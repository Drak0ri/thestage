// js/chars.js — character data, personalities, and procedural pixel-art rendering
// v2.13 — full procedural sprites: role-aware humans + animals, animated

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
const ACTIONS = ['nod','shake','shrug','jump','wave','spin','think','facepalm','point','bow','dance','stomp'];

// ── Skin tone palettes ────────────────────────────────────────────────────────
const SKIN_TONES = [
  { skin:'#fde8c8', skinS:'#e0b88a', skinH:'#fff0e0' },  // fair
  { skin:'#f5c5a3', skinS:'#d4956a', skinH:'#fde0c8' },  // light
  { skin:'#e8a87c', skinS:'#c07848', skinH:'#f0c090' },  // medium-light
  { skin:'#c68642', skinS:'#a0622e', skinH:'#d89858' },  // medium
  { skin:'#a0622e', skinS:'#7a4020', skinH:'#b87840' },  // medium-dark
  { skin:'#7a3a18', skinS:'#5a2008', skinH:'#9a5028' },  // dark
];

// ── Hair colour palettes ──────────────────────────────────────────────────────
const HAIR_COLORS = [
  { hair:'#1a0a00', hairH:'#3a2010' },  // black
  { hair:'#3d2b1f', hairH:'#6b4c38' },  // dark brown
  { hair:'#7b4f2e', hairH:'#a07048' },  // brown
  { hair:'#c07840', hairH:'#d89858' },  // auburn
  { hair:'#d4a800', hairH:'#f0c820' },  // blonde
  { hair:'#e8c870', hairH:'#f0d890' },  // light blonde
  { hair:'#888',    hairH:'#bbb'    },  // grey
  { hair:'#fff',    hairH:'#ddd'    },  // white
  { hair:'#cc2200', hairH:'#ee4400' },  // red
  { hair:'#6633cc', hairH:'#9955ee' },  // purple (fun)
  { hair:'#0055cc', hairH:'#2277ee' },  // blue
  { hair:'#00aa44', hairH:'#22cc66' },  // green
];

// ── Role detection ────────────────────────────────────────────────────────────
// Returns a type string used by the renderer
function detectRoleType(role) {
  if (!role) return 'default';
  var r = role.toLowerCase();
  // Animals first
  if (/\bcat\b/.test(r))     return 'animal_cat';
  if (/\bdog\b/.test(r))     return 'animal_dog';
  if (/\bfox\b/.test(r))     return 'animal_fox';
  if (/\bbear\b/.test(r))    return 'animal_bear';
  if (/\bpenguin\b/.test(r)) return 'animal_penguin';
  if (/\bowl\b/.test(r))     return 'animal_owl';
  if (/\brobot\b|bot\b|ai\b|android/.test(r)) return 'robot';
  if (/\balien\b/.test(r))   return 'alien';
  if (/\bghost\b/.test(r))   return 'ghost';
  // Human roles
  if (/dev|engineer|coder|programmer|software|backend|frontend|fullstack|tech/.test(r)) return 'developer';
  if (/design|ux|ui|artist|creative|graphic/.test(r)) return 'designer';
  if (/ceo|chief exec|founder|co-founder/.test(r)) return 'ceo';
  if (/cto|chief tech/.test(r)) return 'cto';
  if (/coo|chief oper/.test(r)) return 'coo';
  if (/cfo|chief fin/.test(r)) return 'finance';
  if (/manager|lead|head of|director|vp |vice pres/.test(r)) return 'manager';
  if (/product|pm\b|p\.m\./.test(r)) return 'product';
  if (/market|growth|brand|content|seo/.test(r)) return 'marketer';
  if (/sales|account|business dev|biz dev/.test(r)) return 'sales';
  if (/doctor|physician|nurse|medical|health/.test(r)) return 'doctor';
  if (/teacher|professor|educator|lecturer|tutor/.test(r)) return 'teacher';
  if (/scientist|research|analyst|data|ml |machine learn/.test(r)) return 'scientist';
  if (/lawyer|legal|attorney|counsel/.test(r)) return 'lawyer';
  if (/finance|accountant|finan|invest|quant/.test(r)) return 'finance';
  if (/chef|cook|food/.test(r)) return 'chef';
  if (/sport|athlet|coach|trainer|fitness/.test(r)) return 'athlete';
  if (/music|musician|dj|composer/.test(r)) return 'musician';
  if (/astronaut|space/.test(r)) return 'astronaut';
  if (/detective|spy|secret/.test(r)) return 'detective';
  if (/wizard|mage|magic|sorcerer/.test(r)) return 'wizard';
  if (/knight|warrior|soldier|guard/.test(r)) return 'knight';
  if (/pirate/.test(r)) return 'pirate';
  if (/ninja/.test(r)) return 'ninja';
  return 'default';
}

// ── Colour slots per role ─────────────────────────────────────────────────────
function getRoleColors(roleType, colorIdx) {
  var skin = SKIN_TONES[colorIdx % SKIN_TONES.length];
  var hair = HAIR_COLORS[colorIdx % HAIR_COLORS.length];

  var palettes = {
    developer:  { shirt:'#2c3e50', shirtS:'#1a252f', shirt2:'#34495e', pants:'#1a1a2e', pantsS:'#0d0d1a', shoes:'#111', accessory:'#44ff88', acc2:'#22cc66' },
    designer:   { shirt:'#9b59b6', shirtS:'#7d3f9a', shirt2:'#c39bd3', pants:'#2c2040', pantsS:'#1a1028', shoes:'#222', accessory:'#ff6b9d', acc2:'#cc4477' },
    ceo:        { shirt:'#1a1a1a', shirtS:'#0a0a0a', shirt2:'#2a2a2a', pants:'#0d0d0d', pantsS:'#000',    shoes:'#000', accessory:'#d4af37', acc2:'#b8860b' },
    cto:        { shirt:'#1c3a5e', shirtS:'#0d2040', shirt2:'#2a5080', pants:'#0d1a2a', pantsS:'#060d15', shoes:'#111', accessory:'#4aa8ff', acc2:'#2288ee' },
    coo:        { shirt:'#2d4a2a', shirtS:'#1a2e18', shirt2:'#3d6040', pants:'#1a2a18', pantsS:'#0d1510', shoes:'#111', accessory:'#88cc44', acc2:'#66aa22' },
    manager:    { shirt:'#2e4a6e', shirtS:'#1a2e48', shirt2:'#3a5a80', pants:'#1a2030', pantsS:'#0d1020', shoes:'#111', accessory:'#88aaff', acc2:'#5588dd' },
    product:    { shirt:'#3a2a5e', shirtS:'#251a40', shirt2:'#4a3a70', pants:'#1a1028', pantsS:'#0d0815', shoes:'#222', accessory:'#ff8844', acc2:'#dd6622' },
    marketer:   { shirt:'#c0392b', shirtS:'#922b21', shirt2:'#e74c3c', pants:'#1a0a0a', pantsS:'#0d0505', shoes:'#222', accessory:'#ffaa00', acc2:'#dd8800' },
    sales:      { shirt:'#27ae60', shirtS:'#1e8449', shirt2:'#2ecc71', pants:'#0d1a0d', pantsS:'#060e06', shoes:'#222', accessory:'#ffdd00', acc2:'#ccaa00' },
    doctor:     { shirt:'#e8f4fd', shirtS:'#c8d8e8', shirt2:'#ffffff', pants:'#b8d0e8', pantsS:'#8ab0c8', shoes:'#ddd', accessory:'#e74c3c', acc2:'#c0392b' },
    teacher:    { shirt:'#8b6914', shirtS:'#6a4e10', shirt2:'#a07820', pants:'#2c1a08', pantsS:'#1a0e04', shoes:'#3a1a08', accessory:'#ddd', acc2:'#bbb' },
    scientist:  { shirt:'#ecf0f1', shirtS:'#bdc3c7', shirt2:'#ffffff', pants:'#7f8c8d', pantsS:'#5d6d7e', shoes:'#555', accessory:'#00d2ff', acc2:'#0099cc' },
    lawyer:     { shirt:'#1a1a2e', shirtS:'#0d0d1a', shirt2:'#2a2a3e', pants:'#0d0d0d', pantsS:'#000',    shoes:'#000', accessory:'#888', acc2:'#666' },
    finance:    { shirt:'#1c2e4a', shirtS:'#0d1a2e', shirt2:'#2a3e5a', pants:'#0d0d0d', pantsS:'#000',    shoes:'#111', accessory:'#cc8800', acc2:'#aa6600' },
    chef:       { shirt:'#ffffff', shirtS:'#dddddd', shirt2:'#eeeeee', pants:'#2a2a2a', pantsS:'#111',    shoes:'#222', accessory:'#ffffff', acc2:'#dddddd' },
    athlete:    { shirt:'#e74c3c', shirtS:'#c0392b', shirt2:'#ff6b6b', pants:'#1a1a2e', pantsS:'#0d0d1a', shoes:'#ddd', accessory:'#ffdd00', acc2:'#ffaa00' },
    musician:   { shirt:'#2c2c2c', shirtS:'#1a1a1a', shirt2:'#3a3a3a', pants:'#1a1a1a', pantsS:'#0d0d0d', shoes:'#111', accessory:'#aa4400', acc2:'#882200' },
    astronaut:  { shirt:'#e8e8e8', shirtS:'#c8c8c8', shirt2:'#ffffff', pants:'#c8c8c8', pantsS:'#a8a8a8', shoes:'#bbb', accessory:'#4488ff', acc2:'#2266dd' },
    detective:  { shirt:'#3a2a1a', shirtS:'#2a1a0a', shirt2:'#4a3a2a', pants:'#1a1208', pantsS:'#0d0904', shoes:'#222', accessory:'#888', acc2:'#555' },
    wizard:     { shirt:'#1a0a2e', shirtS:'#0d0518', shirt2:'#2a1040', pants:'#0d0818', pantsS:'#060410', shoes:'#1a0a2e', accessory:'#ff88ff', acc2:'#cc44cc' },
    knight:     { shirt:'#888', shirtS:'#555', shirt2:'#aaa', pants:'#555', pantsS:'#333', shoes:'#333', accessory:'#d4af37', acc2:'#b8860b' },
    pirate:     { shirt:'#8b0000', shirtS:'#600000', shirt2:'#aa0000', pants:'#1a1a1a', pantsS:'#0d0d0d', shoes:'#222', accessory:'#d4af37', acc2:'#b8860b' },
    ninja:      { shirt:'#0a0a0a', shirtS:'#000', shirt2:'#1a1a1a', pants:'#0a0a0a', pantsS:'#000', shoes:'#000', accessory:'#cc0000', acc2:'#880000' },
    default:    { shirt:'#3a5078', shirtS:'#2a3a58', shirt2:'#4a6088', pants:'#1a2030', pantsS:'#0d1018', shoes:'#222', accessory:'#88aacc', acc2:'#5588aa' },
  };

  var pal = palettes[roleType] || palettes.default;
  return Object.assign({}, skin, hair, pal);
}

