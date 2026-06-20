# Life Events Planner

A single-page, no-build event planner (`index.html`) — venue, food, guests and a printable summary.

## Data storage
This is a static site with no backend, so data can't auto-write into the GitHub repo from the browser. Instead:
- **Autosave** — every change is saved to the browser's `localStorage`, so reloading or closing the tab doesn't lose data.
- **Download JSON** (Summary page) — exports the full event as a `.json` file matching the schema in `data/sample-event.json`. Commit that file to this repo (e.g. under `data/`) to keep a permanent, version-controlled copy.
- **Load JSON** (Summary page) — re-imports any previously downloaded `.json` file, fully restoring venue, food, guests and notes.

## Responsive design
Layout uses fluid `clamp()` sizing and breakpoints for phones (≤680px), tablets (681–980px) and short/landscape screens, plus `env(safe-area-inset-*)` so content clears notches in landscape. Inputs use 16px font on mobile to prevent iOS auto-zoom.
