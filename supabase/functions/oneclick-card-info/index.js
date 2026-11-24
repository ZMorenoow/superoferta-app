import { corsHeaders, getClients, json } from '../_shared/oneclick.js';
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'GET' && req.method !== 'POST')
        return json({ error: 'Método no permitido' }, 405);
    try {
        const { userClient, admin } = getClients(req);
        const { data: auth, error: authError } = await userClient.auth.getUser();
        if (authError || !auth.user)
            return json({ error: 'No autenticado' }, 401);
        const { data, error } = await admin.from('oneclick_tarjetas')
            .select('card_type, card_number_last4, activo, created_at')
            .eq('id_cliente', auth.user.id).maybeSingle();
        if (error)
            throw error;
        return json({ tarjeta: data?.activo ? data : null });
    }
    catch (error) {
        console.error('oneclick-card-info:', error);
        return json({ error: 'No se pudo consultar la tarjeta' }, 500);
    }
});
