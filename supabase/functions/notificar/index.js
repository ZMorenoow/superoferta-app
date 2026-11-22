// supabase/functions/notificar/index.js
// La invocan los Database Webhooks de "sustituciones" y "pedidos".
import { createClient } from 'npm:@supabase/supabase-js@2';

async function enviarPush(admin, userId, { title, body, data }) {
  if (!userId) {
    console.log(`[push] "${title}": no hay destinatario, no se envía`);
    return;
  }

  const { data: perfil, error } = await admin
    .from('perfiles').select('push_token').eq('id', userId).maybeSingle();
  if (error) console.error('[push] error leyendo el token:', error.message);

  const token = perfil?.push_token;
  if (!token) {
    console.log(`[push] "${title}": el usuario ${userId} no tiene push_token, no se envía`);
    return;
  }

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: token, title, body, data, sound: 'default', channelId: 'default', priority: 'high',
    }),
  });
  const json = await res.json().catch(() => null);
  console.log(
    `[push] "${title}" -> usuario ${userId} (${token.slice(0, 22)}…) | HTTP ${res.status} | Expo: ${JSON.stringify(json)}`,
  );

  // Token inválido (app desinstalada): lo borramos
  if (json?.data?.status === 'error' && json.data.details?.error === 'DeviceNotRegistered') {
    console.log(`[push] token inválido para ${userId}, se borra`);
    await admin.from('perfiles').update({ push_token: null }).eq('id', userId);
  }
}

// El picker puede estar en pedidos.id_picker o, con la asignación automática, en pedido_picker
async function pickerDelPedido(admin, idPedido, idPickerEnPedido) {
  if (idPickerEnPedido) return idPickerEnPedido;

  const { data } = await admin
    .from('pedido_picker')
    .select('id_picker')
    .eq('id_pedido', idPedido)
    .order('fecha_asignacion', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id_picker ?? null;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const { type, table, record, old_record: antes } = await req.json();
    console.log(`[notificar] ${type} en ${table}`);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    // ---- Sustituciones ----------------------------------------------------
    if (table === 'sustituciones') {
      const { data: item } = await admin
        .from('pedido_items')
        .select('id_pedido, productos(nombre), pedidos(id_cliente, id_picker)')
        .eq('id', record.id_item)
        .maybeSingle();
      if (!item) return new Response('ok');

      const nombre = item.productos?.nombre ?? 'un producto';

      // El preparador propone un reemplazo -> avisar al cliente
      if (type === 'INSERT' && record.estado === 'propuesta') {
        await enviarPush(admin, item.pedidos?.id_cliente, {
          title: 'Un producto no está disponible',
          body: `Te sugerimos un reemplazo para ${nombre}. Acéptalo o recházalo.`,
          data: { ruta: '/sustitucion', params: { pedido: String(item.id_pedido) } },
        });
      }

      // El cliente responde -> avisar al preparador
      if (type === 'UPDATE' && antes?.estado === 'propuesta' && record.estado !== 'propuesta') {
        const acepto = ['aceptada', 'aceptado'].includes(record.estado);
        const idPicker = await pickerDelPedido(admin, item.id_pedido, item.pedidos?.id_picker);
        await enviarPush(admin, idPicker, {
          title: acepto ? 'Reemplazo aceptado' : 'Reemplazo rechazado',
          body: acepto
            ? `El cliente aceptó el reemplazo de ${nombre}.`
            : `El cliente rechazó el reemplazo de ${nombre}.`,
          data: { ruta: '/picker' },
        });
      }
    }

    // ---- Pedidos ----------------------------------------------------------
    if (table === 'pedidos' && type === 'UPDATE') {
      // Pedido listo -> cliente
      if (antes?.estado !== record.estado && record.estado === 'completado') {
        await enviarPush(admin, record.id_cliente, {
          title: '¡Tu pedido está listo!',
          body: `Retíralo en la sucursal. Tu código de retiro es ${record.codigo_retiro}.`,
          data: { ruta: '/(tabs)' },
        });
      }

      // Pedido asignado a un preparador -> preparador
      const pasoAAsignado = antes?.estado !== record.estado && record.estado === 'asignado';
      const cambioPicker = record.id_picker && antes?.id_picker !== record.id_picker;

      if (pasoAAsignado || cambioPicker) {
        const idPicker = await pickerDelPedido(admin, record.id, record.id_picker);
        await enviarPush(admin, idPicker, {
          title: 'Nuevo pedido asignado',
          body: `Pedido #${String(record.id).slice(0, 8).toUpperCase()}: tienes un pedido nuevo por preparar.`,
          data: { ruta: '/picker' },
        });
      }
    }

    return new Response('ok');
  } catch (err) {
    console.error(err);
    return new Response('error', { status: 500 });
  }
});