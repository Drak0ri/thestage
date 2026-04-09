// js/chars.js — 48x72 pixel art character renderer + action animations

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

// Available actions — add new ones here and the AI will start using them
const ACTIONS = ['nod','shake','shrug','jump','wave','spin','think','facepalm','point','bow','dance','stomp'];

/**
 * Draw a 48x72 pixel character.
 * pose: 0=stand, 1=walkA, 2=walkB, 3=forward-lean
 * Special poses via action system handle their own offsets externally
 */
function drawPixelChar(ctx, p, frame, opts) {
  frame = frame || 0;
  opts  = opts  || {};
  ctx.clearRect(0, 0, 48, 72);

  var offsetY = opts.offsetY || 0;   // vertical shift (jump, bob)
  var scaleX  = opts.scaleX  || 1;   // flip for direction
  var headTilt = opts.headTilt || 0; // degrees

  if (scaleX === -1) {
    ctx.save();
    ctx.translate(48, 0);
    ctx.scale(-1, 1);
  }

  var px = function(x, y, c, w, h) {
    if (y + offsetY < 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y + offsetY, w||1, h||1);
  };

  var isFwd = frame === 3;
  var swA   = frame===1?2:frame===2?-2:isFwd?-1:0;
  var swB   = -swA;

  var hx=isFwd?15:17, hy=isFwd?1:3, hw=isFwd?18:14, hh=isFwd?20:16;

  // Head (with optional tilt stored as ctx rotate)
  if (headTilt) { ctx.save(); ctx.translate(hx+hw/2, hy+hh/2); ctx.rotate(headTilt*Math.PI/180); ctx.translate(-(hx+hw/2),-(hy+hh/2)); }

  px(hx,hy,p.skin,hw,hh);
  px(hx,hy,p.skinS,1,hh); px(hx+hw-1,hy,p.skinS,1,hh); px(hx,hy+hh-2,p.skinS,hw,2);
  px(hx,hy,p.hair,hw,5); px(hx,hy+5,p.hair,2,7); px(hx+hw-2,hy+5,p.hair,2,7);
  px(hx+4,hy+1,p.hairH,5,1); px(hx+3,hy+2,p.hairH,3,1);

  var ey=hy+8, ex1=hx+(isFwd?3:2), ex2=hx+hw-(isFwd?6:5);
  if (opts.eyesClosed) {
    px(ex1,ey+1,p.hair,3,1); px(ex2,ey+1,p.hair,3,1);
  } else {
    px(ex1,ey,'#fff',3,3); px(ex2,ey,'#fff',3,3);
    px(ex1+1,ey+1,p.eyes); px(ex2+1,ey+1,p.eyes);
  }
  px(ex1,ey-2,p.hair,3,1); px(ex2,ey-2,p.hair,3,1);
  px(hx+Math.floor(hw/2)-1,ey+4,p.skinS,2,2);

  var my=hy+hh-5;
  if (opts.smileWide) {
    px(hx+3,my,p.mouth,hw-6,1); px(hx+2,my-1,p.mouth,1,1); px(hx+hw-3,my-1,p.mouth,1,1);
    px(hx+2,my+1,p.mouth,1,1); px(hx+hw-3,my+1,p.mouth,1,1);
  } else if (opts.mouthO) {
    px(hx+5,my,p.mouth,hw-10,2); px(hx+4,my-1,p.mouth,1,1); px(hx+hw-5,my-1,p.mouth,1,1);
  } else {
    px(hx+4,my,p.mouth,hw-8,1); px(hx+3,my-1,p.mouth,1,1); px(hx+hw-4,my-1,p.mouth,1,1);
  }
  px(hx-1,ey,p.skin,1,4); px(hx+hw,ey,p.skin,1,4);

  if (headTilt) ctx.restore();

  var ny2=hy+hh, nkx=hx+Math.floor(hw/2)-3;
  px(nkx,ny2,p.skin,6,4); px(nkx,ny2,p.skinS,1,4); px(nkx+5,ny2,p.skinS,1,4);

  var bx=isFwd?12:14, by=ny2+4, bw=isFwd?24:20, bh=20;
  px(bx,by,p.shirt,bw,bh); px(bx,by,p.shirtS,1,bh); px(bx+bw-1,by,p.shirtS,1,bh); px(bx,by+bh-1,p.shirtS,bw,1);
  var cx2=hx+Math.floor(hw/2);
  px(cx2-3,by,p.skinS,6,2); px(cx2-2,by+2,p.skinS,4,2); px(cx2-1,by+4,p.skinS,2,1);
  px(bx+3,by+6,p.shirtS,6,5); px(bx+4,by+7,p.shirt,4,3);
  for (var i=0;i<4;i++) px(bx+Math.floor(bw/2),by+4+i*4,p.shirtS,1,2);

  var bely=by+bh;
  px(bx,bely,p.belt,bw,4); px(bx+Math.floor(bw/2)-3,bely,'#888',6,4);

  // Arms — support raised arm pose
  var aH=18;
  var leftSwing  = opts.leftArmUp  ? -10 : swA;
  var rightSwing = opts.rightArmUp ? -10 : swB;
  px(bx-5,by+leftSwing,p.shirt,5,aH); px(bx-5,by+leftSwing,p.shirtS,1,aH);
  px(bx-5,by+aH+leftSwing,p.skin,5,5); px(bx-5,by+aH+leftSwing,p.skinS,1,5);
  px(bx+bw,by+rightSwing,p.shirt,5,aH); px(bx+bw+4,by+rightSwing,p.shirtS,1,aH);
  px(bx+bw,by+aH+rightSwing,p.skin,5,5); px(bx+bw+4,by+aH+rightSwing,p.skinS,1,5);

  // Hand on chin for 'think'
  if (opts.thinkPose) {
    px(nkx+2,ny2+2,p.skin,4,3);
  }

  var lY=bely+4, lH=18, lW=8, llx=bx+1, lrx=bx+bw-lW-1;
  for (var li=0;li<lH;li++) {
    var offL=li>lH/2?(frame===1?swA:frame===2?swA:isFwd?swA:0):0;
    var offR=li>lH/2?(frame===1?swB:frame===2?swB:isFwd?swB:0):0;
    px(llx+offL,lY+li,p.pants,lW,1); px(llx+offL,lY+li,p.pantsS,1,1);
    px(lrx+offR,lY+li,p.pants,lW,1); px(lrx+offR+lW-1,lY+li,p.pantsS,1,1);
  }
  var sY=lY+lH;
  var oL=frame===1?swA:frame===2?swA:isFwd?-1:0;
  var oR=frame===1?swB:frame===2?swB:isFwd?1:0;
  px(llx+oL-1,sY,p.shoes,lW+3,5); px(lrx+oR-1,sY,p.shoes,lW+3,5);
  px(llx+oL,sY+4,'#555',lW+1,1); px(lrx+oR,sY+4,'#555',lW+1,1);

  if (scaleX === -1) ctx.restore();
}

