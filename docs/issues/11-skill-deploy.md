# 11 — Skill deploy/update (informe + lista → gh-pages)

**Tipo:** AFK · **Track:** Operación

## What to build

Encapsular el ciclo de publicación en un skill: `armar libro → generar informe (#04) + lista
recortada (#05) → [compuerta humana] → deploy gh-pages`. Automatiza lo mecánico y **para en la
revisión humana** (regla dura: nada público sin gate).

Deploy = force-push de orphan-commit (NO `git subtree`, no instalado):
```
SITE_TREE=$(git rev-parse HEAD:site)
COMMIT=$(git commit-tree "$SITE_TREE" -m "deploy: ...")
git push -f origin "$COMMIT":refs/heads/gh-pages
```
(`:` fuera de comillas en zsh). `site/.nojekyll` ya existe; Pages habilitado (gh-pages `/`). Lag de
CDN ~1-2 min: verificar el contenido DEPLOYADO con `git show <gh-pages-sha>:...`, no solo `curl`.

## Acceptance criteria

- [x] El skill genera informe + lista recortada y se detiene para revisión humana antes de deployar (`scripts/deploy.js`, dry por default; `npm run deploy`).
- [x] Deploy con orphan-commit force-push a `gh-pages` (no subtree) — `git commit-tree HEAD:site` + `push -f`.
- [x] Verifica lo deployado vía `git show ${commit}:index.html` (no solo `curl` — evita falso-OK por cache CDN).
- [x] No pushea a `main` (`deployRefspec` rechaza main/master; selftest lo prueba).

_Encapsulado como `scripts/deploy.js` + `npm run deploy` (ponytail: el script ES el skill; el `--deploy` real lo corre el humano)._

## Blocked by

- #04 — Informe de compras
- #05 — Lista pública recortada
