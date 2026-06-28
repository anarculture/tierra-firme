#!/usr/bin/env python3
"""Transcribe un audio (ogg/mp3/...) a texto con faster-whisper. Lo usa /sitrep.

Uso (con el venv de Tierra Firme):
  ~/Code/tierra-firme/.venv/bin/python transcribe.py <audio> [modelo]

Modelo por defecto 'small'. Para audio de campo ruidoso, 'medium' transcribe
mejor pero es más lento en CPU. Idioma forzado a español (es-VE).
"""
import sys
from faster_whisper import WhisperModel


def transcribe(path, model="small"):
    m = WhisperModel(model, device="cpu", compute_type="int8")
    segments, _info = m.transcribe(path, language="es")
    return " ".join(s.text.strip() for s in segments).strip()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("uso: transcribe.py <audio> [modelo]")
    print(transcribe(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "small"))
