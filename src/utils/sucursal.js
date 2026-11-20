import { supabase } from './supabase';

// Sucursal preferida del usuario. Devuelve null si no hay sesión o no eligió una.
export async function obtenerSucursalPreferida() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id_sucursal_preferida')
    .eq('id', user.id)
    .single();

  return perfil?.id_sucursal_preferida ?? null;
}

// Sucursal "efectiva": la preferida o, si no hay, la sucursal por defecto.
export async function obtenerSucursalId() {
  let idSucursal = await obtenerSucursalPreferida();

  if (!idSucursal) {
    idSucursal = await obtenerSucursalDefaultId();
  }

  return idSucursal;
}

export async function obtenerSucursalDefaultId() {
  const { data: sucursalDefault } = await supabase
    .from('sucursales')
    .select('id')
    .eq('nombre', 'Super Oferta Los Pablos')
    .single();

  return sucursalDefault?.id ?? null;
}