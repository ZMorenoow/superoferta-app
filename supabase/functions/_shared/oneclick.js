import { createClient } from 'npm:@supabase/supabase-js@2';
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
};
export const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
export const html = (title, message, status = 200) => new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;padding:32px 20px;text-align:center;color:#222}h2{color:#C21807}p{line-height:1.5}</style></head><body><h2>${title}</h2><p>${message}</p><p>Ya puedes volver a SuperOferta.</p></body></html>`, { status, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
export const env = (name) => {
    const value = Deno.env.get(name);
    if (!value)
        throw new Error(`Falta configurar el secreto ${name}`);
    return value;
};
export const getClients = (req) => {
    const url = env('SUPABASE_URL');
    const anon = env('SUPABASE_ANON_KEY');
    const service = env('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return { url, userClient, admin };
};
export const getOneclickConfig = () => ({
    // En integración: https://webpay3gint.transbank.cl
    // En producción: https://webpay3g.transbank.cl (solo después de la certificación).
    baseUrl: (Deno.env.get('TBK_ONECLICK_BASE_URL') ?? 'https://webpay3gint.transbank.cl').replace(/\/$/, ''),
    mallCode: env('TBK_ONECLICK_MALL_COMMERCE_CODE'),
    apiSecret: env('TBK_ONECLICK_API_SECRET'),
    storeCode: env('TBK_ONECLICK_STORE_COMMERCE_CODE'),
});
export const tbkFetch = async (path, method, body) => {
    const cfg = getOneclickConfig();
    const response = await fetch(`${cfg.baseUrl}${path}`, {
        method,
        headers: {
            'Tbk-Api-Key-Id': cfg.mallCode,
            'Tbk-Api-Key-Secret': cfg.apiSecret,
            'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    let data = null;
    if (raw) {
        try {
            data = JSON.parse(raw);
        }
        catch {
            data = { raw };
        }
    }
    if (!response.ok) {
        console.error('Error API Oneclick', response.status, data);
        throw new Error(data?.error_message ?? `Transbank respondió HTTP ${response.status}`);
    }
    return { status: response.status, data };
};
export const generarOrden = (prefijo) => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    return `${prefijo}${timestamp}${random}`.slice(0, 26);
};
export const getRequestParams = async (req) => {
    const params = Object.fromEntries(new URL(req.url).searchParams.entries());
    if (req.method === 'POST') {
        const contentType = req.headers.get('content-type') ?? '';
        if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
            const form = await req.formData();
            for (const [key, value] of form.entries())
                params[key] = String(value);
        }
    }
    return params;
};
