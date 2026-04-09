// js/chars.js — 48×72 pixel art character renderer

const PALETTES = [
  { skin:'#f5c5a3', skinS:'#d4956a', hair:'#3d2b1f', hairH:'#6b4c38', shirt:'#e74c3c', shirtS:'#c0392b', pants:'#2c3e50', pantsS:'#1a252f', shoes:'#1a1a1a', belt:'#333', eyes:'#2c1810', mouth:'#c07060' },
  { skin:'#c68642', skinS:'#a0622e', hair:'#1a1a1a', hairH:'#444',    shirt:'#3498db', shirtS:'#2175a0', pants:'#1a252f', pantsS:'#0d1520', shoes:'#2c1810', belt:'#111', eyes:'#1a3a1a', mouth:'#aa7050' },
  { skin:'#f5c5a3', skinS:'#d4956a', hair:'#d4a800', hairH:'#f0c820', shirt:'#9b59b6', shirtS:'#7d3f9a', pants:'#1a1a2e', pantsS:'#0d0d1a', shoes:'#111',    belt:'#333', eyes:'#224422', mouth:'#c07060' },
  { skin:'#e8b88a', skinS:'#c89060', hair:'#6b3a2a', hairH:'#8b5a3a', shirt:'#27ae60', shirtS:'#1a8a45', pants:'#0d1b0d', pantsS:'#060e06', shoes:'#1a1a1a', belt:'#222', eyes:'#1a2a3a', mouth:'#b07060' },
  { skin:'#f5c5a3', skinS:'#d4956a', hair:'#111',    hairH:'#3a3a3a', shirt:'#e67e22', shirtS:'#c05a10', pants:'#2c3e50', pantsS:'#1a252f', shoes:'#222',    belt:'#111', eyes:'#331a00', mouth:'#c07060' },
  { skin:'#c9956c', skinS:'#a07040', hair:'#2c1810', hairH:'#4a2820', shirt:'#1abc9c', shirtS:'#148a70', pants:'#0d2020', pantsS:'#061010', shoes:'#111',    belt:'#333', eyes:'#1a1a3a', mouth:'#a06848' },
  { skin:'#f5c5a3', skinS:'#d4956a', hair:'#a0522d', hairH:'#c07040', shirt:'#e91e63', shirtS:'#b01045', pants:'#1a0a14', pantsS:'#0d050a', shoes:'#222',    belt:'#111', eyes:'#2a1a2a', mouth:'#c07060' },
  { skin:'#d4956a', skinS:'#b07040', hair:'#1c1c1c', hairH:'#404040', shirt:'#f1c40f', shirtS:'#c9a800', pants:'#1a1a00', pantsS:'#0d0d00', shoes:'#111',    belt:'#222', eyes:'#1a1a00', mouth:'#a06848' },
  { skin:'#ffe0bd', skinS:'#ddb090', hair:'#4a2600', hairH:'#6b3a10', shirt:'#00bcd4', shirtS:'#008fa0', pants:'#002020', pantsS:'#001010', shoes:'#111',    belt:'#333', eyes:'#001a1a', mouth:'#c09070' },
  { skin:'#b06040', skinS:'#8a4020', hair:'#111',    hairH:'#333',    shirt:'#ff9800', shirtS:'#cc6600', pants:'#1a0d00', pantsS:'#0d0600', shoes:'#222',    belt:'#111', eyes:'#1a0a00', mouth:'#904838' },
  { skin:'#f5c5a3', skinS:'#d4956a', hair:'#888',    hairH:'#bbb',    shirt:'#607d8b', shirtS:'#455a64', pants:'#1a2025', pantsS:'#0d1015', shoes:'#111',    belt:'#222', eyes:'#1a2a3a', mouth:'#c07060' },
  { skin:'#c68642', skinS:'#a0622e', hair:'#222',    hairH:'#4a4a4a', shirt:'#8bc34a', shirtS:'#619a20', pants:'#0d1500', pantsS:'#060a00', shoes:'#111',    belt:'#333', eyes:'#0a1a00', mouth:'#aa7050' },
];