// ── Main draw function ────────────────────────────────────────────────────────
// pose: 0=stand, 1=walk-a, 2=walk-b, 3=talk/lean-forward, 4=action/arm-up
// opts: { flip, actionType }
function drawPixelChar(ctx, palOrColorIdx, frame, opts) {
  opts = opts || {};
  var W = ctx.canvas ? ctx.canvas.width  : 24;
  var H = ctx.canvas ? ctx.canvas.height : 36;
  var pose = frame || 0;

  // Support being called with a palette object (roster/pills) or a member object
  var pal, roleType;
  if (palOrColorIdx && typeof palOrColorIdx === 'object' && palOrColorIdx.roleType) {
    roleType = palOrColorIdx.roleType;
    pal = palOrColorIdx;
  } else {
    var colorIdx = (typeof palOrColorIdx === 'number') ? palOrColorIdx : 0;
    roleType = (opts && opts.roleType) ? opts.roleType : 'default';
    pal = getRoleColors(roleType, colorIdx);
  }

  var isAnimal = roleType && roleType.startsWith('animal_');
  var isRobot  = roleType === 'robot';
  var isAlien  = roleType === 'alien';
  var isGhost  = roleType === 'ghost';

  ctx.save();
  if (opts.flip) {
    ctx.scale(-1, 1);
    ctx.translate(-W, 0);
  }

  if (isAnimal) {
    _drawAnimal(ctx, W, H, pose, pal, roleType);
  } else if (isRobot) {
    _drawRobot(ctx, W, H, pose, pal);
  } else if (isAlien) {
    _drawAlien(ctx, W, H, pose, pal);
  } else if (isGhost) {
    _drawGhost(ctx, W, H, pose, pal);
  } else {
    _drawHuman(ctx, W, H, pose, pal, roleType);
  }

  ctx.restore();
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function circle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(Math.round(cx), Math.round(cy), r, 0, Math.PI * 2);
  ctx.fill();
}

// ── Human renderer ────────────────────────────────────────────────────────────
function _drawHuman(ctx, W, H, pose, pal, roleType) {
  var p = pal;

  // Proportions (pixel units, scaled to W/H)
  var s = W / 16;  // base scale unit
  var cx = W / 2;

  // Walk animation — leg/arm offsets
  var leftLegOff  = 0, rightLegOff = 0;
  var leftArmOff  = 0, rightArmOff = 0;
  var bodyBob     = 0;
  var bodyLean    = 0;
  var armRaise    = 0;

  if (pose === 1) { leftLegOff = -s*0.8; rightLegOff = s*0.8; leftArmOff = s*0.6; rightArmOff = -s*0.6; bodyBob = s*0.2; }
  if (pose === 2) { leftLegOff = s*0.8;  rightLegOff = -s*0.8; leftArmOff = -s*0.6; rightArmOff = s*0.6; bodyBob = s*0.2; }
  if (pose === 3) { bodyLean = s*0.3; bodyBob = -s*0.2; }  // talking
  if (pose === 4) { armRaise = -s*2.5; leftArmOff = -s*0.5; bodyBob = -s*0.2; } // action

  var groundY = H - s * 0.5;
  var bodyBot  = groundY - bodyBob;
  var legH     = s * 3.2;
  var legW     = s * 1.8;
  var torsoH   = s * 3.8;
  var torsoW   = s * 4.2;
  var torsoY   = bodyBot - legH - torsoH;
  var headR    = s * 2.2;
  var headCY   = torsoY - headR + s * 0.3;
  var shoeH    = s * 0.9;
  var shoeW    = s * 2.2;

  // ── Shoes ──
  // Left shoe
  px(ctx, cx - legW * 0.6 - s * 0.5, bodyBot - shoeH + leftLegOff * 0.15, shoeW, shoeH, p.shoes);
  // Right shoe
  px(ctx, cx + s * 0.2 + rightLegOff * 0.15, bodyBot - shoeH, shoeW, shoeH, p.shoes);

  // ── Legs ──
  // Left leg
  px(ctx, cx - legW * 0.9, bodyBot - legH + leftLegOff, legW, legH - Math.abs(leftLegOff), p.pants);
  px(ctx, cx - legW * 0.9, bodyBot - legH + leftLegOff, legW, s, p.pantsS);  // cuff
  // Right leg
  px(ctx, cx + s * 0.1 + rightLegOff * 0.2, bodyBot - legH + rightLegOff, legW, legH - Math.abs(rightLegOff), p.pants);
  px(ctx, cx + s * 0.1 + rightLegOff * 0.2, bodyBot - legH + rightLegOff, legW, s, p.pantsS); // cuff

  // ── Torso ──
  px(ctx, cx - torsoW / 2 + bodyLean, torsoY, torsoW, torsoH, p.shirt);
  // Shirt shadow/lapel
  px(ctx, cx - torsoW / 2 + bodyLean, torsoY, torsoW, s * 0.6, p.shirtS);

  // Role-specific torso details
  _drawTorsoDetail(ctx, cx + bodyLean, torsoY, torsoW, torsoH, s, p, roleType);

  // ── Arms ──
  var armW = s * 1.4;
  var armH = s * 2.8;
  var armY = torsoY + s * 0.5;

  // Left arm
  var laY = armY + leftArmOff;
  var laX = cx - torsoW / 2 + bodyLean - armW + s * 0.3;
  px(ctx, laX, laY, armW, armH, p.shirt);
  // Left hand
  circle(ctx, laX + armW / 2, laY + armH + s * 0.4, s * 0.7, p.skin);

  // Right arm
  var raY = armY + rightArmOff + armRaise;
  var raX = cx + torsoW / 2 + bodyLean - s * 0.3;
  px(ctx, raX, raY, armW, armH + (armRaise < 0 ? Math.abs(armRaise) : 0), p.shirt);
  // Right hand
  circle(ctx, raX + armW / 2, raY + armH + (armRaise < 0 ? Math.abs(armRaise) * 1.1 : 0) + s * 0.4, s * 0.7, p.skin);

  // ── Head ──
  var hcx = cx + bodyLean * 0.6;
  // Neck
  px(ctx, hcx - s * 0.6, headCY + headR * 0.5, s * 1.2, s, p.skin);

  // Face base
  circle(ctx, hcx, headCY, headR, p.skin);
  // Face shadow (chin/jaw)
  circle(ctx, hcx, headCY + s * 0.5, headR * 0.85, p.skinS);
  circle(ctx, hcx, headCY, headR * 0.85, p.skin);

  // ── Hair ──
  _drawHair(ctx, hcx, headCY, headR, s, p, roleType);

  // ── Face features ──
  _drawFace(ctx, hcx, headCY, s, p, pose, roleType);

  // ── Role accessories ──
  _drawAccessory(ctx, cx + bodyLean, hcx, headCY, torsoY, torsoH, torsoW, s, p, roleType, pose, armRaise);
}

// ── Hair styles per role ──────────────────────────────────────────────────────
function _drawHair(ctx, hcx, hcy, hr, s, p, roleType) {
  var h = p.hair, hH = p.hairH;

  switch(roleType) {
    case 'developer':
    case 'cto':
      // Messy/shaggy — overlapping arcs
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr * 0.9, hcy - hr * 0.1, hr * 1.8, hr * 0.6, h);
      // Messy bits
      px(ctx, hcx - hr * 0.7, hcy - hr * 1.1, s * 0.8, s * 0.8, h);
      px(ctx, hcx + hr * 0.2, hcy - hr * 1.2, s * 0.9, s * 0.7, h);
      px(ctx, hcx - hr * 0.1, hcy - hr * 1.3, s * 0.7, s * 0.5, hH);
      break;

    case 'designer':
      // Beret / artistic side-swept
      circle(ctx, hcx, hcy - hr * 0.4, hr * 1.1, h);
      px(ctx, hcx - hr * 1.1, hcy - hr * 0.2, hr * 2.2, hr * 0.5, h);
      // Beret pom
      circle(ctx, hcx - hr * 0.6, hcy - hr * 1.2, s * 0.5, hH);
      // Side sweep
      px(ctx, hcx + hr * 0.3, hcy, hr * 0.9, hr * 0.8, h);
      break;

    case 'ceo':
    case 'lawyer':
    case 'finance':
      // Slicked back — sharp, perfect
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr, hcy - hr * 0.2, hr * 2, hr * 0.4, h);
      // Hard part
      px(ctx, hcx - s * 0.3, hcy - hr, s * 0.4, hr * 1.2, p.skinS);
      // Left side
      px(ctx, hcx - hr, hcy - hr * 0.5, hr * 0.9, hr * 0.9, h);
      // Shine
      px(ctx, hcx + s * 0.2, hcy - hr * 0.9, s * 0.5, s * 0.3, hH);
      break;

    case 'manager':
    case 'coo':
    case 'product':
      // Clean professional — neat side part
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr, hcy - hr * 0.2, hr * 2, hr * 0.5, h);
      px(ctx, hcx - s * 0.5, hcy - hr * 0.9, s * 0.5, hr * 0.9, p.skinS);
      break;

    case 'doctor':
    case 'scientist':
      // Neat/short
      circle(ctx, hcx, hcy - hr * 0.4, hr * 0.95, h);
      px(ctx, hcx - hr * 0.9, hcy - hr * 0.1, hr * 1.8, hr * 0.4, h);
      break;

    case 'teacher':
      // Slightly wavy medium
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr, hcy - hr * 0.1, hr * 2, hr * 0.5, h);
      // Waves
      px(ctx, hcx + hr * 0.5, hcy, s * 0.7, hr * 0.7, h);
      px(ctx, hcx - hr * 0.8, hcy + s * 0.2, s * 0.6, hr * 0.6, h);
      break;

    case 'chef':
      // Hair pulled back / minimal
      circle(ctx, hcx, hcy - hr * 0.4, hr * 0.85, h);
      px(ctx, hcx - hr * 0.8, hcy - hr * 0.1, hr * 1.6, hr * 0.35, h);
      break;

    case 'athlete':
      // Short buzz
      circle(ctx, hcx, hcy - hr * 0.35, hr * 0.88, h);
      px(ctx, hcx - hr * 0.85, hcy - hr * 0.05, hr * 1.7, hr * 0.3, h);
      break;

    case 'musician':
      // Wild/long
      circle(ctx, hcx, hcy - hr * 0.3, hr * 1.05, h);
      px(ctx, hcx - hr * 1.1, hcy - hr * 0.2, hr * 2.2, hr * 0.6, h);
      px(ctx, hcx - hr * 1.0, hcy, s * 0.8, hr * 1.2, h);
      px(ctx, hcx + hr * 0.5, hcy, s * 0.8, hr * 1.1, h);
      px(ctx, hcx - hr * 0.3, hcy - hr * 1.3, s * 0.6, s, hH);
      break;

    case 'wizard':
      // Long flowing
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr * 1.1, hcy - hr * 0.3, hr * 2.2, hr * 0.7, h);
      px(ctx, hcx - hr * 1.0, hcy, s, hr * 2, h);
      px(ctx, hcx + hr * 0.3, hcy, s, hr * 1.8, h);
      break;

    case 'detective':
      // Slicked, dark
      circle(ctx, hcx, hcy - hr * 0.35, hr * 0.9, h);
      px(ctx, hcx - hr, hcy - hr * 0.15, hr * 2, hr * 0.4, h);
      // Stubble hint
      px(ctx, hcx - s * 0.6, hcy + hr * 0.55, s * 1.2, s * 0.3, p.skinS);
      break;

    case 'pirate':
      // Bandana-style (drawn in accessory) + scraggly
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr, hcy - hr * 0.1, hr * 2, hr * 0.5, h);
      px(ctx, hcx + hr * 0.4, hcy, s * 0.6, hr, h);
      break;

    case 'ninja':
      // Covered — drawn minimally (mask covers most)
      circle(ctx, hcx, hcy - hr * 0.3, hr * 0.95, h);
      break;

    case 'knight':
      // Helmet covers hair mostly
      circle(ctx, hcx, hcy - hr * 0.3, hr * 0.9, h);
      break;

    case 'astronaut':
      // Neat/contained
      circle(ctx, hcx, hcy - hr * 0.35, hr * 0.85, h);
      px(ctx, hcx - hr * 0.8, hcy - hr * 0.05, hr * 1.6, hr * 0.3, h);
      break;

    case 'marketer':
    case 'sales':
      // Styled/bouncy
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr, hcy - hr * 0.1, hr * 2, hr * 0.6, h);
      px(ctx, hcx - s * 0.3, hcy - hr * 1.1, s, s * 1.2, hH);
      break;

    default:
      // Default medium
      circle(ctx, hcx, hcy - hr * 0.3, hr, h);
      px(ctx, hcx - hr, hcy - hr * 0.1, hr * 2, hr * 0.5, h);
      break;
  }
}

