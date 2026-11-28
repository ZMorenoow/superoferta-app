// supabase/functions/enviar-reporte/index.js
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

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fila = (label, valor) => `
  <tr>
    <td style="padding:9px 0;color:#6B7280;font-size:13px;width:105px;vertical-align:top;border-bottom:1px solid #F1F2F4">${label}</td>
    <td style="padding:9px 0;color:#16181D;font-size:14px;font-weight:600;border-bottom:1px solid #F1F2F4">${valor}</td>
  </tr>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: 'No autorizado' }, 401);

    const { categoria, asunto, descripcion, pedido } = await req.json();
    if (!asunto || !descripcion) return json({ error: 'Faltan datos' }, 400);

    // Datos del picker desde la base, no desde lo que mande el cliente
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('nombre, apellido, sucursales(nombre)')
      .eq('id', user.id)
      .single();

    const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ') || 'Sin nombre';
    const sucursal = perfil?.sucursales?.nombre ?? 'Sin sucursal';
    const asuntoCorto = String(asunto).slice(0, 100);
    const fecha = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

    const html = `
<div style="background:#F3F4F6;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <div style="background:#9B1C1C;padding:28px 24px;text-align:center">
      <img src="https://pnhwofjsmqrmcdrsfpxg.supabase.co/storage/v1/object/public/Fotos%20de%20gmail/unnamed.png" width="140" alt="SuperOferta" style="display:block;margin:0 auto;border:0;height:auto">
      <div style="font-size:13px;color:#FFE3DF;margin-top:8px">Tus ofertas, a un toque</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:16px">Nuevo reporte</div>
    </div>
    <div style="padding:24px">
      <div style="font-size:18px;font-weight:700;color:#16181D;margin-bottom:14px">${esc(asuntoCorto)}</div>
      <table style="width:100%;border-collapse:collapse">
        ${fila('Picker', `${esc(nombre)}<br><span style="font-weight:400;color:#6B7280">${esc(user.email)}</span>`)}
        ${fila('Sucursal', esc(sucursal))}
        ${fila('Categoría', esc(categoria || '-'))}
        ${fila('Pedido', esc(pedido || '-'))}
        ${fila('Fecha', esc(fecha))}
      </table>
      <div style="margin-top:20px;padding:16px;background:#F9FAFB;border-left:4px solid #ED1D26;border-radius:8px;white-space:pre-wrap;color:#16181D;font-size:14px;line-height:1.55">${esc(String(descripcion).slice(0, 500))}</div>
      <p style="margin:20px 0 0;color:#9AA0A8;font-size:12px">Puedes responder a este correo para escribirle directamente al picker.</p>
    </div>
  </div>
</div>`;

    const res = await fetch(Deno.env.get('APPS_SCRIPT_URL'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secreto: Deno.env.get('APPS_SCRIPT_SECRET'),
        subject: `[Picker] ${asuntoCorto}`,
        replyTo: user.email,
        html,
      }),
    });

    const resultado = await res.json().catch(() => null);
    if (!res.ok || !resultado?.ok) {
      return json({ error: resultado?.error ?? 'Falló el envío' }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});