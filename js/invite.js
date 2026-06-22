// ── Invitation Card ──────────────────────────────────────────────────────────
// A square (1:1) invitation card rendered straight onto a <canvas>. The design
// language is ultra-minimal Scandinavian — calm earth-toned paper, fine print
// grain, art-directed procedural imagery and a single muted accent per event —
// finished with a hint of glass-neumorphism: one frosted, softly-raised panel
// that holds every word, all of it set flush-left in an editorial rhythm.
//
// Drawn with the Canvas 2D API only — no libraries, no SVG-foreignObject
// tainting — so it exports as a clean PNG/JPG and still runs from file://. Each
// event type owns its palette, hand-drawn scene and wording, while a shared
// layout engine keeps every card composed and readable for WhatsApp.
//
// Borrows the globals from core.js ($, val, currentEvent) and is re-rendered
// from recalc()/setEvent() whenever the underlying event data changes.

const INVITE_SIZE = 1080;          // export resolution (1080×1080, ideal for WhatsApp)

// Canvas-filter (real frosted-glass blur) isn't universal; detect once and fall
// back to a plain translucent veil where it's missing so the card never breaks.
const ivSupportsFilter = (() => {
  try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; }
  catch (e) { return false; }
})();

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
// Left-aligned, letter-spaced text. Baseline/colour/font are set by the caller.
function ivSpacedL(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of String(text)) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  return cx - x - spacing;
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
      return { lines, size, lineHeight: Math.round(size * 1.1) };
  }
  ctx.font = `${weight} ${minSize}px ${family}`;
  let lines = build(minSize);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return { lines, size: minSize, lineHeight: Math.round(minSize * 1.1) };
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
// A small filled n-point star (used as a quiet accent in a couple of scenes).
function ivStar(ctx, cx, cy, r, points, color) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? r * 0.44 : r;
    const a = (Math.PI / points) * i - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

