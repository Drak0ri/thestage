// js/chars.js — pixel art character renderer

const PALETTES = [
  { skin:'#f5c5a3', hair:'#3d2b1f', shirt:'#e74c3c', pants:'#2c3e50', shoes:'#1a1a1a' },
  { skin:'#c68642', hair:'#1a1a1a', shirt:'#3498db', pants:'#1a252f', shoes:'#2c1810' },
  { skin:'#f5c5a3', hair:'#d4a800', shirt:'#9b59b6', pants:'#1a1a2e', shoes:'#111' },
  { skin:'#e8b88a', hair:'#6b3a2a', shirt:'#27ae60', pants:'#0d1b0d', shoes:'#1a1a1a' },
  { skin:'#f5c5a3', hair:'#111',    shirt:'#e67e22', pants:'#2c3e50', shoes:'#222' },
  { skin:'#c9956c', hair:'#2c1810', shirt:'#1abc9c', pants:'#0d2020', shoes:'#111' },
  { skin:'#f5c5a3', hair:'#a0522d', shirt:'#e91e63', pants:'#1a0a14', shoes:'#222' },
  { skin:'#d4956a', hair:'#1c1c1c', shirt:'#ffeb3b', pants:'#1a1a00', shoes:'#111' },
  { skin:'#ffe0bd', hair:'#4a2600', shirt:'#00bcd4', pants:'#002020', shoes:'#111' },
  { skin:'#b06040', hair:'#111',    shirt:'#ff9800', pants:'#1a0d00', shoes:'#222' },
  { skin:'#f5c5a3', hair:'#888',    shirt:'#607d8b', pants:'#1a2025', shoes:'#111' },
  { skin:'#c68642', hair:'#222',    shirt:'#8bc34a', pants:'#0d1500', shoes:'#111' },
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
 * Draw a 16x24 pixel character onto a 2D canvas context.
 * frame: 0 = stand, 1 = walk-A, 2 = walk-B
 */
function drawPixelChar(ctx, pal, frame = 0) {
  const p = pal;
  ctx.clearRect(0, 0, 16, 24);

  const px = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };

  // Head 4×4
  for (let x = 6; x < 10; x++)
    for (let y = 1; y < 5; y++) px(x, y, p.skin);

  // Hair top + sides
  for (let x = 6; x < 10; x++) px(x, 1, p.hair);
  px(6, 2, p.hair); px(9, 2, p.hair);

  // Eyes
  px(7, 3, '#222'); px(8, 3, '#222');

  // Mouth (tiny smile)
  px(7, 4, '#cc8866'); px(8, 4, '#cc8866');

  // Body 4×5
  for (let x = 6; x < 10; x++)
    for (let y = 5; y < 10; y++) px(x, y, p.shirt);

  // Arms swing with frame
  const armSwing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  for (let y = 5; y < 8; y++) {
    px(5, y + armSwing, p.shirt);
    px(10, y - armSwing, p.shirt);
  }
  // Hands
  px(5, 8 + armSwing, p.skin);
  px(10, 8 - armSwing, p.skin);

  // Legs swing
  const legA = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const legB = -legA;
  for (let y = 10; y < 14; y++) {
    px(6, y + legA, p.pants);
    px(8, y + legB, p.pants);
  }

  // Shoes
  px(6, 14 + legA, p.shoes);
  px(8, 14 + legB, p.shoes);
}

/**
 * Create a scaled canvas element for a character (32×48 = 2× scale of 16×24)
 */
function makeCharCanvas(pal, scale = 2) {
  const c = document.createElement('canvas');
  c.width = 16 * scale;
  c.height = 24 * scale;
  c.style.imageRendering = 'pixelated';
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  drawPixelChar(ctx, pal, 0);
  return { canvas: c, ctx, scale, pal };
}

/**
 * Animate a character canvas element through walk frames
 */
function animateChar(canvas, pal, scale = 2) {
  let frame = 0;
  const ctx = canvas.getContext('2d');
  return setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    drawPixelChar(ctx, pal, frame % 3);
    ctx.restore();
    frame++;
  }, 200);
}
