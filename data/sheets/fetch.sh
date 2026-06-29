#!/usr/bin/env bash
# Baja las pestañas útiles de los Sheets públicos a CSV. Re-ejecutable (cron-able).
# Sin auth ni MCP: las hojas son link-públicas → export endpoint directo.
# ponytail: gid hardcodeado. Si agregan/renombran pestañas, actualizar el mapa.
set -euo pipefail
cd "$(dirname "$0")"

S1=1izXHF-aZOOu7VvfmbpH8TmVCFbjqwm2eqnpJN2ODrCo  # Hackathon Solidario
S2=1HAJwNjMGnSA-D0jFX1l3d96O2xu2W8H6re_N8Bu12OE  # Páginas de ayuda

dl() { # id gid out
  curl -sfL "https://docs.google.com/spreadsheets/d/$1/export?format=csv&gid=$2" -o "$3"
  printf '  %-32s %s filas\n' "$3" "$(( $(wc -l < "$3") - 1 ))"
}

echo "Sheet 2 — directorio de ruteo:"
dl "$S2" 0          directorio-paginas-ayuda.csv
dl "$S2" 1290964227 recursos-herramientas.csv
dl "$S2" 706191220  acopios-refugios.csv
dl "$S2" 1748562477 ongs.csv
dl "$S2" 2089109189 ninos.csv
dl "$S2" 1227732355 mascotas.csv
dl "$S2" 587742593  marcas.csv

echo "Sheet 1 — inteligencia:"
dl "$S1" 608803999  proyectos-hackathon.csv
dl "$S1" 1204875790 plataformas-activas.csv
dl "$S1" 968896767  gaps-criticos.csv
dl "$S1" 1539306856 plataformas-api-datos.csv   # plataformas con API/datos abiertos/GitHub
