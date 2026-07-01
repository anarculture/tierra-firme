# ingesta-06 — Gate PII al servir el bundle personas

**Tipo:** AFK · **Estado: HECHO** (`src/api/pii-gate.js` + wire en `server.js`: cédula→`****XXXX`,
nombre/foto/id fuera, fail-closed sin `TF_API_KEY`; canal gateado da completo. `data/api.py` ya es
deny-by-default → personas ausente = 404 seguro. Test en `test/pii-gate.test.js`).

## What to build

`buildPersonas` escribe `data/bundles/personas.json` con `nombre` + `cedula` (PII) — interno y
gitignored, pero al servirlo por el API hay que gatearlo/redactarlo como ya se hace con `patients`
(`TF_API_KEY`) y `missing` (drop `contact`). Cerrar el path de servicio: cédula → **HMAC token**
(no cruda), redacción de campos sensibles, y gate por API key. Regla no negociable del repo (§5 plan,
CLAUDE.md PII).

## Acceptance criteria

- [ ] `personas` en la POLICY del API: gateado (`TF_API_KEY`) o con `drop` de campos PII crudos.
- [ ] Cédula servida como HMAC/enmascarada (`****XXXX`), nunca dígitos crudos, salvo canal gateado.
- [ ] `reporta_contacto`/teléfono del reportante nunca presente (ya lo descarta el adapter — verificar).
- [ ] El scan de fuga PII (`api.py test` / equivalente) pasa con `personas` incluido.
- [ ] `node --test` verde; test que falla si la cédula cruda saldría sin gate.

## Blocked by

None - can start immediately (bundle personas ya lo produce `buildPersonas`).
