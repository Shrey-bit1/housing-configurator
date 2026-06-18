# Flat Configurator

A browser-based 3D flat / housing configurator built with **TypeScript + Three.js** (bundled with Vite). Rooms and modules are placed on a 0.6 m grid and viewed in an axonometric (isometric) projection. Part of an ongoing thesis project — this repo tracks work in progress.

## Current features

- **Grid system** — 0.6 m cells; per-floor grid size is adjustable (width × depth) with live re-fit of placed items.
- **Room-type presets** — fixed-footprint rooms defined as data: Living Room, Kitchen, Bedroom (Small/Large), Bathroom (Small/Large), Recreation, Circulation (Single/Double), and Outdoor/Balcony (Single/Double). L-shaped and rectangular footprints, extruded to ceiling height.
- **Furniture modules** — small 0.6 m shape modules (Single, Domino, L-Triomino).
- **Placement & editing** — drag from the palette with a green/red validity ghost, snap to grid, collision-checked against everything on the floor; click to select, `R` to rotate 90°, drag to move, `Delete`/`Backspace` to remove.
- **Multi-floor support** — stack multiple floors (each with its own grid and contents); switch the active floor via tabs, add/delete floors. Inactive floors render dimmed and non-interactive.
- **Camera** — orbit/zoom (OrbitControls) with a **Reset View** button to return to the default axonometric angle.

## Run locally

Requires Node.js (18+).

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Project structure

```
src/
  core/        grid, occupancy, room/module definitions, floors, placement store
  scene/       Three.js scene, camera, meshes, grid + ghost rendering
  interaction/ pointer picking, drag-to-place, selection/move/rotate/delete
  ui/          sidebar palette, floor tabs, grid-size controls
  main.ts      wiring
```

## Notes

- Rooms and furniture on a given floor share one occupancy map (collision is checked uniformly between them); each floor is otherwise independent.
- Stairs / vertical circulation between floors are not implemented yet (planned follow-up).
