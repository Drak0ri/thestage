// js/chars.js — pixel-art character rendering
// v2.17 — human side-profile (_drawHumanSide) for walking animation
// Internal canvas: 48×72px

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

const ACTIONS = ['nod','shake','shrug','jump','wave','spin','think','facepalm','point','bow','dance','stomp'];

// ── Skin tones ────────────────────────────────────────────────────────────────
const SKIN_TONES = [
  { skin:'#fde4c0', skinS:'#d4a870', skinD:'#c08858' },
  { skin:'#f5c5a3', skinS:'#d4956a', skinD:'#b07848' },
  { skin:'#e8a87c', skinS:'#c07848', skinD:'#a05c30' },
  { skin:'#c68642', skinS:'#a0622e', skinD:'#7a4418' },
  { skin:'#a05c2e', skinS:'#7a3c18', skinD:'#5a2808' },
  { skin:'#7a3818', skinS:'#5a2008', skinD:'#3a1000' },
];

const HAIR_COLORS = [
  '#1a0800','#2c1a0a','#6b3a1a','#a06030','#c89040','#e8c060',
  '#999','#ddd','#cc2200','#7733cc','#0044cc','#00aa44',
];

// ── Role detection ────────────────────────────────────────────────────────────
function detectRoleType(role) {
  if (!role) return 'default';
  var r = role.toLowerCase();
  if (/\bcat\b/.test(r))     return 'animal_cat';
  if (/\bdog\b/.test(r))     return 'animal_dog';
  if (/\bfox\b/.test(r))     return 'animal_fox';
  if (/\bbear\b/.test(r))    return 'animal_bear';
  if (/\bpenguin\b/.test(r)) return 'animal_penguin';
  if (/\bowl\b/.test(r))     return 'animal_owl';
  if (/\brobot\b|android/.test(r)) return 'robot';
  if (/\balien\b/.test(r))   return 'alien';
  if (/dev|engineer|coder|programmer|software|backend|frontend|fullstack/.test(r)) return 'developer';
  if (/design|ux|ui|artist|creative|graphic/.test(r)) return 'designer';
  if (/ceo|chief exec|founder/.test(r)) return 'ceo';
  if (/cto|chief tech/.test(r)) return 'cto';
  if (/manager|lead|head of|director|vp /.test(r)) return 'manager';
  if (/product|pm\b/.test(r)) return 'product';
  if (/market|growth|brand|content/.test(r)) return 'marketer';
  if (/sales|account|business dev/.test(r)) return 'sales';
  if (/doctor|physician|nurse|medical/.test(r)) return 'doctor';
  if (/teacher|professor|educator|lecturer/.test(r)) return 'teacher';
  if (/scientist|research|analyst|data|ml /.test(r)) return 'scientist';
  if (/lawyer|legal|attorney/.test(r)) return 'lawyer';
  if (/financ|accountant|invest/.test(r)) return 'finance';
  if (/chef|cook/.test(r)) return 'chef';
  if (/wizard|mage|magic/.test(r)) return 'wizard';
  if (/knight|warrior|soldier/.test(r)) return 'knight';
  if (/pirate/.test(r)) return 'pirate';
  if (/ninja/.test(r)) return 'ninja';
  if (/astronaut|space/.test(r)) return 'astronaut';
  if (/detective|spy/.test(r)) return 'detective';
  return 'default';
}

// ── Colour palette per role ───────────────────────────────────────────────────
function getRoleColors(roleType, colorIdx) {
  var skinIdx = colorIdx % SKIN_TONES.length;
  var hairCol = HAIR_COLORS[colorIdx % HAIR_COLORS.length];
  var sk = SKIN_TONES[skinIdx];
  var outfits = {
    developer:  { shirt:'#2c3e50', shirt2:'#1a252f', pants:'#1a1a2e', shoes:'#111', acc:'#44ff88', acc2:'#1a8844' },
    designer:   { shirt:'#9b59b6', shirt2:'#7d3f9a', pants:'#2c1a40', shoes:'#222', acc:'#ff6b9d', acc2:'#cc3366' },
    ceo:        { shirt:'#1a1a1a', shirt2:'#333',    pants:'#0d0d0d', shoes:'#000', acc:'#d4af37', acc2:'#8B6914' },
    cto:        { shirt:'#1c3a5e', shirt2:'#0d2040', pants:'#0d1a2a', shoes:'#111', acc:'#4aa8ff', acc2:'#1166cc' },
    manager:    { shirt:'#2e4a6e', shirt2:'#1a2e48', pants:'#1a2030', shoes:'#111', acc:'#88aaff', acc2:'#3355bb' },
    product:    { shirt:'#3a2a5e', shirt2:'#251840', pants:'#1a1028', shoes:'#222', acc:'#ff8844', acc2:'#cc5500' },
    marketer:   { shirt:'#c0392b', shirt2:'#7b241c', pants:'#1a0808', shoes:'#222', acc:'#ffaa00', acc2:'#cc7700' },
    sales:      { shirt:'#27ae60', shirt2:'#1a7040', pants:'#0d1a0d', shoes:'#222', acc:'#ffdd00', acc2:'#aa9900' },
    doctor:     { shirt:'#e8f4fd', shirt2:'#b8d0e8', pants:'#b0c8e0', shoes:'#ddd', acc:'#e74c3c', acc2:'#991122' },
    teacher:    { shirt:'#8b5e14', shirt2:'#5a3a08', pants:'#2c1808', shoes:'#3a1808', acc:'#ddd', acc2:'#aaa' },
    scientist:  { shirt:'#ecf0f1', shirt2:'#bbb',    pants:'#7f8c8d', shoes:'#555', acc:'#00d2ff', acc2:'#0088bb' },
    lawyer:     { shirt:'#1a1a2e', shirt2:'#2a2a3e', pants:'#0d0d0d', shoes:'#000', acc:'#888', acc2:'#555' },
    finance:    { shirt:'#1c2e4a', shirt2:'#0d1a2e', pants:'#0d0d0d', shoes:'#111', acc:'#cc8800', acc2:'#885500' },
    chef:       { shirt:'#ffffff', shirt2:'#dddddd', pants:'#2a2a2a', shoes:'#222', acc:'#ffffff', acc2:'#cccccc' },
    wizard:     { shirt:'#2a0a4e', shirt2:'#1a0830', pants:'#1a0830', shoes:'#1a0a2e', acc:'#ff88ff', acc2:'#aa00cc' },
    knight:     { shirt:'#888',   shirt2:'#aaa',    pants:'#555',    shoes:'#333', acc:'#d4af37', acc2:'#8B6914' },
    pirate:     { shirt:'#8b0000', shirt2:'#600000', pants:'#111',   shoes:'#222', acc:'#d4af37', acc2:'#8B6914' },
    ninja:      { shirt:'#0a0a0a', shirt2:'#1a1a1a', pants:'#0a0a0a', shoes:'#000', acc:'#cc0000', acc2:'#880000' },
    astronaut:  { shirt:'#d8d8d8', shirt2:'#b8b8b8', pants:'#c0c0c0', shoes:'#aaa', acc:'#4488ff', acc2:'#1144cc' },
    detective:  { shirt:'#4a3020', shirt2:'#2a1808', pants:'#1a1208', shoes:'#222', acc:'#888', acc2:'#555' },
    default:    { shirt:'#3a5078', shirt2:'#2a3a58', pants:'#1a2030', shoes:'#222', acc:'#88aacc', acc2:'#446688' },
  };
  var o = outfits[roleType] || outfits.default;
  return { skin: sk.skin, skinS: sk.skinS, skinD: sk.skinD, hair: hairCol,
           shirt: o.shirt, shirt2: o.shirt2, pants: o.pants, shoes: o.shoes, acc: o.acc, acc2: o.acc2 };
}

// ── Core pixel primitive ──────────────────────────────────────────────────────
function p(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x|0, y|0, w|0, h|0);
}

// ── Hair bitmaps — exactly 18px wide to match head ───────────────────────────
// H = hair pixel, space = transparent
var HAIR_BITMAPS = {
  messy: [
    ' HH HHH H H  H   ',
    'HHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHH',
    'HH              HH',
  ],
  slick: [
    '    HHHHHHHHHH    ',
    '  HHHHHHHHHHHHHH  ',
    ' HHHHHHHHHHHHHHHH ',
    'HH              HH',
  ],
  short: [
    '   HHHHHHHHHH     ',
    '  HHHHHHHHHHHH    ',
    ' HHHHHHHHHHHHH    ',
    'HH                ',
  ],
  medium: [
    '  HHHHHHHHHHHHHH  ',
    ' HHHHHHHHHHHHHHHH ',
    'HHHHHHHHHHHHHHHHHH',
    'HH              HH',
  ],
  wavy: [
    'HHH HHH HHH HHH HH',
    'HHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHH',
    'HH              HH',
  ],
  long: [
    '  HHHHHHHHHHHHHH  ',
    ' HHHHHHHHHHHHHHHH ',
    'HHHHHHHHHHHHHHHHHH',
    'HH              HH',
    'HH              HH',
  ],
  bun: [
    '      HHHHHH      ',
    '    HHHHHHHHHH    ',
    '  HHHHHHHHHHHHHH  ',
    ' HHHHHHHHHHHHHHHH ',
    'HH              HH',
  ],
  buzz: [
    '  HHHHHHHHHHHHHH  ',
    ' HHHHHHHHHHHHHHHH ',
    'HH              HH',
  ],
  none: [
    'HH              HH',
  ],
};

