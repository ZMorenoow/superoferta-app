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
  }, [ubicacion]);

  return banners;
}