const PERSONALITIES = [
  'enthusiastic and slightly chaotic, loves new tech, always excited about the next thing',
  'calm and methodical, delivers dry witty one-liners, extremely reliable under pressure',
  'creative and curious, always asking "but what if we tried..." and usually right',
  'no-nonsense pragmatist, maximum impact minimum words, gets it done',
  'warm and supportive, great at explaining complex things simply, team cheerleader',
  'skeptical but fair, plays devil\'s advocate, usually right about the risks',
  'detail-obsessed perfectionist who notices everything everyone else misses',
  'big-picture thinker who connects dots across projects in surprising ways',
  'quietly hilarious, says little but when they do speak it lands perfectly',
  'organised to a fault, runs everything with colour-coded precision',
  'natural mediator, somehow makes everyone feel heard and keeps meetings on track',
  'chaotically brilliant, idea machine, needs someone to help land the plane',
];

/**
 * Draw a 48×72 pixel character.
 * frame: 0=stand, 1=walkA, 2=walkB, 3=forward (coming toward camera — slightly wider/taller pose)
 */
function drawPixelChar(ctx, p, frame) {
  frame = frame || 0;
  ctx.clearRect(0, 0, 48, 72);

  const px = (x, y, c, w, h) => {
    if (x < 0 || y < 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w || 1, h || 1);
  };

  const isFwd = frame === 3;
  const swA   = frame === 1 ? 2 : frame === 2 ? -2 : isFwd ? -1 : 0;
  const swB   = -swA;

  // ── HEAD ─────────────────────────────────────────────────────────
  const hx = isFwd ? 15 : 17;
  const hy = isFwd ? 1  : 3;
  const hw = isFwd ? 18 : 14;
  const hh = isFwd ? 20 : 16;

  px(hx,      hy,      p.skin,  hw,   hh);
  px(hx,      hy,      p.skinS, 1,    hh);     // left shadow
  px(hx+hw-1, hy,      p.skinS, 1,    hh);     // right shadow
  px(hx,      hy+hh-2, p.skinS, hw,   2);      // chin shadow

  // hair top
  px(hx,   hy,   p.hair,  hw, 5);
  // hair sides
  px(hx,   hy+5, p.hair,  2,  7);
  px(hx+hw-2, hy+5, p.hair, 2, 7);
  // hair highlight streak
  px(hx+4, hy+1, p.hairH, 5, 1);
  px(hx+3, hy+2, p.hairH, 3, 1);

  // eyes
  const ey = hy + 8;
  const ex1 = hx + (isFwd ? 3 : 2);
  const ex2 = hx + hw - (isFwd ? 6 : 5);
  px(ex1,   ey,   '#fff', 3, 3);
  px(ex2,   ey,   '#fff', 3, 3);
  px(ex1+1, ey+1, p.eyes);                     // pupils
  px(ex2+1, ey+1, p.eyes);
  px(ex1,   ey-2, p.hair,  3, 1);              // eyebrows
  px(ex2,   ey-2, p.hair,  3, 1);

  // nose
  const nx = hx + Math.floor(hw/2) - 1;
  px(nx, ey+4, p.skinS, 2, 2);

  // mouth
  const my = hy + hh - 5;
  px(hx+4,    my,   p.mouth, hw-8, 1);
  px(hx+3,    my-1, p.mouth, 1, 1);
  px(hx+hw-4, my-1, p.mouth, 1, 1);

  // ears
  px(hx-1,   ey,   p.skin,  1, 4);
  px(hx+hw,  ey,   p.skin,  1, 4);
  px(hx-1,   ey+1, p.skinS, 1, 1);
  px(hx+hw,  ey+1, p.skinS, 1, 1);

  // ── NECK ─────────────────────────────────────────────────────────
  const ny2 = hy + hh;
  const nkx = hx + Math.floor(hw/2) - 3;
  px(nkx,   ny2, p.skin,  6, 4);
  px(nkx,   ny2, p.skinS, 1, 4);
  px(nkx+5, ny2, p.skinS, 1, 4);

  // ── TORSO ────────────────────────────────────────────────────────
  const bx = isFwd ? 12 : 14;
  const by = ny2 + 4;
  const bw = isFwd ? 24 : 20;
  const bh = 20;

  px(bx,      by, p.shirt,  bw, bh);
  px(bx,      by, p.shirtS, 1,  bh);
  px(bx+bw-1, by, p.shirtS, 1,  bh);
  px(bx,      by+bh-1, p.shirtS, bw, 1);

  // collar
  const cx2 = hx + Math.floor(hw/2);
  px(cx2-3, by,   p.skinS, 6, 2);
  px(cx2-2, by+2, p.skinS, 4, 2);
  px(cx2-1, by+4, p.skinS, 2, 1);

  // pocket
  px(bx+3, by+6, p.shirtS, 6, 5);
  px(bx+4, by+7, p.shirt,  4, 3);

  // button line
  for (let i = 0; i < 4; i++) px(bx + Math.floor(bw/2), by+4 + i*4, p.shirtS, 1, 2);

  // ── BELT ─────────────────────────────────────────────────────────
  const bely = by + bh;
  px(bx,                   bely, p.belt, bw, 4);
  px(bx + Math.floor(bw/2) - 3, bely, '#888', 6, 4); // buckle

  // ── ARMS ─────────────────────────────────────────────────────────
  const aH = 18;
  // left
  px(bx-5, by + swA, p.shirt,  5, aH);
  px(bx-5, by + swA, p.shirtS, 1, aH);
  // left hand
  px(bx-5, by + aH + swA, p.skin, 5, 5);
  px(bx-5, by + aH + swA, p.skinS, 1, 5);

  // right
  px(bx+bw, by + swB, p.shirt,  5, aH);
  px(bx+bw+4, by + swB, p.shirtS, 1, aH);
  // right hand
  px(bx+bw, by + aH + swB, p.skin, 5, 5);
  px(bx+bw+4, by + aH + swB, p.skinS, 1, 5);

  // ── LEGS ─────────────────────────────────────────────────────────
  const lY  = bely + 4;
  const lH  = 18;
  const lW  = 8;
  const llx = bx + 1;
  const lrx = bx + bw - lW - 1;

  for (let i = 0; i < lH; i++) {
    const off = i > lH / 2 ? (frame === 1 ? swA : frame === 2 ? swA : isFwd ? swA : 0) : 0;
    px(llx + off, lY + i, p.pants,  lW, 1);
    px(llx + off, lY + i, p.pantsS, 1,  1);
  }
  for (let i = 0; i < lH; i++) {
    const off = i > lH / 2 ? (frame === 1 ? swB : frame === 2 ? swB : isFwd ? swB : 0) : 0;
    px(lrx + off,      lY + i, p.pants,  lW, 1);
    px(lrx + off+lW-1, lY + i, p.pantsS, 1,  1);
  }

  // ── SHOES ────────────────────────────────────────────────────────
  const sY   = lY + lH;
  const offL = frame === 1 ? swA : frame === 2 ? swA : isFwd ? -1 : 0;
  const offR = frame === 1 ? swB : frame === 2 ? swB : isFwd ?  1 : 0;
  px(llx + offL - 1, sY, p.shoes, lW + 3, 5);
  px(lrx + offR - 1, sY, p.shoes, lW + 3, 5);
  px(llx + offL,     sY+4, '#555', lW+1, 1);
  px(lrx + offR,     sY+4, '#555', lW+1, 1);
}

/**
 * Create a scaled canvas element for a character.
 */
function makeCharCanvas(pal, scale) {
  scale = scale || 2;
  const c   = document.createElement('canvas');
  c.width   = 48 * scale;
  c.height  = 72 * scale;
  c.style.imageRendering = 'pixelated';
  c.style.width  = (48 * scale) + 'px';
  c.style.height = (72 * scale) + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  drawPixelChar(ctx, pal, 0);
  return { canvas: c, ctx, scale, pal };
}

function redrawChar(canvas, pal, frame, scale) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  drawPixelChar(ctx, pal, frame);
  ctx.restore();
}
