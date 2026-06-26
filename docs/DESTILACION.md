# Destilación → store (inbox → sitrep verificado)

Cómo el caos crudo del buzón se convierte en sitreps publicados. **A demanda** (no automático aún):
un humano corre `/sitrep` y aprueba antes de publicar.

```
ingest/inbox/  ──/sitrep──►  BORRADOR (✓/⏳)  ──gate humano──►  aprobados.json  ──publica──►  src/curated/sitreps.json  ──►  app
   (PII)          (skill)      + filas personas                  (sin PII)        (script)        (verificado, público)
```

## Pasos
1. **Destila.** Corré `/sitrep` apuntando al dump del periodo en `ingest/inbox/` (texto + voz
   transcrita con `ingest/transcribe.py` + lo de las fotos). Produce un **borrador** con cada dato
   marcado ✓ (2+ fuentes) o ⏳ (sin confirmar) y su procedencia.
2. **Gate humano.** Un verificador revisa el borrador. Lo confirmado y con fuente pasa; lo ⏳/rumor
   no. Las **personas** (buscadas/localizadas) salen aparte hacia el índice privado — **nunca** al
   sitrep público (sin nombres ni teléfonos de personas vivas).
3. **Aprobados → JSON.** Armá `aprobados.json` con lo que pasó el gate:
   ```json
   { "items": [
     { "titulo": "…", "zona": "La Guaira", "texto": "…", "fuenteOrigen": "IFRC + vecinos" }
   ] }
   ```
   `verificadoEl` es opcional (se autocompleta con hoy). `fuenteOrigen` es **obligatorio** — sin
   procedencia no entra.
4. **Publica al store.**
   ```bash
   node scripts/publica-sitrep.js aprobados.json
   ```
   Valida procedencia, autocompleta la fecha, **deduplica** por `titulo`+`zona`, y agrega a
   `src/curated/sitreps.json`. La app lo muestra con badge *Verificado ✓*.

## Reglas (no se rompen)
- **Cero PII en el store público.** Personas → índice privado (slice aparte).
- **Procedencia + frescura por item.** El script rechaza lo que no tiene `fuenteOrigen`.
- **El gate humano publica, no el bot.** `/sitrep` solo borradorea; `publica-sitrep.js` solo corre
  sobre lo aprobado.

## Pendiente (slices aparte)
- **Índice de personas** (buscada→localizada, reportante, localización) con dedup sesgado a separar
  (ADR 0001) y store propio — toca PII → requiere `/security-review`.
- **Automatizar** la llamada a `/sitrep` cuando el volumen lo pida (hoy: a demanda).
