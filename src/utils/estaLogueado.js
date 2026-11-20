import { supabase } from './supabase';

export async function estaLogueado() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}