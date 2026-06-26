/* Point-in-polygon (ray casting). Puro, sin DOM → usable en el navegador y testeable en node.
   pt = [lng, lat] (orden GeoJSON). */
export function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const hit = (yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function pipFeature(pt, geom) {
  if (!geom) return false;
  if (geom.type === "Polygon") return pointInRing(pt, geom.coordinates[0]);
  if (geom.type === "MultiPolygon") return geom.coordinates.some((poly) => pointInRing(pt, poly[0]));
  return false;
}
