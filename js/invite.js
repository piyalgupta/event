// ── Invitation Card ──────────────────────────────────────────────────────────
// A square (1:1) invitation card rendered straight onto a <canvas>, themed per
// event type and headlined by the "organised for" name. Drawn with the Canvas
// 2D API only — no libraries, no SVG-foreignObject tainting — so it exports as a
// clean PNG/JPG and still runs from file://. Each event type gets its own
// palette, motif, border and wording so no two cards look alike, while a shared
// layout engine keeps every one composed and readable for WhatsApp.
//
// Borrows the globals from core.js ($, val, currentEvent) and is re-rendered
// from recalc()/setEvent() whenever the underlying event data changes.

const INVITE_SIZE = 1080;          // export resolution (1080×1080, ideal for WhatsApp)
const INVITE_INSET = 74;           // decorative frame width around the inner panel

// ── Low-level canvas helpers ───────────────────────────────────────────────
function ivRR(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Centred, letter-spaced text. Baseline/colour/font are set by the caller.
function ivSpaced(ctx, text, cx, y, spacing) {
  text = String(text);
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((s, w) => s + w + spacing, 0) - spacing;
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i] + spacing; });
  ctx.textAlign = prevAlign;
  return total;
}
// Wrap + auto-shrink a headline so it fits maxW within maxLines. Returns the
// chosen lines, font size and line height.
function ivWrapFit(ctx, text, maxW, family, weight, maxSize, minSize, maxLines) {
  text = (text || '').trim();
  const build = size => {
    ctx.font = `${weight} ${size}px ${family}`;
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = build(size);
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxW)
      return { lines, size, lineHeight: Math.round(size * 1.08) };
  }
  // Floor: keep the first maxLines lines, ellipsing the last if it overflows.
  ctx.font = `${weight} ${minSize}px ${family}`;
  let lines = build(minSize);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return { lines, size: minSize, lineHeight: Math.round(minSize * 1.08) };
}
// Pretty event date: "Saturday, 12 July 2026  ·  7:00 PM".
function ivDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return '';
  const date = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return date + '  ·  ' + time;
}
// Tiny deterministic RNG so scattered decoration is stable between redraws.
function ivRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// ── Decorative motifs (each drawn centred on cx,cy, sized by s) ─────────────
function ivBalloons(ctx, cx, cy, s, pal) {
  const cols = pal.mot || [pal.accent, pal.accent2 || pal.accent, pal.ink];
  const set = [[-1.05, 0.12, 0], [0, -0.18, 1], [1.05, 0.12, 2]];
  // strings first
  ctx.save();
  ctx.strokeStyle = pal.line; ctx.lineWidth = s * 0.018;
  set.forEach(([dx, dy]) => {
    const bx = cx + dx * s * 0.42, by = cy + dy * s;
    ctx.beginPath();
    ctx.moveTo(bx, by + s * 0.62);
    ctx.quadraticCurveTo(cx + dx * s * 0.1, cy + s * 0.95, cx, cy + s * 1.05);
    ctx.stroke();
  });
  set.forEach(([dx, dy, ci]) => {
    const bx = cx + dx * s * 0.42, by = cy + dy * s;
    ctx.fillStyle = cols[ci % cols.length];
    ctx.beginPath();
    ctx.ellipse(bx, by, s * 0.34, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // knot
    ctx.beginPath();
    ctx.moveTo(bx - s * 0.05, by + s * 0.42);
    ctx.lineTo(bx + s * 0.05, by + s * 0.42);
    ctx.lineTo(bx, by + s * 0.5);
    ctx.closePath();
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.ellipse(bx - s * 0.12, by - s * 0.14, s * 0.08, s * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
function ivRings(ctx, cx, cy, s, pal) {
  ctx.save();
  ctx.lineWidth = s * 0.13;
  const grd = ctx.createLinearGradient(cx - s, cy, cx + s, cy);
  grd.addColorStop(0, pal.accent); grd.addColorStop(1, pal.accent2 || pal.accent);
  ctx.strokeStyle = grd;
  ctx.beginPath(); ctx.arc(cx - s * 0.42, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + s * 0.42, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke();
  ivSparkle(ctx, cx, cy - s * 0.7, s * 0.34, pal);
  ctx.restore();
}
function ivHeart(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.62);
  ctx.bezierCurveTo(cx - s * 1.1, cy - s * 0.25, cx - s * 0.45, cy - s * 0.95, cx, cy - s * 0.32);
  ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.95, cx + s * 1.1, cy - s * 0.25, cx, cy + s * 0.62);
  ctx.closePath();
}
function ivHearts(ctx, cx, cy, s, pal) {
  ctx.save();
  const grd = ctx.createLinearGradient(cx, cy - s, cx, cy + s);
  grd.addColorStop(0, pal.accent2 || pal.accent); grd.addColorStop(1, pal.accent);
  ctx.fillStyle = grd;
  ivHeart(ctx, cx - s * 0.34, cy, s * 0.7); ctx.fill();
  ctx.fillStyle = pal.panel;
  ivHeart(ctx, cx + s * 0.36, cy + s * 0.02, s * 0.72); ctx.fill();
  ctx.lineWidth = s * 0.07; ctx.strokeStyle = ctx.fillStyle = grd;
  ivHeart(ctx, cx + s * 0.36, cy + s * 0.02, s * 0.72); ctx.stroke();
  ctx.restore();
}
function ivLotus(ctx, cx, cy, s, pal) {
  // Serene lotus — for memorials. Soft, symmetrical petals.
  ctx.save();
  ctx.translate(cx, cy + s * 0.35);
  const petal = (rot, len, wid, fill) => {
    ctx.save(); ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-wid, -len * 0.55, 0, -len);
    ctx.quadraticCurveTo(wid, -len * 0.55, 0, 0);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = pal.line; ctx.lineWidth = s * 0.012; ctx.stroke();
    ctx.restore();
  };
  const back = pal.accent2 || pal.accent;
  [-0.85, -0.42, 0, 0.42, 0.85].forEach(r => petal(r, s * 0.92, s * 0.2, back));
  [-0.5, 0, 0.5].forEach(r => petal(r, s * 1.05, s * 0.24, pal.accent));
  ctx.restore();
}
function ivStarsMotif(ctx, cx, cy, s, pal) {
  // Crescent moon + little stars — gentle, for a naming ceremony.
  ctx.save();
  ctx.fillStyle = pal.accent;
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.panel;
  ctx.beginPath(); ctx.arc(cx + s * 0.26, cy - s * 0.12, s * 0.56, 0, Math.PI * 2); ctx.fill();
  const star = (x, y, r, c) => { ivStar(ctx, x, y, r, 5, c); };
  star(cx + s * 0.8, cy - s * 0.55, s * 0.2, pal.accent2 || pal.accent);
  star(cx - s * 0.78, cy + s * 0.5, s * 0.16, pal.accent2 || pal.accent);
  star(cx + s * 0.62, cy + s * 0.62, s * 0.12, pal.accent);
  ctx.restore();
}
function ivStar(ctx, cx, cy, r, points, color) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (Math.PI / points) * i - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function ivCap(ctx, cx, cy, s, pal) {
  // Graduation mortarboard with a tassel.
  ctx.save();
  ctx.fillStyle = pal.accent;
  // board (diamond)
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.62);
  ctx.lineTo(cx + s * 1.05, cy - s * 0.16);
  ctx.lineTo(cx, cy + s * 0.3);
  ctx.lineTo(cx - s * 1.05, cy - s * 0.16);
  ctx.closePath(); ctx.fill();
  // cap base
  ctx.fillStyle = pal.accent2 || pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.04);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.04);
  ctx.lineTo(cx + s * 0.42, cy + s * 0.42);
  ctx.quadraticCurveTo(cx, cy + s * 0.56, cx - s * 0.42, cy + s * 0.42);
  ctx.closePath(); ctx.fill();
  // button + tassel
  ctx.fillStyle = pal.accent;
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.16, s * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = pal.accent; ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.16);
  ctx.lineTo(cx + s * 0.7, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.7, cy + s * 0.4);
  ctx.stroke();
  ivStar(ctx, cx + s * 0.7, cy + s * 0.5, s * 0.13, 4, pal.accent);
  ctx.restore();
}
function ivDiya(ctx, cx, cy, s, pal) {
  // Lit oil lamp (diya) — for puja / ritual cards.
  ctx.save();
  // flame
  const fg = ctx.createLinearGradient(cx, cy - s * 0.9, cx, cy - s * 0.1);
  fg.addColorStop(0, '#ffd76b'); fg.addColorStop(0.6, pal.accent2 || '#f29b1e'); fg.addColorStop(1, pal.accent);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.9);
  ctx.bezierCurveTo(cx + s * 0.34, cy - s * 0.5, cx + s * 0.18, cy - s * 0.1, cx, cy - s * 0.12);
  ctx.bezierCurveTo(cx - s * 0.18, cy - s * 0.1, cx - s * 0.34, cy - s * 0.5, cx, cy - s * 0.9);
  ctx.closePath(); ctx.fill();
  // glow
  ctx.fillStyle = 'rgba(255,221,120,.28)';
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.45, s * 0.7, 0, Math.PI * 2); ctx.fill();
  // lamp bowl
  const bg = ctx.createLinearGradient(cx, cy, cx, cy + s * 0.55);
  bg.addColorStop(0, pal.accent2 || pal.accent); bg.addColorStop(1, pal.accent);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.95, cy + s * 0.02);
  ctx.quadraticCurveTo(cx, cy + s * 0.78, cx + s * 0.95, cy + s * 0.02);
  ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.12, cx, cy + s * 0.12);
  ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.12, cx - s * 0.95, cy + s * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function ivSparkle(ctx, cx, cy, s, pal) {
  // 4-point glint used on its own (custom) and atop the rings.
  ctx.save();
  const grd = ctx.createLinearGradient(cx - s, cy, cx + s, cy);
  grd.addColorStop(0, pal.accent); grd.addColorStop(1, pal.accent2 || pal.accent);
  ctx.fillStyle = grd;
  const arm = (lx, ly) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + lx * 0.12, cy + ly * 0.12, cx + lx, cy + ly);
    ctx.quadraticCurveTo(cx + lx * 0.12, cy - ly * 0.12, cx, cy);
    ctx.quadraticCurveTo(cx - lx * 0.12, cy + ly * 0.12, cx, cy);
    ctx.fill();
  };
  // draw a 4-point star via two crossed kite shapes
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.quadraticCurveTo(cx + s * 0.16, cy - s * 0.16, cx + s, cy);
  ctx.quadraticCurveTo(cx + s * 0.16, cy + s * 0.16, cx, cy + s);
  ctx.quadraticCurveTo(cx - s * 0.16, cy + s * 0.16, cx - s, cy);
  ctx.quadraticCurveTo(cx - s * 0.16, cy - s * 0.16, cx, cy - s);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ── Scattered background decoration (shown in the frame around the panel) ───
