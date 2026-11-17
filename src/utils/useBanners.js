// utils/useBanners.js
// Carga los banners activos desde Supabase ('onboarding' o 'home').
// Si no hay internet, hay un error o todavía no se creó ninguno,
// usa el arreglo `fallback` (por ejemplo MOCK_BANNERS) para que la app nunca quede vacía.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useBanners(ubicacion, fallback = []) {
  const [banners, setBanners] = useState(fallback);

  useEffect(() => {
    let vivo = true;

    (async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('id, titulo, subtitulo, imagen_url, bg, emoji, orden')
        .eq('ubicacion', ubicacion)
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (!vivo) return;
      if (!error && data && data.length > 0) setBanners(data);
    })();

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacion]);

  return banners;
}