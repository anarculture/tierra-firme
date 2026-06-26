/* Jitter determinista para marcadores de ubicación aproximada (centroide de estado).
   Mismo seed → mismo punto; dispersa dentro de ~km del centroide para que no se apilen. Puro. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function jitter(lat, lng, seed, km = 22) {
  const h = hash(String(seed));
  const ang = (h % 360) * Math.PI / 180;
  const dist = (((h >>> 9) % 1000) / 1000) * km; // 0..km determinista
  const dLat = (dist * Math.cos(ang)) / 111;
  const dLng = (dist * Math.sin(ang)) / (111 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}
