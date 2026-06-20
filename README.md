# Life Events Planner

A single-page, no-build event planner — venue, food, guests and a printable summary. Just open `index.html`; there is nothing to compile or install.

## Project structure
Concerns are split across plain, framework-free files (no bundler — the browser loads them directly):

- **`index.html`** — markup only: the cover and the venue / food / guests / summary pages.
- **`styles.css`** — all styling, including the responsive and print layouts.
- **`js/`** — the app logic, loaded in dependency order as classic scripts:
  - `core.js` — config, shared state, DOM/formatting helpers and the row readers.
  - `sections.js` — builders/handlers for the event-type chips, map, food and guest rows.
  - `calc.js` — `recalc()`, the single pass that refreshes every derived total.
  - `storage.js` — collect/apply, autosave, JSON import/export and GitHub sync.
  - `report.js` — the print/PDF report builder and "clear all" reset.
  - `main.js` — bootstrap: page navigation, restoring saved data, and the autosave safety net.

## Data storage
This is a static site with no backend, so data can't auto-write into the GitHub repo from the browser. Instead:
- **Autosave** — every change is saved to the browser's `localStorage`, so reloading or closing the tab doesn't lose data.
- **Download JSON** (Summary page) — exports the full event as a `.json` file matching the schema in `data/sample-event.json`. Commit that file to this repo (e.g. under `data/`) to keep a permanent, version-controlled copy.
- **Load JSON** (Summary page) — re-imports any previously downloaded `.json` file, fully restoring venue, food, guests and notes.

## Responsive design
Layout uses fluid `clamp()` sizing and breakpoints for phones (≤680px), tablets (681–980px) and short/landscape screens, plus `env(safe-area-inset-*)` so content clears notches in landscape. Inputs use 16px font on mobile to prevent iOS auto-zoom.