// ── Fine print grain ────────────────────────────────────────────────────────
// A single small monochrome noise tile, built once and tiled with `multiply`
// at a whisper of opacity — that matte, risograph paper feel without bloating
// the canvas or tainting the export.
let _ivGrainTile = null;
function ivGrainTile() {
  if (_ivGrainTile) return _ivGrainTile;
  const n = 140, oc = document.createElement('canvas');
  oc.width = oc.height = n;
  const octx = oc.getContext('2d');
  const img = octx.createImageData(n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (208 + Math.random() * 47) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  _ivGrainTile = oc;
  return oc;
}
function ivGrain(ctx, W, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(ivGrainTile(), 'repeat');
  ctx.fillRect(0, 0, W, W);
  ctx.restore();
}

// ── Procedural scenes ────────────────────────────────────────────────────────
// Each scene paints the upper "image" zone (0 → sceneBottom). Its lowest band
// slides under the glass panel and is gently frosted, so every scene reads as
// one calm, art-directed picture. All kept minimal: a few confident shapes.
function ivHill(ctx, W, baseY, peakY, bottomY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottomY);
  ctx.lineTo(0, baseY);
  ctx.quadraticCurveTo(W * 0.5, peakY, W, baseY);
  ctx.lineTo(W, bottomY);
  ctx.closePath();
  ctx.fill();
}
function ivArch(ctx, cx, topY, w, bottomY, fill, stroke, lw) {
  const half = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - half, bottomY);
  ctx.lineTo(cx - half, topY + half);
  ctx.arc(cx, topY + half, half, Math.PI, 0);
  ctx.lineTo(cx + half, bottomY);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function ivBlob(ctx, cx, cy, r, seed, fill) {
  const rnd = ivRng(seed), pts = 9;
  const rads = []; for (let i = 0; i < pts; i++) rads.push(r * (0.78 + rnd() * 0.4));
  ctx.beginPath();
  ctx.moveTo(cx + rads[0], cy);
  for (let i = 1; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = rads[i % pts];
    const am = a - Math.PI / pts, rm = r * (0.78 + ((rnd() * 0.4)));
    ctx.quadraticCurveTo(cx + Math.cos(am) * rm * 1.08, cy + Math.sin(am) * rm * 1.08, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

// Birthday — a soft sun setting into two quiet rolling hills.
function ivSceneSun(ctx, W, sb, p) {
  const s = p.scene;
  ctx.save();
  ctx.fillStyle = s[0];                                   // sun disc
  ctx.beginPath(); ctx.arc(W * 0.71, W * 0.165, 118, 0, 6.28); ctx.fill();
  ctx.strokeStyle = p.accent2; ctx.lineWidth = 2.4; ctx.globalAlpha = 0.45;  // halo ring
  ctx.beginPath(); ctx.arc(W * 0.71, W * 0.165, 150, 0, 6.28); ctx.stroke();
  ctx.globalAlpha = 1;
  ivHill(ctx, W, W * 0.295, W * 0.205, sb, s[1]);         // back hill (sage)
  ivHill(ctx, W, W * 0.345, W * 0.27, sb, s[2]);          // front hill (clay)
  // a few weightless confetti specks above the horizon
  const rnd = ivRng(7);
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(rnd() * W, rnd() * W * 0.22);
    ctx.rotate(rnd() * 6.28);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = i % 2 ? p.accent : p.accent2;
    ctx.fillRect(-7, -2.4, 14, 4.8);
    ctx.restore();
  }
  ctx.restore();
}
// Marriage — two interlocking stone arches, one drawn, one filled.
function ivSceneArches(ctx, W, sb, p) {
  const s = p.scene;
  ivArch(ctx, W * 0.435, W * 0.10, 300, sb, s[0], null, 0);        // back, filled (lighter)
  ivArch(ctx, W * 0.585, W * 0.09, 300, sb, s[1], p.accent, 3.2);  // front, filled + drawn
  ctx.save();                                                       // small inner keystone dot
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.arc(W * 0.585, W * 0.12, 7, 0, 6.28); ctx.fill();
  ctx.restore();
}
// Anniversary — two overlapping rings, a quiet union.
function ivSceneCircles(ctx, W, sb, p) {
  const s = p.scene;
  ctx.save();
  ctx.fillStyle = s[1]; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(W * 0.565, W * 0.20, 122, 0, 6.28); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3.2; ctx.strokeStyle = s[0];
  ctx.beginPath(); ctx.arc(W * 0.435, W * 0.20, 122, 0, 6.28); ctx.stroke();
  ctx.strokeStyle = p.accent;
  ctx.beginPath(); ctx.arc(W * 0.565, W * 0.20, 122, 0, 6.28); ctx.stroke();
  ctx.restore();
}
// Memorial — a single still lotus, drawn in fine dove-grey line, on a soft halo.
function ivSceneLotus(ctx, W, sb, p) {
  const s = p.scene, cx = W * 0.5, cy = W * 0.235;
  ctx.save();
  ctx.fillStyle = s[0];
  ctx.beginPath(); ctx.arc(cx, cy, 142, 0, 6.28); ctx.fill();        // halo
  ctx.translate(cx, cy + 70);
  ctx.strokeStyle = s[1]; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
  const petal = (rot, len, wid) => {
    ctx.save(); ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-wid, -len * 0.55, 0, -len);
    ctx.quadraticCurveTo(wid, -len * 0.55, 0, 0);
    ctx.stroke();
    ctx.restore();
  };
  [-0.78, -0.39, 0, 0.39, 0.78].forEach(r => petal(r, 132, 34));
  [-0.46, 0.46].forEach(r => petal(r, 150, 40));
  ctx.restore();
}
// Naming Ceremony — a soft crescent, a small cloud and a scatter of stars.
function ivSceneMoon(ctx, W, sb, p) {
  const s = p.scene, cx = W * 0.66, cy = W * 0.185;
  ctx.save();
  ctx.fillStyle = s[0];
  ctx.beginPath(); ctx.arc(cx, cy, 112, 0, 6.28); ctx.fill();
  ctx.fillStyle = p.paper;
  ctx.beginPath(); ctx.arc(cx + 46, cy - 22, 100, 0, 6.28); ctx.fill();   // carve crescent
  // soft cloud
  ctx.fillStyle = s[2];
  const cloud = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.28); ctx.arc(x + r, y + r * 0.2, r * 0.8, 0, 6.28);
    ctx.arc(x - r, y + r * 0.2, r * 0.8, 0, 6.28); ctx.arc(x + r * 0.4, y - r * 0.4, r * 0.7, 0, 6.28);
    ctx.fill();
  };
  cloud(W * 0.26, W * 0.34, 30);
  ivStar(ctx, W * 0.30, W * 0.13, 10, 5, p.accent);
  ivStar(ctx, W * 0.46, W * 0.30, 7, 5, p.accent2);
  ivStar(ctx, W * 0.82, W * 0.345, 6, 5, p.accent);
  ctx.restore();
}
// Graduation — a calm summit with a single warm point of light above it.
function ivScenePeak(ctx, W, sb, p) {
  const s = p.scene;
  ctx.save();
  ctx.fillStyle = s[2]; ctx.beginPath();                  // warm sun/star
  ctx.arc(W * 0.52, W * 0.115, 30, 0, 6.28); ctx.fill();
  const peak = (cx, baseW, topY, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx + baseW / 2, sb);
    ctx.lineTo(cx - baseW / 2, sb);
    ctx.closePath(); ctx.fill();
  };
  peak(W * 0.36, 580, W * 0.275, s[0]);                   // back peak (lighter)
  peak(W * 0.595, 680, W * 0.185, s[1]);                  // front peak (deeper)
  ctx.restore();
}
// Puja / Ritual — a sun rising from the panel's edge, with radiating arcs.
function ivSceneSunrise(ctx, W, sb, p) {
  const s = p.scene, cx = W * 0.5, base = sb - 124;       // sit on the glass seam
  ctx.save();
  ctx.lineWidth = 3.2;
  [[300, s[2]], [232, s[1]], [168, s[0]]].forEach(([r, col]) => {
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(cx, base, r, Math.PI, 0); ctx.stroke();
  });
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.arc(cx, base, 104, Math.PI, 0); ctx.fill();
  ctx.restore();
}
// Custom — two soft organic cut-outs, a quietly modern composition.
function ivSceneBlobs(ctx, W, sb, p) {
  const s = p.scene;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ivBlob(ctx, W * 0.4, W * 0.215, 150, 11, s[0]);
  ctx.globalAlpha = 0.78;
  ivBlob(ctx, W * 0.62, W * 0.235, 120, 29, s[1]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.arc(W * 0.74, W * 0.13, 12, 0, 6.28); ctx.fill();
  ctx.restore();
}

// ── Frosted-glass neumorphic panel ───────────────────────────────────────────
// One softly-raised pane of glass: a gentle drop shadow lifts it off the paper,
// a real blur frosts the scene behind it, a milky veil + top sheen give it body,
// and a bright top-left rim seals the glass edge.
function ivGlassPanel(ctx, canvas, x, y, w, h, r, p) {
  // raise it: translucent tint + soft drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(38,32,26,0.26)';
  ctx.shadowBlur = 52; ctx.shadowOffsetY = 28;
  ivRR(ctx, x, y, w, h, r);
  ctx.fillStyle = p.glass;
  ctx.fill();
  ctx.restore();

  // frost the scene showing through (falls back to a plain veil if unsupported)
  ctx.save();
  ivRR(ctx, x, y, w, h, r); ctx.clip();
  if (ivSupportsFilter) {
    ctx.filter = 'blur(20px)';
    ctx.drawImage(canvas, x - 24, y - 24, w + 48, h + 48, x - 24, y - 24, w + 48, h + 48);
    ctx.filter = 'none';
  }
  ctx.fillStyle = p.glassVeil;
  ctx.fillRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();

  // glass edges: bright outer rim + a faint inner accent hairline
  ctx.save();
  ivRR(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.62)'; ctx.stroke();
  ivRR(ctx, x + 12, y + 12, w - 24, h - 24, r - 9);
  ctx.lineWidth = 1; ctx.strokeStyle = p.glassLine; ctx.stroke();
  ctx.restore();
}

// ── Themes : one entry per event type ────────────────────────────────────────
// Each theme owns a muted Scandinavian palette, a procedural scene, its
// typography and wording. inviteTheme() falls back to "Custom Event".
const INVITE_THEMES = {
  'Birthday': {
    pal: {
      paper: '#f5eee1', paper2: '#efe5d4', ink: '#3b342b', sub: '#8a7f70',
      accent: '#cf8a5c', accent2: '#e3b487', scene: ['#e8b878', '#b3b58c', '#cba078'],
      glass: 'rgba(250,245,237,0.50)', glassVeil: 'rgba(255,252,246,0.30)', glassLine: 'rgba(207,138,92,0.30)'
    },
    titleFamily: '"Plus Jakarta Sans", sans-serif', titleWeight: 700, eventStyle: 'caps',
    kicker: "Hip hip hooray — you're invited", closing: 'Cake, candles and good company await.',
    scene: ivSceneSun
  },
  'Marriage': {
    pal: {
      paper: '#f3ede4', paper2: '#ece3d6', ink: '#36302a', sub: '#867c6e',
      accent: '#a07d4d', accent2: '#c9b083', scene: ['#dccdaf', '#cdba93', '#cabb9e'],
      glass: 'rgba(249,244,236,0.50)', glassVeil: 'rgba(255,252,245,0.28)', glassLine: 'rgba(169,140,95,0.32)'
    },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With joyful hearts, you are invited', closing: 'We request the pleasure of your company.',
    scene: ivSceneArches
  },
  'Anniversary': {
    pal: {
      paper: '#f4ece7', paper2: '#eee1da', ink: '#3a302d', sub: '#8a7873',
      accent: '#bd7d7d', accent2: '#d8a6a6', scene: ['#c1807f', '#e6c5c5', '#d8a6a6'],
      glass: 'rgba(250,243,240,0.50)', glassVeil: 'rgba(255,250,248,0.28)', glassLine: 'rgba(189,125,125,0.30)'
    },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With love, you are invited to celebrate', closing: 'Here is to love that only grows.',
    scene: ivSceneCircles
  },
  'Post-Funeral Rituals / Memorial': {
    pal: {
      paper: '#edeef1', paper2: '#e5e7ec', ink: '#3a3a42', sub: '#7f7f8a',
      accent: '#8c8c9a', accent2: '#b3b3c0', scene: ['#dcdce4', '#9a9aa8', '#b3b3c0'],
      glass: 'rgba(247,247,250,0.52)', glassVeil: 'rgba(255,255,255,0.30)', glassLine: 'rgba(140,140,154,0.30)'
    },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 500, eventStyle: 'serif',
    kicker: 'In loving memory · you are warmly invited', closing: 'Your presence will be a quiet comfort.',
    scene: ivSceneLotus
  },
  'Naming Ceremony': {
    pal: {
      paper: '#ecf1f1', paper2: '#e3edee', ink: '#34403e', sub: '#7c8a88',
      accent: '#6fa3a0', accent2: '#9cc7c3', scene: ['#a9cbc8', '#ffffff', '#d3e3e2'],
      glass: 'rgba(245,250,250,0.50)', glassVeil: 'rgba(255,255,255,0.30)', glassLine: 'rgba(111,163,160,0.30)'
    },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With joy, we invite you to the naming of', closing: 'Come shower our little one with blessings.',
    scene: ivSceneMoon
  },
  'Graduation': {
    pal: {
      paper: '#efe9dd', paper2: '#e8e0d0', ink: '#2f2c27', sub: '#827a6c',
      accent: '#5f7060', accent2: '#90a18f', scene: ['#94a48f', '#566a58', '#c59f49'],
      glass: 'rgba(249,245,237,0.50)', glassVeil: 'rgba(255,253,247,0.28)', glassLine: 'rgba(95,112,96,0.30)'
    },
    titleFamily: '"Plus Jakarta Sans", sans-serif', titleWeight: 700, eventStyle: 'caps',
    kicker: "You're invited to celebrate the graduation of", closing: 'The tassel was worth the hassle — join us.',
    scene: ivScenePeak
  },
  'Puja / Ritual': {
    pal: {
      paper: '#f4ecdd', paper2: '#eee2cd', ink: '#3a3025', sub: '#8a7c66',
      accent: '#c08a3e', accent2: '#e0b46f', scene: ['#d59a4a', '#e6bd82', '#f0d3a6'],
      glass: 'rgba(250,244,234,0.50)', glassVeil: 'rgba(255,251,243,0.28)', glassLine: 'rgba(192,138,62,0.30)'
    },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'With devotion, you are invited to', closing: 'Your blessings will grace the occasion.',
    scene: ivSceneSunrise
  },
  'Custom Event': {
    pal: {
      paper: '#eeedf2', paper2: '#e7e6ee', ink: '#302d3a', sub: '#7a7588',
      accent: '#7d75a8', accent2: '#a9a2cc', scene: ['#aaa0cd', '#cdc7e6', '#a9a2cc'],
      glass: 'rgba(248,247,251,0.50)', glassVeil: 'rgba(255,255,255,0.28)', glassLine: 'rgba(125,117,168,0.30)'
    },
    titleFamily: '"Cormorant Garamond", serif', titleWeight: 600, eventStyle: 'serif',
    kicker: 'You are cordially invited to', closing: 'We would love to have you with us.',
    scene: ivSceneBlobs
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

  // ── Paper + scene + grain ──
  ctx.clearRect(0, 0, W, W);
  const bg = ctx.createLinearGradient(0, 0, 0, W);
  bg.addColorStop(0, p.paper); bg.addColorStop(1, p.paper2);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);

  // ── Glass panel geometry (defined first so the scene can tuck beneath it) ──
  const PX = 80, PW = W - 160, PY = 396, PH = W - PY - 64, PR = 42;
  const sceneBottom = PY + 128;

  t.scene(ctx, W, sceneBottom, p);
  ivGrain(ctx, W, 0.06);

  ivGlassPanel(ctx, canvas, PX, PY, PW, PH, PR, p);

  // ── Content : everything flush-left in an editorial stack ──
  const cl = PX + 60;                 // content left edge
  const cw = PW - 120;                // content width
  const regTop = PY + 56, regBot = PY + PH - 52;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const titleFit = ivWrapFit(ctx, data.name || 'Your Event Name', cw - 4, t.titleFamily, t.titleWeight, 72, 40, 2);
  const blocks = [];

  // kicker, led by a small accent dot
  blocks.push({
    h: 24, gap: 26, draw: y => {
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.arc(cl + 5, y + 11, 5.5, 0, 6.28); ctx.fill();
      ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
      ivSpacedL(ctx, t.kicker.toUpperCase(), cl + 24, y, 2.2);
    }
  });
  // title (the name)
  blocks.push({
    h: titleFit.lines.length * titleFit.lineHeight, gap: 18, draw: y => {
      ctx.font = `${t.titleWeight} ${titleFit.size}px ${t.titleFamily}`;
      ctx.fillStyle = p.ink;
      titleFit.lines.forEach((ln, i) => ctx.fillText(ln, cl, y + i * titleFit.lineHeight));
    }
  });
  // event-type line
  blocks.push({
    h: 42, gap: 24, draw: y => {
      ctx.fillStyle = p.accent;
      if (t.eventStyle === 'caps') { ctx.font = '700 23px "Plus Jakarta Sans", sans-serif'; ivSpacedL(ctx, data.type.toUpperCase(), cl, y + 6, 3); }
      else { ctx.font = 'italic 600 36px "Cormorant Garamond", serif'; ctx.fillText(data.type, cl, y); }
    }
  });
  // short left-aligned rule with a terminal dot
  blocks.push({
    h: 12, gap: 28, draw: y => {
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cl, y + 6); ctx.lineTo(cl + 64, y + 6); ctx.stroke();
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.arc(cl + 78, y + 6, 4, 0, 6.28); ctx.fill();
    }
  });

  // detail blocks: a small label above its value(s), all flush-left
  const pushDetail = (label, parts, lastGap) => {
    blocks.push({ h: 18, gap: 8, draw: y => { ctx.font = '700 16px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = p.sub; ivSpacedL(ctx, label, cl, y, 2.6); } });
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      blocks.push({
        h: part.size + 6, gap: last ? lastGap : 5, draw: y => {
          ctx.font = `${part.weight} ${part.size}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillStyle = part.color;
          ctx.fillText(part.text, cl, y);
        }
      });
    });
  };

  if (data.when) {
    ctx.font = '600 29px "Plus Jakarta Sans", sans-serif';
    const lines = ivWrapLines(ctx, data.when, cw, 2).map(text => ({ text, size: 29, weight: 600, color: p.ink }));
    pushDetail('WHEN', lines, 24);
  }
  if (data.venue || data.addr) {
    const parts = [];
    if (data.venue) {
      ctx.font = '600 29px "Plus Jakarta Sans", sans-serif';
      ivWrapLines(ctx, data.venue, cw, 1).forEach(text => parts.push({ text, size: 29, weight: 600, color: p.ink }));
    }
    if (data.addr) {
      ctx.font = '500 23px "Plus Jakarta Sans", sans-serif';
      ivWrapLines(ctx, data.addr, cw, 2).forEach(text => parts.push({ text, size: 23, weight: 500, color: p.sub }));
    }
    pushDetail('WHERE', parts, 24);
  }

  // closing line — a soft, hand-set sign-off
  ctx.font = 'italic 500 26px "Cormorant Garamond", serif';
  const closeLines = ivWrapLines(ctx, t.closing, cw, 2);
  blocks.push({
    h: closeLines.length * 34, gap: 0, draw: y => {
      ctx.font = 'italic 500 26px "Cormorant Garamond", serif'; ctx.fillStyle = p.sub;
      closeLines.forEach((ln, i) => ctx.fillText(ln, cl, y + i * 34));
    }
  });

  // ── Vertically centre the stack within the panel; compress gaps if it's tall ──
  let total = blocks.reduce((s, b) => s + b.h + b.gap, 0) - blocks[blocks.length - 1].gap;
  const region = regBot - regTop;
  if (total > region) {
    const gapSum = blocks.reduce((s, b) => s + b.gap, 0);
    const shrink = gapSum ? Math.min(1, (total - region) / gapSum) : 0;
    blocks.forEach(b => { b.gap = Math.max(2, b.gap - b.gap * shrink); });
    total = blocks.reduce((s, b) => s + b.h + b.gap, 0) - blocks[blocks.length - 1].gap;
  }
  let y = regTop + Math.max(0, (region - total) / 2);
  blocks.forEach(b => { b.draw(y); y += b.h + b.gap; });

  // a final whisper of grain ties the glass back into the paper
  ivGrain(ctx, W, 0.03);

  // Keep the side-panel name input mirrored (without stealing the caret).
  const nameInp = $('inviteName');
  if (nameInp && document.activeElement !== nameInp && nameInp.value !== data.name) nameInp.value = data.name;
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