function getAppearance(roleType) {
  var map = {
    developer:  { hair: 'messy',  glasses: true  },
    designer:   { hair: 'wavy',   glasses: false },
    ceo:        { hair: 'slick',  glasses: false },
    cto:        { hair: 'slick',  glasses: true  },
    manager:    { hair: 'short',  glasses: false },
    product:    { hair: 'medium', glasses: false },
    marketer:   { hair: 'wavy',   glasses: false },
    sales:      { hair: 'slick',  glasses: false },
    doctor:     { hair: 'short',  glasses: false },
    teacher:    { hair: 'medium', glasses: true  },
    scientist:  { hair: 'messy',  glasses: true  },
    lawyer:     { hair: 'slick',  glasses: false },
    finance:    { hair: 'slick',  glasses: false },
    chef:       { hair: 'none',   glasses: false },
    wizard:     { hair: 'long',   glasses: false },
    knight:     { hair: 'none',   glasses: false },
    pirate:     { hair: 'medium', glasses: false },
    ninja:      { hair: 'none',   glasses: false },
    astronaut:  { hair: 'buzz',   glasses: false },
    detective:  { hair: 'slick',  glasses: false },
    default:    { hair: 'medium', glasses: false },
  };
  return map[roleType] || map.default;
}

// ── Main draw function ────────────────────────────────────────────────────────
function drawPixelChar(ctx, palOrObj, frame, opts) {
  opts = opts || {};
  var W = ctx.canvas.width;
  var H = ctx.canvas.height;
  var pose = frame || 0;
  var pal, roleType;
  if (palOrObj && palOrObj.roleType) {
    roleType = palOrObj.roleType;
    pal = palOrObj;
  } else {
    roleType = opts.roleType || 'default';
    pal = getRoleColors(roleType, 0);
  }
  var isAnimal = roleType && roleType.startsWith('animal_');
  var isRobot  = roleType === 'robot';
  var isAlien  = roleType === 'alien';
  var wantsSide = (opts.facing === 'side');
  // Only humans currently support true side-view. Others fall back to front + flip.
  var canSide = wantsSide && !isAnimal && !isRobot && !isAlien;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (opts.flip) { ctx.scale(-1,1); ctx.translate(-W,0); }
  if      (canSide)  _drawHumanSide(ctx, W, H, pose, pal, roleType);
  else if (isAnimal) _drawAnimal(ctx, W, H, pose, pal, roleType);
  else if (isRobot)  _drawRobot(ctx, W, H, pose, pal);
  else if (isAlien)  _drawAlien(ctx, W, H, pose, pal);
  else               _drawHuman(ctx, W, H, pose, pal, roleType);
  ctx.restore();
}

// ── Human ─────────────────────────────────────────────────────────────────────
function _drawHuman(ctx, W, H, pose, pal, roleType) {
  var cx = W >> 1; // 24

  var ll=0, rl=0, la=0, ra=0, bob=0;
  if (pose===1){ ll=-3; rl=3;  la=2;  ra=-2; bob=1; }
  if (pose===2){ ll=3;  rl=-3; la=-2; ra=2;  bob=1; }
  if (pose===3){ bob=-1; }
  if (pose===4){ ra=-7; la=1; bob=-1; }

  var groundY = H - 2 + bob;

  // Shoes
  p(ctx, cx-11, groundY-3, 10, 3, pal.shoes);
  p(ctx, cx+2,  groundY-3, 10, 3, pal.shoes);
  p(ctx, cx-11, groundY-3, 10, 1, '#ffffff22');

  // Legs
  var legH = 18;
  var legTop = groundY - 3 - legH;
  p(ctx, cx-10, legTop+ll, 8, legH, pal.pants);
  p(ctx, cx+2,  legTop+rl, 8, legH, pal.pants);
  // Trouser crease/shadow
  p(ctx, cx-10, legTop+ll, 1, legH, '#00000022');
  p(ctx, cx+2,  legTop+rl, 1, legH, '#00000022');
  // Cuffs
  p(ctx, cx-10, legTop+ll, 8, 2, pal.shirt2);
  p(ctx, cx+2,  legTop+rl, 8, 2, pal.shirt2);

  // Body
  var bodyH = 22;
  var bodyY = legTop - bodyH;
  var bodyX = cx - 11;
  var bodyW = 22;
  p(ctx, bodyX, bodyY, bodyW, bodyH, pal.shirt);
  // Shoulder highlight
  p(ctx, bodyX, bodyY, bodyW, 2, pal.shirt2);
  // Side shadow
  p(ctx, bodyX, bodyY+2, 2, bodyH-2, pal.shirt2);
  p(ctx, bodyX+bodyW-2, bodyY+2, 2, bodyH-2, pal.shirt2);
  // Bottom edge
  p(ctx, bodyX, bodyY+bodyH-1, bodyW, 1, pal.shirt2);

  // Body detail
  _bodyDetail(ctx, cx, bodyX, bodyY, bodyW, bodyH, pal, roleType, pose);

  // Arms
  var armY = bodyY + 2;
  var armH = 14;
  // Left arm
  p(ctx, bodyX-5, armY+la, 5, armH, pal.shirt);
  p(ctx, bodyX-5, armY+la, 1, armH, pal.shirt2); // shadow edge
  // Left hand
  p(ctx, bodyX-5, armY+la+armH,   5, 4, pal.skin);
  p(ctx, bodyX-5, armY+la+armH,   5, 1, pal.skinS);
  // Right arm
  p(ctx, bodyX+bodyW, armY+ra, 5, armH, pal.shirt);
  p(ctx, bodyX+bodyW+4, armY+ra, 1, armH, pal.shirt2);
  // Right hand
  p(ctx, bodyX+bodyW, armY+ra+armH, 5, 4, pal.skin);
  p(ctx, bodyX+bodyW, armY+ra+armH, 5, 1, pal.skinS);

  // Neck
  p(ctx, cx-3, bodyY-5, 6, 6, pal.skin);
  p(ctx, cx-3, bodyY-5, 6, 1, pal.skinS);

  // Head
  var headH = 18, headW = 18;
  var headY = bodyY - headH - 1;
  var headX = cx - headW/2;
  // Head shape — slightly rounded with pixel corners
  p(ctx, headX+1, headY,   headW-2, headH,   pal.skin);
  p(ctx, headX,   headY+1, headW,   headH-2, pal.skin);
  // Head shading
  p(ctx, headX+1,      headY+1,      1, headH-2, pal.skinS); // left
  p(ctx, headX+headW-2,headY+1,      1, headH-2, pal.skinS); // right
  p(ctx, headX+1,      headY+headH-2,headW-2, 1, pal.skinS); // bottom
  // Ear stubs
  p(ctx, headX-1,      headY+6,      2, 5,   pal.skinS);
  p(ctx, headX+headW-1,headY+6,      2, 5,   pal.skinS);

  // Hair
  var app = getAppearance(roleType);
  _drawHairPixel(ctx, headX, headY, headW, pal.hair, app.hair);

  // Face
  _drawFace(ctx, headX, headY, headW, headH, pal, app, roleType, pose);

  // Head accessory
  _drawHeadAccessory(ctx, cx, headX, headY, headW, headH, pal, roleType, pose);

  // Held item on action
  if (pose===4) _drawHeldItem(ctx, cx, bodyX, bodyY, bodyW, armY, pal, roleType);
}