function makeCharCanvas(pal, scale) {
  scale = scale || 2;
  var c = document.createElement('canvas');
  c.width = 48*scale; c.height = 72*scale;
  c.style.imageRendering = 'pixelated';
  c.style.width  = (48*scale)+'px';
  c.style.height = (72*scale)+'px';
  var ctx = c.getContext('2d');
  ctx.scale(scale,scale);
  drawPixelChar(ctx, pal, 0);
  return { canvas:c, ctx:ctx, scale:scale, pal:pal };
}

function redrawChar(canvas, pal, frame, scale, opts) {
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(scale,scale);
  drawPixelChar(ctx, pal, frame, opts);
  ctx.restore();
}

/**
 * Play an action animation on a canvas element.
 * Returns a promise that resolves when done.
 */
function playAction(canvas, pal, scale, actionName) {
  return new Promise(function(resolve) {
    var ctx  = canvas.getContext('2d');
    var step = 0;
    var frames = _actionFrames(actionName);
    if (!frames || !frames.length) { resolve(); return; }

    var timer = setInterval(function() {
      if (step >= frames.length) {
        clearInterval(timer);
        // Return to stand
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.save(); ctx.scale(scale,scale);
        drawPixelChar(ctx, pal, 0);
        ctx.restore();
        resolve();
        return;
      }
      var f = frames[step];
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save(); ctx.scale(scale,scale);
      drawPixelChar(ctx, pal, f.pose||0, f.opts||{});
      ctx.restore();
      step++;
    }, frames[0].duration || 80);
  });
}

