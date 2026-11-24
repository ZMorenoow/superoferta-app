import { getClients, getRequestParams, html, tbkFetch } from '../_shared/oneclick.js';

Deno.serve(async (req) => {
    if (req.method !== 'GET' && req.method !== 'POST')
        return html('Inscripción Oneclick', 'Método no permitido.', 405);

    // true una vez que esta ejecución "reclamó" la inscripción (estado -> procesando)
    let reclamada = false;
    let admin;
    let token;

    try {
        ({ admin } = getClients(req));
        const params = await getRequestParams(req);
        token = params.TBK_TOKEN ?? params.tbk_token;

        if (!token)
            return html('Inscripción no completada', 'No recibimos el identificador de Transbank.', 400);

        const { data: pending, error: pendingError } = await admin
            .from('oneclick_inscripciones')
            .select('token, id_cliente, username, estado')
            .eq('token', token)
            .maybeSingle();
        if (pendingError)
            throw pendingError;
        if (!pending)
            return html('Inscripción no encontrada', 'No encontramos una inscripción pendiente para este retorno.', 404);

        if (pending.estado === 'completada')
            return html('Tarjeta inscrita', 'Tu tarjeta ya quedó registrada correctamente.');
        if (pending.estado === 'procesando')
            return html('Confirmando tarjeta', 'Estamos confirmando tu tarjeta. Ya puedes volver a la app.');
        if (pending.estado !== 'pendiente')
            return html('No se pudo inscribir la tarjeta', 'Esta inscripción ya no es válida. Puedes volver a intentarlo desde SuperOferta.', 400);

        // Se reclama el token de forma atómica: si llegan dos requests a la vez
        // (doble GET, reintento del WebView), solo una pasa y llama a Transbank.
        // Transbank solo deja confirmar cada token una vez.
        const { data: claim, error: claimError } = await admin
            .from('oneclick_inscripciones')
            .update({ estado: 'procesando' })
            .eq('token', token)
            .eq('estado', 'pendiente')
            .select('token');
        if (claimError)
            throw claimError;
        if (!claim?.length)
            return html('Confirmando tarjeta', 'Estamos confirmando tu tarjeta. Ya puedes volver a la app.');
        reclamada = true;

        // Transbank exige PUT con body vacío para confirmar la inscripción.
        const { data } = await tbkFetch(`/rswebpaytransaction/api/oneclick/v1.2/inscriptions/${encodeURIComponent(token)}`, 'PUT', {});

        if (data?.response_code !== 0 || !data?.tbk_user) {
            await admin.from('oneclick_inscripciones').update({ estado: 'rechazada' }).eq('token', token);
            reclamada = false;
            return html('No se pudo inscribir la tarjeta', 'Transbank no aprobó la inscripción. Puedes volver a intentarlo desde SuperOferta.', 400);
        }

        const { error: cardError } = await admin.from('oneclick_tarjetas').upsert({
            id_cliente: pending.id_cliente,
            username: pending.username,
            tbk_user: data.tbk_user,
            card_type: data.card_type ?? null,
            card_number_last4: typeof data.card_number === 'string' ? data.card_number.slice(-4) : null,
            activo: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id_cliente' });
        if (cardError)
            throw cardError;

        const { error: updateError } = await admin.from('oneclick_inscripciones')
            .update({ estado: 'completada' }).eq('token', token);
        if (updateError)
            throw updateError;
        reclamada = false;

        return html('¡Tarjeta inscrita!', `Tu tarjeta ${data.card_type ?? ''} terminada en ${String(data.card_number ?? '').slice(-4)} quedó registrada correctamente.`);
    }
    catch (error) {
        console.error('oneclick-inscription-return:', error);

        // Si falló después de reclamar, no se deja "procesando" para siempre
        if (reclamada && admin && token) {
            await admin.from('oneclick_inscripciones')
                .update({ estado: 'error' }).eq('token', token);
        }

        return html('Error en la inscripción', 'No pudimos confirmar la inscripción. Contacta soporte antes de volver a intentarlo.', 500);
    }
});