// ── Human side profile (facing LEFT; caller flips for right) ──────────────────
// Same overall proportions as front view so the character reads as the "same person".
//   Head 18×18 → silhouette: forehead curve, nose bump on left, back-of-head mass on right
//   Body 12w × 22h → narrower silhouette (only thickness visible, not shoulder span)
//   Arms: front arm prominent on left, back arm peeks from right
//   Legs: 6w each, clear front/back in walk cycle
function _drawHumanSide(ctx, W, H, pose, pal, roleType) {
  var cx = W >> 1; // 24 — vertical centerline of character

  // Walk cycle offsets — amplified so steps read clearly at pixel scale.
  //   Front leg / front arm sit on the LEFT (facing-left side).
  //   flX = front-leg x offset; blX = back-leg x offset
  //   faY = front-arm vertical swing; baY = back-arm vertical swing
  var flX=0, blX=0, faY=0, baY=0, flY=0, blY=0, bob=0;
  var faX=0, baX=0;
  if (pose===1) {
    // Front leg forward (further left), back leg trailing
    flX=-4; blX=3;
    // Opposite arms swing
    faY=-2; baY=2;
    faX=1;  baX=-1;
    flY=0;  blY=-1;    // back foot slightly lifted
    bob=1;
  }
  if (pose===2) {
    // Mirror: front leg back, back leg forward
    flX=3;  blX=-4;
    faY=2;  baY=-2;
    faX=-1; baX=1;
    flY=-1; blY=0;
    bob=1;
  }
  if (pose===3) bob=-1;                      // talk-lean
  if (pose===4) { faY=-9; faX=-2; bob=-1; }  // action — front arm raised

  var groundY = H - 2 + bob;

  // ─── Shoes (profile: one elongated shoe per leg, toe pointing left) ────
  // Back shoe first (behind)
  p(ctx, cx-2+blX,  groundY-3+blY, 9, 3, pal.shoes);
  p(ctx, cx-2+blX,  groundY-3+blY, 9, 1, '#ffffff22');
  p(ctx, cx-3+blX,  groundY-2+blY, 1, 2, pal.shoes);    // toe
  // Front shoe (in front — overlaps)
  p(ctx, cx-6+flX,  groundY-3+flY, 11, 3, pal.shoes);
  p(ctx, cx-6+flX,  groundY-3+flY, 11, 1, '#ffffff33');
  p(ctx, cx-7+flX,  groundY-2+flY, 1, 2, pal.shoes);    // toe
  // Heel nubs
  p(ctx, cx+4+flX,  groundY-1+flY, 1, 1, '#00000055');
  p(ctx, cx+6+blX,  groundY-1+blY, 1, 1, '#00000044');

  // ─── Legs ──────────────────────────────────────────────────────────────
  var legH = 18;
  var legTop = groundY - 3 - legH;
  // Back leg (drawn first, partially hidden by front leg)
  p(ctx, cx+blX,    legTop+blY, 5, legH, pal.pants);
  p(ctx, cx+blX,    legTop+blY, 5, 1, '#ffffff10');
  p(ctx, cx+blX,    legTop+blY, 1, legH, '#00000044');   // shaded front edge of back leg
  p(ctx, cx+blX,    legTop+blY, 5, 2, pal.shirt2);
  // Front leg
  p(ctx, cx-5+flX,  legTop+flY, 5, legH, pal.pants);
  p(ctx, cx-5+flX,  legTop+flY, 5, 1, '#ffffff22');
  p(ctx, cx-5+flX,  legTop+flY, 1, legH, '#ffffff18');   // leading edge highlight
  p(ctx, cx-1+flX,  legTop+flY, 1, legH, '#00000033');   // trailing edge shadow
  p(ctx, cx-5+flX,  legTop+flY, 5, 2, pal.shirt2);

  // ─── Body (side silhouette — narrower than front) ──────────────────────
  var bodyH = 22;
  var bodyY = legTop - bodyH;
  var bodyW = 12;
  var bodyX = cx - 6;
  p(ctx, bodyX, bodyY, bodyW, bodyH, pal.shirt);
  // Shoulder cap — slight extra pixel at top
  p(ctx, bodyX, bodyY, bodyW, 2, pal.shirt2);
  p(ctx, bodyX-1, bodyY+1, 1, 2, pal.shirt2);            // front shoulder nub
  // Front edge (facing left = leading edge on left)
  p(ctx, bodyX, bodyY+2, 1, bodyH-3, '#ffffff18');
  // Back edge shadow
  p(ctx, bodyX+bodyW-1, bodyY+2, 1, bodyH-3, '#00000044');
  // Bottom hem
  p(ctx, bodyX, bodyY+bodyH-1, bodyW, 1, pal.shirt2);

  // Role-specific body detail
  _bodyDetailSide(ctx, cx, bodyX, bodyY, bodyW, bodyH, pal, roleType, pose);

  // ─── Arms ──────────────────────────────────────────────────────────────
  var armY = bodyY + 2;
  var armH = 14;
  var armW = 4;

  // Back arm — drawn first (behind body on the RIGHT/back side)
  // We add a small x-offset so it's not just a line on the body edge
  var backArmX = bodyX + bodyW - 1 + baX;
  p(ctx, backArmX, armY + baY, armW, armH, pal.shirt);
  p(ctx, backArmX, armY + baY, 1, armH, '#00000044');      // shadow where arm meets body
  p(ctx, backArmX + armW - 1, armY + baY, 1, armH, pal.shirt2);
  // Back hand
  p(ctx, backArmX, armY + baY + armH, armW, 4, pal.skin);
  p(ctx, backArmX + armW - 1, armY + baY + armH, 1, 4, pal.skinS);

  // Front arm — prominent on the LEFT (facing-left side)
  if (pose === 4) {
    // Raised arm — extends UP from shoulder, hand high near head
    var raiseTop = armY + faY;  // faY is -9 here
    p(ctx, bodyX - 3 + faX, raiseTop, armW, armH, pal.shirt);
    p(ctx, bodyX - 3 + faX, raiseTop, 1, armH, '#ffffff20');
    p(ctx, bodyX - 3 + faX + armW - 1, raiseTop, 1, armH, pal.shirt2);
    // Hand at top
    p(ctx, bodyX - 3 + faX, raiseTop - 4, armW, 4, pal.skin);
    p(ctx, bodyX - 3 + faX, raiseTop - 4, 1, 4, pal.skinS);
  } else {
    var frontArmX = bodyX - 3 + faX;
    p(ctx, frontArmX, armY + faY, armW, armH, pal.shirt);
    // Clear leading-edge highlight so arm reads as a distinct shape
    p(ctx, frontArmX, armY + faY, 1, armH, '#ffffff28');
    // Trailing edge
    p(ctx, frontArmX + armW - 1, armY + faY, 1, armH, pal.shirt2);
    // Front hand
    p(ctx, frontArmX, armY + faY + armH, armW, 4, pal.skin);
    p(ctx, frontArmX, armY + faY + armH, 1, 4, pal.skin);
    p(ctx, frontArmX, armY + faY + armH + 3, armW, 1, pal.skinS);
  }

  // ─── Neck ──────────────────────────────────────────────────────────────
  // Shifted slightly forward (toward face side)
  p(ctx, cx-3, bodyY-5, 5, 6, pal.skin);
  p(ctx, cx-3, bodyY-5, 5, 1, pal.skinS);                // under-chin shadow
  p(ctx, cx+1, bodyY-5, 1, 6, pal.skinS);                // back-of-neck shadow

  // ─── Head silhouette (build up in layers for clean side profile) ──────
  var headH = 18, headW = 18;
  var headY = bodyY - headH - 1;
  var headX = cx - headW/2 + 1;  // shift 1px right so nose has room to protrude

  // Base head — slightly tapered rectangle
  p(ctx, headX+1, headY,   headW-2, headH,   pal.skin);
  p(ctx, headX,   headY+2, headW,   headH-4, pal.skin);

  // Back-of-head bulge (skull curves outward)
  p(ctx, headX + headW,     headY + 4, 1, headH - 8, pal.skin);
  p(ctx, headX + headW,     headY + 4, 1, 1, pal.skinS);
  p(ctx, headX + headW,     headY + headH - 5, 1, 1, pal.skinS);

  // ── Nose — protruding wedge on LEFT side ──
  // Structure: bridge → tip → nostril shadow. 2px protrusion for clarity.
  var noseTop = headY + 6;
  // Bridge (connects forehead to nose tip, 1 pixel out)
  p(ctx, headX - 1, noseTop,     1, 1, pal.skin);
  // Tip of nose — 2 pixels protruding
  p(ctx, headX - 2, noseTop + 1, 2, 2, pal.skin);
  // Under-nose shadow (separates nose from mouth area)
  p(ctx, headX - 1, noseTop + 3, 1, 1, pal.skinS);
  p(ctx, headX,     noseTop + 3, 1, 1, pal.skinS);
  // Top-of-nose highlight
  p(ctx, headX - 2, noseTop + 1, 1, 1, pal.skin);
  // Nostril detail
  p(ctx, headX - 1, noseTop + 2, 1, 1, pal.skinD || pal.skinS);

  // ── Brow ridge ──
  var browY = headY + 5;
  p(ctx, headX, browY, 4, 1, pal.skinD || pal.skinS);
  p(ctx, headX + 1, browY - 1, 3, 1, pal.skinS);  // brow highlight

  // ── Eye (single visible eye, close to front) ──
  var eyeX = headX + 1;
  var eyeY = headY + 7;
  p(ctx, eyeX, eyeY, 2, 2, '#1a0a00');
  p(ctx, eyeX, eyeY, 1, 1, '#ffffff');           // catchlight

  // ── Cheek shading ──
  p(ctx, headX + 2, headY + 10, 2, 1, pal.skinS);
  p(ctx, headX + 1, headY + 11, 1, 2, pal.skinS);

  // ── Mouth ──
  if (pose === 3 || pose === 4) {
    // Open (talking)
    p(ctx, headX, headY + 13, 4, 2, '#2a0808');
    p(ctx, headX, headY + 13, 4, 1, '#6a2020');
  } else {
    p(ctx, headX, headY + 13, 4, 1, '#3a1a0a');
  }

  // ── Chin ──
  p(ctx, headX + 1, headY + headH - 3, 3, 2, pal.skin);
  p(ctx, headX,     headY + headH - 2, 1, 1, pal.skinS);
  p(ctx, headX + 1, headY + headH - 1, 3, 1, pal.skinS);  // jaw underside

  // ── Ear (on back half of head) ──
  var earX = headX + headW - 4;
  var earY = headY + 7;
  p(ctx, earX,     earY,     2, 5, pal.skinS);
  p(ctx, earX + 1, earY + 1, 1, 3, pal.skinD || pal.skinS);
  p(ctx, earX - 1, earY + 2, 1, 2, pal.skinS);   // front-of-ear curve

  // ─── Hair ─────────────────────────────────────────────────────────────
  _drawHairSide(ctx, headX, headY, headW, headH, pal.hair, roleType);

  // ─── Accessories (glasses etc.) ──────────────────────────────────────
  _drawSideAccessory(ctx, headX, headY, headW, headH, pal, roleType, pose);
}

// Side-view hair — sweep back from forehead, covering top and back of head
function _drawHairSide(ctx, hx, hy, hw, hh, hairColor, roleType) {
  // Top cap — full width of head
  p(ctx, hx + 1, hy - 1, hw - 2, 3, hairColor);
  p(ctx, hx + 2, hy - 2, hw - 4, 1, hairColor);
  // Front-top forehead hairline — slight forward sweep
  p(ctx, hx,     hy + 1, 3, 2, hairColor);
  p(ctx, hx - 1, hy + 1, 1, 2, hairColor);
  // Back of head — hair mass extends down further
  p(ctx, hx + hw - 4, hy + 2, 4, 6, hairColor);
  p(ctx, hx + hw - 3, hy + 8, 3, 2, hairColor);
  p(ctx, hx + hw - 2, hy + 10, 2, 1, hairColor);
  // Sideburn hint (small patch in front of ear)
  p(ctx, hx + hw - 5, hy + 7, 1, 2, hairColor);
  // Highlight streak on top
  p(ctx, hx + 3, hy - 1, hw - 8, 1, '#ffffff18');
}

// Side-view accessories — small glasses, positioned around the eye only
function _drawSideAccessory(ctx, hx, hy, hw, hh, pal, roleType, pose) {
  var r = (roleType || '').toLowerCase();
  if (/scientist|professor|teacher|doctor/.test(r)) {
    // Side-view glasses: one lens covering the eye, temple arm going back
    var lensX = hx;
    var lensY = hy + 6;
    // Lens frame — 4px square around the eye
    p(ctx, lensX,     lensY,     4, 1, '#444');       // top
    p(ctx, lensX,     lensY + 3, 4, 1, '#444');       // bottom
    p(ctx, lensX,     lensY + 1, 1, 2, '#444');       // front
    p(ctx, lensX + 3, lensY + 1, 1, 2, '#444');       // back
    // Lens glint
    p(ctx, lensX + 1, lensY + 1, 1, 1, '#ffffff55');
    // Temple arm going to ear
    p(ctx, lensX + 4, lensY + 1, hw - 8, 1, '#444');
  }
}

