# Ingresos hospitalarios — Sismo VE 2026 (CUARENTENA · PII · interno)

Listas de pacientes/ingresados en hospitales y refugios tras el sismo del 24-jun-2026, para
que familiares ubiquen a los suyos. **Datos crudos de terceros, no verificados directamente,
con PII de personas vivas.**

## Procedencia

- **Carpeta Drive:** "SISMO 2026 VZLA" / desc. "INGRESOS HOSPITALARIOS SISMO 2026"
  (`1o36ifaRz45kAs5rKzci49aD0mP5JB_YI`, owner `marcelitagrimaldo@gmail.com`).
- Descargada completa el **2026-06-29** a `data/SISMO 2026 VZLA -*/` (gitignored, 33 MB, 118 archivos).

## Licencia y publicación (no negociable)

Fuente de terceros, **sin licencia declarada** → **captura interna, NO se publica en `/v1`**
y **NO** se estampa como obra nuestra. Es PII médica sin verificar: todos los `*.json` de aquí
y la carpeta cruda están **gitignored**. Si algo sale, va por la **compuerta humana**
(`npm run revisar`) y por el dataset gateado `patients` (TF_API_KEY), nunca crudo. No lo mezcles
con `data/patients.json` (curado, licencia propia).

## Qué ingerimos (lo que sirve)

Pipeline: **fuentes → `merge.py` → `combined-records.json` → `dedup.py` → `personas.json`**.
4 fuentes de personas fundidas: **120.793 filas → 112.311 personas** deduplicadas.

| archivo (este dir) | tracked | qué es |
|---|---|---|
| `personas.json` | no (PII) | **PRIMARIO** — 112.311 personas deduplicadas de 4 fuentes (`_confianza`, `_fuentes[]`, apariciones) |
| `combined-records.json` | no (PII) | 120.793 filas, unión cruda de las 4 fuentes (input del dedup; intermedio) |
| `encuentralos.json` | no (PII) | **107.015** — desaparecidos/encontrados del sismo, API `encuentralos.tecnosoft.dev` (la capa que faltaba: personas *buscadas*, no ingresadas). Sin PII de reportante |
| `buscatupaciente.json` | no (PII) | 9.053 — pacientes de `buscatupaciente.netlify.app` (Firebase). Sin contacto de familiar |
| `consolidado.json` | no (PII) | 3.688 — master de las listas de hospital (Drive) |
| `pacientes-control.json` | no (PII) | 1.037 — hoja "Control_Pacientes_Busqueda tati" |
| `busqueda-familiares.json` | no (PII) | 33 — **DEMANDA** (familias *buscando*), semántica distinta, NO entra al dedup |
| `plataformas-busqueda.md` | sí | directorio de 16+ plataformas/bots de búsqueda → candidato a `ruteo` |
| `merge.py` | sí | une toda fuente `*.json` con `records` → `combined-records.json` |
| `import.py` | sí | parser+normalizador stdlib (consolidado/control xlsx → JSON) |
| `audit.py` | sí | scorecard de calidad (completeness, dups, fallecidos). `python3 audit.py [json]` |
| `dedup.py` | sí | `combined-records.json` → `personas.json`. Merge conservador (cédula fuerte, nombre sin chocar). `--selftest` |
| `buscar.py` | sí | busca una persona (cédula/nombre) en toda la data local + 2 sheets vivos. `python3 buscar.py <q>` · `--refresh` · `--selftest` |
| `revisar-cedulas.csv` | no (PII) | cola de revisión humana: cédulas con nombres en conflicto (regenera con `dedup.py`) |
| `_cache_sheet*.csv` | no (PII) | caché de los sheets vivos para `buscar.py` |

**Estados en el dump (120.793):** desaparecido 70.575 · encontrado 36.440 · siendo atendido 8.859 ·
dado de alta ~260 · **fallecido 19**. Es el ciclo completo: buscado → hallado → atendido → alta/deceso.
Re-ingesta: `python3 merge.py && python3 dedup.py combined-records.json personas.json`.

### `personas.json` — el primario (deduplicado)

`dedup.py` colapsa **120.793 filas → 112.311 personas** (-8.482). Regla conservadora (dato de vida
o muerte): fusiona fuerte por **cédula**; por **nombre** solo ata filas con nombre+apellido (NO
solo-primer-nombre) y sin cédula en conflicto. Nunca pierde filas (`_n_filas`, `_fuentes[]`,
`apariciones[]`).

