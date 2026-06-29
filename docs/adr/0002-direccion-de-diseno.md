# Dirección de diseño: minimalist dark, sin globo pesado

**Contexto.** Parte del propósito de Tierra Firme es corregir el UX/UI "AI-slop" de las
plataformas que salieron tras el sismo. Referencia de vibe: worldmonitor (dark, situational
awareness). Pero el público núcleo son afectados en red mala / gama baja / bajo estrés, además
de diáspora y respondedores.

**Decisión.** Sistema base **minimalist editorial (Notion/Linear) en dark mode**: paleta
restringida, jerarquía clara, tipografía del sistema (sin webfonts pesadas), motion mínimo. El
antídoto al slop es estructura intencional, no decoración. **Acentos brutalist** (contraste
fuerte, tipografía Swiss, densidad) **solo** en el centro de mando (mapa, contador de réplicas,
cifras). El estilo **soft/calm/premium** se reserva para superficies tranquilas de diáspora
(donaciones, "acerca de"). La disciplina **full-output (cero placeholders)** aplica al *build*
con dudamel/lazy-fable, no es un estilo.

**Mapa (ver `web/MAP.md`).** Se **rechaza** el globo 3D de worldmonitor (globe.gl/deck.gl) por
peso. Vista país = **SVG choropleth de los 24 estados** (instantáneo, offline, themeable);
zoom a pines (centros/daños) = **Leaflet + CARTO dark_matter**.

**Considered / rechazadas.** `soft` (mala legibilidad bajo estrés/sol + costo de banda),
`brutalist` puro ("experimental layout" riesgoso en uso-bajo-pánico), globo 3D (peso). Ejecución
con `/ui-ux-pro-max` como motor, dirigido por esta dirección.

**Consecuencia.** Los tokens viven en `web/styles.css` (`:root`). Todo slice de UI usa esas
variables; un color/spacing ad-hoc es una regresión de diseño.