// Side-view body detail — ties, lab coats etc. (simplified for side view)
function _bodyDetailSide(ctx, cx, bodyX, bodyY, bodyW, bodyH, pal, roleType, pose) {
  var r = (roleType || '').toLowerCase();
  // Tie — visible as thin vertical stripe toward front of body
  if (/ceo|cto|lawyer|finance|manager/.test(r)) {
    p(ctx, bodyX + 1, bodyY + 2, 2, bodyH - 6, pal.acc || '#333');
    p(ctx, bodyX + 1, bodyY + 2, 2, 1, pal.acc2 || '#222');
    // Tie knot
    p(ctx, bodyX + 1, bodyY + 1, 2, 1, pal.acc2 || '#222');
  }
  // Lab coat / white coat — front panel
  if (/doctor|scientist/.test(r)) {
    p(ctx, bodyX, bodyY + 2, 3, bodyH - 3, '#ffffff');
    p(ctx, bodyX, bodyY + 2, 1, bodyH - 3, '#cccccc');
    // Button
    p(ctx, bodyX + 1, bodyY + 8, 1, 1, '#666');
    p(ctx, bodyX + 1, bodyY + 13, 1, 1, '#666');
  }
  // Pocket suggestion — subtle chest pocket
  if (/developer|engineer|designer/.test(r)) {
    p(ctx, bodyX + 2, bodyY + 9, 3, 3, pal.shirt2);
    p(ctx, bodyX + 2, bodyY + 9, 3, 1, '#ffffff15');
  }
}

function _drawHairPixel(ctx, hx, hy, hw, hairColor, style) {
  var bm = HAIR_BITMAPS[style] || HAIR_BITMAPS.medium;
  // Last row of bitmap = top of head (hy). Rows above it go negative.
  var ox = hx;
  var oy = hy - (bm.length - 1);
  ctx.fillStyle = hairColor;
  for (var row=0; row<bm.length; row++) {
    var line = bm[row];
    for (var col=0; col<line.length && col<hw; col++) {
      if (line[col]==='H') ctx.fillRect((ox+col)|0, (oy+row)|0, 1, 1);
    }
  }
}

function _drawFace(ctx, hx, hy, hw, hh, pal, app, roleType, pose) {
  var talking = (pose===3);
  // Eyebrows
  var brow = (pal.hair==='#ddd'||pal.hair==='#999') ? '#888' : pal.hair;
  p(ctx, hx+2,  hy+4, 5, 1, brow);
  p(ctx, hx+11, hy+4, 5, 1, brow);
  if (talking) {
    // raised brows
    p(ctx, hx+1,  hy+3, 5, 1, brow);
    p(ctx, hx+10, hy+3, 5, 1, brow);
  }

  // Eyes — whites
  p(ctx, hx+2,  hy+6, 5, 4, '#f4f4f4');
  p(ctx, hx+11, hy+6, 5, 4, '#f4f4f4');
  // Eye outline top
  p(ctx, hx+2,  hy+6, 5, 1, '#888');
  p(ctx, hx+11, hy+6, 5, 1, '#888');
  // Iris
  p(ctx, hx+3,  hy+7, 3, 3, '#336688');
  p(ctx, hx+12, hy+7, 3, 3, '#336688');
  // Pupil
  p(ctx, hx+4,  hy+7, 2, 2, '#111');
  p(ctx, hx+13, hy+7, 2, 2, '#111');
  // Shine
  p(ctx, hx+4,  hy+7, 1, 1, '#fff');
  p(ctx, hx+13, hy+7, 1, 1, '#fff');
  // Lower lash line
  p(ctx, hx+2,  hy+9, 5, 1, '#aaa');
  p(ctx, hx+11, hy+9, 5, 1, '#aaa');

  // Glasses
  if (app.glasses) {
    // Left lens frame
    p(ctx, hx+1,  hy+5, 7, 1, '#555'); // top
    p(ctx, hx+1,  hy+10,7, 1, '#555'); // bottom
    p(ctx, hx+1,  hy+5, 1, 6, '#555'); // left
    p(ctx, hx+7,  hy+5, 1, 6, '#555'); // right
    // Right lens frame
    p(ctx, hx+10, hy+5, 7, 1, '#555');
    p(ctx, hx+10, hy+10,7, 1, '#555');
    p(ctx, hx+10, hy+5, 1, 6, '#555');
    p(ctx, hx+16, hy+5, 1, 6, '#555');
    // Bridge
    p(ctx, hx+7,  hy+7, 4, 1, '#555');
    // Arms
    p(ctx, hx,    hy+7, 2, 1, '#555');
    p(ctx, hx+16, hy+7, 2, 1, '#555');
  }

  // Nose
  p(ctx, hx+8,  hy+11, 2, 1, pal.skinS);
  p(ctx, hx+7,  hy+12, 4, 1, pal.skinS);

  // Mouth
  var my = hy+14;
  var mx = hx+3;
  if (talking) {
    // Open mouth — tasteful, pixel-art talking expression
    p(ctx, mx+1, my,   10, 1, '#cc6655'); // upper lip
    p(ctx, mx,   my+1, 12, 3, '#1a0808'); // mouth opening (dark cavity)
    p(ctx, mx+1, my+4, 10, 1, '#cc6655'); // lower lip
    // Single neat tooth row (no gaps = no monster teeth)
    p(ctx, mx+2, my+1,  8, 1, '#eeeedd');
  } else {
    // Closed smile — pixel curve
    p(ctx, mx,     my+1, 2, 1, '#cc6655'); // left end up
    p(ctx, mx+2,   my+2, 8, 1, '#cc6655'); // centre flat
    p(ctx, mx+10,  my+1, 2, 1, '#cc6655'); // right end up
    // Lower lip hint
    p(ctx, mx+2,   my+3, 8, 1, pal.skinS);
  }

  // Role extras on face
  if (roleType==='detective'||roleType==='pirate') {
    // Stubble dots
    p(ctx, hx+3, hy+16, 1, 1, pal.skinS);
    p(ctx, hx+5, hy+16, 1, 1, pal.skinS);
    p(ctx, hx+7, hy+16, 1, 1, pal.skinS);
    p(ctx, hx+9, hy+16, 1, 1, pal.skinS);
    p(ctx, hx+11,hy+16, 1, 1, pal.skinS);
    p(ctx, hx+4, hy+17, 1, 1, pal.skinS);
    p(ctx, hx+8, hy+17, 1, 1, pal.skinS);
  }
  if (roleType==='wizard') {
    // Long beard flowing down
    p(ctx, hx+2,  hy+16, 14, 3, '#ddd');
    p(ctx, hx+3,  hy+19, 12, 3, '#ddd');
    p(ctx, hx+4,  hy+22, 10, 3, '#eee');
    p(ctx, hx+5,  hy+25, 8,  3, '#ddd');
  }
}

