// supabase/functions/enviar-oferta/index.js
// Envía una oferta a todos los clientes: guarda la notificación en la app
// y manda el push por Expo. Solo la puede usar un usuario con rol 'admin'.
//
// Desplegar:  supabase functions deploy enviar-oferta
// (SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya vienen incluidas)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const trozos = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // 1) Quién llama
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'No autenticado' }, 401);

    const admin = createClient(url, service);

    // 2) Debe ser admin
    const { data: yo } = await admin
      .from('perfiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single();
    if (yo?.rol !== 'admin' || yo?.activo === false) {
      return json({ error: 'No autorizado' }, 403);
    }

    // 3) Datos del mensaje
    const body = await req.json();
    const titulo = String(body?.titulo ?? '').trim();
    const mensaje = String(body?.mensaje ?? '').trim();
    if (!titulo || !mensaje) return json({ error: 'Falta el título o el mensaje' }, 400);
    if (titulo.length > 60 || mensaje.length > 180) {
      return json({ error: 'Título máx. 60 y mensaje máx. 180 caracteres' }, 400);
    }

    // 4) Destinatarios: todos los clientes activos
    const { data: clientes, error: errCli } = await admin
      .from('perfiles')
      .select('id, expo_push_token')
      .eq('rol', 'cliente')
      .or('activo.is.null,activo.eq.true');
    if (errCli) throw errCli;
    const lista = clientes ?? [];

    // 5) Notificación dentro de la app
    for (const grupo of trozos(lista, 500)) {
      const { error } = await admin.from('notificaciones').insert(
        grupo.map((c) => ({ id_usuario: c.id, titulo, mensaje, tipo: 'oferta' })),
      );
      if (error) throw error;
    }

    // 6) Push por Expo (de a 100)
    const tokens = lista
      .map((c) => c.expo_push_token)
      .filter((t) => !!t && t.startsWith('ExponentPushToken'));

    let enviados = 0;
    for (const grupo of trozos(tokens, 100)) {
      const r = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          grupo.map((to) => ({
            to, title: titulo, body: mensaje, sound: 'default', data: { tipo: 'oferta' },
          })),
        ),
      });
      if (r.ok) enviados += grupo.length;
    }

    return json({ clientes: lista.length, push_enviados: enviados });
  } catch (e) {
    return json({ error: e?.message ?? 'Error inesperado' }, 500);
  }
});