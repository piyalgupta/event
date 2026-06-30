# Life Events Planner

A single-page, no-build event planner — venue, food, guests and a printable summary. Just open `index.html`; there is nothing to compile or install.

## Project structure
Concerns are split across plain, framework-free files (no bundler — the browser loads them directly):

- **`index.html`** — markup only: the cover and the venue / food / guests / summary pages.
- **`styles.css`** — all styling, including the responsive and print layouts.
- **`js/`** — the app logic, loaded in dependency order as classic scripts:
  - `core.js` — config, shared state, DOM/formatting helpers and the row readers.
  - `sections.js` — builders/handlers for the event-type chips, map, food and guest rows.
  - `whatsapp.js` — the self-contained WhatsApp invite module (wa.me links, sender/test, .vcf export).
  - `calc.js` — `recalc()`, the single pass that refreshes every derived total.
  - `storage.js` — collect/apply, autosave, JSON import/export and GitHub sync.
  - `report.js` — the print/PDF report builder and "clear all" reset.
  - `dashboard.js` — the read-only analytics dashboard (KPI tiles + dependency-free SVG/CSS charts).
  - `invite.js` — the Invitation Card: a square 1:1 card drawn on a `<canvas>`, themed per event type and downloadable as PNG/JPG.
  - `main.js` — bootstrap: page navigation, restoring saved data, and the autosave safety net.

## Data storage
This is a static site with no backend, so data can't auto-write into the GitHub repo from the browser. Instead:
- **Autosave** — every change is saved to the browser's `localStorage`, so reloading or closing the tab doesn't lose data.
- **Download JSON** (Summary page) — exports the full event as a `.json` file matching the schema in `data/sample-event.json`. Commit that file to this repo (e.g. under `data/`) to keep a permanent, version-controlled copy.
- **Load JSON** (Summary page) — re-imports any previously downloaded `.json` file, fully restoring venue, food, guests and notes.
- **Save / Load List by name** (Summary page) — with a GitHub token connected, **Save** (☁️) stores the whole event under a name you type into `data/lists/<name>.json` in the repo; a `_index.json` keeps the friendly names. **Load** is a dropdown listing those saved names — pick one to restore it. Use it to keep several named guest lists side by side.

## Guests & WhatsApp invites
The WhatsApp feature is a standalone module (`js/whatsapp.js`), kept separate from the form builders. Each guest has a **phone number** field, and the Guests page has an *Invite guests on WhatsApp* panel:

- **Your WhatsApp number (sender)** — your own number, defaulting to **+91 9874174100**. **Send test message** opens a `wa.me` chat to it so you can confirm WhatsApp works before inviting anyone.
- Add an optional image — **paste a public URL** or **attach a picture from your device** (read in the browser, kept with the saved event, shown as a thumbnail; max 2 MB). A public URL rides along as a `wa.me` link preview; a device image can't, so it's used for the preview and the broadcast flow below.
- Type a message (use `{name}` to personalise), then **Message whole list** (one chat per guest), tap a single guest, or type any number into **Or message a single number** — all launch WhatsApp pre-filled via `wa.me` click-to-chat. The image shows as a link preview.
- To send a **real image file to everyone for free**, use **Save contacts (.vcf)**: it exports every guest-with-phone as a phone-contacts file — import it into your phone, make a WhatsApp **Broadcast list** from those contacts, and send your image + message once (it reaches all of them as private chats, free; recipients must have your number saved).

Fully automated server-side sending would instead need the paid WhatsApp Business / Meta Cloud API. The link/number builders are covered by a dependency-free test: `node test/whatsapp.test.js`.

## Invitation card
The **Invitation Card** page turns your event into a ready-to-share image. It takes its headline from *“This event is being organised for”* (editable on the page itself or on the Venue page) and renders a **square 1:1 card** on a `<canvas>`, so it downloads as a clean **PNG or JPG** — sized 1080×1080, ideal for a WhatsApp status or chat.

Every event type gets its **own world-class theme** — distinct palette, decorative motif, border and wording — drawn entirely with the Canvas 2D API (no libraries, no tainting, still runs from `file://`):

- **Birthday** — festive coral-to-gold gradient with confetti and a balloon cluster.
- **Marriage** — deep maroon with gold dust, an ivory double-bordered panel, interlocking rings.
- **Anniversary** — rose-gold blush with intertwined hearts.
- **Post-Funeral Rituals / Memorial** — a calm slate-lavender card with a soft lotus, worded with care.
- **Naming Ceremony** — a pastel sky with clouds, a crescent moon and stars.
- **Graduation** — a navy-on-gold academic card with a mortarboard cap.
- **Puja / Ritual** — a saffron radial with a lit diya and a marigold border.
- **Custom Event** — the app’s signature indigo→violet→rose gradient with a sparkle.

All text sits on a high-contrast inner panel so the card stays readable when shared. The card re-renders live from the same venue/food/guest model (via `recalc()`) and re-themes instantly when the event type changes.

## Analytics dashboard
The final page is a read-only **Analytics Dashboard** that re-derives everything from the same venue/food/guest model on each change (via `recalc()`), so it is always live. It shows KPI tiles (grand total, cost per head, cost per family, invited/RSVP heads, plates) plus charts that slice the data from several angles: a **cost split** donut (venue vs food), **food cost by category**, **payment progress** (paid vs due, broken down by venue/food), and guest classifications **by relationship**, **by reference**, **invitation & RSVP**, and **families by party size**. The charts are hand-built SVG/CSS with no libraries, so the page still runs straight from `file://`.

## Motion & scrolling
The heavy animated background and scroll-snap were dropped, so scrolling is fully user-controllable and stays smooth on long pages. Only subtle, purposeful micro-motion remains — a soft fade when switching views and a small slide when guest/food rows are added or removed — all fully disabled under `prefers-reduced-motion`. The event type is chosen from a single dropdown instead of a chip strip.

## Responsive design
Layout uses fluid `clamp()` sizing and breakpoints for phones (≤680px), tablets (681–980px) and short/landscape screens, plus `env(safe-area-inset-*)` so content clears notches in landscape. On desktop (≥981px) the gutters shrink and the panels span the full width edge-to-edge, with the Summary laid out as a two-column grid. Inputs use 16px font on mobile to prevent iOS auto-zoom.