// ── Face features ─────────────────────────────────────────────────────────────
function _drawFace(ctx, hcx, hcy, s, p, pose, roleType) {
  var eyeY   = hcy - s * 0.3;
  var eyeW   = s * 0.7;
  var eyeH   = s * 0.55;
  var eyeSep = s * 1.1;
  var mouthY = hcy + s * 0.9;

  // Eyes whites
  px(ctx, hcx - eyeSep - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH, '#fff');
  px(ctx, hcx + eyeSep - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH, '#fff');

  // Pupils
  var pupilColor = p.eyes || '#1a1a1a';
  var pupilW = eyeW * 0.55, pupilH = eyeH * 0.7;
  px(ctx, hcx - eyeSep - pupilW / 2 + s * 0.05, eyeY - pupilH / 2, pupilW, pupilH, pupilColor);
  px(ctx, hcx + eyeSep - pupilW / 2 + s * 0.05, eyeY - pupilH / 2, pupilW, pupilH, pupilColor);

  // Eye shine
  px(ctx, hcx - eyeSep + s * 0.05, eyeY - eyeH * 0.3, s * 0.2, s * 0.2, 'rgba(255,255,255,0.8)');
  px(ctx, hcx + eyeSep + s * 0.05, eyeY - eyeH * 0.3, s * 0.2, s * 0.2, 'rgba(255,255,255,0.8)');

  // Talking = open mouth, idle = small smile
  if (pose === 3 || pose === 4) {
    // Talking mouth — open
    px(ctx, hcx - s * 0.6, mouthY, s * 1.2, s * 0.6, '#1a0a00');
    px(ctx, hcx - s * 0.5, mouthY + s * 0.1, s, s * 0.3, '#cc6688');
    // Raised eyebrows
    px(ctx, hcx - eyeSep - s * 0.5, eyeY - eyeH - s * 0.4, s * 0.8, s * 0.25, p.hair);
    px(ctx, hcx + eyeSep - s * 0.3, eyeY - eyeH - s * 0.4, s * 0.8, s * 0.25, p.hair);
  } else {
    // Smile
    ctx.strokeStyle = p.mouth || '#c07060';
    ctx.lineWidth = Math.max(1, s * 0.35);
    ctx.beginPath();
    ctx.arc(hcx, mouthY - s * 0.2, s * 0.65, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  // Role-specific face features
  if (roleType === 'teacher' || roleType === 'scientist' || roleType === 'developer') {
    // Glasses
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(1, s * 0.3);
    ctx.strokeRect(hcx - eyeSep - eyeW * 0.7, eyeY - eyeH * 0.7, eyeW * 1.4, eyeH * 1.4);
    ctx.strokeRect(hcx + eyeSep - eyeW * 0.7, eyeY - eyeH * 0.7, eyeW * 1.4, eyeH * 1.4);
    ctx.beginPath();
    ctx.moveTo(hcx - eyeSep + eyeW * 0.7, eyeY);
    ctx.lineTo(hcx + eyeSep - eyeW * 0.7, eyeY);
    ctx.stroke();
  }

  if (roleType === 'detective' || roleType === 'pirate') {
    // Stubble
    for (var i = 0; i < 5; i++) {
      px(ctx, hcx - s * 0.7 + i * s * 0.35, mouthY + s * 0.6, s * 0.15, s * 0.3, p.skinS);
    }
  }

  if (roleType === 'wizard') {
    // Long beard
    px(ctx, hcx - s * 0.8, mouthY + s * 0.4, s * 1.6, s * 2.5, p.hairH);
    px(ctx, hcx - s * 0.6, mouthY + s * 0.4, s * 1.2, s * 2.5, '#ddd');
  }
}

// ── Torso detail per role ─────────────────────────────────────────────────────
function _drawTorsoDetail(ctx, cx, torsoY, torsoW, torsoH, s, p, roleType) {
  switch(roleType) {
    case 'ceo':
    case 'lawyer':
    case 'finance':
    case 'manager':
    case 'coo':
      // Suit — lapels + tie
      px(ctx, cx - s * 0.3, torsoY, s * 0.6, torsoH * 0.7, '#222');  // tie
      px(ctx, cx - s * 0.2, torsoY + s * 0.5, s * 0.4, torsoH * 0.5, p.accessory); // tie colour
      // Lapels
      ctx.fillStyle = p.shirtS;
      ctx.beginPath();
      ctx.moveTo(cx - torsoW * 0.4, torsoY);
      ctx.lineTo(cx - s * 0.3, torsoY + s * 1.2);
      ctx.lineTo(cx - torsoW * 0.4, torsoY + torsoH * 0.6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + torsoW * 0.4, torsoY);
      ctx.lineTo(cx + s * 0.3, torsoY + s * 1.2);
      ctx.lineTo(cx + torsoW * 0.4, torsoY + torsoH * 0.6);
      ctx.fill();
      // Shirt buttons
      for (var b = 0; b < 3; b++) {
        circle(ctx, cx - s * 0.05, torsoY + s * 0.8 + b * s * 0.9, s * 0.18, '#888');
      }
      break;

    case 'developer':
    case 'cto':
      // Hoodie — front pocket
      px(ctx, cx - s * 1.2, torsoY + torsoH * 0.55, s * 2.4, torsoH * 0.35, p.shirtS);
      px(ctx, cx - s * 0.5, torsoY + torsoH * 0.55, s * 0.3, torsoH * 0.35, p.shirt2);
      // Kangaroo pocket outline
      ctx.strokeStyle = p.shirt2;
      ctx.lineWidth = Math.max(1, s * 0.25);
      ctx.strokeRect(cx - s * 1.0, torsoY + torsoH * 0.57, s * 2.0, torsoH * 0.3);
      // Laptop sticker hint
      px(ctx, cx - s * 0.8, torsoY + s * 0.8, s * 0.5, s * 0.35, p.accessory);
      break;

    case 'designer':
      // Turtleneck — roll collar
      px(ctx, cx - torsoW * 0.35, torsoY, torsoW * 0.7, s * 0.9, p.shirt2);
      px(ctx, cx - torsoW * 0.3, torsoY - s * 0.3, torsoW * 0.6, s * 0.7, p.shirt2);
      // Interesting pattern on shirt
      for (var d = 0; d < 3; d++) {
        px(ctx, cx - s * 0.9 + d * s * 0.9, torsoY + s * 1.5 + (d % 2) * s * 0.5, s * 0.4, s * 0.4, p.accessory);
      }
      break;

    case 'doctor':
    case 'scientist':
      // White coat — buttons down front, pockets
      px(ctx, cx - s * 0.4, torsoY, s * 0.8, torsoH, '#ccc'); // open coat front
      // Pocket
      px(ctx, cx - torsoW * 0.3, torsoY + s * 1.2, s * 1.4, s * 1.0, '#ddd');
      ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1;
      ctx.strokeRect(cx - torsoW * 0.3, torsoY + s * 1.2, s * 1.4, s);
      // Pen in pocket
      px(ctx, cx - s * 0.1, torsoY + s * 1.2, s * 0.25, s * 0.8, p.accessory);
      // Coat buttons
      for (var db = 0; db < 4; db++) {
        circle(ctx, cx + s * 0.05, torsoY + s * 0.4 + db * s * 0.75, s * 0.2, '#999');
      }
      break;

    case 'chef':
      // Double-breasted chef coat
      px(ctx, cx - torsoW * 0.25, torsoY, torsoW * 0.5, torsoH, '#eee');
      for (var cb = 0; cb < 3; cb++) {
        circle(ctx, cx - s * 0.6, torsoY + s * 0.6 + cb * s * 0.9, s * 0.3, '#ccc');
        circle(ctx, cx + s * 0.5, torsoY + s * 0.6 + cb * s * 0.9, s * 0.3, '#ccc');
      }
      break;

    case 'athlete':
      // Jersey with number
      px(ctx, cx - s * 0.7, torsoY + s * 1.0, s * 1.4, s * 1.5, p.shirt2);
      // Number
      ctx.fillStyle = p.accessory;
      ctx.font = Math.round(s * 1.2) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('7', cx, torsoY + s * 2.1);
      ctx.textAlign = 'left';
      // Stripes on shoulders
      px(ctx, cx - torsoW * 0.5, torsoY + s * 0.3, torsoW, s * 0.4, p.accessory);
      break;

    case 'musician':
      // Band tee — print
      px(ctx, cx - s * 1.0, torsoY + s * 0.8, s * 2.0, s * 1.8, p.shirtS);
      // Star/lightning bolt
      ctx.fillStyle = p.accessory;
      ctx.beginPath();
      ctx.moveTo(cx, torsoY + s * 0.9);
      ctx.lineTo(cx + s * 0.4, torsoY + s * 1.5);
      ctx.lineTo(cx - s * 0.4, torsoY + s * 1.5);
      ctx.closePath(); ctx.fill();
      break;

    case 'teacher':
      // Blazer + scarf/lanyard
      ctx.fillStyle = p.shirtS;
      ctx.beginPath();
      ctx.moveTo(cx - torsoW * 0.45, torsoY);
      ctx.lineTo(cx - s * 0.3, torsoY + s);
      ctx.lineTo(cx - torsoW * 0.45, torsoY + torsoH * 0.7);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + torsoW * 0.45, torsoY);
      ctx.lineTo(cx + s * 0.3, torsoY + s);
      ctx.lineTo(cx + torsoW * 0.45, torsoY + torsoH * 0.7);
      ctx.fill();
      // Lanyard
      px(ctx, cx - s * 0.15, torsoY, s * 0.3, torsoH * 0.55, p.accessory);
      px(ctx, cx - s * 0.5, torsoY + torsoH * 0.5, s, s * 0.6, p.accessory);
      break;

    case 'wizard':
      // Robe — star pattern
      px(ctx, cx - torsoW * 0.4, torsoY, torsoW * 0.8, torsoH, p.shirt);
      for (var ws = 0; ws < 4; ws++) {
        var sx = cx - s * 0.8 + ws * s * 0.55;
        var sy = torsoY + s * 0.8 + (ws % 2) * s * 0.8;
        // Little star
        px(ctx, sx, sy, s * 0.25, s * 0.7, p.accessory);
        px(ctx, sx - s * 0.2, sy + s * 0.2, s * 0.65, s * 0.25, p.accessory);
      }
      break;

    case 'knight':
      // Armour plates
      px(ctx, cx - torsoW * 0.42, torsoY, torsoW * 0.84, torsoH, '#999');
      // Chest plate detail
      px(ctx, cx - torsoW * 0.3, torsoY + s * 0.3, torsoW * 0.6, torsoH * 0.55, '#bbb');
      // Plate lines
      px(ctx, cx - torsoW * 0.3, torsoY + torsoH * 0.4, torsoW * 0.6, s * 0.2, '#777');
      px(ctx, cx - torsoW * 0.3, torsoY + torsoH * 0.6, torsoW * 0.6, s * 0.2, '#777');
      // Crest
      circle(ctx, cx, torsoY + s * 0.8, s * 0.5, p.accessory);
      break;

    case 'pirate':
      // Coat — red trim
      ctx.fillStyle = p.shirtS;
      ctx.beginPath();
      ctx.moveTo(cx - torsoW * 0.45, torsoY);
      ctx.lineTo(cx - s * 0.35, torsoY + s * 1.2);
      ctx.lineTo(cx - torsoW * 0.45, torsoY + torsoH);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + torsoW * 0.45, torsoY);
      ctx.lineTo(cx + s * 0.35, torsoY + s * 1.2);
      ctx.lineTo(cx + torsoW * 0.45, torsoY + torsoH);
      ctx.fill();
      // Gold buttons
      for (var pb = 0; pb < 3; pb++) {
        circle(ctx, cx, torsoY + s * 0.7 + pb * s * 0.9, s * 0.3, p.accessory);
      }
      break;

    case 'ninja':
      // Plain dark, belt
      px(ctx, cx - torsoW * 0.35, torsoY + torsoH * 0.45, torsoW * 0.7, s * 0.5, p.accessory);
      break;

    case 'detective':
      // Trench coat detail
      ctx.fillStyle = p.shirtS;
      ctx.beginPath();
      ctx.moveTo(cx - torsoW * 0.43, torsoY);
      ctx.lineTo(cx - s * 0.3, torsoY + s * 1.0);
      ctx.lineTo(cx - torsoW * 0.43, torsoY + torsoH * 0.8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + torsoW * 0.43, torsoY);
      ctx.lineTo(cx + s * 0.3, torsoY + s * 1.0);
      ctx.lineTo(cx + torsoW * 0.43, torsoY + torsoH * 0.8);
      ctx.fill();
      // Belt
      px(ctx, cx - torsoW * 0.4, torsoY + torsoH * 0.58, torsoW * 0.8, s * 0.45, '#555');
      circle(ctx, cx, torsoY + torsoH * 0.6, s * 0.35, '#888');
      break;

    case 'marketer':
    case 'sales':
      // Smart blazer, open collar
      ctx.fillStyle = p.shirtS;
      ctx.beginPath();
      ctx.moveTo(cx - torsoW * 0.43, torsoY);
      ctx.lineTo(cx - s * 0.3, torsoY + s);
      ctx.lineTo(cx - torsoW * 0.43, torsoY + torsoH * 0.75);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + torsoW * 0.43, torsoY);
      ctx.lineTo(cx + s * 0.3, torsoY + s);
      ctx.lineTo(cx + torsoW * 0.43, torsoY + torsoH * 0.75);
      ctx.fill();
      // Open shirt / accent
      px(ctx, cx - s * 0.3, torsoY, s * 0.6, s * 1.2, p.shirt2);
      break;

    case 'astronaut':
      // Space suit — collar, panel
      px(ctx, cx - torsoW * 0.35, torsoY, torsoW * 0.7, s * 0.7, '#aaa'); // neck ring
      px(ctx, cx - s * 1.0, torsoY + s * 1.0, s * 2.0, s * 1.8, '#ddd'); // chest panel
      circle(ctx, cx - s * 0.5, torsoY + s * 1.4, s * 0.35, p.accessory);
      circle(ctx, cx + s * 0.2, torsoY + s * 1.4, s * 0.35, '#ccc');
      circle(ctx, cx + s * 0.7, torsoY + s * 2.0, s * 0.25, p.acc2);
      break;

    default:
      // Casual — simple open collar
      px(ctx, cx - s * 0.35, torsoY, s * 0.7, s * 1.0, p.shirt2);
      break;
  }
}

