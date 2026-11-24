import { corsHeaders, getClients, json, tbkFetch } from '../_shared/oneclick.js';
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST' && req.method !== 'DELETE')
        return json({ error: 'Método no permitido' }, 405);
    try {
        const { userClient, admin } = getClients(req);
        const { data: auth, error: authError } = await userClient.auth.getUser();
        if (authError || !auth.user)
            return json({ error: 'No autenticado' }, 401);
        const { data: card, error: cardError } = await admin.from('oneclick_tarjetas')
            .select('id, username, tbk_user').eq('id_cliente', auth.user.id).eq('activo', true).maybeSingle();
        if (cardError)
            throw cardError;
        if (!card)
            return json({ error: 'No tienes una tarjeta Oneclick inscrita' }, 404);
        await tbkFetch('/rswebpaytransaction/api/oneclick/v1.2/inscriptions', 'DELETE', {
            tbk_user: card.tbk_user,
            username: card.username,
        });
        const { error: deleteError } = await admin.from('oneclick_tarjetas')
            .update({ activo: false, updated_at: new Date().toISOString() }).eq('id', card.id);
        if (deleteError)
            throw deleteError;
        return json({ ok: true, message: 'Tarjeta eliminada de Oneclick' });
    }
    catch (error) {
        console.error('oneclick-card-delete:', error);
        return json({ error: error instanceof Error ? error.message : 'No se pudo eliminar la tarjeta' }, 500);
    }
});
