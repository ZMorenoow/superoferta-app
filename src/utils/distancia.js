// Distancia en línea recta entre dos puntos (fórmula de Haversine), en km.
const RADIO_TIERRA_KM = 6371;

// Las calles dan más vuelta que la línea recta; se usa para estimar la ruta real.
const FACTOR_RUTA = 1.3;

// Velocidades promedio en ciudad, en km/h
const VELOCIDAD_KMH = { pie: 5, auto: 30 };

const aRadianes = (grados) => (grados * Math.PI) / 180;

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const dLat = aRadianes(lat2 - lat1);
  const dLon = aRadianes(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) * Math.sin(dLon / 2) ** 2;

  return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 0.85 -> "850 m"   |   3.24 -> "3,2 km"   |   null -> ""
export function formatearDistancia(km) {
  if (km === null || km === undefined || Number.isNaN(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

// Minutos aproximados para recorrer la distancia ('pie' o 'auto'). Devuelve null si no hay distancia.
export function estimarMinutos(km, modo) {
  if (km === null || km === undefined || Number.isNaN(km)) return null;
  const velocidad = VELOCIDAD_KMH[modo];
  if (!velocidad) return null;
  const horas = (km * FACTOR_RUTA) / velocidad;
  return Math.max(1, Math.round(horas * 60));
}

// 7 -> "7 min"   |   65 -> "1 h 5 min"   |   120 -> "2 h"
export function formatearDuracion(minutos) {
  if (minutos === null || minutos === undefined) return '';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}