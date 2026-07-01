# 05 — Lista pública de necesidades recortada

**Tipo:** AFK · **Track:** Libro

## What to build

Reconvertir el sitio público actual (gh-pages) en la **lista recortada cara-a-donante**
([ADR 0006](../adr/0006-frontera-interno-publico.md)): la mitad "qué hace falta" del ciclo de
confianza que sostiene el financiamiento externo.

- **Solo campos seguros:** `zona + insumo + urgencia`. Nada de lugar con detalle de paciente,
  nada de contacto, nada de estado interno/costos/quién.
- **Solo necesidades `vigente`:** auto-descarta lo `comprada`/`entregada`/`verificada`/`cancelada`
  ([ADR 0005](../adr/0005-estado-derivado-de-eventos.md)). Así nunca engaña a un donante para que
  financie algo ya resuelto — y es la herramienta anti-bullwhip (anti sobre-oferta).
- Sale del libro interno vía la compuerta humana (como el informe #04).

Reemplaza el `publica.js` / `needs.json` del modelo viejo (que servía necesidades sin recorte ni
filtro de estado).

## Acceptance criteria

- [x] La vista pública muestra solo `zona + insumo + urgencia` de necesidades `vigente`.
- [x] Al resolverse una Necesidad, desaparece de la vista pública en la próxima publicación.
- [x] Cero PII / cero detalle interno en la salida (test de no-fuga).
- [x] Pasa por compuerta humana antes de publicarse (panel: Publicar lista; re-recorta del libro, no del body).
- [x] `node --test` cubre el filtro (solo `vigente`) y el recorte de campos.

## Blocked by

- #01 — Necesidad: identidad + estado (necesita el filtro por estado)