// ── Accessories (hats, tools, held items) ─────────────────────────────────────
function _drawAccessory(ctx, cx, hcx, hcy, torsoY, torsoH, torsoW, s, p, roleType, pose, armRaise) {
  var hr = s * 2.2;

  switch(roleType) {
    case 'developer':
    case 'cto':
      // Headphones (sometimes) — just small ear buds
      px(ctx, hcx - hr * 0.95, hcy - s * 0.2, s * 0.4, s * 0.8, '#333');
      px(ctx, hcx + hr * 0.6, hcy - s * 0.2, s * 0.4, s * 0.8, '#333');
      px(ctx, hcx - hr * 0.9, hcy - hr * 0.8, hr * 1.85, s * 0.35, '#333'); // band
      break;

    case 'designer':
      // Beret
      px(ctx, hcx - hr * 0.9, hcy - hr * 0.85, hr * 1.8, s * 0.5, p.hair);
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.ellipse(hcx - s * 0.4, hcy - hr * 1.05, hr * 1.0, hr * 0.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, hcx - hr * 0.5, hcy - hr * 1.2, s * 0.4, p.hairH);
      break;

    case 'ceo':
    case 'finance':
      // Wristwatch hint (on action pose)
      if (pose === 4) {
        circle(ctx, hcx + hr * 0.9, torsoY - s, s * 0.6, p.accessory);
        px(ctx, hcx + hr * 0.7, torsoY - s - s * 0.4, s * 0.4, s * 0.8, '#888');
      }
      break;

    case 'doctor':
      // Stethoscope around neck
      ctx.strokeStyle = p.accessory;
      ctx.lineWidth = Math.max(1.5, s * 0.45);
      ctx.beginPath();
      ctx.arc(hcx, hcy + hr * 0.6, s * 1.2, 0.1, Math.PI - 0.1, false);
      ctx.stroke();
      circle(ctx, hcx, hcy + hr * 0.6 + s * 1.2, s * 0.5, p.accessory);
      // Headband mirror
      px(ctx, hcx + hr * 0.3, hcy - s * 0.5, s * 0.8, s * 0.7, '#ddd');
      circle(ctx, hcx + hr * 0.5, hcy - s * 0.2, s * 0.3, '#aaa');
      break;

    case 'scientist':
      // Goggles on forehead
      px(ctx, hcx - hr * 0.7, hcy - hr * 0.9, hr * 1.4, s * 0.55, '#333');
      px(ctx, hcx - hr * 0.6, hcy - hr * 1.0, s * 0.9, s * 0.6, p.accessory);
      px(ctx, hcx + s * 0.15, hcy - hr * 1.0, s * 0.9, s * 0.6, p.accessory);
      // Test tube in hand (action pose)
      if (pose === 4) {
        px(ctx, hcx + hr * 0.8, torsoY + s, s * 0.6, s * 2.0, p.accessory);
        px(ctx, hcx + hr * 0.8, torsoY + s, s * 0.6, s * 0.4, '#fff');
      }
      break;

    case 'chef':
      // Chef hat — tall toque
      px(ctx, hcx - hr * 0.75, hcy - hr * 0.9, hr * 1.5, s * 0.5, '#ddd');
      px(ctx, hcx - hr * 0.6, hcy - hr * 0.9 - s * 2.0, hr * 1.2, s * 2.2, '#fff');
      px(ctx, hcx - hr * 0.65, hcy - hr * 0.9 - s * 2.1, hr * 1.3, s * 0.5, '#eee');
      // Ladle in action
      if (pose === 4) {
        px(ctx, cx + torsoW * 0.4, torsoY - s * 0.5, s * 0.4, s * 2.5, '#888');
        circle(ctx, cx + torsoW * 0.4 + s * 0.2, torsoY - s, s * 0.9, '#aaa');
      }
      break;

    case 'teacher':
      // Pointer stick (action pose)
      if (pose === 4) {
        px(ctx, hcx + hr * 0.6, torsoY - s * 2, s * 0.35, s * 4.5, '#8B6914');
        circle(ctx, hcx + hr * 0.6 + s * 0.18, torsoY - s * 2.1, s * 0.4, '#d4af37');
      }
      break;

    case 'musician':
      // Guitar (action pose) or pick
      if (pose === 4) {
        // Guitar body
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(cx + torsoW * 0.15, torsoY + torsoH * 0.5, s * 1.5, s * 2.0, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Neck
        px(ctx, cx + torsoW * 0.3, torsoY - s * 2, s * 0.5, s * 3.5, '#6B3A1A');
        // Strings
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.5;
        for (var str = 0; str < 4; str++) {
          ctx.beginPath();
          ctx.moveTo(cx + torsoW * 0.35 + str * s * 0.1, torsoY - s * 1.5);
          ctx.lineTo(cx + torsoW * 0.25, torsoY + torsoH * 0.8);
          ctx.stroke();
        }
      }
      break;

    case 'wizard':
      // Pointy hat
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.moveTo(hcx, hcy - hr * 3.0);
      ctx.lineTo(hcx - hr * 1.1, hcy - hr * 0.7);
      ctx.lineTo(hcx + hr * 1.1, hcy - hr * 0.7);
      ctx.closePath(); ctx.fill();
      // Hat brim
      px(ctx, hcx - hr * 1.2, hcy - hr * 0.85, hr * 2.4, s * 0.55, p.shirt2);
      // Stars on hat
      px(ctx, hcx - s * 0.2, hcy - hr * 1.8, s * 0.4, s * 0.9, p.accessory);
      px(ctx, hcx - s * 0.6, hcy - hr * 1.9, s * 1.2, s * 0.4, p.accessory);
      // Staff (action pose)
      if (pose === 4) {
        px(ctx, cx - torsoW * 0.6, torsoY - s * 2.5, s * 0.5, s * 6, '#5a3a1a');
        circle(ctx, cx - torsoW * 0.6 + s * 0.25, torsoY - s * 2.5, s * 0.85, p.accessory);
        circle(ctx, cx - torsoW * 0.6 + s * 0.25, torsoY - s * 2.5, s * 0.5, '#fff');
      }
      break;

    case 'knight':
      // Helmet
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(hcx, hcy - hr * 0.2, hr * 1.1, Math.PI, Math.PI * 2);
      ctx.fill();
      px(ctx, hcx - hr * 1.1, hcy - hr * 0.2, hr * 2.2, s * 0.6, '#999');
      // Visor
      px(ctx, hcx - hr * 0.6, hcy - s * 0.4, hr * 1.2, s * 0.4, '#333');
      px(ctx, hcx - hr * 0.6, hcy - s * 0.4, hr * 1.2, s * 0.15, '#555');
      // Plume
      px(ctx, hcx + s * 0.2, hcy - hr * 1.0, s * 0.6, hr * 0.9, p.accessory);
      // Sword (action)
      if (pose === 4) {
        px(ctx, cx + torsoW * 0.5, torsoY - s * 3, s * 0.5, s * 5, '#ccc');
        px(ctx, cx + torsoW * 0.3, torsoY - s * 0.5, s * 1.4, s * 0.5, '#aaa');
        circle(ctx, cx + torsoW * 0.5 + s * 0.25, torsoY - s * 3.1, s * 0.5, p.accessory);
      }
      break;

    case 'pirate':
      // Tricorn hat
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(hcx, hcy - hr * 2.2);
      ctx.lineTo(hcx - hr * 1.4, hcy - hr * 0.8);
      ctx.lineTo(hcx + hr * 1.4, hcy - hr * 0.8);
      ctx.closePath(); ctx.fill();
      px(ctx, hcx - hr * 1.3, hcy - hr * 0.85, hr * 2.6, s * 0.4, '#222');
      // Skull on hat
      circle(ctx, hcx, hcy - hr * 1.3, s * 0.5, '#fff');
      px(ctx, hcx - s * 0.5, hcy - hr * 1.1, s, s * 0.25, '#fff');
      // Eyepatch
      px(ctx, hcx + s * 0.5, hcy - s * 0.5, s * 0.85, s * 0.6, '#111');
      // Sword/hook action
      if (pose === 4) {
        px(ctx, cx + torsoW * 0.5, torsoY - s * 2, s * 0.45, s * 4, '#ccc');
      }
      break;

    case 'ninja':
      // Mask covers lower face
      px(ctx, hcx - hr * 0.85, hcy, hr * 1.7, hr * 0.55, p.shirt);
      // Headband
      px(ctx, hcx - hr * 0.95, hcy - s * 0.1, hr * 1.9, s * 0.5, p.accessory);
      // Shuriken (action)
      if (pose === 4) {
        ctx.fillStyle = '#888';
        ctx.save();
        ctx.translate(cx + torsoW * 0.6, torsoY);
        ctx.rotate(Math.PI / 4);
        px(ctx, -s * 0.9, -s * 0.2, s * 1.8, s * 0.4, '#888');
        px(ctx, -s * 0.2, -s * 0.9, s * 0.4, s * 1.8, '#888');
        ctx.restore();
      }
      break;

    case 'detective':
      // Fedora hat
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.arc(hcx, hcy - hr * 0.55, hr * 0.88, Math.PI, Math.PI * 2);
      ctx.fill();
      px(ctx, hcx - hr * 1.1, hcy - hr * 0.65, hr * 2.2, s * 0.5, p.shirt);  // brim
      px(ctx, hcx - hr * 0.6, hcy - hr * 1.05, hr * 1.2, s * 0.4, p.shirtS); // band
      // Magnifying glass (action)
      if (pose === 4) {
        circle(ctx, cx + torsoW * 0.55, torsoY - s, s * 1.1, 'rgba(150,200,255,0.3)');
        ctx.strokeStyle = '#888'; ctx.lineWidth = s * 0.4;
        ctx.beginPath();
        ctx.arc(cx + torsoW * 0.55, torsoY - s, s * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        px(ctx, cx + torsoW * 0.55 + s * 0.8, torsoY + s * 0.2, s * 0.4, s * 1.2, '#888');
      }
      break;

    case 'athlete':
      // Sweatband on head
      px(ctx, hcx - hr * 0.9, hcy - hr * 0.6, hr * 1.8, s * 0.5, '#fff');
      // Whistle (coach variant)
      if (pose === 3) {
        px(ctx, hcx - hr * 0.2, hcy + hr * 0.7, s * 0.8, s * 0.4, '#d4af37');
        ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(hcx, hcy + hr * 0.6); ctx.lineTo(hcx - s * 0.2, hcy + hr * 0.7); ctx.stroke();
      }
      break;

    case 'astronaut':
      // Helmet visor
      ctx.strokeStyle = 'rgba(100,180,255,0.5)'; ctx.lineWidth = s * 0.7;
      ctx.beginPath();
      ctx.arc(hcx, hcy, hr * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      // Helmet frame
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = s * 0.5;
      ctx.beginPath();
      ctx.arc(hcx, hcy, hr * 1.25, 0, Math.PI * 2);
      ctx.stroke();
      // Flag patch
      px(ctx, cx - torsoW * 0.48, torsoY + s * 0.5, s * 1.4, s * 0.9, p.accessory);
      break;

    case 'marketer':
      // Earpiece / phone vibe
      px(ctx, hcx + hr * 0.75, hcy - s * 0.1, s * 0.3, s * 0.7, '#333');
      // Clipboard (action)
      if (pose === 4) {
        px(ctx, cx + torsoW * 0.35, torsoY - s * 0.5, s * 2.0, s * 2.5, '#e8d8b0');
        px(ctx, cx + torsoW * 0.35, torsoY - s * 0.5, s * 2.0, s * 0.3, '#c0a060');
        for (var cl = 0; cl < 3; cl++) {
          px(ctx, cx + torsoW * 0.45, torsoY + s * 0.2 + cl * s * 0.6, s * 1.5, s * 0.2, '#aaa');
        }
      }
      break;

    case 'product':
      // Post-it note on chest
      px(ctx, cx - torsoW * 0.15, torsoY + s * 0.7, s * 1.3, s * 1.1, '#ffeb3b');
      px(ctx, cx - s * 0.05, torsoY + s * 1.0, s * 0.8, s * 0.2, '#bbb');
      px(ctx, cx - s * 0.05, torsoY + s * 1.25, s * 0.8, s * 0.2, '#bbb');
      break;
  }
}

// ── Animal renderer ───────────────────────────────────────────────────────────
function _drawAnimal(ctx, W, H, pose, pal, roleType) {
  var s = W / 16;
  var cx = W / 2;
  var groundY = H - s * 0.5;
  var bodyBob = (pose === 1 || pose === 2) ? s * 0.25 : 0;
  if (pose === 4) bodyBob = -s * 0.3;

  switch(roleType) {
    case 'animal_cat': _drawCat(ctx, cx, groundY, s, pal, pose, bodyBob); break;
    case 'animal_dog': _drawDog(ctx, cx, groundY, s, pal, pose, bodyBob); break;
    case 'animal_fox': _drawFox(ctx, cx, groundY, s, pal, pose, bodyBob); break;
    case 'animal_bear': _drawBear(ctx, cx, groundY, s, pal, pose, bodyBob); break;
    case 'animal_penguin': _drawPenguin(ctx, cx, groundY, s, pal, pose, bodyBob); break;
    case 'animal_owl': _drawOwl(ctx, cx, groundY, s, pal, pose, bodyBob); break;
  }
}

function _drawCat(ctx, cx, groundY, s, pal, pose, bob) {
  var legSwingL = 0, legSwingR = 0, armSwingL = 0, armSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.7; legSwingR = s * 0.7; armSwingL = s * 0.5; armSwingR = -s * 0.5; }
  if (pose === 2) { legSwingL = s * 0.7;  legSwingR = -s * 0.7; armSwingL = -s * 0.5; armSwingR = s * 0.5; }
  var bodyColor = pal.shirt || '#888';
  var bodyLight = pal.shirt2 || '#aaa';
  var bodyDark  = pal.shirtS || '#666';
  var eyeColor  = pal.accessory || '#44ff88';
  var baseY = groundY - bob;

  // Tail
  ctx.strokeStyle = bodyColor; ctx.lineWidth = s * 1.1;
  ctx.beginPath();
  ctx.moveTo(cx + s * 2.5, baseY - s * 3.5);
  ctx.quadraticCurveTo(cx + s * 4.5, baseY - s * 2, cx + s * 3.5, baseY - s * 5.5);
  ctx.stroke();
  // Tail tip
  circle(ctx, cx + s * 3.5, baseY - s * 5.5, s * 0.7, bodyLight);

  // Legs
  px(ctx, cx - s * 2.0, baseY - s * 3.8 + legSwingL, s * 1.4, s * 3.8, bodyDark);
  px(ctx, cx + s * 0.8, baseY - s * 3.8 + legSwingR, s * 1.4, s * 3.8, bodyDark);
  // Paws
  circle(ctx, cx - s * 1.3, baseY + legSwingL * 0.2, s * 0.8, bodyColor);
  circle(ctx, cx + s * 1.5, baseY + legSwingR * 0.2, s * 0.8, bodyColor);

  // Body
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - s * 4.5, s * 2.6, s * 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly
  ctx.fillStyle = bodyLight;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - s * 4.2, s * 1.4, s * 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  px(ctx, cx - s * 3.0, baseY - s * 6.5 + armSwingL, s * 1.3, s * 2.4, bodyDark);
  px(ctx, cx + s * 1.8, baseY - s * 6.5 + armSwingR, s * 1.3, s * 2.4, bodyDark);
  circle(ctx, cx - s * 2.4, baseY - s * 4.1 + armSwingL, s * 0.7, bodyColor);
  circle(ctx, cx + s * 2.5, baseY - s * 4.1 + armSwingR, s * 0.7, bodyColor);

  // Head
  var hcy = baseY - s * 8.2;
  circle(ctx, cx, hcy, s * 2.4, bodyColor);
  // Ears
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.moveTo(cx - s * 1.8, hcy - s * 1.5); ctx.lineTo(cx - s * 2.6, hcy - s * 3.0); ctx.lineTo(cx - s * 0.6, hcy - s * 2.0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + s * 1.8, hcy - s * 1.5); ctx.lineTo(cx + s * 2.6, hcy - s * 3.0); ctx.lineTo(cx + s * 0.6, hcy - s * 2.0); ctx.fill();
  // Inner ears
  ctx.fillStyle = '#ffaaaa';
  ctx.beginPath(); ctx.moveTo(cx - s * 1.7, hcy - s * 1.7); ctx.lineTo(cx - s * 2.2, hcy - s * 2.7); ctx.lineTo(cx - s * 0.9, hcy - s * 2.1); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + s * 1.7, hcy - s * 1.7); ctx.lineTo(cx + s * 2.2, hcy - s * 2.7); ctx.lineTo(cx + s * 0.9, hcy - s * 2.1); ctx.fill();

  // Cat face
  // Eyes (slit pupils)
  px(ctx, cx - s * 1.2, hcy - s * 0.35, s * 0.8, s * 0.75, '#fff');
  px(ctx, cx + s * 0.45, hcy - s * 0.35, s * 0.8, s * 0.75, '#fff');
  circle(ctx, cx - s * 0.8, hcy - s * 0.0, s * 0.35, eyeColor);
  circle(ctx, cx + s * 0.8, hcy - s * 0.0, s * 0.35, eyeColor);
  px(ctx, cx - s * 0.9, hcy - s * 0.4, s * 0.25, s * 0.8, '#111'); // slit
  px(ctx, cx + s * 0.7, hcy - s * 0.4, s * 0.25, s * 0.8, '#111');
  // Nose
  ctx.fillStyle = '#ffaaaa';
  ctx.beginPath(); ctx.moveTo(cx, hcy + s * 0.3); ctx.lineTo(cx - s * 0.35, hcy + s * 0.7); ctx.lineTo(cx + s * 0.35, hcy + s * 0.7); ctx.fill();
  // Whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
  for (var w = 0; w < 3; w++) {
    ctx.beginPath(); ctx.moveTo(cx, hcy + s * 0.5); ctx.lineTo(cx - s * 2.5, hcy + s * 0.2 + w * s * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, hcy + s * 0.5); ctx.lineTo(cx + s * 2.5, hcy + s * 0.2 + w * s * 0.3); ctx.stroke();
  }
  // Mouth
  ctx.strokeStyle = bodyDark; ctx.lineWidth = s * 0.25;
  ctx.beginPath(); ctx.arc(cx - s * 0.3, hcy + s * 0.9, s * 0.35, 0, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + s * 0.3, hcy + s * 0.9, s * 0.35, 0, Math.PI); ctx.stroke();
}

function _drawDog(ctx, cx, groundY, s, pal, pose, bob) {
  var legSwingL = 0, legSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.7; legSwingR = s * 0.7; }
  if (pose === 2) { legSwingL = s * 0.7;  legSwingR = -s * 0.7; }
  var bodyColor = pal.shirt || '#c8a050';
  var bodyLight = pal.shirt2 || '#e8c878';
  var bodyDark  = pal.shirtS || '#a07830';
  var spotColor = pal.pants || '#444';
  var eyeColor  = '#5c3d1a';
  var baseY = groundY - bob;

  // Tail (wagging on talk/action)
  var tailAngle = (pose === 3 || pose === 4) ? 0.8 : 0.3;
  ctx.strokeStyle = bodyColor; ctx.lineWidth = s * 1.3;
  ctx.beginPath();
  ctx.moveTo(cx + s * 2.0, baseY - s * 4.0);
  ctx.quadraticCurveTo(cx + s * 4.5, baseY - s * 3.0, cx + s * 3.8, baseY - s * 6.0 + tailAngle * s);
  ctx.stroke();

  // Legs
  px(ctx, cx - s * 2.0, baseY - s * 3.8 + legSwingL, s * 1.5, s * 3.8, bodyDark);
  px(ctx, cx + s * 0.7, baseY - s * 3.8 + legSwingR, s * 1.5, s * 3.8, bodyDark);
  circle(ctx, cx - s * 1.2, baseY + legSwingL * 0.2, s * 1.0, bodyColor);
  circle(ctx, cx + s * 1.5, baseY + legSwingR * 0.2, s * 1.0, bodyColor);

  // Body
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 4.5, s * 2.8, s * 3.0, 0, 0, Math.PI * 2); ctx.fill();
  // Spot
  ctx.fillStyle = spotColor;
  ctx.beginPath(); ctx.ellipse(cx + s * 0.8, baseY - s * 5.2, s * 1.0, s * 0.8, -0.3, 0, Math.PI * 2); ctx.fill();
  // Belly
  ctx.fillStyle = bodyLight;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 4.0, s * 1.2, s * 1.6, 0, 0, Math.PI * 2); ctx.fill();

  // Arms
  px(ctx, cx - s * 3.0, baseY - s * 6.5, s * 1.4, s * 2.4, bodyDark);
  px(ctx, cx + s * 1.8, baseY - s * 6.5, s * 1.4, s * 2.4, bodyDark);
  circle(ctx, cx - s * 2.3, baseY - s * 4.1, s * 0.85, bodyColor);
  circle(ctx, cx + s * 2.5, baseY - s * 4.1, s * 0.85, bodyColor);

  // Head
  var hcy = baseY - s * 8.5;
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.ellipse(cx, hcy, s * 2.2, s * 2.4, 0, 0, Math.PI * 2); ctx.fill();
  // Ears — floppy
  ctx.fillStyle = bodyDark;
  ctx.beginPath(); ctx.ellipse(cx - s * 2.2, hcy + s * 0.5, s * 0.8, s * 1.6, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 2.2, hcy + s * 0.5, s * 0.8, s * 1.6, 0.3, 0, Math.PI * 2); ctx.fill();
  // Snout
  ctx.fillStyle = bodyLight;
  ctx.beginPath(); ctx.ellipse(cx, hcy + s * 0.7, s * 1.3, s * 1.0, 0, 0, Math.PI * 2); ctx.fill();
  // Nose
  circle(ctx, cx, hcy + s * 0.3, s * 0.5, '#222');
  // Eyes
  circle(ctx, cx - s * 1.0, hcy - s * 0.4, s * 0.55, '#fff');
  circle(ctx, cx + s * 1.0, hcy - s * 0.4, s * 0.55, '#fff');
  circle(ctx, cx - s * 0.9, hcy - s * 0.4, s * 0.35, eyeColor);
  circle(ctx, cx + s * 1.1, hcy - s * 0.4, s * 0.35, eyeColor);
  px(ctx, cx - s * 0.95, hcy - s * 0.5, s * 0.22, s * 0.22, '#fff'); // shine
  px(ctx, cx + s * 1.05, hcy - s * 0.5, s * 0.22, s * 0.22, '#fff');
  // Mouth
  ctx.strokeStyle = '#555'; ctx.lineWidth = s * 0.3;
  ctx.beginPath(); ctx.arc(cx - s * 0.4, hcy + s * 1.0, s * 0.4, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + s * 0.4, hcy + s * 1.0, s * 0.4, 0.1, Math.PI - 0.1); ctx.stroke();
  // Tongue (on action/talk)
  if (pose === 3 || pose === 4) {
    ctx.fillStyle = '#ff6688';
    ctx.beginPath(); ctx.ellipse(cx, hcy + s * 1.4, s * 0.5, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function _drawFox(ctx, cx, groundY, s, pal, pose, bob) {
  var legSwingL = 0, legSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.7; legSwingR = s * 0.7; }
  if (pose === 2) { legSwingL = s * 0.7;  legSwingR = -s * 0.7; }
  var baseY = groundY - bob;
  var orange = '#e8641a', orangeL = '#f0842a', orangeD = '#c04810', white = '#f5f0e8', black = '#1a1a1a';

  // Fluffy tail
  ctx.strokeStyle = orange; ctx.lineWidth = s * 2.0;
  ctx.beginPath(); ctx.moveTo(cx + s * 2.0, baseY - s * 4.0);
  ctx.quadraticCurveTo(cx + s * 5.0, baseY - s * 3.5, cx + s * 4.2, baseY - s * 6.5); ctx.stroke();
  circle(ctx, cx + s * 4.2, baseY - s * 6.5, s * 1.2, white);

  // Legs
  px(ctx, cx - s * 2.0, baseY - s * 3.8 + legSwingL, s * 1.3, s * 3.8, orangeD);
  px(ctx, cx + s * 0.8, baseY - s * 3.8 + legSwingR, s * 1.3, s * 3.8, orangeD);
  circle(ctx, cx - s * 1.3, baseY + legSwingL * 0.2, s * 0.7, black);
  circle(ctx, cx + s * 1.4, baseY + legSwingR * 0.2, s * 0.7, black);

  // Body
  ctx.fillStyle = orange;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 4.5, s * 2.5, s * 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = white;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 4.0, s * 1.3, s * 1.8, 0, 0, Math.PI * 2); ctx.fill();

  // Arms
  px(ctx, cx - s * 3.0, baseY - s * 6.2, s * 1.3, s * 2.4, orangeD);
  px(ctx, cx + s * 1.8, baseY - s * 6.2, s * 1.3, s * 2.4, orangeD);
  circle(ctx, cx - s * 2.3, baseY - s * 3.8, s * 0.7, black);
  circle(ctx, cx + s * 2.5, baseY - s * 3.8, s * 0.7, black);

  // Head
  var hcy = baseY - s * 8.0;
  ctx.fillStyle = orange;
  ctx.beginPath(); ctx.ellipse(cx, hcy, s * 2.2, s * 2.2, 0, 0, Math.PI * 2); ctx.fill();
  // Pointy ears
  ctx.fillStyle = orange;
  ctx.beginPath(); ctx.moveTo(cx - s * 1.5, hcy - s * 1.2); ctx.lineTo(cx - s * 2.4, hcy - s * 3.4); ctx.lineTo(cx - s * 0.4, hcy - s * 2.0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + s * 1.5, hcy - s * 1.2); ctx.lineTo(cx + s * 2.4, hcy - s * 3.4); ctx.lineTo(cx + s * 0.4, hcy - s * 2.0); ctx.fill();
  ctx.fillStyle = '#ffccaa';
  ctx.beginPath(); ctx.moveTo(cx - s * 1.4, hcy - s * 1.4); ctx.lineTo(cx - s * 2.1, hcy - s * 3.0); ctx.lineTo(cx - s * 0.6, hcy - s * 2.1); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + s * 1.4, hcy - s * 1.4); ctx.lineTo(cx + s * 2.1, hcy - s * 3.0); ctx.lineTo(cx + s * 0.6, hcy - s * 2.1); ctx.fill();
  // White face mask
  ctx.fillStyle = white;
  ctx.beginPath(); ctx.ellipse(cx, hcy + s * 0.5, s * 1.5, s * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  // Black mask markings
  ctx.fillStyle = black;
  ctx.beginPath(); ctx.ellipse(cx - s * 1.1, hcy - s * 0.2, s * 0.75, s * 0.6, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 1.1, hcy - s * 0.2, s * 0.75, s * 0.6, 0.3, 0, Math.PI * 2); ctx.fill();
  // Eyes
  circle(ctx, cx - s * 1.0, hcy - s * 0.2, s * 0.5, '#fff');
  circle(ctx, cx + s * 1.0, hcy - s * 0.2, s * 0.5, '#fff');
  circle(ctx, cx - s * 0.95, hcy - s * 0.15, s * 0.3, '#1a4000');
  circle(ctx, cx + s * 1.05, hcy - s * 0.15, s * 0.3, '#1a4000');
  // Nose
  circle(ctx, cx, hcy + s * 0.7, s * 0.4, black);
}

