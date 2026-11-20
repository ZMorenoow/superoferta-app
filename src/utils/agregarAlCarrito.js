import { supabase } from './supabase';

export async function agregarAlCarrito(item) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'login';

  let { data: carrito } = await supabase
    .from('carrito')
    .select('id')
    .eq('id_cliente', user.id)
    .maybeSingle();

  if (!carrito) {
    const { data: nuevo, error } = await supabase
      .from('carrito')
      .insert({ id_cliente: user.id })
      .select('id')
      .single();
    if (error) return 'error';
    carrito = nuevo;
  }

  const { data: itemExistente } = await supabase
    .from('carrito_items')
    .select('id, cantidad')
    .eq('id_carrito', carrito.id)
    .eq('id_producto', item.id)
    .maybeSingle();

  if (itemExistente) {
    const { error } = await supabase
      .from('carrito_items')
      .update({ cantidad: itemExistente.cantidad + 1 })
      .eq('id', itemExistente.id);
    return error ? 'error' : 'ok';
  }

  const { error } = await supabase.from('carrito_items').insert({
    id_carrito: carrito.id,
    id_producto: item.id,
    cantidad: 1,
    precio_unitario: item.price,
  });
  return error ? 'error' : 'ok';
}