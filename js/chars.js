// js/chars.js — character data & personality config
// Drawing is now handled by SpriteRenderer in world.js using LPC spritesheets

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

// Available actions — the AI includes [ACTION:name] in responses
// These map to spritesheet animations in world.js ACTION_ANIM_MAP
const ACTIONS = ['nod','shake','shrug','jump','wave','spin','think','facepalm','point','bow','dance','stomp'];

// Roster / pill avatar: draw a small preview of the character using their palette colour
// Used by chat.js pill rendering and roster tiles
function drawPixelChar(ctx, pal, frame, opts) {
  // Minimal stub — draws a coloured circle as avatar for pills/roster
  // Full rendering uses LPC spritesheet canvases in world.js
  opts = opts || {};
  var W = ctx.canvas ? ctx.canvas.width : 24;
  var H = ctx.canvas ? ctx.canvas.height : 36;
  // Body
  ctx.fillStyle = pal.shirt;
  ctx.fillRect(W*0.2, H*0.38, W*0.6, H*0.45);
  // Head
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(W*0.5, H*0.22, W*0.28, 0, Math.PI*2);
  ctx.fill();
  // Hair
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(W*0.5, H*0.16, W*0.28, Math.PI, Math.PI*2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(W*0.32, H*0.19, W*0.12, H*0.07);
  ctx.fillRect(W*0.56, H*0.19, W*0.12, H*0.07);
  ctx.fillStyle = pal.eyes;
  ctx.fillRect(W*0.36, H*0.20, W*0.06, H*0.05);
  ctx.fillRect(W*0.60, H*0.20, W*0.06, H*0.05);
  // Legs
  ctx.fillStyle = pal.pants;
  ctx.fillRect(W*0.22, H*0.72, W*0.22, H*0.22);
  ctx.fillRect(W*0.56, H*0.72, W*0.22, H*0.22);
}