function _drawBear(ctx, cx, groundY, s, pal, pose, bob) {
  var legSwingL = 0, legSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.6; legSwingR = s * 0.6; }
  if (pose === 2) { legSwingL = s * 0.6;  legSwingR = -s * 0.6; }
  var baseY = groundY - bob;
  var brown = pal.shirt || '#8B4513', brownL = pal.shirt2 || '#a0602a', brownD = pal.shirtS || '#5a2e0a';
  var beige = '#d4a070';

  // Legs (stubby)
  px(ctx, cx - s * 2.1, baseY - s * 3.2 + legSwingL, s * 1.8, s * 3.2, brownD);
  px(ctx, cx + s * 0.5, baseY - s * 3.2 + legSwingR, s * 1.8, s * 3.2, brownD);
  circle(ctx, cx - s * 1.2, baseY + legSwingL * 0.15, s * 1.2, brown);
  circle(ctx, cx + s * 1.4, baseY + legSwingR * 0.15, s * 1.2, brown);

  // Body (chunky)
  ctx.fillStyle = brown;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 5.0, s * 3.0, s * 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = beige;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 4.3, s * 1.8, s * 2.2, 0, 0, Math.PI * 2); ctx.fill();

  // Arms
  ctx.fillStyle = brown;
  ctx.beginPath(); ctx.ellipse(cx - s * 3.2, baseY - s * 5.5, s * 1.2, s * 2.5, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 3.2, baseY - s * 5.5, s * 1.2, s * 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
  circle(ctx, cx - s * 3.2, baseY - s * 3.1, s * 1.0, brownL);
  circle(ctx, cx + s * 3.2, baseY - s * 3.1, s * 1.0, brownL);

  // Head
  var hcy = baseY - s * 9.0;
  ctx.fillStyle = brown;
  ctx.beginPath(); ctx.ellipse(cx, hcy, s * 2.6, s * 2.6, 0, 0, Math.PI * 2); ctx.fill();
  // Round ears
  circle(ctx, cx - s * 2.0, hcy - s * 1.8, s * 1.0, brown);
  circle(ctx, cx + s * 2.0, hcy - s * 1.8, s * 1.0, brown);
  circle(ctx, cx - s * 2.0, hcy - s * 1.8, s * 0.55, brownD);
  circle(ctx, cx + s * 2.0, hcy - s * 1.8, s * 0.55, brownD);
  // Muzzle
  ctx.fillStyle = beige;
  ctx.beginPath(); ctx.ellipse(cx, hcy + s * 0.7, s * 1.4, s * 1.0, 0, 0, Math.PI * 2); ctx.fill();
  // Nose
  circle(ctx, cx, hcy + s * 0.2, s * 0.6, '#111');
  // Eyes
  circle(ctx, cx - s * 1.1, hcy - s * 0.5, s * 0.6, brownD);
  circle(ctx, cx + s * 1.1, hcy - s * 0.5, s * 0.6, brownD);
  circle(ctx, cx - s * 1.0, hcy - s * 0.55, s * 0.25, '#fff');
  circle(ctx, cx + s * 1.2, hcy - s * 0.55, s * 0.25, '#fff');
  // Smile
  ctx.strokeStyle = '#333'; ctx.lineWidth = s * 0.3;
  ctx.beginPath(); ctx.arc(cx, hcy + s * 1.1, s * 0.5, 0.1, Math.PI - 0.1); ctx.stroke();
}

