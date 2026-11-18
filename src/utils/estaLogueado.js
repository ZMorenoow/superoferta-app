import { supabase } from './supabase';

// Lee la sesión local (rápido, no depende de la red)
export async function estaLogueado() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}