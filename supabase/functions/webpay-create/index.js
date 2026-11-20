import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });


const generarOrdenCompra = () => {
  const tiempo = Date.now().toString(36);
  const azar = Math.random().toString(36).slice(2, 6);
  return `SO${tiempo}${azar}`.slice(0, 26);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const TBK_COMMERCE_CODE = Deno.env.get('TBK_COMMERCE_CODE');
    const TBK_API_SECRET = Deno.env.get('TBK_API_SECRET');
    const TBK_BASE_URL = Deno.env.get('TBK_BASE_URL');


    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401);
    const user = userData.user;


    const { id_pedido } = await req.json();
    if (!id_pedido) return json({ error: 'Falta id_pedido' }, 400);

   
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: pedido, error: pedidoError } = await admin
      .from('pedidos')
      .select('id, id_cliente, estado, total')
      .eq('id', id_pedido)
      .maybeSingle();

    if (pedidoError) {
      console.error('Error leyendo el pedido', pedidoError);

      return json({ error: 'No se pudo leer el pedido', detalle: pedidoError.message }, 500);
    }
    if (!pedido) {
  
      return json({ error: 'Pedido no encontrado', detalle: 'la consulta no devolvió filas' }, 404);
    }
    if (pedido.id_cliente !== user.id) {
      return json(
        { error: 'Pedido no encontrado', detalle: 'el pedido es de otro usuario', usuario: user.id, dueno: pedido.id_cliente },
        404,
      );
    }
    if (pedido.estado !== 'pendiente') {
      return json({ error: 'El pedido no está pendiente de pago' }, 409);
    }
    if (!Number.isInteger(pedido.total) || pedido.total <= 0) {
      return json({ error: 'El total del pedido no es válido' }, 400);
    }

    const ordenCompra = generarOrdenCompra();
    const tbkRes = await fetch(
      `${TBK_BASE_URL}/rswebpaytransaction/api/webpay/v1.2/transactions`,
      {
        method: 'POST',
        headers: {
          'Tbk-Api-Key-Id': TBK_COMMERCE_CODE,
          'Tbk-Api-Key-Secret': TBK_API_SECRET,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buy_order: ordenCompra,
          session_id: pedido.id,
          amount: pedido.total,
          return_url: `${SUPABASE_URL}/functions/v1/webpay-return`,
        }),
      },
    );

    if (!tbkRes.ok) {
      console.error('Transbank create falló', tbkRes.status, await tbkRes.text());
      return json({ error: 'No se pudo iniciar el pago' }, 502);
    }
    const tbk = await tbkRes.json();


    const { error: pagoError } = await admin.from('pagos').insert({
      id_pedido: pedido.id,
      id_cliente: user.id,
      monto: pedido.total,
      estado: 'iniciado',
      token_transbank: tbk.token,
      orden_compra: ordenCompra,
    });
    if (pagoError) {
      console.error('No se pudo guardar el pago', pagoError);
      return json({ error: 'No se pudo registrar el pago' }, 500);
    }

    return json({ url: tbk.url, token: tbk.token });
  } catch (err) {
    console.error('webpay-create error', err);
    return json({ error: 'Error interno' }, 500);
  }
});