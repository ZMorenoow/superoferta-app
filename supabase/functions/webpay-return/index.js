import { createClient } from 'npm:@supabase/supabase-js@2';

const RESULT_URL = Deno.env.get('PAGO_RESULT_URL') ?? 'https://superoferta.local/pago-resultado';

const redirect = (estado, idPedido) => {
  const url = new URL(RESULT_URL);
  url.searchParams.set('estado', estado);
  if (idPedido) url.searchParams.set('pedido', idPedido);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
};


const liberarPedido = async (admin, idPedido) => {
  const { error } = await admin.rpc('liberar_pedido', { p_pedido: idPedido });
  if (error) console.error('No se pudo liberar el pedido', idPedido, error);
};


const anularPagoIniciado = async (admin, columna, valor) => {
  const { error } = await admin
    .from('pagos')
    .update({ estado: 'anulado' })
    .eq(columna, valor)
    .eq('estado', 'iniciado');
  if (error) console.error('No se pudo anular el pago', columna, valor, error);
};

const vaciarCarrito = async (admin, idPedido) => {
  try {
    const { data: pedido } = await admin
      .from('pedidos')
      .select('id_cliente')
      .eq('id', idPedido)
      .maybeSingle();
    if (!pedido?.id_cliente) return;

    const { data: carritos } = await admin
      .from('carrito')
      .select('id')
      .eq('id_cliente', pedido.id_cliente);
    const ids = (carritos ?? []).map((c) => c.id);
    if (ids.length === 0) return;

    const { error } = await admin.from('carrito_items').delete().in('id_carrito', ids);
    if (error) console.error('No se pudo vaciar el carrito', idPedido, error);
  } catch (err) {
    console.error('Error vaciando el carrito', idPedido, err);
  }
};

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const TBK_COMMERCE_CODE = Deno.env.get('TBK_COMMERCE_CODE');
  const TBK_API_SECRET = Deno.env.get('TBK_API_SECRET');
  const TBK_BASE_URL = Deno.env.get('TBK_BASE_URL');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);


  const params = Object.fromEntries(new URL(req.url).searchParams);
  if (req.method === 'POST') {
    try {
      const form = await req.formData();
      for (const [clave, valor] of form.entries()) params[clave] = String(valor);
    } catch (_) {

    }
  }
  const { token_ws, TBK_TOKEN, TBK_ID_SESION } = params;

  try {
    if (TBK_TOKEN) {
      const { data: pago } = await admin
        .from('pagos')
        .select('id_pedido')
        .eq('token_transbank', TBK_TOKEN)
        .maybeSingle();
      const idPedido = pago?.id_pedido ?? TBK_ID_SESION;
      if (idPedido) await liberarPedido(admin, idPedido);
      await anularPagoIniciado(admin, 'token_transbank', TBK_TOKEN);
      return redirect('cancelado', idPedido);
    }

    if (!token_ws) {
      if (TBK_ID_SESION) {
        await liberarPedido(admin, TBK_ID_SESION);
        await anularPagoIniciado(admin, 'id_pedido', TBK_ID_SESION);
        return redirect('expirado', TBK_ID_SESION);
      }
      return redirect('error');
    }

    const { data: pago } = await admin
      .from('pagos')
      .select('id, id_pedido, monto, estado, orden_compra')
      .eq('token_transbank', token_ws)
      .maybeSingle();

    if (!pago) return redirect('error');


    if (pago.estado !== 'iniciado') return redirect(pago.estado, pago.id_pedido);

    const tbkRes = await fetch(
      `${TBK_BASE_URL}/rswebpaytransaction/api/webpay/v1.2/transactions/${token_ws}`,
      {
        method: 'PUT',
        headers: {
          'Tbk-Api-Key-Id': TBK_COMMERCE_CODE,
          'Tbk-Api-Key-Secret': TBK_API_SECRET,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!tbkRes.ok) {
      console.error('Transbank commit falló', tbkRes.status, await tbkRes.text());
      return redirect('error', pago.id_pedido);
    }
    const tbk = await tbkRes.json();

    const aprobado =
      tbk.status === 'AUTHORIZED' &&
      tbk.response_code === 0 &&
      tbk.amount === pago.monto &&
      tbk.buy_order === pago.orden_compra;

    if (tbk.status === 'AUTHORIZED' && !aprobado) {
      console.error('Pago autorizado pero los datos no coinciden', { pago, tbk });
    }

    await admin
      .from('pagos')
      .update({
        estado: aprobado ? 'autorizado' : 'rechazado',
        codigo_autorizacion: tbk.authorization_code ?? null,
        tipo_pago: tbk.payment_type_code ?? null,
        numero_cuotas: tbk.installments_number ?? null,
        respuesta_codigo: tbk.response_code != null ? String(tbk.response_code) : null,
        fecha_pago: tbk.transaction_date ?? null,
      })
      .eq('id', pago.id);

    if (aprobado) {
      const { data: actualizado } = await admin
        .from('pedidos')
        .update({ estado: 'pagado', updated_at: new Date().toISOString() })
        .eq('id', pago.id_pedido)
        .eq('estado', 'pendiente')
        .select('id');
      if (!actualizado || actualizado.length === 0) {
        console.error('Pago autorizado, pero el pedido ya no estaba pendiente. Revisar a mano.', pago);
      }


      await vaciarCarrito(admin, pago.id_pedido);
    } else {
      await liberarPedido(admin, pago.id_pedido);
    }

    return redirect(aprobado ? 'autorizado' : 'rechazado', pago.id_pedido);
  } catch (err) {
    console.error('webpay-return error', err);
    return redirect('error');
  }
});