function _drawPenguin(ctx, cx, groundY, s, pal, pose, bob) {
  var legSwingL = 0, legSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.5; legSwingR = s * 0.5; }
  if (pose === 2) { legSwingL = s * 0.5;  legSwingR = -s * 0.5; }
  var baseY = groundY - bob;
  var black = '#1a1a2e', white = '#f0f0f0', orange = '#ff8800';

  // Feet
  ctx.fillStyle = orange;
  ctx.beginPath(); ctx.ellipse(cx - s * 1.0, baseY + legSwingL * 0.2, s * 1.0, s * 0.5, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 1.0, baseY + legSwingR * 0.2, s * 1.0, s * 0.5, -0.2, 0, Math.PI * 2); ctx.fill();

  // Legs (stubby orange)
  px(ctx, cx - s * 1.4, baseY - s * 2.0 + legSwingL, s * 0.9, s * 2.0, orange);
  px(ctx, cx + s * 0.6, baseY - s * 2.0 + legSwingR, s * 0.9, s * 2.0, orange);

  // Body (egg shaped, larger)
  ctx.fillStyle = black;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 5.5, s * 2.5, s * 4.0, 0, 0, Math.PI * 2); ctx.fill();
  // White belly
  ctx.fillStyle = white;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 5.0, s * 1.6, s * 3.0, 0, 0, Math.PI * 2); ctx.fill();

  // Wing-arms
  ctx.fillStyle = black;
  ctx.beginPath(); ctx.ellipse(cx - s * 2.8, baseY - s * 5.5, s * 0.9, s * 2.5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 2.8, baseY - s * 5.5, s * 0.9, s * 2.5, -0.3, 0, Math.PI * 2); ctx.fill();

  // Head
  var hcy = baseY - s * 10.5;
  circle(ctx, cx, hcy, s * 2.2, black);
  // White face
  ctx.fillStyle = white;
  ctx.beginPath(); ctx.ellipse(cx, hcy + s * 0.3, s * 1.5, s * 1.4, 0, 0, Math.PI * 2); ctx.fill();
  // Beak
  ctx.fillStyle = orange;
  ctx.beginPath(); ctx.moveTo(cx - s * 0.5, hcy + s * 0.5); ctx.lineTo(cx + s * 0.5, hcy + s * 0.5); ctx.lineTo(cx, hcy + s * 1.3); ctx.fill();
  // Eyes
  circle(ctx, cx - s * 0.9, hcy - s * 0.4, s * 0.55, black);
  circle(ctx, cx + s * 0.9, hcy - s * 0.4, s * 0.55, black);
  circle(ctx, cx - s * 0.75, hcy - s * 0.5, s * 0.22, '#fff');
  circle(ctx, cx + s * 1.05, hcy - s * 0.5, s * 0.22, '#fff');
  // Tiny bow tie (they're fancy)
  ctx.fillStyle = pal.accessory || '#ff4444';
  ctx.beginPath(); ctx.moveTo(cx, hcy + s * 1.2); ctx.lineTo(cx - s * 0.7, hcy + s * 0.9); ctx.lineTo(cx - s * 0.7, hcy + s * 1.5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, hcy + s * 1.2); ctx.lineTo(cx + s * 0.7, hcy + s * 0.9); ctx.lineTo(cx + s * 0.7, hcy + s * 1.5); ctx.fill();
  circle(ctx, cx, hcy + s * 1.2, s * 0.3, '#cc2200');
}

