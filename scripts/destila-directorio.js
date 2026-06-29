#!/usr/bin/env node
// Destila los CSV de data/sheets/ a UNA tabla de ruteo deduplicada por dominio,
// lista para que el bot la ingiera y responda en lenguaje natural.
// Determinista: mapeo de columnas por fuente + normalización de categorías + overrides
// de juicio (hechos a mano). Sin IA, sin API. Estilo casa: vanilla + stdlib.
// Salidas:  ruteo.json (estructurado)  +  ruteo.md (corpus NL agrupado por categoría)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sheets');

// CSV mínimo quote-aware (Node no trae parser).
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const URL_RE = /https?:\/\/[^\s,"]+/i;
const clean = s => (s || '').replace(/[\u{1F000}-\u{1FFFF} -➿]/gu, '').replace(/\s+/g, ' ').trim();
const domainKey = url => { try { return new URL(url.match(URL_RE)[0]).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

// raw → categoría canónica (intent del bot). null = no mapea (queda para override).
const NORM = {
  desaparecidos:'Desaparecidos', personas:'Desaparecidos', localizados:'Desaparecidos',
  hospitales:'Hospitales', heridos:'Hospitales', ingresados:'Hospitales',
  donaciones:'Donaciones', 'donación':'Donaciones', donacion:'Donaciones',
  acopios:'Acopios', acopio:'Acopios', suministros:'Acopios', 'centros de acopio':'Acopios',
  albergues:'Albergues', refugios:'Albergues', refugio:'Albergues',
  edificios:'Edificios', 'danos estructurales':'Edificios', 'daños estructurales':'Edificios', 'daños':'Edificios', 'daÃ±os':'Edificios',
  rescates:'Rescates', rescate:'Rescates',
  mascotas:'Mascotas', mascota:'Mascotas', animales:'Mascotas',
  'niños':'Niños', ninos:'Niños', 'niñez':'Niños', infancias:'Niños', infancia:'Niños',
  'falta de recursos':'Servicios básicos', 'servicios básicos':'Servicios básicos',
  'salud mental':'Salud mental', 'psicológico':'Salud mental', psicosocial:'Salud mental',
  ong:'ONG', herramienta:'Herramienta', informativo:'Directorio', 'directorio/buscador':'Directorio',
  directorio:'Directorio', recopilador:'Directorio', 'recursos verificados':'Directorio',
  'organismo oficial':'Oficial', oficial:'Oficial', 'api para desarrolladores':'Herramienta',
  'maquinaria pesada':'Maquinaria',
};
const norm = raw => NORM[clean(raw).toLowerCase()] || null;

// JUICIO a mano: categorías para dominios que quedaron sin mapear (one-shot, revisado por Claude).
const OVERRIDE = {
  'ajevenezuela.org':['Donaciones'], 'centro-de-acopio-ven.vercel.app':['Acopios'],
  'centrosayudavenezuela.org':['Acopios'], 'enlazavenezuela.com':['Directorio'],
  'mapadenecesidadesvzla.com':['Acopios','Servicios básicos'], 'mirandaconecta.site':['Directorio'],
  'nueveonce.com':['Directorio'], 'paho.org':['Oficial'], 'psfvenezuela.wordpress.com':['Salud mental'],
  'recursos-venezuela.netlify.app':['Directorio'], 'refugiovenezuela.com':['Albergues'],
  'reliefweb.int':['Oficial'], 'responsegrid.app':['Acopios'], 'respuestave.org':['Herramienta'],
  'sos.yummyrides.com':['Edificios','Rescates'], 'todosconvzla.com':['Directorio'],
  'unicef.es':['Donaciones'], 'venemergencia.com':['Directorio'], 'venezuela-ayuda.com':['Directorio'],
  'venezuela2026.xyz':['Desaparecidos'], 'venezuelaayuda.org':['Directorio'],
  'venezuelayuda.com':['Directorio'], 'www2.cruzroja.es':['Donaciones'],
  'redh.avapre.com':['Hospitales'], 'ayudaencamino.com':['Directorio'],
  'ayudave.com':['Acopios','Directorio'], 'kevinesaa.github.io':['Directorio'],
  'centrorecursosvenezuela.netlify.app':['Directorio'], 'demanoenmano.vercel.app':['Acopios','Hospitales'],
  'infanciaprotegidavzla.netlify.app':['Niños'], 'info-central-terremoto-venezuela.com':['Directorio'],
  'data.humdata.org':['Edificios','Oficial'], 'reconectavenezuela.com':['Servicios básicos'],
  'ayudavenezuela2026.com':['Directorio'], 'redquipu.com':['Directorio'],
  'zonasafectadasvenezuela.app':['Edificios','Directorio'], 'sectorve.com':['Directorio'],
  'senaldeayuda.org':['Directorio'], 'sismoayudave.com':['Edificios'],
  'sosven.site':['Desaparecidos','Mascotas'], 'venezuela-earthquake-map.vercel.app':['Directorio'],
  'venezuelahelp.click':['Acopios'], 'venezuelasolidaria.com':['Directorio'],
  'vzlayuda.com':['Directorio'], 'vzla-response-hub.vercel.app':['Directorio'],
};

// No cara-a-usuario: twitter suelto + portales internos del hackathon.
const EXCLUDE = new Set(['x.com', 'twitter.com', 'pawboard.dev', 'build4venezuela.com']);

// Mapeo de columnas por fuente. cols por índice; def = categoría fija de la pestaña.
const SOURCES = {
  'directorio-paginas-ayuda.csv': { nombre:1, url:2, desc:4, cat:5, status:0 },
  'plataformas-api-datos.csv':    { nombre:1, url:2, desc:3, cat:0, api:4 },
  'plataformas-activas.csv':      { nombre:1, url:2, desc:3, status:4 }, // "Tipo"≠categoría → override/union
  'recursos-herramientas.csv':    { generic:true, def:'Herramienta' },
  'acopios-refugios.csv':         { generic:true, def:'Acopios' },
  'ongs.csv':                     { generic:true, def:'ONG' },
  'ninos.csv':                    { generic:true, def:'Niños' },
  'mascotas.csv':                 { generic:true, def:'Mascotas' },
};

const STATUS = /^(true|false|activo|no activo|por verificar|tiempo limitado|operativo|en desarrollo)$/i;
const isInactive = cells => cells.some(c => /^(false|no activo)$/i.test(c.trim()));
const byDomain = new Map();

for (const [file, cfg] of Object.entries(SOURCES)) {
  const path = join(DIR, file);
  if (!existsSync(path)) { console.warn(`  falta ${file}, salto`); continue; }
  for (const cells of parseCSV(readFileSync(path, 'utf8'))) {
    const urlCell = cfg.generic ? cells.find(c => URL_RE.test(c)) : cells[cfg.url];
    if (!urlCell || !URL_RE.test(urlCell)) continue;
    const dom = domainKey(urlCell);
    if (!dom || EXCLUDE.has(dom) || dom.includes('docs.google.com') || dom.includes('drive.google.com')) continue;
    const url = urlCell.match(URL_RE)[0].replace(/[).,]+$/, '');

    let nombre, desc, cats = new Set();
    if (cfg.generic) {
      const cand = cells.filter(c => c.trim() && !URL_RE.test(c) && !STATUS.test(c.trim())).map(clean);
      nombre = cand[0] || dom;
      desc = cand.slice(1).sort((a, b) => b.length - a.length)[0] || '';
      cats.add(cfg.def);
    } else {
      nombre = clean(cells[cfg.nombre]) || dom;
      desc = clean(cells[cfg.desc]);
      for (const part of String(cells[cfg.cat] || '').split(/[,/]/)) { const n = norm(part); if (n) cats.add(n); }
    }
    if (OVERRIDE[dom]) OVERRIDE[dom].forEach(c => cats.add(c));
    const api = cfg.api != null && /\bSI\b|public|\/api/i.test(cells[cfg.api] || '') ? clean(cells[cfg.api]) : null;
    const activo = !isInactive(cells);

    const prev = byDomain.get(dom);
    if (prev) {
      cats.forEach(c => prev.categorias.add(c));
      prev.fuentes.add(file);
      prev.activo = prev.activo || activo;
      if (!prev.desc && desc) prev.desc = desc;
      if (!prev.api && api) prev.api = api;
      if (nombre && !/\.(com|org|net|app|xyz|site)/.test(nombre) && nombre.length < prev.nombre.length) prev.nombre = nombre;
    } else {
      byDomain.set(dom, { dominio: dom, nombre, url, desc, categorias: cats, activo, api, fuentes: new Set([file]) });
    }
  }
}

const out = [...byDomain.values()]
  .map(r => ({ dominio:r.dominio, nombre:r.nombre, url:r.url, que_hace:r.desc,
               categorias:[...r.categorias].sort(), activo:r.activo, api:r.api, fuentes:[...r.fuentes] }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre));

writeFileSync(join(DIR, 'ruteo.json'), JSON.stringify(out, null, 2) + '\n');

// ruteo.md — corpus que el bot ingiere para responder en lenguaje natural, agrupado por categoría.
const cats = {};
for (const r of out) {
  if (!r.activo) continue;
  for (const c of (r.categorias.length ? r.categorias : ['Sin categoría'])) (cats[c] ||= []).push(r);
}
let md = `# Directorio de ayuda — Venezuela terremoto 2026\n\n` +
  `Plataformas activas para enrutar usuarios. Generado por scripts/destila-directorio.js — no editar a mano.\n`;
for (const c of Object.keys(cats).sort()) {
  md += `\n## ${c}\n`;
  for (const r of cats[c].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    md += `- **${r.nombre}** — ${r.que_hace || 'sin descripción'} ${r.url}\n`;
}
writeFileSync(join(DIR, 'ruteo.md'), md);

// self-check
if (out.length === 0) throw new Error('ruteo vacío — parser roto');
if (out.some(r => !r.url || !r.dominio)) throw new Error('fila sin url/dominio');
const sinCat = out.filter(r => r.categorias.length === 0);
console.log(`ruteo.json: ${out.length} plataformas únicas`);
console.log(`  activas: ${out.filter(r => r.activo).length}  ·  con API: ${out.filter(r => r.api).length}`);
console.log(`  categorías: ${Object.keys(cats).length}  ·  SIN categoría: ${sinCat.length}`);
if (sinCat.length) console.log('  →', sinCat.map(r => r.dominio).join(', '));
