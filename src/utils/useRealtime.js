import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

let contador = 0;

/**
 * Ejecuta `onCambio` cada vez que cambia alguna de las tablas indicadas.
 *
 *   useRealtime('mi-pantalla', [
 *     { table: 'sustituciones' },
 *     { table: 'pedido_items', filter: `id_pedido=eq.${pedido}` },
 *   ], cargar);
 *
 * Respeta RLS: solo llegan eventos de filas que el usuario puede ver.
 * Agrupa ráfagas de eventos (250 ms) para no recargar de más.
 */
export function useRealtime(nombre, suscripciones, onCambio, activo = true) {
  const callback = useRef(onCambio);
  callback.current = onCambio;
  const clave = JSON.stringify(suscripciones);

  useEffect(() => {
    if (!activo) return;

    let timer;
    const disparar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current?.(), 250);
    };

    let canal = supabase.channel(`${nombre}-${++contador}`);
    suscripciones.forEach(({ table, filter }) => {
      canal = canal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        disparar
      );
    });
    canal.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [nombre, clave, activo]);
}