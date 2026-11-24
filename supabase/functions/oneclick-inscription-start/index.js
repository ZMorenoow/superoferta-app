import { corsHeaders, getClients, json, tbkFetch } from '../_shared/oneclick.js';
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST')
        return json({ error: 'Método no permitido' }, 405);
    try {
        const { url, userClient, admin } = getClients(req);
        const { data: auth, error: authError } = await userClient.auth.getUser();
        if (authError || !auth.user)
            return json({ error: 'No autenticado' }, 401);
        const user = auth.user;
        if (!user.email)
            return json({ error: 'La cuenta no tiene un correo electrónico' }, 400);
        const { data: existing, error: existingError } = await admin
            .from('oneclick_tarjetas').select('id, activo').eq('id_cliente', user.id).maybeSingle();
        if (existingError)
            throw existingError;
        if (existing?.activo)
            return json({ error: 'Ya tienes una tarjeta Oneclick inscrita. Elimínala antes de registrar otra.' }, 409);
        const responseUrl = `${url}/functions/v1/oneclick-inscription-return`;
        const username = user.id; // UUID estable y único por usuario; el mismo se usa al pagar y borrar.
        const { data } = await tbkFetch('/rswebpaytransaction/api/oneclick/v1.2/inscriptions', 'POST', {
            username,
            email: user.email,
            response_url: responseUrl,
        });
        if (!data?.token || !data?.url_webpay)
            throw new Error('Transbank no devolvió token/url_webpay válidos');
        const { error: pendingError } = await admin.from('oneclick_inscripciones').insert({
            token: data.token,
            id_cliente: user.id,
            username,
            estado: 'iniciada',
        });
        if (pendingError)
            throw pendingError;
        return json({ url: data.url_webpay, token: data.token });
    }
    catch (error) {
        console.error('oneclick-inscription-start:', error);
        return json({ error: error instanceof Error ? error.message : 'No se pudo iniciar la inscripción' }, 500);
    }
});