**Confianza DE LA FUSIÓN** (`_confianza`, no confianza del dato de origen):

| `_confianza` | n | qué significa |
|---|---|---|
| `sin_merge` | 108.671 | 1 sola fila — tal cual la fuente (no agregamos riesgo). Domina porque Encuéntralos trae 107k sin apellido → no fusionables salvo por cédula |
| `alta` | 53 | misma cédula + mismo nombre |
| `media` | 1.787 | fusión por nombre+apellido, sin cédula (homónimos posibles) |
| `revisar` | 1.800 | **misma cédula, nombres distintos** → bandera roja, cola para ojo humano (incluye cruces buenos entre-fuentes con grafía distinta) |

⚠ **No es resolución de identidad autoritativa.** Es **triage para la compuerta humana**. Las
cédulas de la fuente NO son IDs limpios (1.831 cédulas duplicadas afectan 5.144 filas; muchas con
≥2 nombres). El cruce entre-fuentes se sostiene sobre las 18.804 cédulas válidas (~21%); el resto
(desaparecidos sin cédula) queda como registro individual. `personas[]`: `nombres, apellidos,
cedula, edad, sexo, hospitales[], apariciones[], estado, _match, _confianza, _nombres_distintos,
_fuentes[]`.

### `consolidado.json` — el primario

Origen: `01-LISTA DIGITALIZADA HOSPITALES/Terremoto Venezuela - Consolidado de personas de
todos los archivos.xlsx`. Es el **único archivo ya consolidado/deduplicado** con esquema limpio
y columna `FUENTE` que rastrea de qué archivo vino cada persona. **Supersede** a
`pacientes-control.json`. Versión viva (Google Sheet): ver `plataformas-busqueda.md`.

`{ "_src", "schema":[...], "records":[ {record} ] }` — campos (snake_case):
`apellidos, nombres, cedula, edad, menor, sexo, hospital, area, piso_cama, procedencia,
diagnostico, estado, fecha, hora, familiar, fuente, comentarios`.

- 3688 registros · 1114 con cédula · `estado` casi siempre vacío (65 ALTA, 48 Ingreso, 11+ FALLECIDO).
- Hospitales/centros (col `hospital`): Domingo Luciani (~760 entre 2 grafías), Pérez Carreño 557,
  Vargas 476, Campo Golf Caribe / Refugio Los Cocos / desplazados (~930), HUC 135, Clínica El Ávila 118,
  Catia (~225 entre 2 grafías), "pared azul (sin identificar)" 122.

## Qué NO ingerimos (redundante o crudo) — vive en `data/SISMO 2026 VZLA -*/`

- **105 imágenes** (jpeg/jpg) — fotos de las listas en papel por hospital (Pérez Carreño, Catia,
  Vargas, El Ávila). Son el **upstream** ya digitalizado en los xlsx. No las OCR-eamos (alguien ya lo hizo).
  Evidencia cruda; se quedan en la carpeta gitignored.
- **xlsx por hospital** (`Pacientes_Hospital_Perez_Carreno` 1647, `HOSPITAL DE CATIA LISTADO`,
  `Clinica el Avila`, `Reporte Afectados Sismos`) — fundidos en el consolidado vía `FUENTE`.
- **`HOSPITAL VARGAS DE CARACAS.xlsx`** — caso aparte: trae OCR + verificación contra CNE
  (`verificado_cne`, `nombre_cne`, `parroquia`, `centro_electoral`). 223 filas, 1 hospital. No ingerido
  (el consolidado ya cubre Vargas), pero su metadata de verificación es lo más confiable del lote.
- **`01-Lista digitalizada...xlsx`** (14 hojas) — el workbook humano de búsqueda; fuente del consolidado.
- **2 docx** (`LISTAS DE PERSONAS EN MULTIPLES HOSPITALES`, `Listado 2`) — **idénticos entre sí** y
  redundantes con el consolidado.
- **2 PDF** (`Ingresos...Consolidado.pdf` 15 MB, `LISTA ACTUALIZADA DESCARGADA PACIENTES.pdf`) — versiones
  impresas/escaneadas del mismo dato.

## Re-ingesta

`import.py` parsea la hoja "Control_Pacientes" → `pacientes-control.json` (stdlib, `--selftest`).
El consolidado se ingirió con un script ad-hoc equivalente (mismo lector xlsx stdlib). Snapshot del
2026-06-29; las hojas vivas siguen cambiando.
