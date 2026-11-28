import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

// Devuelve la ubicación del cliente { latitude, longitude } o null si no está disponible.
export default function useUbicacion() {
  const [ubicacion, setUbicacion] = useState(null);
  const [permisoDenegado, setPermisoDenegado] = useState(false);

  useEffect(() => {
    let activo = true;

    const pedirUbicacion = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (activo) setPermisoDenegado(true);
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (activo) {
          setUbicacion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch (err) {
        console.warn('No se pudo obtener la ubicación', err);
      }
    };

    pedirUbicacion();

    return () => {
      activo = false;
    };
  }, []);

  return { ubicacion, permisoDenegado };
}