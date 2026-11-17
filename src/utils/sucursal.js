import { supabase } from './supabase';

export async function obtenerSucursalId() {
  const { data: { user } } = await supabase.auth.getUser();
  let idSucursal = null;

  if (user) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('id_sucursal_preferida')
      .eq('id', user.id)
      .single();
    idSucursal = perfil?.id_sucursal_preferida ?? null;
  }

  if (!idSucursal) {
    const { data: sucursalDefault } = await supabase
      .from('sucursales')
      .select('id')
      .eq('nombre', 'Super Oferta Los Pablos')
      .single();
    idSucursal = sucursalDefault?.id ?? null;
  }

  return idSucursal;
}