function _bodyDetail(ctx, cx, bx, by, bw, bh, pal, roleType, pose) {
  switch(roleType) {
    case 'ceo': case 'lawyer': case 'finance':
      // Lapels
      p(ctx, bx+3,  by,    5, bh*0.6, pal.shirt2);
      p(ctx, bx+bw-8,by,   5, bh*0.6, pal.shirt2);
      // Shirt / collar
      p(ctx, cx-2,  by,    4, bh*0.35,'#ffffff');
      // Tie
      p(ctx, cx-1,  by+3,  3, bh-5, pal.acc);
      p(ctx, cx,    by+3,  1, bh-5, pal.acc2);
      // Tie knot
      p(ctx, cx-2,  by+2,  5, 3, pal.acc);
      // Buttons
      p(ctx, cx,    by+bh*0.25+2, 2, 2, '#ffffff88');
      p(ctx, cx,    by+bh*0.5+1,  2, 2, '#ffffff88');
      p(ctx, cx,    by+bh*0.75-1, 2, 2, '#ffffff88');
      break;
    case 'developer': case 'cto':
      // Hoodie pocket
      p(ctx, bx+2, by+bh*0.5, bw-4, bh*0.42, pal.shirt2);
      // Pocket seam
      p(ctx, cx-1, by+bh*0.5, 2, bh*0.42, '#ffffff22');
      // Logo sticker
      p(ctx, bx+3, by+4, 5, 4, pal.acc);
      p(ctx, bx+4, by+3, 3, 1, pal.acc);
      break;
    case 'designer':
      // Turtleneck
      p(ctx, cx-5, by,    10, 5,  pal.shirt2);
      p(ctx, cx-4, by-2,  8,  3,  pal.shirt2);
      // Dots pattern
      p(ctx, bx+3, by+8,  3,  3,  pal.acc);
      p(ctx, bx+10,by+12, 3,  3,  pal.acc2);
      p(ctx, bx+16,by+6,  3,  3,  pal.acc);
      break;
    case 'manager': case 'coo':
      // Blazer lapels
      p(ctx, bx+3, by, 4, bh*0.55, pal.shirt2);
      p(ctx, bx+bw-7, by, 4, bh*0.55, pal.shirt2);
      // Open collar
      p(ctx, cx-2, by, 4, bh*0.35, '#ffffff88');
      break;
    case 'product':
      // Smart casual — collar
      p(ctx, cx-2, by, 4, bh*0.3, '#ffffffcc');
      // Post-it on chest
      p(ctx, bx+2, by+7, 8, 7, '#ffeb3b');
      p(ctx, bx+3, by+10,6, 1, '#bbb');
      p(ctx, bx+3, by+12,5, 1, '#bbb');
      break;
    case 'doctor': case 'scientist':
      // White coat lapels
      p(ctx, bx+1, by,    5, bh*0.65, '#cccccc');
      p(ctx, bx+bw-6,by,  5, bh*0.65, '#cccccc');
      // Coat buttons
      p(ctx, cx,   by+3,  2, 2, '#aaa');
      p(ctx, cx,   by+8,  2, 2, '#aaa');
      p(ctx, cx,   by+13, 2, 2, '#aaa');
      // Breast pocket + pen
      p(ctx, bx+2, by+6,  7, 6, '#dddddd');
      p(ctx, bx+4, by+5,  2, 7, pal.acc);
      p(ctx, bx+6, by+5,  2, 7, '#eee');
      break;
    case 'chef':
      // Double breasted
      p(ctx, bx+2, by, 5, bh, '#eeeeee');
      p(ctx, bx+bw-7,by,5, bh, '#eeeeee');
      for (var cb=0; cb<3; cb++) {
        p(ctx, bx+3,    by+4+cb*5, 3, 3, '#ccc');
        p(ctx, bx+bw-6, by+4+cb*5, 3, 3, '#ccc');
      }
      break;
    case 'wizard':
      // Robe stars
      p(ctx, bx+3,  by+5,  1, 3, pal.acc); p(ctx, bx+2,  by+6,  3, 1, pal.acc);
      p(ctx, bx+14, by+12, 1, 3, pal.acc2); p(ctx, bx+13,by+13,  3, 1, pal.acc2);
      p(ctx, bx+8,  by+3,  1, 3, pal.acc); p(ctx, bx+7,  by+4,  3, 1, pal.acc);
      break;
    case 'knight':
      // Breastplate
      p(ctx, bx+1, by+2,  bw-2, bh-3, '#aaaaaa');
      p(ctx, bx+3, by+3,  bw-6, bh-5, '#cccccc');
      p(ctx, cx-1, by+3,  2, bh-5, '#888');
      p(ctx, bx+1, by+bh*0.4, bw-2, 2, '#888');
      p(ctx, bx+1, by+bh*0.65,bw-2, 2, '#888');
      // Crest
      p(ctx, cx-3, by+6,  6, 5,  pal.acc);
      p(ctx, cx-1, by+4,  2, 9,  pal.acc2);
      break;
    case 'pirate':
      // Coat lapels
      p(ctx, bx+2, by, 4, bh*0.7, pal.shirt2);
      p(ctx, bx+bw-6,by,4, bh*0.7, pal.shirt2);
      // Gold buttons
      for (var pb=0; pb<3; pb++) {
        p(ctx, cx-2, by+4+pb*5, 4, 4, pal.acc);
        p(ctx, cx-1, by+5+pb*5, 2, 2, pal.acc2);
      }
      break;
    case 'ninja':
      // Belt
      p(ctx, bx, by+bh*0.5-2, bw, 4, pal.acc);
      p(ctx, cx-3, by+bh*0.5-2, 6, 4, pal.acc2);
      break;
    case 'detective':
      // Trench coat lapels
      p(ctx, bx+2, by, 4, bh*0.6, pal.shirt2);
      p(ctx, bx+bw-6,by,4, bh*0.6, pal.shirt2);
      // Belt
      p(ctx, bx, by+bh*0.55, bw, 3, '#444');
      p(ctx, cx-2,by+bh*0.55,5, 3, '#777');
      break;
    case 'astronaut':
      // Neck ring
      p(ctx, cx-5, by, 10, 3, '#bbb');
      // Chest panel
      p(ctx, cx-7, by+5, 14, 12, '#ddd');
      p(ctx, cx-5, by+7, 4, 4,  pal.acc);
      p(ctx, cx+1, by+7, 4, 4,  '#aaa');
      p(ctx, cx-5, by+12,10, 2,  '#bbb');
      // Flag patch
      p(ctx, bx+2, by+3, 6, 4,  pal.acc2);
      break;
    case 'marketer':
      // Smart blazer
      p(ctx, bx+3, by, 4, bh*0.55, pal.shirt2);
      p(ctx, bx+bw-7,by,4,bh*0.55, pal.shirt2);
      p(ctx, cx-2, by, 4, bh*0.3, '#ffffffcc');
      // Lanyard
      p(ctx, cx-1, by, 2, bh*0.5, pal.acc);
      p(ctx, cx-3, by+bh*0.45,6, 5, pal.acc);
      break;
    default:
      // Simple collar
      p(ctx, cx-3, by, 6, 3, '#ffffff44');
      break;
  }
}

function _drawHeadAccessory(ctx, cx, hx, hy, hw, hh, pal, roleType, pose) {
  switch(roleType) {
    case 'chef':
      // Toque
      p(ctx, hx,    hy-14, hw,   16, '#ffffff');
      p(ctx, hx-1,  hy-3,  hw+2, 5,  '#eeeeee');
      p(ctx, hx+1,  hy-14, hw-2, 1,  '#f0f0f0');
      // Toque texture lines
      p(ctx, hx+3,  hy-11, 1, 8, '#eeeeee');
      p(ctx, hx+8,  hy-11, 1, 8, '#eeeeee');
      p(ctx, hx+13, hy-11, 1, 8, '#eeeeee');
      break;
    case 'wizard':
      // Tall pointed hat
      p(ctx, cx-1,  hy-22, 2, 4,  pal.shirt);
      p(ctx, cx-2,  hy-18, 4, 4,  pal.shirt);
      p(ctx, cx-4,  hy-14, 8, 4,  pal.shirt);
      p(ctx, cx-6,  hy-10, 12,4,  pal.shirt);
      p(ctx, hx-2,  hy-6,  hw+4,6,pal.shirt2); // brim
      // Hat band star
      p(ctx, cx-1,  hy-12, 3, 1, pal.acc); p(ctx, cx,hy-13,1,3,pal.acc);
      break;
    case 'knight':
      // Full pixel helmet
      p(ctx, hx-2,  hy-2,  hw+4, hh+3, '#999');
      p(ctx, hx-1,  hy-2,  hw+2, 4,    '#bbb'); // crown highlight
      // Visor gap
      p(ctx, hx+1,  hy+5,  hw-2, 4,    '#222');
      p(ctx, hx+1,  hy+5,  hw-2, 1,    '#444');
      // Cheek guards
      p(ctx, hx-2,  hy+4,  3,    8,    '#888');
      p(ctx, hx+hw-1,hy+4, 3,    8,    '#888');
      // Plume
      p(ctx, cx-1,  hy-9,  3,    9,    pal.acc);
      p(ctx, cx-2,  hy-12, 5,    4,    pal.acc);
      break;
    case 'pirate':
      // Tricorn
      p(ctx, hx-3,  hy-8,  hw+6, 4,    '#111');
      p(ctx, hx,    hy-14, hw,   7,    '#111');
      p(ctx, hx+1,  hy-14, hw-2, 1,    '#222');
      // Hat band
      p(ctx, hx,    hy-8,  hw,   2,    '#333');
      // Tiny skull
      p(ctx, cx-2,  hy-13, 5,    4,    '#eee');
      p(ctx, cx-2,  hy-11, 2,    2,    '#111');
      p(ctx, cx+1,  hy-11, 2,    2,    '#111');
      p(ctx, cx-1,  hy-10, 3,    1,    '#111');
      // Eyepatch (right eye only)
      p(ctx, hx+hw-7,hy+6, 8,    4,    '#111');
      p(ctx, hx+hw-4,hy+4, 2,    6,    '#333');
      break;
    case 'detective':
      // Fedora
      p(ctx, hx-3,  hy-3,  hw+6, 4,    '#3a2a1a');
      p(ctx, hx,    hy-10, hw,   8,    '#4a3020');
      p(ctx, hx+1,  hy-10, hw-2, 1,    '#5a3a28');
      // Indent in crown
      p(ctx, hx+3,  hy-10, hw-6, 2,    '#3a2a18');
      p(ctx, hx,    hy-4,  hw,   2,    '#2a1808');
      break;
    case 'ninja':
      // Mask over lower face
      p(ctx, hx,    hy+9,  hw,   hh-8, pal.shirt);
      p(ctx, hx+1,  hy+9,  hw-2, 1,    pal.shirt2);
      // Headband
      p(ctx, hx-1,  hy+3,  hw+2, 3,    pal.acc);
      // Knot
      p(ctx, hx-3,  hy+3,  4,    4,    pal.acc);
      p(ctx, hx-4,  hy+4,  3,    2,    pal.acc2);
      break;
    case 'astronaut':
      // Helmet (drawn over head)
      p(ctx, hx-4,  hy-4,  hw+8, hh+6, '#b0b0b0');
      p(ctx, hx-2,  hy-2,  hw+4, hh+2, '#334466'); // visor
      // Visor tint
      p(ctx, hx,    hy,    hw,   hh,   '#3355668a');
      // Visor reflection streak
      p(ctx, hx+2,  hy+2,  4,    8,    '#ffffff44');
      p(ctx, hx+2,  hy+2,  8,    1,    '#ffffff44');
      // Helmet ring
      p(ctx, hx-4,  hy+hh+2,hw+8, 3,  '#999');
      break;
    case 'doctor':
      // Head mirror
      p(ctx, hx+hw-2,hy+2, 7,    5,    '#ddd');
      p(ctx, hx+hw-1,hy+3, 5,    3,    '#ccc');
      p(ctx, hx+hw,  hy+4, 3,    1,    '#888');
      break;
    case 'scientist':
      // Goggles on forehead
      p(ctx, hx+1,  hy+1,  6,    4,    pal.acc2);
      p(ctx, hx+11, hy+1,  6,    4,    pal.acc2);
      p(ctx, hx+7,  hy+2,  4,    2,    '#888');
      p(ctx, hx+2,  hy+2,  4,    2,    '#ffffffbb');
      p(ctx, hx+12, hy+2,  4,    2,    '#ffffffbb');
      break;
    case 'designer':
      // Beret
      p(ctx, hx-1,  hy-5,  hw+2, 4,    pal.hair);
      p(ctx, hx,    hy-7,  hw,   3,    pal.hair);
      p(ctx, hx+2,  hy-8,  hw-4, 2,    pal.hair);
      // Pom
      p(ctx, hx+2,  hy-10, 6,    4,    '#ffffffcc');
      p(ctx, hx+3,  hy-11, 4,    2,    '#ffffffcc');
      break;
  }
}

