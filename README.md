# El Buscador · landing

Landing de [El Buscador](https://github.com/stkabir/el-buscador). Un mundo 3D hecho solo con three.js (sin video ni assets): al hacer scroll, la cámara vuela por un "disco" con forma de treemap y pasa por una zona por cada función.

## Comandos

```bash
pnpm install
pnpm astro dev --background   # http://localhost:4321
pnpm build
```

## Dónde está cada cosa

| Qué | Archivo |
|---|---|
| Textos de cada sección, enlaces | `src/data/sections.ts` |
| Página, cabecera, riel, footer | `src/pages/index.astro` |
| Colores (CSS) y efecto del toggle de tema | `src/styles/global.css` |
| Colores de la escena 3D, claro y oscuro | `src/scripts/world/palette.ts` |
| Zonas 3D (una por sección, mismo índice) | `src/scripts/world/world.ts` |
| Recorrido de la cámara, scroll y tema | `src/scripts/world/main.ts` (`SHOTS`, `DWELL`) |

Agregar una sección: una entrada en `sections.ts`, una zona en `ZONES` + un método en `world.ts`, y un encuadre en `SHOTS`.

Con `prefers-reduced-motion` la cámara salta entre zonas sin volar. Sin WebGL, los textos se muestran como página normal.