function _drawOwl(ctx, cx, groundY, s, pal, pose, bob) {
  var baseY = groundY - bob;
  var brown = pal.shirt || '#6B3A1A', brownL = pal.shirt2 || '#8b5a2a', brownD = pal.shirtS || '#4a2510';
  var cream = '#f5e8c8';
  var eyeColor = pal.accessory || '#ffdd00';
  var legSwingL = 0, legSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.4; legSwingR = s * 0.4; }
  if (pose === 2) { legSwingL = s * 0.4;  legSwingR = -s * 0.4; }

  // Talons
  ctx.strokeStyle = '#aa8800'; ctx.lineWidth = s * 0.4;
  for (var t = -1; t <= 1; t++) {
    ctx.beginPath(); ctx.moveTo(cx - s * 1.2 + t * s * 0.6, baseY); ctx.lineTo(cx - s * 1.2 + t * s * 0.9, baseY + s * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 1.2 + t * s * 0.6, baseY); ctx.lineTo(cx + s * 1.2 + t * s * 0.9, baseY + s * 0.7); ctx.stroke();
  }
  // Legs
  px(ctx, cx - s * 1.5, baseY - s * 1.8 + legSwingL, s * 0.7, s * 1.8, brownD);
  px(ctx, cx + s * 0.9, baseY - s * 1.8 + legSwingR, s * 0.7, s * 1.8, brownD);

  // Body
  ctx.fillStyle = brown;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 5.0, s * 2.5, s * 4.0, 0, 0, Math.PI * 2); ctx.fill();
  // Wing pattern
  ctx.fillStyle = brownD;
  ctx.beginPath(); ctx.ellipse(cx - s * 2.0, baseY - s * 5.0, s * 0.9, s * 3.0, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 2.0, baseY - s * 5.0, s * 0.9, s * 3.0, -0.2, 0, Math.PI * 2); ctx.fill();
  // Belly spots/streaks
  ctx.fillStyle = cream;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 4.5, s * 1.5, s * 2.8, 0, 0, Math.PI * 2); ctx.fill();
  for (var sp = 0; sp < 4; sp++) {
    ctx.fillStyle = brownD;
    ctx.beginPath(); ctx.ellipse(cx + (sp % 2 - 0.5) * s * 0.8, baseY - s * 3.5 - sp * s * 0.6, s * 0.4, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Head — round
  var hcy = baseY - s * 9.5;
  circle(ctx, cx, hcy, s * 2.5, brown);
  // Ear tufts
  ctx.fillStyle = brownD;
  ctx.beginPath(); ctx.moveTo(cx - s * 1.2, hcy - s * 1.8); ctx.lineTo(cx - s * 1.8, hcy - s * 3.2); ctx.lineTo(cx - s * 0.4, hcy - s * 2.2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + s * 1.2, hcy - s * 1.8); ctx.lineTo(cx + s * 1.8, hcy - s * 3.2); ctx.lineTo(cx + s * 0.4, hcy - s * 2.2); ctx.fill();
  // Facial disc
  ctx.fillStyle = cream;
  ctx.beginPath(); ctx.ellipse(cx, hcy + s * 0.2, s * 2.0, s * 1.9, 0, 0, Math.PI * 2); ctx.fill();
  // Eyes — huge round
  circle(ctx, cx - s * 1.0, hcy - s * 0.2, s * 0.85, eyeColor);
  circle(ctx, cx + s * 1.0, hcy - s * 0.2, s * 0.85, eyeColor);
  circle(ctx, cx - s * 1.0, hcy - s * 0.2, s * 0.5, '#111');
  circle(ctx, cx + s * 1.0, hcy - s * 0.2, s * 0.5, '#111');
  circle(ctx, cx - s * 0.8, hcy - s * 0.35, s * 0.22, '#fff');
  circle(ctx, cx + s * 1.2, hcy - s * 0.35, s * 0.22, '#fff');
  // Beak
  ctx.fillStyle = '#cc8800';
  ctx.beginPath(); ctx.moveTo(cx - s * 0.4, hcy + s * 0.4); ctx.lineTo(cx + s * 0.4, hcy + s * 0.4); ctx.lineTo(cx, hcy + s * 1.0); ctx.fill();
  // Spectacles on talking owls
  if (pose === 3 || pose === 4) {
    ctx.strokeStyle = '#888'; ctx.lineWidth = s * 0.25;
    ctx.strokeRect(cx - s * 1.75, hcy - s * 0.9, s * 1.5, s * 1.4);
    ctx.strokeRect(cx + s * 0.3, hcy - s * 0.9, s * 1.5, s * 1.4);
    ctx.beginPath(); ctx.moveTo(cx - s * 0.25, hcy - s * 0.2); ctx.lineTo(cx + s * 0.3, hcy - s * 0.2); ctx.stroke();
  }
}

// ── Robot renderer ────────────────────────────────────────────────────────────
function _drawRobot(ctx, W, H, pose, pal) {
  var s = W / 16;
  var cx = W / 2;
  var groundY = H - s * 0.5;
  var bodyBob = (pose === 1 || pose === 2) ? s * 0.2 : 0;
  if (pose === 4) bodyBob = -s * 0.25;
  var baseY = groundY - bodyBob;

  var metal = '#4a5568', metalL = '#718096', metalD = '#2d3748', acc = pal.accessory || '#00d2ff', acc2 = pal.acc2 || '#0099cc';

  // Feet
  px(ctx, cx - s * 2.2, baseY - s * 0.6, s * 1.8, s * 0.8, metalD);
  px(ctx, cx + s * 0.5, baseY - s * 0.6, s * 1.8, s * 0.8, metalD);

  // Legs — boxy
  var legSwingL = 0, legSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.8; legSwingR = s * 0.8; }
  if (pose === 2) { legSwingL = s * 0.8;  legSwingR = -s * 0.8; }
  px(ctx, cx - s * 2.0, baseY - s * 3.8 + legSwingL, s * 1.6, s * 3.2, metal);
  px(ctx, cx + s * 0.5, baseY - s * 3.8 + legSwingR, s * 1.6, s * 3.2, metal);
  // Knee joint
  circle(ctx, cx - s * 1.2, baseY - s * 2.2 + legSwingL * 0.5, s * 0.6, metalD);
  circle(ctx, cx + s * 1.3, baseY - s * 2.2 + legSwingR * 0.5, s * 0.6, metalD);

  // Torso — rectangular
  var torsoY = baseY - s * 4.0;
  px(ctx, cx - s * 2.6, torsoY - s * 3.8, s * 5.2, s * 4.0, metal);
  // Torso detail
  px(ctx, cx - s * 2.2, torsoY - s * 3.5, s * 4.4, s * 0.5, metalD); // top stripe
  // Screen/panel on chest
  px(ctx, cx - s * 1.5, torsoY - s * 3.2, s * 3.0, s * 2.0, metalD);
  // LED indicators
  circle(ctx, cx - s * 1.0, torsoY - s * 2.6, s * 0.3, pose === 3 || pose === 4 ? '#ff4444' : '#44ff44');
  circle(ctx, cx - s * 0.2, torsoY - s * 2.6, s * 0.3, acc);
  circle(ctx, cx + s * 0.6, torsoY - s * 2.6, s * 0.3, '#ffff44');
  // Scan line on screen
  var scanLine = (pose === 3) ? torsoY - s * 1.5 : torsoY - s * 2.0;
  px(ctx, cx - s * 1.4, scanLine, s * 2.8, s * 0.2, acc);
  // Bolts on body
  circle(ctx, cx - s * 2.2, torsoY - s * 3.4, s * 0.25, metalL);
  circle(ctx, cx + s * 2.2, torsoY - s * 3.4, s * 0.25, metalL);
  circle(ctx, cx - s * 2.2, torsoY - s * 1.0, s * 0.25, metalL);
  circle(ctx, cx + s * 2.2, torsoY - s * 1.0, s * 0.25, metalL);

  // Arms — boxy with articulation
  var armRaiseR = (pose === 4) ? -s * 2.5 : 0;
  var armLSwing = 0, armRSwing = 0;
  if (pose === 1) { armLSwing = s * 0.5; armRSwing = -s * 0.5; }
  if (pose === 2) { armLSwing = -s * 0.5; armRSwing = s * 0.5; }

  // Left arm
  px(ctx, cx - s * 3.8, torsoY - s * 3.5 + armLSwing, s * 1.2, s * 2.5, metal);
  // Left hand (claw)
  px(ctx, cx - s * 4.0, torsoY - s * 1.2 + armLSwing, s * 1.5, s * 0.8, metalL);
  // Right arm
  px(ctx, cx + s * 2.6, torsoY - s * 3.5 + armRSwing + armRaiseR, s * 1.2, s * 2.5, metal);
  // Right hand
  px(ctx, cx + s * 2.4, torsoY - s * 1.2 + armRSwing + armRaiseR, s * 1.5, s * 0.8, metalL);
  // Shoulder joints
  circle(ctx, cx - s * 3.2, torsoY - s * 3.5, s * 0.6, metalD);
  circle(ctx, cx + s * 3.2, torsoY - s * 3.5, s * 0.6, metalD);

  // Head — boxy
  var hcy = torsoY - s * 5.2;
  px(ctx, cx - s * 2.0, hcy - s * 1.8, s * 4.0, s * 3.6, metal);
  px(ctx, cx - s * 1.8, hcy - s * 1.6, s * 3.6, s * 3.2, metalL);
  // Antenna
  px(ctx, cx + s * 0.8, hcy - s * 2.8, s * 0.4, s * 1.2, metalD);
  circle(ctx, cx + s * 1.0, hcy - s * 3.0, s * 0.45, acc);
  // Eye visor — glowing
  px(ctx, cx - s * 1.5, hcy - s * 0.8, s * 3.0, s * 1.2, metalD);
  // Eyes — LED strip
  var eyeGlow = (pose === 3 || pose === 4) ? acc : acc2;
  for (var e = 0; e < 5; e++) {
    px(ctx, cx - s * 1.3 + e * s * 0.58, hcy - s * 0.55, s * 0.4, s * 0.7, eyeGlow);
  }
  // Mouth speaker grille
  px(ctx, cx - s * 1.2, hcy + s * 0.6, s * 2.4, s * 0.6, metalD);
  for (var g = 0; g < 5; g++) {
    px(ctx, cx - s * 1.0 + g * s * 0.48, hcy + s * 0.65, s * 0.25, s * 0.5, '#333');
  }
  // Head bolts
  circle(ctx, cx - s * 1.6, hcy - s * 1.4, s * 0.2, metalD);
  circle(ctx, cx + s * 1.6, hcy - s * 1.4, s * 0.2, metalD);
}

