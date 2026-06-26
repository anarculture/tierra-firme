# Esquema de trabajo — monitorVE + GitHub (multi-agente)

> Regla de oro contra la confusión: **un proceso por worktree, una rama por slice, main solo lo toca el coordinador.**

## Espacio físico (nada ensucia `~/Code`)

- Todo el proyecto vive en `~/Code/monitorVE`. **Prohibido** crear hermanos `~/Code/monitorVE-*`.
- Cada agente trabaja en su propio worktree **dentro** del repo:
  `~/Code/monitorVE/.claude/worktrees/<slice>` — `.claude/` está gitignored, así que los worktrees no se publican ni aparecen en `~/Code`.
- Crear así (o con el tool EnterWorktree del harness, que ya usa esa ruta):

  ```sh
  git worktree add .claude/worktrees/<slice> -b agent/<slice> main
  ```

## Ramas

- `main` — integración. **Siempre verde** (`npm test`). Nadie codea aquí; solo el coordinador mergea.
- `agent/<slice>` — una rama por slice. **1 rama ↔ 1 issue de GitHub** (ej. `agent/c4-export` ↔ #10).
- El worktree raíz (`~/Code/monitorVE`, rama `main`) es del **coordinador**. Los agentes nunca codean ahí.

## Flujo por slice (loop del agente)

1. Tomá un issue abierto **sin** label `blocked`.
2. `git worktree add .claude/worktrees/<slice> -b agent/<slice> main`.
3. Implementá con `/lazy-fable`; gate failable (`npm test` + el check del issue).
4. `git push -u origin agent/<slice>`.
5. Abrí PR con **`Closes #N`** en el cuerpo.
6. El coordinador mergea a `main` y borra rama + worktree:
   `git worktree remove .claude/worktrees/<slice> && git branch -d agent/<slice> && git push origin --delete agent/<slice>`.

## Gates HITL (label `hitl`)

Antes de mergear: correr **`/security-review`** del diff.
- #2 bot intake → store (PII), #6 F0 Supabase (claves del dueño), #9 C3 despacho (liability/dinero).

## Tracker

- **GitHub Issues = única fuente de verdad.** Labels: `afk` · `hitl` · `blocked` · `fase-a/b/c` · `in-progress`.
- `ISSUES.md` / `BUILD.md` quedan como histórico; no se mantienen.

## Coordinador (rol)

- No codea slices: integra. Mantiene `main` verde, mergea PRs, cierra issues, poda ramas/worktrees, sincroniza `origin`.
- Si dos agentes necesitan `main` a la vez → no: cada uno su rama/worktree.