function _drawHeldItem(ctx, cx, bx, by, bw, armY, pal, roleType) {
  var ix = bx + bw + 5;
  var iy = armY - 6;
  switch(roleType) {
    case 'doctor':
      p(ctx, ix, iy, 10, 14, '#e8d8a0');
      p(ctx, ix, iy, 10, 2,  '#c0a040');
      p(ctx, ix+1, iy+3, 8, 1, '#888');
      p(ctx, ix+1, iy+5, 8, 1, '#888');
      p(ctx, ix+1, iy+7, 6, 1, '#888');
      break;
    case 'teacher':
      p(ctx, ix, iy-10, 2, 24, '#8B6914');
      p(ctx, ix, iy-11, 2, 2, '#d4af37');
      break;
    case 'scientist':
      p(ctx, ix+2, iy,    4, 12, pal.acc);
      p(ctx, ix+2, iy,    4, 3,  '#fff');
      p(ctx, ix+3, iy+10, 2, 3,  '#ffffffaa');
      break;
    case 'wizard':
      p(ctx, bx-9, by-18, 3, 32, '#6b3a1a');
      p(ctx, bx-11,by-20, 7, 6,  pal.acc);
      p(ctx, bx-10,by-19, 5, 4,  '#ffffffcc');
      p(ctx, bx-9, by-22, 3, 3,  pal.acc2);
      break;
    case 'knight':
      p(ctx, ix, iy-14, 3, 26, '#ccc');
      p(ctx, ix, iy-14, 3, 1,  '#888');
      p(ctx, ix-5,iy,  13, 3,  '#aaa');
      p(ctx, cx+bw+6,iy-15,2,2,pal.acc);
      break;
    case 'detective':
      p(ctx, ix+3, iy,   8, 8, '#334455aa');
      p(ctx, ix+3, iy,   8, 1, '#888');
      p(ctx, ix+3, iy+7, 8, 1, '#888');
      p(ctx, ix+3, iy,   1, 8, '#888');
      p(ctx, ix+10,iy,   1, 8, '#888');
      p(ctx, ix+9, iy+8, 4, 4, '#888');
      break;
    case 'chef':
      p(ctx, ix, iy, 2, 14, '#888');
      p(ctx, ix-3,iy, 8, 6,  '#aaa');
      p(ctx, ix-3,iy+1,8,4,  '#c8c8c8');
      break;
    case 'marketer':
      p(ctx, ix, iy, 10, 14, '#f0e8d0');
      p(ctx, ix, iy, 10, 2,  '#c0a858');
      p(ctx, ix+1,iy+3,8,1,'#aaa');
      p(ctx, ix+1,iy+5,8,1,'#aaa');
      p(ctx, ix+1,iy+7,6,1,'#aaa');
      break;
  }
}

// ── Robot ─────────────────────────────────────────────────────────────────────
function _drawRobot(ctx, W, H, pose, pal) {
  var cx = W >> 1;
  var ll=0,rl=0,la=0,ra=0,bob=0;
  if (pose===1){ll=-3;rl=3;la=2;ra=-2;bob=1;}
  if (pose===2){ll=3;rl=-3;la=-2;ra=2;bob=1;}
  if (pose===4){ra=-7;}
  var groundY = H-2+bob;

  // Box feet
  p(ctx, cx-13,groundY-4, 12, 4, '#2d3748');
  p(ctx, cx+1, groundY-4, 12, 4, '#2d3748');
  p(ctx, cx-13,groundY-4, 12, 1, '#555');
  p(ctx, cx+1, groundY-4, 12, 1, '#555');

  // Box legs
  var legH=16;
  var legTop=groundY-4-legH;
  p(ctx, cx-11,legTop+ll, 9, legH,'#4a5568');
  p(ctx, cx+2, legTop+rl, 9, legH,'#4a5568');
  p(ctx, cx-11,legTop+ll, 1, legH,'#718096');
  p(ctx, cx+2, legTop+rl, 1, legH,'#718096');
  // Knee joint
  p(ctx, cx-11,legTop+legH/2+ll, 9, 3,'#2d3748');
  p(ctx, cx+2, legTop+legH/2+rl, 9, 3,'#2d3748');

  // Body (boxy)
  var bodyY=legTop-22; var bodyW=24;
  p(ctx, cx-bodyW/2,bodyY, bodyW,22,'#4a5568');
  p(ctx, cx-bodyW/2,bodyY, bodyW,2, '#718096');
  p(ctx, cx-bodyW/2,bodyY, 2,22,   '#718096');
  // Chest panel
  p(ctx, cx-8,bodyY+3, 16,13,'#1a2040');
  // LED row
  p(ctx, cx-7,bodyY+5, 3,3, pose>=3?'#ff4444':'#44ff44');
  p(ctx, cx-2,bodyY+5, 3,3, pal.acc);
  p(ctx, cx+3,bodyY+5, 3,3, '#ffff44');
  // Scanline
  var sl=bodyY+9+(pose===3?2:0);
  p(ctx, cx-7,sl,14,1,pal.acc);
  p(ctx, cx-7,sl,14,1,'#ffffff44');
  // Bolts
  p(ctx, cx-bodyW/2+1,bodyY+1,  2,2,'#2d3748');
  p(ctx, cx+bodyW/2-3,bodyY+1,  2,2,'#2d3748');
  p(ctx, cx-bodyW/2+1,bodyY+19, 2,2,'#2d3748');
  p(ctx, cx+bodyW/2-3,bodyY+19, 2,2,'#2d3748');

  // Arms
  p(ctx, cx-bodyW/2-7,bodyY+2+la, 7,16,'#4a5568');
  p(ctx, cx-bodyW/2-7,bodyY+2+la, 1,16,'#718096');
  p(ctx, cx-bodyW/2-8,bodyY+16+la,9, 5,'#2d3748');
  p(ctx, cx+bodyW/2,  bodyY+2+ra, 7,16,'#4a5568');
  p(ctx, cx+bodyW/2+6,bodyY+2+ra, 1,16,'#718096');
  p(ctx, cx+bodyW/2-1,bodyY+16+ra,9, 5,'#2d3748');
  // Shoulder bolts
  p(ctx, cx-bodyW/2-2,bodyY+1, 4,4,'#2d3748');
  p(ctx, cx+bodyW/2-2,bodyY+1, 4,4,'#2d3748');

  // Head (boxy)
  var headY=bodyY-18;
  p(ctx, cx-10,headY, 20,17,'#4a5568');
  p(ctx, cx-10,headY, 20,2, '#718096');
  p(ctx, cx-10,headY, 2, 17,'#718096');
  // Antenna
  p(ctx, cx+4,headY-9, 2,10,'#2d3748');
  p(ctx, cx+3,headY-10,4, 4,pal.acc);
  p(ctx, cx+4,headY-9, 2, 2,'#ffffff88');
  // Visor
  p(ctx, cx-8,headY+4, 16,7,'#0d1a30');
  // Eye LEDs
  var eyeC=(pose>=3)?pal.acc:'#6688aa';
  p(ctx, cx-7,headY+5, 5,5,eyeC);
  p(ctx, cx+2,headY+5, 5,5,eyeC);
  p(ctx, cx-6,headY+6, 3,3,'#ffffff55');
  p(ctx, cx+3,headY+6, 3,3,'#ffffff55');
  p(ctx, cx-6,headY+6, 1,1,'#fff');
  p(ctx, cx+4,headY+6, 1,1,'#fff');
  // Mouth grille
  p(ctx, cx-7,headY+13,14,3,'#2d3748');
  for (var g=0;g<5;g++) p(ctx, cx-6+g*3,headY+13,2,3,'#1a252f');
}

// ── Alien ─────────────────────────────────────────────────────────────────────
function _drawAlien(ctx, W, H, pose, pal) {
  var cx = W>>1;
  var ll=0,rl=0,bob=0;
  if(pose===1){ll=-3;rl=3;bob=1;}
  if(pose===2){ll=3;rl=-3;bob=1;}
  var groundY=H-2+bob;

  // 3 spindly legs
  p(ctx,cx-10,groundY-20+ll,3,20,'#228822');
  p(ctx,cx-2, groundY-22,   3,22,'#228822');
  p(ctx,cx+6, groundY-20+rl,3,20,'#228822');

  // Body
  var by=groundY-20-20;
  p(ctx,cx-10,by,  20,20,'#44cc44');
  p(ctx,cx-8, by-2,16,22,'#44cc44');
  p(ctx,cx-5, by+3,10,12,'#66ee66'); // belly

  // 4 arms
  p(ctx,cx-14,by+2, 4,12,'#228822');
  p(ctx,cx-14,by+8, 14,4,'#228822');
  p(ctx,cx+10,by+2, 4,12,'#228822');
  p(ctx,cx+3, by+8, 12,4,'#228822');

  // Huge head
  var hy=by-24;
  p(ctx,cx-14,hy,   28,24,'#44cc44');
  p(ctx,cx-12,hy-3, 24,26,'#44cc44');
  p(ctx,cx-10,hy-5, 20,28,'#33aa33');
  // Veins
  p(ctx,cx-4,hy+2,1,12,'#228822');
  p(ctx,cx+3,hy+2,1,12,'#228822');

  // Huge almond eyes
  p(ctx,cx-11,hy+8, 9,6,'#0a0a1a');
  p(ctx,cx+2, hy+8, 9,6,'#0a0a1a');
  p(ctx,cx-10,hy+9, 7,4,'#440088');
  p(ctx,cx+3, hy+9, 7,4,'#440088');
  p(ctx,cx-9, hy+9, 2,2,'#ffffff66');
  p(ctx,cx+4, hy+9, 2,2,'#ffffff66');

  // Slit mouth
  p(ctx,cx-5,hy+18,10,1,'#228822');
  p(ctx,cx-4,hy+17, 8,1,'#33aa33');

  // Antennae
  p(ctx,cx-8,hy-8,2,9,'#44cc44');
  p(ctx,cx+6,hy-8,2,9,'#44cc44');
  p(ctx,cx-10,hy-10,6,4,'#ff00ff');
  p(ctx,cx+4, hy-10,6,4,'#ff00ff');
}

