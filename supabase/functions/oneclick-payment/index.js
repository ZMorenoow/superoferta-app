import { corsHeaders, generarOrden, getClients, getOneclickConfig, json, tbkFetch } from '../_shared/oneclick.js';
const vaciarCarrito = async (admin, idPedido) => {
    const { data: pedido, error: pedidoError } = await admin.from('pedidos')
        .select('id_cliente').eq('id', idPedido).maybeSingle();
    if (pedidoError)
        throw pedidoError;
    if (!pedido?.id_cliente)
        return;
    const { data: carritos, error: carritoError } = await admin.from('carrito')
        .select('id').eq('id_cliente', pedido.id_cliente);
    if (carritoError)
        throw carritoError;
    const ids = (carritos ?? []).map((item) => item.id);
    if (!ids.length)
        return;
    const { error } = await admin.from('carrito_items').delete().in('id_carrito', ids);
    if (error)
        throw error;
};
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST')
        return json({ error: 'Método no permitido' }, 405);
    try {
        const { userClient, admin } = getClients(req);
        const { data: auth, error: authError } = await userClient.auth.getUser();
        if (authError || !auth.user)
            return json({ error: 'No autenticado' }, 401);
        const user = auth.user;
        const body = await req.json();
        const idPedido = body?.id_pedido;
        if (typeof idPedido !== 'string' || !idPedido)
            return json({ error: 'Falta id_pedido' }, 400);
        const cfg = getOneclickConfig();
        const { data: pedido, error: pedidoError } = await admin.from('pedidos')
            .select('id, id_cliente, estado, total').eq('id', idPedido).maybeSingle();
        if (pedidoError)
            throw pedidoError;
        if (!pedido || pedido.id_cliente !== user.id)
            return json({ error: 'Pedido no encontrado' }, 404);
        if (pedido.estado !== 'pendiente')
            return json({ error: 'El pedido no está pendiente de pago' }, 409);
        if (!Number.isSafeInteger(pedido.total) || pedido.total <= 0)
            return json({ error: 'El total del pedido no es válido' }, 400);
        const { data: paid, error: paidError } = await admin.from('pagos')
            .select('id').eq('id_pedido', idPedido).eq('estado', 'autorizado').limit(1);
        if (paidError)
            throw paidError;
        if (paid?.length)
            return json({ error: 'Este pedido ya tiene un pago autorizado' }, 409);
        const { data: card, error: cardError } = await admin.from('oneclick_tarjetas')
            .select('username, tbk_user').eq('id_cliente', user.id).eq('activo', true).maybeSingle();
        if (cardError)
            throw cardError;
        if (!card)
            return json({ error: 'No tienes una tarjeta Oneclick inscrita' }, 409);
        const parentBuyOrder = generarOrden('SOM');
        const childBuyOrder = generarOrden('SOS');
        const { data: reserved, error: reserveError } = await admin.rpc('reservar_oneclick_intento', {
            p_id_pedido: idPedido,
            p_id_cliente: user.id,
            p_parent_buy_order: parentBuyOrder,
            p_detail_buy_order: childBuyOrder,
            p_commerce_code: cfg.storeCode,
            p_amount: pedido.total,
        });
        if (reserveError)
            throw reserveError;
        if (!reserved?.ok)
            return json({ error: reserved?.error ?? 'No se pudo reservar el intento de pago' }, 409);
        let result;
        try {
            const response = await tbkFetch('/rswebpaytransaction/api/oneclick/v1.2/transactions', 'POST', {
                username: card.username,
                tbk_user: card.tbk_user,
                buy_order: parentBuyOrder,
                details: [{
                        commerce_code: cfg.storeCode,
                        buy_order: childBuyOrder,
                        amount: pedido.total,
                    }],
            });
            result = response.data;
        }
        catch (error) {
            // No se libera el intento automáticamente: si hubo timeout, el cargo podría haberse procesado.
            await admin.from('oneclick_transacciones').update({ estado: 'requiere_revision' })
                .eq('id_pedido', idPedido).eq('parent_buy_order', parentBuyOrder);
            throw error;
        }
        const detail = Array.isArray(result?.details) ? result.details.find((d) => d.buy_order === childBuyOrder) : null;
        const approved = !!detail && detail.response_code === 0 && detail.status === 'AUTHORIZED'
            && Number(detail.amount) === Number(pedido.total)
            && String(detail.commerce_code) === String(cfg.storeCode);
        await admin.from('oneclick_transacciones').update({
            estado: approved ? 'autorizado' : 'rechazado',
            authorization_code: detail?.authorization_code ?? null,
            response_code: detail?.response_code ?? null,
            payment_type_code: detail?.payment_type_code ?? null,
            installments_number: detail?.installments_number ?? 0,
            transaction_date: result?.transaction_date ?? null,
            respuesta: result ?? null,
        }).eq('id_pedido', idPedido).eq('parent_buy_order', parentBuyOrder);
        if (!approved) {
            return json({ ok: false, estado: 'rechazado', response_code: detail?.response_code ?? null,
                message: 'Transbank no autorizó el pago. Puedes intentar nuevamente.' }, 402);
        }
        // Se registra el pago con las columnas ya presentes en public.pagos. token_transbank no aplica a Oneclick.
        const { error: paymentInsertError } = await admin.from('pagos').insert({
            id_pedido: idPedido,
            id_cliente: user.id,
            monto: pedido.total,
            estado: 'autorizado',
            orden_compra: parentBuyOrder,
            codigo_autorizacion: detail.authorization_code ?? null,
            tipo_pago: detail.payment_type_code ?? null,
            numero_cuotas: detail.installments_number ?? 0,
            respuesta_codigo: String(detail.response_code),
            fecha_pago: result?.transaction_date ?? new Date().toISOString(),
        });
        if (paymentInsertError) {
            await admin.from('oneclick_transacciones').update({ estado: 'autorizado_pendiente_registro_pago' })
                .eq('id_pedido', idPedido).eq('parent_buy_order', parentBuyOrder);
            console.error('Cargo aprobado pero no se pudo insertar en pagos', paymentInsertError);
            return json({ ok: false, estado: 'requiere_revision', message: 'El cargo fue autorizado, pero no pudimos actualizar el pedido. Contacta soporte.' }, 500);
        }
        const { data: updatedOrder, error: orderUpdateError } = await admin.from('pedidos')
            .update({ estado: 'pagado', updated_at: new Date().toISOString() })
            .eq('id', idPedido).eq('estado', 'pendiente').select('id');
        if (orderUpdateError || !updatedOrder?.length) {
            await admin.from('oneclick_transacciones').update({ estado: 'autorizado_pedido_pendiente_revision' })
                .eq('id_pedido', idPedido).eq('parent_buy_order', parentBuyOrder);
            console.error('Cargo autorizado, pedido no pudo cambiar a pagado', orderUpdateError);
            return json({ ok: false, estado: 'requiere_revision', message: 'El pago fue autorizado y requiere revisión del pedido.' }, 500);
        }
        await vaciarCarrito(admin, idPedido);
        const { error: couponError } = await admin.rpc('marcar_cupon_usado', { p_pedido: idPedido });
        if (couponError)
            console.error('No se pudo marcar cupón usado', couponError);
        return json({ ok: true, estado: 'autorizado', id_pedido: idPedido,
            codigo_autorizacion: detail.authorization_code ?? null,
            card_number: result?.card_detail?.card_number ?? null });
    }
    catch (error) {
        console.error('oneclick-payment:', error);
        return json({ error: error instanceof Error ? error.message : 'No se pudo procesar el pago' }, 500);
    }
});
