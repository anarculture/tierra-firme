/* Geocodificación de centros de acopio (AyudaVE los entrega con coords:null).
   Cascada: cache → Nominatim (OSM) → centroide de estado → null.
   Nominatim: 1 req/s, User-Agent obligatorio, su ToS EXIGE cachear (data/geocode-cache.json).
   Degrada con gracia: si Nominatim no responde, usa el centroide de estado — el flujo NO depende de la red.
   La llamada en vivo a Nominatim es opt-in via env GEOCODE_NOMINATIM=1 (por defecto OFF: todo cae a
   fallback de estado, instantáneo y determinista). Cada coord lleva { lat, lng, source, confidence }. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const GEOJSON = fileURLToPath(new URL("../../web/ve-estados.geojson", import.meta.url));
const DEFAULT_CACHE = fileURLToPath(new URL("../../data/geocode-cache.json", import.meta.url));
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "monitorVE/0.1 (consola crisis sísmica VE; colectivo.htmk@protonmail.com)";

// Bbox aproximado de Venezuela — valida resultados de Nominatim y centroides.
const VE = { latMin: 0, latMax: 13, lngMin: -74, lngMax: -59 };
const inVE = (lat, lng) =>
  lat >= VE.latMin && lat <= VE.latMax && lng >= VE.lngMin && lng <= VE.lngMax;

// Normaliza nombre de estado: "La Guaira (Vargas)" → "la guaira".
const normEstado = (s) => String(s || "").replace(/\(.*?\)/g, "").trim().toLowerCase();

// Construye la clave de cache de una dirección (estable entre corridas).
export const makeKey = (estado, municipio, address) =>
  `${estado}|${municipio}|${address}`.toLowerCase().trim();

let _centroids = null; // cache en memoria
let _normIndex = null; // nombre-normalizado → {lat,lng}

function exteriorRings(geom) {
  if (geom.type === "Polygon") return [geom.coordinates[0]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((p) => p[0]);
  return [];
}

/** Centroide aproximado por estado = promedio de coords del anillo exterior.
 *  @returns {Record<string,{lat:number,lng:number}>} keyed por el nombre exacto del geojson. */
export function estadoCentroids() {
  if (_centroids) return _centroids;
  const gj = JSON.parse(readFileSync(GEOJSON, "utf8"));
  const out = {};
  for (const f of gj.features) {
    const name = f.properties?.name;
    if (!name) continue;
    let sumLng = 0, sumLat = 0, n = 0;
    for (const ring of exteriorRings(f.geometry)) {
      for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; n++; }
    }
    if (n) out[name] = { lat: sumLat / n, lng: sumLng / n };
  }
  _centroids = out;
  _normIndex = {};
  for (const [name, c] of Object.entries(out)) _normIndex[normEstado(name)] = c;
  return out;
}

function centroidFor(estado) {
  estadoCentroids();
  return _normIndex[normEstado(estado)] || null;
}

async function queryNominatim(address, estado, municipio) {
  const q = [address, municipio, estado, "Venezuela"].filter(Boolean).join(", ");
  const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1`;
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  const lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
  if (isNaN(lat) || isNaN(lng) || !inVE(lat, lng)) return null;
  return { lat, lng };
}

/** Geocodifica una dirección. Cascada: cache → Nominatim → centroide de estado → null.
 *  @param {object} cache  mapa key→coords (mutable; se persiste en enrichCentros)
 *  @param {{networkDown?:boolean,calledNominatim?:boolean}} opts.state  estado compartido del batch
 *  @returns {Promise<{lat:number,lng:number,source:string,confidence:string}|null>} */
export async function geocode(address, estado, municipio, cache = {}, opts = {}) {
  const key = makeKey(estado, municipio, address);
  if (cache[key]) return { ...cache[key] };
  const state = opts.state;
  if (!state?.networkDown) {
    try {
      const hit = await queryNominatim(address, estado, municipio);
      if (state) state.calledNominatim = true; // la petición retornó → respeta 1 req/s
      if (hit) {
        const coords = { lat: hit.lat, lng: hit.lng, source: "nominatim", confidence: "alta" };
        cache[key] = coords;
        return coords;
      }
    } catch {
      if (state) state.networkDown = true; // sin red → fallback para el resto del batch
    }
  }
  const c = centroidFor(estado);
  if (c) return { lat: c.lat, lng: c.lng, source: "estado", confidence: "baja" };
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Geocodifica in-place los centros sin coords; persiste el cache. Devuelve el mismo array.
 *  Nominatim en vivo solo si env GEOCODE_NOMINATIM=1 (si no, todo vía fallback de estado). */
export async function enrichCentros(centros, cacheFile = DEFAULT_CACHE) {
  if (!Array.isArray(centros)) return centros;
  estadoCentroids(); // calienta el índice de centroides
  let cache = {};
  try { cache = JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* sin cache previa */ }

  const nominatimEnabled = process.env.GEOCODE_NOMINATIM === "1";
  const state = { networkDown: !nominatimEnabled, calledNominatim: false };
  const counts = { nominatim: 0, cache: 0, estado: 0, sinCoords: 0, ya: 0 };

  for (const centro of centros) {
    if (centro.coords) { counts.ya++; continue; }
    const p = centro.payload || {};
    const key = makeKey(p.estado, p.municipio, p.address);
    const wasCached = key in cache;
    state.calledNominatim = false;
    const coords = await geocode(p.address, p.estado, p.municipio, cache, { state });
    centro.coords = coords;
    if (!coords) counts.sinCoords++;
    else if (wasCached) counts.cache++;
    else if (coords.source === "nominatim") counts.nominatim++;
    else counts.estado++;
    if (state.calledNominatim) await sleep(1000); // ToS Nominatim: máx 1 req/s
  }

  try {
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, JSON.stringify(cache, null, 2));
  } catch (e) { console.warn("  ! geocode-cache no persistido: " + e.message); }

  console.log(
    `  geocode: nominatim=${counts.nominatim} cache=${counts.cache} estado=${counts.estado} sin-coords=${counts.sinCoords}` +
      (state.networkDown ? (nominatimEnabled ? " (nominatim caído → fallback)" : " (nominatim off)") : "")
  );
  return centros;
}