// ── Animals ───────────────────────────────────────────────────────────────────
function _drawAnimal(ctx,W,H,pose,pal,roleType) {
  switch(roleType){
    case 'animal_cat':    _drawCat(ctx,W,H,pose,pal); break;
    case 'animal_dog':    _drawDog(ctx,W,H,pose,pal); break;
    case 'animal_fox':    _drawFox(ctx,W,H,pose,pal); break;
    case 'animal_bear':   _drawBear(ctx,W,H,pose,pal); break;
    case 'animal_penguin':_drawPenguin(ctx,W,H,pose,pal); break;
    case 'animal_owl':    _drawOwl(ctx,W,H,pose,pal); break;
  }
}

function _drawCat(ctx,W,H,pose,pal){
  var cx=W>>1;
  var ll=0,rl=0,la=0,ra=0,bob=0;
  if(pose===1){ll=-2;rl=2;la=2;ra=-2;bob=1;}
  if(pose===2){ll=2;rl=-2;la=-2;ra=2;bob=1;}
  if(pose===4){ra=-6;}
  var gY=H-2+bob;
  var bc=pal.shirt||'#888';
  var bl=pal.shirt2||'#aaa';
  var bd=pal.shirtS||'#555';

  // Tail
  p(ctx,cx+10,gY-22,3,14,bc);
  p(ctx,cx+11,gY-30,3, 9,bc);
  p(ctx,cx+10,gY-34,4, 5,bl);

  // Feet/paws
  p(ctx,cx-9, gY-3, 7,3,bd);
  p(ctx,cx+2, gY-3, 7,3,bd);
  // Legs
  p(ctx,cx-8, gY-3-12+ll,6,12,bd);
  p(ctx,cx+3, gY-3-12+rl,6,12,bd);

  // Body
  p(ctx,cx-10,gY-3-12-16,20,18,bc);
  p(ctx,cx-8, gY-3-12-18,16,20,bc);
  p(ctx,cx-6, gY-3-12-14,12,14,bl); // belly

  // Arms
  p(ctx,cx-14,gY-3-12-14+la,5,12,bd);
  p(ctx,cx-14,gY-3-12-4+la, 6, 4,bc);
  p(ctx,cx+9, gY-3-12-14+ra,5,12,bd);
  p(ctx,cx+9, gY-3-12-4+ra, 6, 4,bc);

  // Head
  var hy=gY-3-12-16-16;
  p(ctx,cx-9, hy,   18,14,bc);
  p(ctx,cx-7, hy-2, 14,16,bc);
  // Ear triangles
  p(ctx,cx-9, hy-7, 2,8,bc); p(ctx,cx-8,hy-8,4,3,bc);
  p(ctx,cx+5, hy-7, 2,8,bc); p(ctx,cx+4,hy-8,4,3,bc);
  p(ctx,cx-8, hy-6, 2,5,'#ffaaaa'); p(ctx,cx+5,hy-6,2,5,'#ffaaaa');

  // Eyes — slit pupils
  p(ctx,cx-6,hy+4,5,4,'#eee');
  p(ctx,cx+1,hy+4,5,4,'#eee');
  p(ctx,cx-4,hy+5,1,3,'#111');
  p(ctx,cx+3,hy+5,1,3,'#111');
  p(ctx,cx-5,hy+5,3,2,pal.acc||'#44ff88');
  p(ctx,cx+2,hy+5,3,2,pal.acc||'#44ff88');
  p(ctx,cx-5,hy+4,5,1,'#888');

  // Nose
  p(ctx,cx-1,hy+9, 2,1,'#ffaaaa');
  p(ctx,cx-2,hy+10,4,1,'#ffaaaa');
  // Whiskers
  p(ctx,cx-7,hy+10,4,1,'#ffffff99');
  p(ctx,cx+3,hy+10,4,1,'#ffffff99');
  p(ctx,cx-7,hy+11,3,1,'#ffffff66');
  p(ctx,cx+4,hy+11,3,1,'#ffffff66');
  // Mouth
  p(ctx,cx-2,hy+12,1,2,bd); p(ctx,cx,hy+13,1,1,bd); p(ctx,cx+1,hy+12,1,2,bd);
}

function _drawDog(ctx,W,H,pose,pal){
  var cx=W>>1;
  var ll=0,rl=0,la=0,ra=0,bob=0;
  if(pose===1){ll=-2;rl=2;la=2;ra=-2;bob=1;}
  if(pose===2){ll=2;rl=-2;la=-2;ra=2;bob=1;}
  if(pose===4){ra=-6;}
  var gY=H-2+bob;
  var bc=pal.shirt||'#c8a050';
  var bl=pal.shirt2||'#e8c870';
  var bd=pal.shirtS||'#a07030';

  // Tail (wagging when happy)
  var tw=(pose===3||pose===4)?-4:0;
  p(ctx,cx+10,gY-18+tw,4,12,bc);
  p(ctx,cx+9, gY-22+tw,5, 6,bc);

  p(ctx,cx-10,gY-3,8,3,bd); p(ctx,cx+2,gY-3,8,3,bd);
  p(ctx,cx-9, gY-3-12+ll,7,12,bd); p(ctx,cx+2,gY-3-12+rl,7,12,bd);

  p(ctx,cx-11,gY-3-12-16,22,18,bc);
  p(ctx,cx-9, gY-3-12-18,18,20,bc);
  p(ctx,cx-6, gY-3-12-14,12,12,bl);
  p(ctx,cx+2, gY-3-12-10, 6, 6,bd); // spot

  p(ctx,cx-14,gY-3-12-14+la,5,12,bc); p(ctx,cx-13,gY-3-12-4+la,6,4,bl);
  p(ctx,cx+9, gY-3-12-14+ra,5,12,bc); p(ctx,cx+9, gY-3-12-4+ra,6,4,bl);

  var hy=gY-3-12-16-16;
  p(ctx,cx-9,hy,  18,14,bc); p(ctx,cx-7,hy-2,14,16,bc);
  // Floppy ears
  p(ctx,cx-13,hy+2,6,12,bd); p(ctx,cx+7,hy+2,6,12,bd);
  // Snout
  p(ctx,cx-5,hy+8,10,7,bl);
  // Nose
  p(ctx,cx-2,hy+7,4,3,'#111'); p(ctx,cx-1,hy+7,2,1,'#333');
  // Eyes
  p(ctx,cx-6,hy+3,4,4,'#eee'); p(ctx,cx+2,hy+3,4,4,'#eee');
  p(ctx,cx-5,hy+4,2,2,'#3a2010'); p(ctx,cx+3,hy+4,2,2,'#3a2010');
  p(ctx,cx-5,hy+4,1,1,'#fff'); p(ctx,cx+4,hy+4,1,1,'#fff');
  p(ctx,cx-6,hy+3,4,1,'#888'); p(ctx,cx+2,hy+3,4,1,'#888');
  // Mouth
  p(ctx,cx-3,hy+13,3,1,bd); p(ctx,cx+1,hy+13,3,1,bd);
  if(pose===3||pose===4){
    p(ctx,cx-2,hy+14,4,5,'#ff6688');
    p(ctx,cx-2,hy+17,4,2,'#ee4466');
  }
}

function _drawFox(ctx,W,H,pose,pal){
  var cx=W>>1;
  var ll=0,rl=0,la=0,ra=0,bob=0;
  if(pose===1){ll=-2;rl=2;la=2;ra=-2;bob=1;}
  if(pose===2){ll=2;rl=-2;la=-2;ra=2;bob=1;}
  if(pose===4){ra=-6;}
  var gY=H-2+bob;
  var or='#e05010',orL='#f07020',orD='#a03000',wh='#f0ece0',bk='#111';

  p(ctx,cx+9,gY-20,5,14,or); p(ctx,cx+10,gY-26,5,8,or); p(ctx,cx+9,gY-30,6,5,wh);

  p(ctx,cx-10,gY-3,8,3,bk); p(ctx,cx+2,gY-3,8,3,bk);
  p(ctx,cx-9,gY-3-12+ll,7,12,orD); p(ctx,cx+2,gY-3-12+rl,7,12,orD);

  p(ctx,cx-10,gY-3-12-16,20,18,or); p(ctx,cx-8,gY-3-12-18,16,20,or);
  p(ctx,cx-6,gY-3-12-14,12,14,wh);

  p(ctx,cx-13,gY-3-12-14+la,5,12,orD); p(ctx,cx-13,gY-3-12-4+la,5,4,bk);
  p(ctx,cx+8, gY-3-12-14+ra,5,12,orD); p(ctx,cx+8, gY-3-12-4+ra,5,4,bk);

  var hy=gY-3-12-16-16;
  p(ctx,cx-8,hy,16,13,or); p(ctx,cx-6,hy-2,12,15,or);
  // Pointy ears
  p(ctx,cx-8,hy-8,2,9,or); p(ctx,cx-7,hy-9,4,3,or);
  p(ctx,cx+4,hy-8,2,9,or); p(ctx,cx+3,hy-9,4,3,or);
  p(ctx,cx-7,hy-7,2,6,'#ffccaa'); p(ctx,cx+5,hy-7,2,6,'#ffccaa');
  // White face + black mask
  p(ctx,cx-5,hy+4,10,9,wh);
  p(ctx,cx-7,hy+3,4,5,bk); p(ctx,cx+3,hy+3,4,5,bk);
  // Eyes
  p(ctx,cx-5,hy+4,3,3,'#eee'); p(ctx,cx+2,hy+4,3,3,'#eee');
  p(ctx,cx-4,hy+5,2,2,'#1a4000'); p(ctx,cx+3,hy+5,2,2,'#1a4000');
  p(ctx,cx-4,hy+5,1,1,'#fff'); p(ctx,cx+4,hy+5,1,1,'#fff');
  p(ctx,cx-5,hy+4,3,1,'#888'); p(ctx,cx+2,hy+4,3,1,'#888');
  p(ctx,cx-1,hy+9,2,2,bk);
}