function ivScatter(ctx, W, draw, count, seed) {
  const rnd = ivRng(seed);
  for (let i = 0; i < count; i++) {
    const x = rnd() * W, y = rnd() * W;
    draw(x, y, rnd, i);
  }
}

// ── Ornamental corner flourishes (drawn in the decorative frame) ────────────
function ivCorners(ctx, W, pal, ornate) {
  const m = INVITE_INSET * 0.46;          // distance from the very edge
  const len = ornate ? 64 : 46;
  ctx.save();
  ctx.strokeStyle = pal.frameInk || pal.accent;
  ctx.lineWidth = ornate ? 3 : 2.2;
  ctx.lineCap = 'round';
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, W - m, 1, -1], [W - m, W - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * len, y);
    ctx.stroke();
    if (ornate) {
      ctx.beginPath();
      ctx.moveTo(x + sx * len, y);
      ctx.quadraticCurveTo(x + sx * (len + 22), y + sy * 4, x + sx * (len + 16), y + sy * 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + sy * len);
      ctx.quadraticCurveTo(x + sx * 4, y + sy * (len + 22), x + sx * 26, y + sy * (len + 16));
      ctx.stroke();
      ivStar(ctx, x, y, 6, 4, pal.frameInk || pal.accent);
    }
  });
  ctx.restore();
}

