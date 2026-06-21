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
- **Save / Load List by name** (Summary page) — with a GitHub token connected, **Save** (☁️) stores the whole event under a name you type into `data/lists/<name>.json` in the repo; a `_index.json` keeps the friendly names. **Load** is a dropdown listing those saved names — pick one to restore it. Use it to keep several named guest lists side by side.

## Guests & WhatsApp invites
Each guest now has a **phone number** field. The Guests page has an *Invite guests on WhatsApp* panel: type a message (use `{name}` to personalise) and an optional image link, then **Message whole list** (one chat per guest), tap a single guest, or type any number into **Or message a single number** — all launch WhatsApp pre-filled via `wa.me` click-to-chat. The image shows as a link preview. To send a **real image file to everyone for free**, use **Save contacts (.vcf)**: it exports every guest-with-phone as a phone-contacts file — import it into your phone, make a WhatsApp **Broadcast list** from those contacts, and send your image + message once (it reaches all of them as private chats, free; recipients must have your number saved). Fully automated server-side sending would instead need the paid WhatsApp Business / Meta Cloud API.

## Responsive design
Layout uses fluid `clamp()` sizing and breakpoints for phones (≤680px), tablets (681–980px) and short/landscape screens, plus `env(safe-area-inset-*)` so content clears notches in landscape. On desktop (≥981px) the gutters shrink and the panels span the full width edge-to-edge, with the Summary laid out as a two-column grid. Inputs use 16px font on mobile to prevent iOS auto-zoom.