function _drawBear(ctx,W,H,pose,pal){
  var cx=W>>1;
  var ll=0,rl=0,la=0,ra=0,bob=0;
  if(pose===1){ll=-2;rl=2;la=2;ra=-2;bob=1;}
  if(pose===2){ll=2;rl=-2;la=-2;ra=2;bob=1;}
  if(pose===4){ra=-6;la=2;}
  var gY=H-2+bob;
  var br=pal.shirt||'#8B4513',brL=pal.shirt2||'#c07840',brD=pal.shirtS||'#5a2e0a',be='#d4a070';

  p(ctx,cx-11,gY-4,10,4,brD); p(ctx,cx+1,gY-4,10,4,brD);
  p(ctx,cx-10,gY-4-10+ll,8,10,brD); p(ctx,cx+2,gY-4-10+rl,8,10,brD);

  p(ctx,cx-13,gY-4-10-20,26,22,br); p(ctx,cx-11,gY-4-10-22,22,24,br);
  p(ctx,cx-8, gY-4-10-18,16,16,be);

  p(ctx,cx-17,gY-4-10-18+la,7,14,br); p(ctx,cx-17,gY-4-10-6+la,8,6,brL);
  p(ctx,cx+10,gY-4-10-18+ra,7,14,br); p(ctx,cx+10,gY-4-10-6+ra,8,6,brL);

  var hy=gY-4-10-20-18;
  p(ctx,cx-10,hy,  20,16,br); p(ctx,cx-8,hy-2,16,18,br);
  // Round ears (pixel squares)
  p(ctx,cx-12,hy-4,8,8,br); p(ctx,cx+4,hy-4,8,8,br);
  p(ctx,cx-11,hy-3,6,6,brD); p(ctx,cx+5,hy-3,6,6,brD);

  p(ctx,cx-6,hy+8,12,8,be);
  p(ctx,cx-2,hy+7,4,3,'#111'); p(ctx,cx-1,hy+7,2,1,'#333');
  p(ctx,cx-6,hy+3,4,4,brD); p(ctx,cx+2,hy+3,4,4,brD);
  p(ctx,cx-5,hy+4,2,2,'#111'); p(ctx,cx+3,hy+4,2,2,'#111');
  p(ctx,cx-5,hy+4,1,1,'#fff'); p(ctx,cx+4,hy+4,1,1,'#fff');
  p(ctx,cx-6,hy+3,4,1,'#888'); p(ctx,cx+2,hy+3,4,1,'#888');
  p(ctx,cx-3,hy+13,3,1,brD); p(ctx,cx+1,hy+13,3,1,brD);
}

function _drawPenguin(ctx,W,H,pose,pal){
  var cx=W>>1;
  var ll=0,rl=0,bob=0;
  if(pose===1){ll=-2;rl=2;bob=1;} if(pose===2){ll=2;rl=-2;bob=1;}
  var gY=H-2+bob;
  var bk='#1a1a2e',wh='#f0f0f0',or='#ff8800';

  p(ctx,cx-9,gY-3,8,3,or); p(ctx,cx+1,gY-3,8,3,or);
  p(ctx,cx-7,gY-3-6+ll,5,6,or); p(ctx,cx+2,gY-3-6+rl,5,6,or);

  p(ctx,cx-12,gY-3-6-26,24,28,bk); p(ctx,cx-10,gY-3-6-28,20,30,bk);
  p(ctx,cx-8, gY-3-6-24,16,24,wh);

  p(ctx,cx-16,gY-3-6-24,6,20,bk); p(ctx,cx+10,gY-3-6-24,6,20,bk);

  var hy=gY-3-6-26-16;
  p(ctx,cx-9,hy,18,14,bk); p(ctx,cx-7,hy-2,14,16,bk);
  p(ctx,cx-6,hy+2,12,11,wh);
  p(ctx,cx-3,hy+8,6,2,or); p(ctx,cx-2,hy+10,4,2,or);
  p(ctx,cx-5,hy+2,4,4,bk); p(ctx,cx+1,hy+2,4,4,bk);
  p(ctx,cx-4,hy+3,2,2,'#111'); p(ctx,cx+2,hy+3,2,2,'#111');
  p(ctx,cx-4,hy+3,1,1,'#fff'); p(ctx,cx+3,hy+3,1,1,'#fff');
  p(ctx,cx-5,hy+2,4,1,'#888'); p(ctx,cx+1,hy+2,4,1,'#888');
  // Bow tie
  p(ctx,gY-3-6-4+cx-5,0,0,0,''); // just use absolute
  var btY=gY-3-6-4;
  p(ctx,cx-4,btY,3,4,pal.acc||'#ff4444'); p(ctx,cx+1,btY,3,4,pal.acc||'#ff4444');
  p(ctx,cx-1,btY+1,2,2,'#cc0000');
}

function _drawOwl(ctx,W,H,pose,pal){
  var cx=W>>1;
  var ll=0,rl=0,bob=0;
  if(pose===1){ll=-1;rl=1;bob=1;} if(pose===2){ll=1;rl=-1;bob=1;}
  var gY=H-2+bob;
  var br=pal.shirt||'#7B4A1A',brL=pal.shirt2||'#a06030',brD=pal.shirtS||'#4a2808';
  var cr='#f0deb4',eyeC=pal.acc||'#ffdd00';

  // Talons
  p(ctx,cx-8,gY-2,3,2,'#aa8800'); p(ctx,cx-5,gY-3,2,3,'#aa8800'); p(ctx,cx-2,gY-2,3,2,'#aa8800');
  p(ctx,cx+3,gY-2,3,2,'#aa8800'); p(ctx,cx+5,gY-3,2,3,'#aa8800'); p(ctx,cx+7,gY-2,3,2,'#aa8800');

  p(ctx,cx-7,gY-2-6+ll,4,6,brD); p(ctx,cx+3,gY-2-6+rl,4,6,brD);

  p(ctx,cx-11,gY-2-6-24,22,26,br); p(ctx,cx-9,gY-2-6-26,18,28,br);
  // Wings
  p(ctx,cx-13,gY-2-6-22,4,20,brD); p(ctx,cx+9,gY-2-6-22,4,20,brD);
  // Wing feathers
  for(var fw=0;fw<4;fw++){
    p(ctx,cx-13,gY-2-6-22+fw*5,4,1,br);
    p(ctx,cx+9, gY-2-6-22+fw*5,4,1,br);
  }
  // Belly
  p(ctx,cx-7,gY-2-6-22,14,20,cr);
  // Belly streaks
  for(var bsr=0;bsr<4;bsr++) p(ctx,cx-2+bsr,gY-2-6-20+bsr*4,2,3,brD);

  var hy=gY-2-6-24-18;
  p(ctx,cx-11,hy,22,16,br); p(ctx,cx-9,hy-2,18,18,br);
  // Ear tufts
  p(ctx,cx-9,hy-9,3,10,brD); p(ctx,cx-8,hy-10,5,3,brD);
  p(ctx,cx+5,hy-9,3,10,brD); p(ctx,cx+3,hy-10,5,3,brD);
  // Facial disc
  p(ctx,cx-8,hy+2,16,13,cr);

  // HUGE eyes — owl's defining feature — each 7x7 pixels
  // Left eye
  p(ctx,cx-8,hy+2,7,7,eyeC);
  p(ctx,cx-7,hy+3,5,5,'#221100');
  p(ctx,cx-6,hy+4,3,3,'#111');
  p(ctx,cx-6,hy+4,1,1,'#fff');
  // Eye ring
  p(ctx,cx-8,hy+2,7,1,br); p(ctx,cx-8,hy+8,7,1,br);
  p(ctx,cx-8,hy+2,1,7,br); p(ctx,cx-2,hy+2,1,7,br);
  // Right eye
  p(ctx,cx+1,hy+2,7,7,eyeC);
  p(ctx,cx+2,hy+3,5,5,'#221100');
  p(ctx,cx+3,hy+4,3,3,'#111');
  p(ctx,cx+4,hy+4,1,1,'#fff');
  p(ctx,cx+1,hy+2,7,1,br); p(ctx,cx+1,hy+8,7,1,br);
  p(ctx,cx+1,hy+2,1,7,br); p(ctx,cx+7,hy+2,1,7,br);

  // Beak
  p(ctx,cx-2,hy+9,4,2,'#cc8800'); p(ctx,cx-1,hy+11,2,2,'#cc8800');

  // Glasses if talking
  if(pose===3||pose===4){
    p(ctx,cx-9,hy+1,8,1,'#777'); p(ctx,cx-9,hy+8,8,1,'#777');
    p(ctx,cx-9,hy+1,1,8,'#777'); p(ctx,cx-2,hy+1,1,8,'#777');
    p(ctx,cx,  hy+1,8,1,'#777'); p(ctx,cx,  hy+8,8,1,'#777');
    p(ctx,cx,  hy+1,1,8,'#777'); p(ctx,cx+7,hy+1,1,8,'#777');
    p(ctx,cx-2,hy+4,3,1,'#777');
  }
}