// ── Themes : one entry per event type ───────────────────────────────────────
// Each theme owns its background, panel surface + border, decorative motif,
// typography and wording. inviteTheme() falls back to "Custom Event".
const INVITE_THEMES = {
  'Birthday': {
    pal: { panel: '#fffaf2', ink: '#c42c6b', sub: '#7c5a63', accent: '#ff5d8f', accent2: '#ffb43d', line: 'rgba(196,44,107,.28)', frameInk: '#ffffff', mot: ['#ff5d8f', '#ffb43d', '#6ad1e3'] },
    titleFamily: '"Plus Jakarta Sans", sans-serif', titleWeight: 800, eventStyle: 'caps',
    kicker: "Hip Hip Hooray — You're Invited", closing: 'Cake, candles & good company await!',
    motif: ivBalloons,
    bg(ctx, W, p) {
      const g = ctx.createLinearGradient(0, 0, W, W);
      g.addColorStop(0, '#ff7eb3'); g.addColorStop(.5, '#ff9a6c'); g.addColorStop(1, '#ffd56b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      const r = ctx.createRadialGradient(W * .5, W * .2, 0, W * .5, W * .2, W * .7);
      r.addColorStop(0, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, W);
      const cols = ['#ffffff', '#ffe16b', '#6ad1e3', '#ff5d8f', '#7c5cff'];
      ivScatter(ctx, W, (x, y, rnd) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * 6.28);
        ctx.fillStyle = cols[(rnd() * cols.length) | 0]; ctx.globalAlpha = .9;
        ctx.fillRect(-7, -3, 14, 6); ctx.restore();
      }, 90, 7);
    }
  },
  'Marriage': {
    pal: { panel: '#fffdf4', ink: '#6e1023', sub: '#8a6a52', accent: '#b8902e', accent2: '#d8b25a', line: 'rgba(184,144,46,.4)', frameInk: '#e7c989', mot: ['#b8902e', '#d8b25a'] },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With Joyful Hearts, You Are Invited', closing: 'We request the pleasure of your company',
    motif: ivRings, ornate: true, doubleBorder: true,
    bg(ctx, W, p) {
      const g = ctx.createLinearGradient(0, 0, W, W);
      g.addColorStop(0, '#5b0d22'); g.addColorStop(.5, '#7a1430'); g.addColorStop(1, '#3f0a1c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      const r = ctx.createRadialGradient(W * .5, W * .5, W * .1, W * .5, W * .5, W * .75);
      r.addColorStop(0, 'rgba(216,178,90,.18)'); r.addColorStop(1, 'rgba(216,178,90,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, W);
      ivScatter(ctx, W, (x, y, rnd) => {
        ctx.fillStyle = 'rgba(231,201,137,' + (.35 + rnd() * .4) + ')';
        ctx.beginPath(); ctx.arc(x, y, 1.2 + rnd() * 2.6, 0, 6.28); ctx.fill();
      }, 120, 21);
    }
  },
  'Anniversary': {
    pal: { panel: '#fff7f3', ink: '#8a2f4e', sub: '#8a6258', accent: '#c8607e', accent2: '#caa06a', line: 'rgba(200,96,126,.3)', frameInk: '#e2a9b8', mot: ['#c8607e', '#caa06a'] },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With Love, You Are Invited to Celebrate', closing: "Here's to love that only grows",
    motif: ivHearts,
    bg(ctx, W, p) {
      const g = ctx.createLinearGradient(0, 0, 0, W);
      g.addColorStop(0, '#f7d6c9'); g.addColorStop(.5, '#f3b9c6'); g.addColorStop(1, '#e9c7a0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      const r = ctx.createRadialGradient(W * .5, W * .3, 0, W * .5, W * .3, W * .7);
      r.addColorStop(0, 'rgba(255,255,255,.42)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, W);
      ivScatter(ctx, W, (x, y, rnd) => {
        ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = '#d57a92';
        ivHeart(ctx, x, y, 5 + rnd() * 6); ctx.fill(); ctx.restore();
      }, 46, 33);
    }
  },
  'Post-Funeral Rituals / Memorial': {
    pal: { panel: '#f7f6f1', ink: '#33323e', sub: '#5f5d6b', accent: '#7d7a92', accent2: '#a9a3bf', line: 'rgba(125,122,146,.3)', frameInk: '#a9a3bf', mot: ['#8e8aa6', '#bcb7cf'] },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'In Loving Memory · You Are Warmly Invited', closing: 'Your presence will be a quiet comfort',
    motif: ivLotus,
    bg(ctx, W, p) {
      const g = ctx.createLinearGradient(0, 0, 0, W);
      g.addColorStop(0, '#e9e8ef'); g.addColorStop(.5, '#dfe0e8'); g.addColorStop(1, '#d2d3de');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      const r = ctx.createRadialGradient(W * .5, W * .32, 0, W * .5, W * .32, W * .72);
      r.addColorStop(0, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, W);
    }
  },
  'Naming Ceremony': {
    pal: { panel: '#fcfdff', ink: '#3a6ea5', sub: '#6a7a8f', accent: '#5aa9e0', accent2: '#ffb38a', line: 'rgba(90,169,224,.3)', frameInk: '#bcdcf2', mot: ['#5aa9e0', '#ffb38a', '#86d6c0'] },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With Joy, We Invite You to the Naming of', closing: 'Come shower our little one with blessings',
    motif: ivStarsMotif,
    bg(ctx, W, p) {
      const g = ctx.createLinearGradient(0, 0, W, W);
      g.addColorStop(0, '#cdeafe'); g.addColorStop(.5, '#e4f3ff'); g.addColorStop(1, '#ffe7d6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      // soft clouds
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      const cloud = (x, y, s) => {
        ctx.beginPath();
        ctx.arc(x, y, s, 0, 6.28); ctx.arc(x + s, y + s * .2, s * .8, 0, 6.28);
        ctx.arc(x - s, y + s * .2, s * .8, 0, 6.28); ctx.arc(x + s * .4, y - s * .4, s * .7, 0, 6.28);
        ctx.fill();
      };
      cloud(W * .2, W * .14, 26); cloud(W * .82, W * .2, 20); cloud(W * .68, W * .9, 24);
      ivScatter(ctx, W, (x, y, rnd) => ivStar(ctx, x, y, 3 + rnd() * 5, 5, 'rgba(255,255,255,.85)'), 40, 11);
    }
  },
  'Graduation': {
    pal: { panel: '#0f1b3d', ink: '#f6f1e3', sub: '#c3c8de', accent: '#d9b25a', accent2: '#f0d089', line: 'rgba(217,178,90,.5)', frameInk: '#0f1b3d', mot: ['#d9b25a', '#f0d089'] },
    titleFamily: '"Plus Jakarta Sans", sans-serif', titleWeight: 800, eventStyle: 'caps',
    kicker: "You're Invited to Celebrate the Graduation of", closing: 'The tassel was worth the hassle — join us!',
    motif: ivCap,
    bg(ctx, W, p) {
      const g = ctx.createLinearGradient(0, 0, W, W);
      g.addColorStop(0, '#f1e6c6'); g.addColorStop(.5, '#e8d6a6'); g.addColorStop(1, '#d9c089');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      ivScatter(ctx, W, (x, y, rnd) => {
        ctx.fillStyle = 'rgba(120,90,30,' + (.18 + rnd() * .2) + ')';
        ctx.beginPath(); ctx.arc(x, y, 1.5 + rnd() * 2.2, 0, 6.28); ctx.fill();
      }, 80, 5);
    }
  },
  'Puja / Ritual': {
    pal: { panel: '#fff7e9', ink: '#a8301a', sub: '#8a5a36', accent: '#e0731e', accent2: '#f2a31e', line: 'rgba(224,115,30,.36)', frameInk: '#f2a31e', mot: ['#e0731e', '#f2a31e'] },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With Devotion, You Are Invited to', closing: 'Your blessings will grace the occasion',
    motif: ivDiya, ornate: true,
    bg(ctx, W, p) {
      const g = ctx.createRadialGradient(W * .5, W * .42, W * .08, W * .5, W * .5, W * .8);
      g.addColorStop(0, '#ffb24d'); g.addColorStop(.55, '#f07d22'); g.addColorStop(1, '#c8331a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      // marigold dot ring around the frame
      const cx = W / 2, cy = W / 2, R = W * .46;
      for (let a = 0; a < 6.28; a += 0.16) {
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.fillStyle = a % 0.32 < 0.16 ? '#ffd76b' : '#fff1cf';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.28); ctx.fill();
      }
    }
  },
  'Custom Event': {
    pal: { panel: '#ffffff', ink: '#2a2550', sub: '#5b567e', accent: '#7c5cff', accent2: '#e0498f', line: 'rgba(124,92,255,.28)', frameInk: '#ffffff', mot: ['#7c5cff', '#e0498f', '#0fb5c4'] },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'You Are Cordially Invited to', closing: "We'd love to have you with us",
    motif: ivSparkle,
    bg(ctx, W, p) {
      const g = ctx.createLinearGradient(0, 0, W, W);
      g.addColorStop(0, '#7b54f0'); g.addColorStop(.4, '#9b4dde'); g.addColorStop(.72, '#e0498f'); g.addColorStop(1, '#f6913d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      const r = ctx.createRadialGradient(W * .5, W * .22, 0, W * .5, W * .22, W * .7);
      r.addColorStop(0, 'rgba(255,255,255,.32)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, W);
      ivScatter(ctx, W, (x, y, rnd) => ivStar(ctx, x, y, 2 + rnd() * 5, 4, 'rgba(255,255,255,.8)'), 60, 9);
    }
  }
};
function inviteTheme(name) { return INVITE_THEMES[name] || INVITE_THEMES['Custom Event']; }

// Prettier event-type label for the card (the long memorial value is shortened).
function inviteTypeLabel(type) {
  if (type === 'Post-Funeral Rituals / Memorial') return 'Prayer Meeting & Remembrance';
  if (type === 'Puja / Ritual') return 'Puja & Ritual';
  if (type === 'Custom Event') return 'A Special Occasion';
  return type;
}

// ── Draw the card ────────────────────────────────────────────────────────────
function drawInvite() {
  const canvas = $('inviteCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = INVITE_SIZE;
  const t = inviteTheme(currentEvent);
  const p = t.pal;
  const data = {
    name: (val('organizedFor') || '').trim(),
    type: inviteTypeLabel(currentEvent),
    when: ivDate(val('eventDate')),
    venue: (val('venueName') || '').trim(),
    addr: (val('venueAddr') || '').trim().replace(/\s*\n\s*/g, ', ')
  };

  ctx.clearRect(0, 0, W, W);
  t.bg(ctx, W, p);
  ivCorners(ctx, W, p, t.ornate);

  // ── Inner panel ──
  const ins = INVITE_INSET, pw = W - ins * 2;
  ctx.save();
  ctx.shadowColor = 'rgba(20,12,40,.32)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 22;
  ivRR(ctx, ins, ins, pw, pw, 38); ctx.fillStyle = p.panel; ctx.fill();
  ctx.restore();
  // border(s)
  ctx.strokeStyle = p.accent; ctx.lineWidth = 2.5;
  ivRR(ctx, ins + 18, ins + 18, pw - 36, pw - 36, 26); ctx.stroke();
  if (t.doubleBorder) {
    ctx.lineWidth = 1.2;
    ivRR(ctx, ins + 26, ins + 26, pw - 52, pw - 52, 20); ctx.stroke();
  }

  // ── Compose the content as vertically-centred blocks ──
  const cx = W / 2;
  const pad = 78;
  const contentW = pw - pad * 2;
  const regTop = ins + pad, regBot = ins + pw - pad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const titleFit = ivWrapFit(ctx, data.name || 'Your Event Name', contentW, t.titleFamily, t.titleWeight, 104, 48, 2);
  const blocks = [];

  // motif
  blocks.push({ h: 132, gap: 30, draw: y => t.motif(ctx, cx, y + 60, 58, p) });
  // kicker
  blocks.push({ h: 26, gap: 22, draw: y => { ctx.font = '700 23px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = p.sub; ivSpaced(ctx, t.kicker.toUpperCase(), cx, y, 2.4); } });
  // divider
  blocks.push({ h: 16, gap: 26, draw: y => ivOrnDivider(ctx, cx, y + 8, 120, p) });
  // title
  blocks.push({
    h: titleFit.lines.length * titleFit.lineHeight, gap: 16, draw: y => {
      ctx.font = `${t.titleWeight} ${titleFit.size}px ${t.titleFamily}`;
      ctx.fillStyle = p.ink;
      titleFit.lines.forEach((ln, i) => {
        if (t.eventStyle === 'caps') { ctx.font = `${t.titleWeight} ${titleFit.size}px ${t.titleFamily}`; ctx.fillText(ln, cx, y + i * titleFit.lineHeight); }
        else ctx.fillText(ln, cx, y + i * titleFit.lineHeight);
      });
    }
  });
  // event-type line
  blocks.push({
    h: 44, gap: 30, draw: y => {
      if (t.eventStyle === 'caps') { ctx.font = '700 27px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = p.accent; ivSpaced(ctx, data.type.toUpperCase(), cx, y + 6, 3); }
      else { ctx.font = 'italic 600 40px "Cormorant Garamond", serif'; ctx.fillStyle = p.accent; ctx.fillText(data.type, cx, y); }
    }
  });
  // divider
  blocks.push({ h: 16, gap: 30, draw: y => ivOrnDivider(ctx, cx, y + 8, 120, p) });

  // details
  const detail = (label, lines, valSize) => {
    blocks.push({ h: 20, gap: 8, draw: y => { ctx.font = '700 19px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = p.accent; ivSpaced(ctx, label, cx, y, 3); } });
    lines.forEach((ln, i) => {
      blocks.push({ h: valSize + 6, gap: i === lines.length - 1 ? 26 : 6, draw: y => { ctx.font = `600 ${valSize}px "Plus Jakarta Sans", sans-serif`; ctx.fillStyle = p.ink; ctx.fillText(ln, cx, y); } });
    });
  };
  if (data.when) {
    ctx.font = '600 31px "Plus Jakarta Sans", sans-serif';
    const wl = ivWrapLines(ctx, data.when, contentW, 2);
    detail('WHEN', wl, 31);
  }
  if (data.venue || data.addr) {
    ctx.font = '600 31px "Plus Jakarta Sans", sans-serif';
    const lines = [];
    if (data.venue) lines.push(...ivWrapLines(ctx, data.venue, contentW, 1));
    if (data.addr) { ctx.font = '500 25px "Plus Jakarta Sans", sans-serif'; ivWrapLines(ctx, data.addr, contentW, 2).forEach(l => lines.push({ text: l, small: true })); }
    // render WHERE manually to mix sizes
    blocks.push({ h: 20, gap: 8, draw: y => { ctx.font = '700 19px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = p.accent; ivSpaced(ctx, 'WHERE', cx, y, 3); } });
    lines.forEach((ln, i) => {
      const small = typeof ln === 'object';
      const text = small ? ln.text : ln;
      const size = small ? 25 : 31;
      blocks.push({ h: size + 6, gap: i === lines.length - 1 ? 26 : 6, draw: y => { ctx.font = `${small ? 500 : 600} ${size}px "Plus Jakarta Sans", sans-serif`; ctx.fillStyle = small ? p.sub : p.ink; ctx.fillText(text, cx, y); } });
    });
  }

  // closing line
  ctx.font = 'italic 500 28px "Cormorant Garamond", serif';
  const closeLines = ivWrapLines(ctx, t.closing, contentW, 2);
  blocks.push({
    h: closeLines.length * 36, gap: 0, draw: y => {
      ctx.font = 'italic 500 28px "Cormorant Garamond", serif'; ctx.fillStyle = p.sub;
      closeLines.forEach((ln, i) => ctx.fillText(ln, cx, y + i * 36));
    }
  });

  // ── Vertically centre the stack within the content region ──
  let total = blocks.reduce((s, b) => s + b.h + b.gap, 0) - (blocks.length ? blocks[blocks.length - 1].gap : 0);
  const region = regBot - regTop;
  let y = regTop + Math.max(0, (region - total) / 2);
  // if content is taller than the region, compress gaps proportionally
  if (total > region) {
    const gapSum = blocks.reduce((s, b) => s + b.gap, 0);
    const shrink = gapSum ? Math.max(0, (total - region)) / gapSum : 0;
    blocks.forEach(b => { b.gap = Math.max(2, b.gap - b.gap * Math.min(1, shrink)); });
    total = blocks.reduce((s, b) => s + b.h + b.gap, 0) - blocks[blocks.length - 1].gap;
    y = regTop + Math.max(0, (region - total) / 2);
  }
  blocks.forEach(b => { b.draw(y); y += b.h + b.gap; });

  // Keep the side-panel name input mirrored (without stealing the caret).
  const nameInp = $('inviteName');
  if (nameInp && document.activeElement !== nameInp && nameInp.value !== data.name) nameInp.value = data.name;
}

// Ornamental centred divider: a hairline with a small diamond at its middle.
function ivOrnDivider(ctx, cx, y, half, p) {
  ctx.save();
  const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, p.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = g; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 16, y);
  ctx.moveTo(cx + 16, y); ctx.lineTo(cx + half, y); ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.save(); ctx.translate(cx, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
  ctx.restore();
}

// Wrap text to <= maxLines using the ctx's CURRENT font; returns the lines.
function ivWrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const tt = cur ? cur + ' ' + w : w;
    if (ctx.measureText(tt).width <= maxW || !cur) cur = tt;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

// ── Render hook + download ───────────────────────────────────────────────────
// Only paint while the Invitation view is on screen — it's the one place the
// canvas is visible, and recalc() calls this on every keystroke.
function renderInvite() {
  const sec = $('view-invite');
  if (!sec || !sec.classList.contains('active')) return;
  drawInvite();
}
function syncInviteName(v) {
  setVal('organizedFor', v);
  if (typeof recalc === 'function') recalc();
}
function downloadInvite(type) {
  const canvas = $('inviteCanvas');
  if (!canvas) return;
  drawInvite();   // ensure the export reflects the latest data
  const jpg = type === 'jpg';
  const mime = jpg ? 'image/jpeg' : 'image/png';
  const base = ((val('organizedFor') || 'event').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'event');
  const fname = base + '-invitation.' + (jpg ? 'jpg' : 'png');
  const trigger = href => {
    const a = document.createElement('a');
    a.href = href; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
  };
  if (canvas.toBlob) {
    canvas.toBlob(blob => {
      if (!blob) { trigger(canvas.toDataURL(mime, jpg ? 0.95 : undefined)); return; }
      const url = URL.createObjectURL(blob);
      trigger(url);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, mime, jpg ? 0.95 : undefined);
  } else {
    trigger(canvas.toDataURL(mime, jpg ? 0.95 : undefined));
  }
}

// Fonts load asynchronously; redraw once they're ready so the card uses the
// brand typefaces rather than a fallback.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => renderInvite());
}
