# Tierra Firme

Bot de WhatsApp para la crisis sísmica de Venezuela (doblete M7.2/M7.5, 24-jun-2026).
Reenviás lo que llega (cadenas, audios, fotos, capturas) y Tierra Firme **centraliza el
caos y lo destila en información funcional: qué hace falta, dónde y cuánto** — para que
los recursos se asignen bien y la ayuda llegue donde de verdad se necesita. **No es fuente oficial.**

> **Norte.** Tierra Firme es la **puerta de entrada WhatsApp única** del ecosistema de
> respuesta: sensor de demanda WhatsApp-nativo (reenvíos → necesidad/oferta estructurada,
> dedup, geocode) que **enruta** lo que no le toca a la herramienta que ya existe.
> Plan de funcionamiento completo: **[`TIERRA-FIRME.md`](TIERRA-FIRME.md)**.
>
> **Llegaste nuevo?** `npm test` (debe estar verde), luego leé `TIERRA-FIRME.md`.

## Loop central

`reenvío → destila (LLM) → dedup + geocode → compuerta humana → torre de control / export`

Nada público sin un humano que verifica. PII (nombres/teléfonos) fuera de la salida pública.

## Estructura

```
ingest/                 Bot: buzón WhatsApp/Telegram, destilador (eco), transcripción de voz
  whatsapp_buzon.py       Webhook Meta Cloud API → inbox
  telegram_buzon.py       Bot Telegram → inbox (mismo contrato de inbox)
  destilador.py           Eco por-mensaje vía Gemini (acuse al que reenvía)
  reply.py / responder.py Capa de respuesta (gateada, default off)
  transcribe.py           Voz → texto (faster-whisper, es-VE)
scripts/
  destila.js              inbox/<fecha>.jsonl → borradores de sitrep (LLM)
  analiza.js              inbox → necesidades/ofertas/gaps/alertas (análisis)
  revisar-server.js       Panel del operador (compuerta humana)
src/ingest/geocoder.js  Geocodifica contra el catálogo de centros
data/bundles/centros.json   Catálogo de centros geocodificados (lo que el bot cruza)
web/revisar.html        Panel de revisión del operador
```

## Stack

Vanilla JS + Node stdlib + Python (intake/voz). Gemini (`gemini-2.5-flash-lite`, endpoint nativo)
para destilar. Boring, server-light, corre en red mala.

## Comandos

```bash
npm test                 # node:test — debe pasar
npm run destila          # destila el inbox del día → borradores
npm run revisar          # levanta el panel del operador
node scripts/analiza.js  # análisis necesidades/ofertas/gaps
```