function _actionFrames(action) {
  var D = 80; // default frame duration ms
  switch(action) {
    case 'nod':
      return [
        {pose:0,opts:{headTilt:-8},duration:100},
        {pose:0,opts:{headTilt:8},duration:100},
        {pose:0,opts:{headTilt:-5},duration:100},
        {pose:0,opts:{},duration:100},
      ];
    case 'shake':
      return [
        {pose:0,opts:{scaleX:-1},duration:80},
        {pose:0,opts:{},duration:80},
        {pose:0,opts:{scaleX:-1},duration:80},
        {pose:0,opts:{},duration:80},
        {pose:0,opts:{scaleX:-1},duration:80},
        {pose:0,opts:{},duration:80},
      ];
    case 'shrug':
      return [
        {pose:0,opts:{leftArmUp:true,rightArmUp:true},duration:150},
        {pose:0,opts:{leftArmUp:true,rightArmUp:true,headTilt:5},duration:150},
        {pose:0,opts:{leftArmUp:true,rightArmUp:true},duration:150},
        {pose:0,opts:{},duration:100},
      ];
    case 'jump':
      return [
        {pose:0,opts:{offsetY:2},duration:60},
        {pose:0,opts:{offsetY:-10},duration:80},
        {pose:0,opts:{offsetY:-16},duration:80},
        {pose:0,opts:{offsetY:-10},duration:80},
        {pose:0,opts:{offsetY:-4},duration:60},
        {pose:0,opts:{offsetY:0},duration:60},
      ];
    case 'wave':
      return [
        {pose:0,opts:{rightArmUp:true},duration:120},
        {pose:0,opts:{rightArmUp:false},duration:100},
        {pose:0,opts:{rightArmUp:true},duration:120},
        {pose:0,opts:{rightArmUp:false},duration:100},
        {pose:0,opts:{rightArmUp:true},duration:120},
        {pose:0,opts:{},duration:100},
      ];
    case 'spin':
      return [
        {pose:0,opts:{scaleX:1},duration:80},
        {pose:0,opts:{scaleX:-1},duration:80},
        {pose:0,opts:{scaleX:1},duration:80},
        {pose:0,opts:{scaleX:-1},duration:80},
        {pose:0,opts:{scaleX:1},duration:80},
      ];
    case 'think':
      return [
        {pose:0,opts:{thinkPose:true,headTilt:-5},duration:200},
        {pose:0,opts:{thinkPose:true,headTilt:5},duration:200},
        {pose:0,opts:{thinkPose:true,headTilt:-3},duration:200},
        {pose:0,opts:{},duration:100},
      ];
    case 'facepalm':
      return [
        {pose:0,opts:{leftArmUp:true,headTilt:5},duration:150},
        {pose:0,opts:{leftArmUp:true,headTilt:8,eyesClosed:true},duration:200},
        {pose:0,opts:{leftArmUp:true,headTilt:5,eyesClosed:true},duration:150},
        {pose:0,opts:{},duration:100},
      ];
    case 'point':
      return [
        {pose:0,opts:{rightArmUp:true},duration:100},
        {pose:0,opts:{rightArmUp:true,headTilt:-3},duration:300},
        {pose:0,opts:{rightArmUp:true},duration:100},
        {pose:0,opts:{},duration:100},
      ];
    case 'bow':
      return [
        {pose:0,opts:{offsetY:4,headTilt:20},duration:150},
        {pose:0,opts:{offsetY:6,headTilt:25},duration:200},
        {pose:0,opts:{offsetY:4,headTilt:20},duration:150},
        {pose:0,opts:{},duration:100},
      ];
    case 'dance':
      return [
        {pose:1,opts:{offsetY:-4,rightArmUp:true},duration:150},
        {pose:2,opts:{offsetY:0,leftArmUp:true},duration:150},
        {pose:1,opts:{offsetY:-4,rightArmUp:true},duration:150},
        {pose:2,opts:{offsetY:0,leftArmUp:true},duration:150},
        {pose:1,opts:{offsetY:-2,rightArmUp:true,leftArmUp:true},duration:150},
        {pose:0,opts:{},duration:100},
      ];
    case 'stomp':
      return [
        {pose:1,opts:{offsetY:2},duration:100},
        {pose:0,opts:{offsetY:0},duration:80},
        {pose:2,opts:{offsetY:2},duration:100},
        {pose:0,opts:{offsetY:0},duration:80},
        {pose:1,opts:{offsetY:2},duration:100},
        {pose:0,opts:{},duration:80},
      ];
    default:
      return null;
  }
}