// ── Alien renderer ────────────────────────────────────────────────────────────
function _drawAlien(ctx, W, H, pose, pal) {
  var s = W / 16;
  var cx = W / 2;
  var groundY = H - s * 0.5;
  var bodyBob = (pose === 1 || pose === 2) ? s * 0.25 : 0;
  var baseY = groundY - bodyBob;

  var green = '#44cc44', greenL = '#66ee66', greenD = '#228822', black = '#0a0a1a';
  var legSwingL = 0, legSwingR = 0;
  if (pose === 1) { legSwingL = -s * 0.7; legSwingR = s * 0.7; }
  if (pose === 2) { legSwingL = s * 0.7;  legSwingR = -s * 0.7; }

  // 3 legs
  px(ctx, cx - s * 2.5, baseY - s * 3.0 + legSwingL, s * 1.0, s * 3.0, greenD);
  px(ctx, cx - s * 0.5, baseY - s * 3.5, s * 1.0, s * 3.5, greenD);
  px(ctx, cx + s * 1.5, baseY - s * 3.0 + legSwingR, s * 1.0, s * 3.0, greenD);

  // Body
  ctx.fillStyle = green;
  ctx.beginPath(); ctx.ellipse(cx, baseY - s * 5.0, s * 2.5, s * 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = greenL;
  ctx.beginPath(); ctx.ellipse(cx - s * 0.3, baseY - s * 5.5, s * 1.2, s * 1.8, -0.2, 0, Math.PI * 2); ctx.fill();

  // 4 arms (2 pairs)
  ctx.fillStyle = greenD;
  ctx.beginPath(); ctx.ellipse(cx - s * 3.2, baseY - s * 6.5, s * 0.8, s * 2.5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - s * 3.0, baseY - s * 3.8, s * 0.7, s * 1.8, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 3.2, baseY - s * 6.5, s * 0.8, s * 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 3.0, baseY - s * 3.8, s * 0.7, s * 1.8, -0.1, 0, Math.PI * 2); ctx.fill();

  // Huge head
  var hcy = baseY - s * 10.0;
  ctx.fillStyle = green;
  ctx.beginPath(); ctx.ellipse(cx, hcy, s * 3.0, s * 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // Veins/texture
  ctx.strokeStyle = greenD; ctx.lineWidth = s * 0.2;
  ctx.beginPath(); ctx.moveTo(cx - s * 1, hcy - s * 2); ctx.lineTo(cx - s * 0.5, hcy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + s * 1, hcy - s * 2); ctx.lineTo(cx + s * 0.5, hcy); ctx.stroke();
  // Giant eyes
  circle(ctx, cx - s * 1.4, hcy + s * 0.2, s * 1.1, black);
  circle(ctx, cx + s * 1.4, hcy + s * 0.2, s * 1.1, black);
  circle(ctx, cx - s * 1.4, hcy + s * 0.2, s * 0.65, '#8800ff');
  circle(ctx, cx + s * 1.4, hcy + s * 0.2, s * 0.65, '#8800ff');
  circle(ctx, cx - s * 1.2, hcy, s * 0.28, '#fff');
  circle(ctx, cx + s * 1.6, hcy, s * 0.28, '#fff');
  // Tiny mouth slit
  px(ctx, cx - s * 0.4, hcy + s * 1.3, s * 0.8, s * 0.2, greenD);
  // Antennae
  ctx.strokeStyle = green; ctx.lineWidth = s * 0.4;
  ctx.beginPath(); ctx.moveTo(cx - s * 1.5, hcy - s * 2.8); ctx.lineTo(cx - s * 2.2, hcy - s * 4.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + s * 1.5, hcy - s * 2.8); ctx.lineTo(cx + s * 2.2, hcy - s * 4.5); ctx.stroke();
  circle(ctx, cx - s * 2.2, hcy - s * 4.5, s * 0.5, '#ff00ff');
  circle(ctx, cx + s * 2.2, hcy - s * 4.5, s * 0.5, '#ff00ff');
}

// ── Ghost renderer ────────────────────────────────────────────────────────────
function _drawGhost(ctx, W, H, pose, pal) {
  var s = W / 16;
  var cx = W / 2;
  var groundY = H - s * 0.5;
  var floatY = Math.sin(Date.now() / 800) * s * 0.5; // gentle float
  var baseY = groundY - s * 2.0 + floatY;
  if (pose === 4) baseY -= s;

  var ghostColor = pal.shirt || 'rgba(200,220,255,0.88)';
  var ghostDark  = 'rgba(160,180,220,0.7)';

  // Wispy bottom
  ctx.fillStyle = ghostColor;
  for (var w = 0; w < 5; w++) {
    ctx.beginPath();
    ctx.arc(cx - s * 2.0 + w * s, baseY, s * 0.75, 0, Math.PI * 2); ctx.fill();
  }
  // Body
  ctx.beginPath();
  ctx.moveTo(cx - s * 2.5, baseY);
  ctx.lineTo(cx - s * 2.5, baseY - s * 6.0);
  ctx.quadraticCurveTo(cx - s * 2.5, baseY - s * 8.5, cx, baseY - s * 8.5);
  ctx.quadraticCurveTo(cx + s * 2.5, baseY - s * 8.5, cx + s * 2.5, baseY - s * 6.0);
  ctx.lineTo(cx + s * 2.5, baseY);
  ctx.fill();
  // Shading
  ctx.fillStyle = ghostDark;
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.5, baseY - s * 4.0, s * 1.2, s * 2.5, 0.3, 0, Math.PI * 2); ctx.fill();

  // Arms (wispy)
  ctx.strokeStyle = ghostColor; ctx.lineWidth = s * 1.2;
  if (pose === 4) {
    ctx.beginPath(); ctx.moveTo(cx - s * 2.4, baseY - s * 6.0); ctx.quadraticCurveTo(cx - s * 4.5, baseY - s * 7.0, cx - s * 3.5, baseY - s * 8.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 2.4, baseY - s * 6.0); ctx.quadraticCurveTo(cx + s * 4.5, baseY - s * 8.0, cx + s * 3.5, baseY - s * 9.5); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(cx - s * 2.4, baseY - s * 5.0); ctx.quadraticCurveTo(cx - s * 4.0, baseY - s * 4.5, cx - s * 3.5, baseY - s * 3.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 2.4, baseY - s * 5.0); ctx.quadraticCurveTo(cx + s * 4.0, baseY - s * 4.5, cx + s * 3.5, baseY - s * 3.0); ctx.stroke();
  }

  // Eyes (hollow black, spooky)
  var hcy = baseY - s * 7.0;
  ctx.fillStyle = '#0a0820';
  ctx.beginPath(); ctx.ellipse(cx - s * 1.1, hcy, s * 0.7, s * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 1.1, hcy, s * 0.7, s * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  // Eye glow
  circle(ctx, cx - s * 1.0, hcy - s * 0.2, s * 0.3, pal.accessory || '#8888ff');
  circle(ctx, cx + s * 1.2, hcy - s * 0.2, s * 0.3, pal.accessory || '#8888ff');
  // Wavy mouth
  ctx.strokeStyle = '#0a0820'; ctx.lineWidth = s * 0.4;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.9, hcy + s * 1.1);
  for (var wm = 0; wm < 4; wm++) {
    ctx.quadraticCurveTo(
      cx - s * 0.5 + wm * s * 0.5, hcy + s * 1.4 + (wm % 2) * s * 0.4,
      cx - s * 0.3 + (wm + 1) * s * 0.45, hcy + s * 1.1
    );
  }
  ctx.stroke();
}
