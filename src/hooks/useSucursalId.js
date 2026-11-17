import { useEffect, useState } from 'react';
import { obtenerSucursalId } from '../utils/sucursal';

export default function useSucursalId() {
  const [idSucursal, setIdSucursal] = useState(null);
  const [loadingSucursal, setLoadingSucursal] = useState(true);

  useEffect(() => {
    let cancelled = false;
    obtenerSucursalId().then((id) => {
      if (!cancelled) {
        setIdSucursal(id);
        setLoadingSucursal(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { idSucursal, loadingSucursal };
}