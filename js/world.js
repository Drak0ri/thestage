// js/world.js  — LPC spritesheet rendering

const IDLE_PX      = 1.8;   // CSS display scale idle
const ACTIVE_PX    = 2.2;   // CSS display scale talking
const FLOOR_H      = 58;
const CLAUDE_COLOR_IDX = 0;     // colorIdx 0 = Claude, rendered larger
const CLAUDE_SCALE_BONUS = 0.4; // Claude is this much bigger than others

// ── Spritesheet layout ──────────────────────────────────────────────────────
// Each sprite PNG: 576 × 384 px  (9 cols × 6 rows of 64×64 frames) — pinned @eaa9beaf
// All animations use LPC rows ≤20 so clothing layers always cover them
// Row 0 : idle      2 frames  (walk-right standing poses)
// Row 1 : walk      9 frames  (walk-right full cycle)
// Row 2 : run       6 frames  (slash-right energetic)
// Row 3 : action    7 frames  (spellcast-right wave/gesture)
// Row 4 : hurt      6 frames  (hurt front)
// Row 5 : thrust    8 frames  (thrust-right pointing)
const SPRITE_FRAME = 64;
const SPRITE_CDN   = 'https://cdn.jsdelivr.net/gh/Drak0ri/thestage-sprites@21eee9680bc1b565350fdf65e6dca3ddf06f752c/char_';

// Spritesheet: 576×768px, 9 cols × 12 rows of 64×64 frames
// 4 directions × 3 animations. Direction order per group: down, left, right, up
// Rows  0-3:  idle   (2 frames — standing walk pose)
// Rows  4-7:  walk   (9 frames)
// Rows  8-11: action (7 frames — spellcast gesture)
const DIR = { BACK: 0, LEFT: 1, RIGHT: 2, FRONT: 3 };
// Row within each anim group: BACK=0(away), LEFT=1(profile left), RIGHT=2(profile right), FRONT=3(toward camera)
const ANIM_BASE   = { idle: 0, walk: 4, action: 8 };
const ANIM_ROWS = {
  idle:   { row: 0, frames: 2, fps: 3  },
  walk:   { row: 4, frames: 9, fps: 10 },
  action: { row: 8, frames: 7, fps: 10 },
};

// Map old action names → new animation names
const ACTION_ANIM_MAP = {
  nod: 'idle', shake: 'idle', shrug: 'idle',
  jump: 'action', wave: 'action', spin: 'action',
  think: 'idle', facepalm: 'action', point: 'action',
  bow: 'idle', dance: 'action', stomp: 'action',
};

// Preload all 12 sprite images
const _spriteCache = {};
// Per-sprite load listeners (supports multiple renderers waiting on same image)
var _spriteListeners = {};

function _getSprite(colorIdx, onLoadCb) {
  var idx = (colorIdx || 0) % 12;
  if (!_spriteCache[idx]) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    _spriteListeners[idx] = [];
    img.onload = function() {
      var cbs = _spriteListeners[idx] || [];
      for (var i = 0; i < cbs.length; i++) cbs[i](img);
      _spriteListeners[idx] = [];
    };
    img.src = SPRITE_CDN + idx + '.png';
    _spriteCache[idx] = img;
  }
  var img = _spriteCache[idx];
  if (onLoadCb) {
    if (img.complete && img.naturalWidth) {
      onLoadCb(img);
    } else {
      (_spriteListeners[idx] = _spriteListeners[idx] || []).push(onLoadCb);
    }
  }
  return img;
}

// Preload all on script load
for (var _pi = 0; _pi < 12; _pi++) _getSprite(_pi);

// ── Sprite canvas renderer ──────────────────────────────────────────────────
function SpriteRenderer(colorIdx, canvas) {
  this.colorIdx    = colorIdx;
  this.canvas      = canvas;
  this.ctx         = canvas.getContext('2d');
  this._animName   = 'idle';
  this._dir        = DIR.FRONT;   // current facing direction
  this._animRow    = 0;          // computed from anim + dir
  this._animFrames = 2;
  this._animFps    = 3;
  this.frame       = 0;
  this._timer      = null;
  this._oneshot    = false;
  this._onDone     = null;
  var self = this;
  _getSprite(colorIdx, function() { self._draw(); });
}

// Atomically update anim state — row = ANIM_BASE[anim] + dir
SpriteRenderer.prototype._setAnimState = function(name, dir, oneshot, onDone) {
  var info = ANIM_ROWS[name] || ANIM_ROWS['idle'];
  this._animName   = name;
  this._dir        = (dir !== undefined && dir !== null) ? dir : this._dir;
  this._animRow    = (ANIM_BASE[name] || 0) + this._dir;
  this._animFrames = info.frames;
  this._animFps    = info.fps;
  this.frame       = 0;
  this._oneshot    = !!oneshot;
  this._onDone     = onDone || null;
};

SpriteRenderer.prototype.setAnim = function(name, dir, oneshot, onDone) {
  this._setAnimState(name, dir, oneshot, onDone);
  this._draw();
};

SpriteRenderer.prototype._draw = function() {
  var img = _getSprite(this.colorIdx);
  var ctx = this.ctx;
  var W   = this.canvas.width;
  var H   = this.canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!img.complete || !img.naturalWidth) return;
  var sx = this.frame * SPRITE_FRAME;
  var sy = this._animRow * SPRITE_FRAME;
  ctx.drawImage(img, sx, sy, SPRITE_FRAME, SPRITE_FRAME, 0, 0, W, H);
};

SpriteRenderer.prototype.startLoop = function() {
  this._stopLoop();
  var self = this;
  // Capture fps at loop-start time; restart loop if anim changes
  var loopFps = this._animFps;
  var interval = Math.round(1000 / loopFps);
  this._timer = setInterval(function() {
    // Advance frame within locked frame count
    self.frame = (self.frame + 1) % self._animFrames;
    if (self._oneshot && self.frame === 0) {
      self._stopLoop();
      var cb = self._onDone;
      self.still('idle', self._dir);  // static frame, no loop
      if (cb) cb();
      return;
    }
    self._draw();
  }, interval);
};

SpriteRenderer.prototype._stopLoop = function() {
  if (this._timer) { clearInterval(this._timer); this._timer = null; }
};

// Draw a single static frame — no loop
SpriteRenderer.prototype.still = function(animName, dir) {
  this._stopLoop();
  this._setAnimState(animName || 'idle', (dir !== undefined) ? dir : this._dir, false, null);
  this.frame = 0;
  this._draw();
};

SpriteRenderer.prototype.destroy = function() {
  this._stopLoop();
};

SpriteRenderer.prototype.playOnce = function(animName, onDone) {
  this._stopLoop();
  this._setAnimState(animName, this._dir, true, onDone);
  this._draw();
  this.startLoop();
};

// Switch to a new looping animation with optional direction change
SpriteRenderer.prototype.switchAnim = function(animName, dir) {
  this._stopLoop();
  this._setAnimState(animName, (dir !== undefined) ? dir : this._dir, false, null);
  this._draw();
  this.startLoop();
};

// Set direction only (keep same animation, update row)
SpriteRenderer.prototype.setDir = function(dir) {
  if (dir === this._dir) return;
  this._dir     = dir;
  this._animRow = (ANIM_BASE[this._animName] || 0) + dir;
  this.frame    = 0;
  this._draw();
};

// ── World object ────────────────────────────────────────────────────────────
const World = {
  container:    null,
  charsLayer:   null,
  animTimers:   {},
  wanderTimers: {},
  wanderState:  {},
  renderers:    {},   // id → SpriteRenderer
  meetingMode:  false,
  currentRoom:  'stage',

  init() {
    this.container  = document.getElementById('world-container');
    this.charsLayer = document.getElementById('chars-layer');
    this._buildFloor();
    this._buildStars();
    this._buildBgCanvas();
    if (typeof WorldObjects !== 'undefined') WorldObjects.init();
    window.addEventListener('resize', function() {
      World._buildBgCanvas();
      World.render();
      if (typeof WorldObjects !== 'undefined') WorldObjects.resize();
    });
    this.initKeyboard();
    this.container.addEventListener('click', function(e) {
      var t = e.target;
      if (t === World.container || t.id === 'bg-canvas' ||
          t.classList.contains('floor-tile') || t.id === 'stars-layer' ||
          t.id === 'world-hud' || t.id === 'status-bar' ||
          t.id === 'objects-layer' || t.id === 'chars-layer') {
        Chat.closePanel();
      }
    });
  },

  switchRoom(roomId) {
    if (!ROOMS[roomId]) return;
    this.currentRoom = roomId;
    Chat.closePanel();
    if (typeof WorldObjects !== 'undefined') WorldObjects.onRoomSwitch();
    if (typeof Props !== 'undefined') Props.onRoomSwitch();
    this._buildFloor(); this._buildBgCanvas();
    this.render();
    App.setStatus('Entered ' + ROOMS[roomId].statusLabel);
    document.querySelectorAll('.room-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.room === roomId);
    });
  },

  _buildFloor() {
    var existing = this.container.querySelector('.floor-tile');
    if (existing) existing.remove();
    var room = ROOMS[this.currentRoom];
    var f = document.createElement('div');
    f.className = 'floor-tile';
    f.style.background = 'repeating-linear-gradient(90deg,' +
      room.floor.color1+' 0px,'+room.floor.color1+' 31px,'+
      room.floor.color2+' 32px,'+room.floor.color2+' 63px)';
    f.style.borderTopColor = room.floor.border;
    var charsLayer = document.getElementById('chars-layer');
    if (charsLayer) this.container.insertBefore(f, charsLayer);
    else this.container.appendChild(f);
  },

  _buildStars() {
    var layer = document.getElementById('stars-layer');
    layer.innerHTML = '';
    for (var i = 0; i < 45; i++) {
      var s = document.createElement('div'); s.className = 'star';
      var sz = (Math.random()*2+1).toFixed(1);
      s.style.cssText = 'width:'+sz+'px;height:'+sz+'px;left:'+(Math.random()*100).toFixed(1)+
        '%;top:'+(Math.random()*58).toFixed(1)+'%;animation-delay:'+(Math.random()*2).toFixed(2)+
        's;animation-duration:'+(1.5+Math.random()*2).toFixed(2)+'s';
      layer.appendChild(s);
    }
  },

  _buildBgCanvas() {
    var canvas = document.getElementById('bg-canvas');
    var W = canvas.width  = this.container.offsetWidth  || 700;
    var H = canvas.height = this.container.offsetHeight || 320;
    var ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, W, H);
    if      (this.currentRoom === 'stage')      this._drawStageRoom(ctx, W, H);
    else if (this.currentRoom === 'boardroom')  this._drawBoardroom(ctx, W, H);
    else if (this.currentRoom === 'playground') this._drawPlayground(ctx, W, H);
    else if (this.currentRoom === 'classroom')  this._drawClassroom(ctx, W, H);
  },

  _drawStageRoom(ctx,W,H) {
    var b=[[0,H-160,50,120],[55,H-130,40,90],[100,H-170,60,130],[170,H-145,40,105],[220,H-185,55,145],[285,H-140,38,100],[330,H-165,60,125],[400,H-150,45,110],[455,H-180,50,140],[515,H-145,45,105],[570,H-170,50,130],[628,H-135,42,95],[676,H-155,50,115]];
    b.forEach(function(b){ctx.fillStyle='#0d0c22';ctx.fillRect(b[0],b[1],b[2],b[3]);for(var wx=b[0]+5;wx<b[0]+b[2]-5;wx+=9)for(var wy=b[1]+8;wy<b[1]+b[3]-5;wy+=11){ctx.fillStyle=Math.random()>0.45?'#ffcc4418':'#3366ff10';ctx.fillRect(wx,wy,5,6);}});
    var fog=ctx.createLinearGradient(0,H-90,0,H-FLOOR_H);fog.addColorStop(0,'rgba(15,14,23,0)');fog.addColorStop(1,'rgba(15,14,23,0.6)');ctx.fillStyle=fog;ctx.fillRect(0,H-90,W,90);
  },

  _drawBoardroom(ctx,W,H) {
    var floor=H-FLOOR_H;
    var ceilH=Math.round(H*0.18);
    ctx.fillStyle='#1a1a1e';ctx.fillRect(0,0,W,ceilH);
    var cofX=Math.round(W*0.15),cofW=Math.round(W*0.7),cofY=4,cofH2=ceilH-8;
    ctx.fillStyle='#222228';ctx.fillRect(cofX,cofY,cofW,cofH2);
    ctx.strokeStyle='#2a2a32';ctx.lineWidth=2;ctx.strokeRect(cofX,cofY,cofW,cofH2);
    var stripY=ceilH-4;
    var ledGrad=ctx.createLinearGradient(0,stripY-20,0,stripY+2);
    ledGrad.addColorStop(0,'rgba(255,248,220,0)');ledGrad.addColorStop(0.6,'rgba(255,248,220,0.18)');ledGrad.addColorStop(1,'rgba(255,248,220,0.45)');
    ctx.fillStyle=ledGrad;ctx.fillRect(0,stripY-20,W,24);
    ctx.fillStyle='rgba(255,250,230,0.9)';ctx.fillRect(0,stripY,W,2);
    [W*0.3,W*0.5,W*0.7].forEach(function(lx){ctx.fillStyle='rgba(255,248,220,0.15)';ctx.beginPath();ctx.arc(lx,ceilH*0.5,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,248,220,0.7)';ctx.beginPath();ctx.arc(lx,ceilH*0.5,3,0,Math.PI*2);ctx.fill();});
    var wallTop=ceilH,wallBot=floor;
    var panelW=Math.round(W*0.28);
    var lwGrad=ctx.createLinearGradient(0,0,panelW,0);
    lwGrad.addColorStop(0,'#1a1510');lwGrad.addColorStop(0.4,'#221c14');lwGrad.addColorStop(1,'rgba(28,22,16,0)');
    ctx.fillStyle=lwGrad;ctx.fillRect(0,wallTop,panelW,wallBot-wallTop);
    ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1;
    for(var pvx=20;pvx<panelW;pvx+=28){ctx.beginPath();ctx.moveTo(pvx,wallTop);ctx.lineTo(pvx,wallBot);ctx.stroke();}
    var rwStart=W-Math.round(W*0.22);
    var rwGrad=ctx.createLinearGradient(rwStart,0,W,0);
    rwGrad.addColorStop(0,'rgba(220,225,230,0)');rwGrad.addColorStop(0.3,'rgba(220,225,230,0.55)');rwGrad.addColorStop(1,'rgba(235,240,245,0.85)');
    ctx.fillStyle=rwGrad;ctx.fillRect(rwStart,wallTop,W-rwStart,wallBot-wallTop);
    ctx.strokeStyle='rgba(180,190,200,0.3)';ctx.lineWidth=1;
    for(var cf=rwStart+18;cf<W;cf+=18){ctx.beginPath();ctx.moveTo(cf,wallTop);ctx.lineTo(cf,wallBot);ctx.stroke();}
    var backL=panelW,backR=rwStart;
    ctx.fillStyle='#2e2e34';ctx.fillRect(backL,wallTop,backR-backL,wallBot-wallTop);
    ctx.fillStyle='rgba(255,255,255,0.02)';
    for(var wy2=wallTop;wy2<wallBot;wy2+=12){ctx.fillRect(backL,wy2,backR-backL,1);}
    var tvW=Math.round((backR-backL)*0.3),tvH=Math.round(tvW*0.55);
    var tvX=Math.round((backL+backR)/2-tvW/2),tvY=Math.round(wallTop+(wallBot-wallTop)*0.12);
    ctx.fillStyle='#0a0a0a';ctx.fillRect(tvX,tvY,tvW,tvH);
    ctx.strokeStyle='#3a3a3a';ctx.lineWidth=2;ctx.strokeRect(tvX,tvY,tvW,tvH);
    var tvGlow=ctx.createRadialGradient(tvX+tvW/2,tvY+tvH/2,2,tvX+tvW/2,tvY+tvH/2,tvW*0.6);
    tvGlow.addColorStop(0,'rgba(40,80,180,0.12)');tvGlow.addColorStop(1,'rgba(40,80,180,0)');
    ctx.fillStyle=tvGlow;ctx.fillRect(tvX,tvY,tvW,tvH);
    ctx.fillStyle='#222';ctx.fillRect(tvX+tvW/2-2,tvY+tvH,4,8);ctx.fillRect(tvX+tvW/2-10,tvY+tvH+8,20,3);
    var apH=Math.round(tvH*0.9),apW=Math.round(tvW*0.35),apY=tvY+Math.round(tvH*0.05);
    var apLX=tvX-apW-18;
    ctx.fillStyle='#5c3d18';ctx.fillRect(apLX,apY,apW,apH);
    ctx.strokeStyle='#7a5530';ctx.lineWidth=1.5;ctx.strokeRect(apLX,apY,apW,apH);
    var apRX=tvX+tvW+18;
    ctx.fillStyle='#5c3d18';ctx.fillRect(apRX,apY,apW,apH);
    ctx.strokeStyle='#7a5530';ctx.lineWidth=1.5;ctx.strokeRect(apRX,apY,apW,apH);
    var tBotY=floor,tH_face=28,tTopY=tBotY-tH_face,tSurfH=14,tSurfTopY=tTopY-tSurfH;
    var tFrontL=Math.round(W*0.08),tFrontR=Math.round(W*0.92),tBackY2=tSurfTopY-12,tBackL=Math.round(W*0.18),tBackR=Math.round(W*0.82);
    var tDark='#1e1810',tMid2='#2a2016',tLight='#3a2c1c';
    function trap(x1,y1,x2,y2,x3,y3,x4,y4,fill,stroke,lw){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.lineTo(x4,y4);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}}
    trap(tFrontL,tSurfTopY,tFrontR,tSurfTopY,tBackR,tBackY2,tBackL,tBackY2,tLight,tDark,0.5);
    trap(tFrontL,tSurfTopY,tFrontR,tSurfTopY,tFrontR,tBotY,tFrontL,tBotY,tMid2,tDark,0.5);
    trap(tFrontL,tSurfTopY,tBackL,tBackY2,tBackL,tBackY2+tH_face+tSurfH,tFrontL,tBotY,tDark,'#111',0.5);
    trap(tFrontR,tSurfTopY,tBackR,tBackY2,tBackR,tBackY2+tH_face+tSurfH,tFrontR,tBotY,tDark,'#111',0.5);
    var chairPositions=[0.18,0.30,0.42,0.58,0.70,0.82];
    chairPositions.forEach(function(xf){var cx=Math.round(W*xf),cy=floor+6;ctx.fillStyle='#1a1a1e';ctx.beginPath();ctx.ellipse(cx,cy-18,11,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(cx-9,cy-18,18,22);ctx.beginPath();ctx.ellipse(cx,cy,14,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#252525';ctx.fillRect(cx-14,cy-10,3,10);ctx.fillRect(cx+11,cy-10,3,10);});
    var floorGrad=ctx.createLinearGradient(0,floor,0,H);
    floorGrad.addColorStop(0,'rgba(255,248,220,0.06)');floorGrad.addColorStop(0.3,'rgba(0,0,0,0)');
    ctx.fillStyle=floorGrad;ctx.fillRect(0,floor,W,H-floor);
  },

  _drawPlayground(ctx,W,H) {
    ctx.fillStyle='#0a1a2e';ctx.fillRect(0,0,W,H);
    [[80,40,90],[220,25,70],[420,50,100],[580,30,80],[750,45,60]].forEach(function(c){ctx.fillStyle='rgba(180,210,255,0.12)';ctx.beginPath();ctx.arc(c[0],c[1],c[2]*0.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(c[0]+c[2]*0.3,c[1]+5,c[2]*0.35,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(c[0]-c[2]*0.3,c[1]+8,c[2]*0.3,0,Math.PI*2);ctx.fill();});
    var tc=['#2d8a2d','#3aaa3a','#1a6a1a','#44bb44'];
    [[60,H-FLOOR_H],[160,H-FLOOR_H],[W-80,H-FLOOR_H],[W-200,H-FLOOR_H]].forEach(function(t,ti){ctx.fillStyle='#6b3a1a';ctx.fillRect(t[0]-4,t[1]-35,8,35);ctx.fillStyle=tc[ti%tc.length];ctx.fillRect(t[0]-18,t[1]-55,36,20);ctx.fillRect(t[0]-14,t[1]-70,28,18);ctx.fillRect(t[0]-10,t[1]-82,20,14);ctx.fillStyle='rgba(150,255,150,0.3)';ctx.fillRect(t[0]-10,t[1]-68,10,8);});
    [{x:120,y:H-FLOOR_H-8,c:'#ff4444',s:10},{x:300,y:H-FLOOR_H-6,c:'#4444ff',s:8},{x:480,y:H-FLOOR_H-9,c:'#ffaa00',s:11},{x:650,y:H-FLOOR_H-7,c:'#aa44ff',s:9}].forEach(function(sh){ctx.fillStyle=sh.c;ctx.beginPath();ctx.arc(sh.x,sh.y,sh.s,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(sh.x-sh.s*0.3,sh.y-sh.s*0.3,sh.s*0.3,0,Math.PI*2);ctx.fill();});
    for(var hx=W/2-80;hx<W/2+80;hx+=36){ctx.strokeStyle='rgba(255,200,50,0.25)';ctx.lineWidth=2;ctx.strokeRect(hx,H-FLOOR_H-2,32,20);}
  },

  _drawClassroom(ctx, W, H) {
    var floor = H - FLOOR_H;
    // Sky / ceiling — warm classroom light
    var skyGrad = ctx.createLinearGradient(0, 0, 0, floor);
    skyGrad.addColorStop(0, '#0d1118');
    skyGrad.addColorStop(1, '#1a1f10');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, floor);

    // Back wall — warm plaster
    ctx.fillStyle = '#1e1c12';
    ctx.fillRect(0, 0, W, floor);

    // Windows left and right — daylight spilling in
    var winW = Math.round(W * 0.10), winH = Math.round((floor) * 0.45), winY = Math.round(floor * 0.08);
    [[Math.round(W * 0.04)], [Math.round(W * 0.86)]].forEach(function(wx) {
      ctx.fillStyle = '#1a2840';
      ctx.fillRect(wx[0], winY, winW, winH);
      // Window panes
      ctx.strokeStyle = '#2a3a50'; ctx.lineWidth = 2;
      ctx.strokeRect(wx[0], winY, winW, winH);
      ctx.beginPath(); ctx.moveTo(wx[0] + winW/2, winY); ctx.lineTo(wx[0] + winW/2, winY + winH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx[0], winY + winH/2); ctx.lineTo(wx[0] + winW, winY + winH/2); ctx.stroke();
      // Light spill
      var spill = ctx.createRadialGradient(wx[0] + winW/2, winY + winH/2, 0, wx[0] + winW/2, winY + winH/2, winW * 2);
      spill.addColorStop(0, 'rgba(180,210,255,0.07)');
      spill.addColorStop(1, 'rgba(180,210,255,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(0, 0, W, floor);
      // Curtains
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(wx[0] - 8, winY - 4, 10, winH + 8);
      ctx.fillRect(wx[0] + winW - 2, winY - 4, 10, winH + 8);
    });

    // Chalkboard — centre back wall, the star of the room
    var cbX = Math.round(W * 0.18), cbW = Math.round(W * 0.64);
    var cbY = Math.round(floor * 0.05), cbH = Math.round(floor * 0.52);
    // Board frame (dark wood)
    ctx.fillStyle = '#2a1a08';
    ctx.fillRect(cbX - 10, cbY - 8, cbW + 20, cbH + 16);
    ctx.strokeStyle = '#3a2810'; ctx.lineWidth = 3;
    ctx.strokeRect(cbX - 10, cbY - 8, cbW + 20, cbH + 16);
    // Board surface — deep slate green
    var boardGrad = ctx.createLinearGradient(cbX, cbY, cbX + cbW, cbY + cbH);
    boardGrad.addColorStop(0, '#1a2e1a');
    boardGrad.addColorStop(0.5, '#1e3320');
    boardGrad.addColorStop(1, '#182818');
    ctx.fillStyle = boardGrad;
    ctx.fillRect(cbX, cbY, cbW, cbH);
    // Board texture — subtle grain
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (var gy = cbY; gy < cbY + cbH; gy += 4) ctx.fillRect(cbX, gy, cbW, 1);
    // Chalk residue / ghost marks
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    var ghostPhrases = [
      {x:0.12, y:0.2, w:0.35, h:0.03},
      {x:0.08, y:0.45, w:0.25, h:0.025},
      {x:0.5,  y:0.3, w:0.4,  h:0.025},
    ];
    ghostPhrases.forEach(function(g) {
      ctx.fillRect(cbX + g.x * cbW, cbY + g.y * cbH, g.w * cbW, g.h * cbH);
    });
    // Board edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.strokeRect(cbX + 2, cbY + 2, cbW - 4, cbH - 4);
    // Chalk tray
    ctx.fillStyle = '#2a1a08';
    ctx.fillRect(cbX - 10, cbY + cbH + 8, cbW + 20, 8);
    ctx.fillStyle = '#fffde0';
    for (var ci = 0; ci < 5; ci++) {
      ctx.fillRect(cbX + 15 + ci * 28, cbY + cbH + 10, 20, 4);
    }
    // Eraser
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(cbX + cbW - 50, cbY + cbH + 9, 36, 6);

    // Overhead strip lights
    var lightY = 8;
    [W * 0.25, W * 0.5, W * 0.75].forEach(function(lx) {
      ctx.fillStyle = 'rgba(255,250,220,0.7)';
      ctx.fillRect(lx - 30, lightY, 60, 4);
      var lg = ctx.createRadialGradient(lx, lightY + 2, 0, lx, lightY + 50, 80);
      lg.addColorStop(0, 'rgba(255,250,220,0.12)');
      lg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(lx - 80, lightY, 160, 100);
    });

    // Student desks — two rows
    var deskColor = '#3a2a10', deskTop = '#4a3618', deskShadow = '#2a1c08';
    var deskPositions = [0.12, 0.28, 0.44, 0.60, 0.76, 0.90];
    // Back row (smaller, higher up = further away)
    deskPositions.forEach(function(xf) {
      var dx = Math.round(W * xf - 20), dy = floor - 28;
      var dw = 42, dh = 10;
      ctx.fillStyle = deskShadow; ctx.fillRect(dx + 3, dy + dh, dw - 6, 4);
      ctx.fillStyle = deskColor;  ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = deskTop;    ctx.fillRect(dx + 2, dy, dw - 4, dh - 3);
      // Legs
      ctx.fillStyle = deskShadow;
      ctx.fillRect(dx + 4,  dy + dh, 4, 12);
      ctx.fillRect(dx + dw - 8, dy + dh, 4, 12);
    });

    // Teacher's desk — front left, larger
    var tdX = Math.round(W * 0.04), tdY = floor - 32, tdW = 80, tdH = 14;
    ctx.fillStyle = '#1e1208'; ctx.fillRect(tdX + 4, tdY + tdH, tdW - 8, 6);
    ctx.fillStyle = '#2e1e0a'; ctx.fillRect(tdX, tdY, tdW, tdH);
    ctx.fillStyle = '#3a280e'; ctx.fillRect(tdX + 2, tdY, tdW - 4, tdH - 4);
    ctx.fillStyle = '#1e1208';
    ctx.fillRect(tdX + 6,  tdY + tdH, 5, 16);
    ctx.fillRect(tdX + tdW - 11, tdY + tdH, 5, 16);
    // Mug on teacher's desk
    ctx.fillStyle = '#cc3322'; ctx.fillRect(tdX + tdW - 22, tdY - 8, 10, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(tdX + tdW - 21, tdY - 7, 8, 3);

    // Floor — warm worn wood
    var floorGrad = ctx.createLinearGradient(0, floor, 0, H);
    floorGrad.addColorStop(0, 'rgba(255,220,160,0.08)');
    floorGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floor, W, H - floor);
    // Floor planks
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    for (var px = 0; px < W; px += Math.round(W / 10)) {
      ctx.beginPath(); ctx.moveTo(px, floor); ctx.lineTo(px, H); ctx.stroke();
    }
  },

  setMeetingMode(on) { this.meetingMode = on; this.render(); },

  render() {
    this._clearTimers();
    // Destroy existing renderers
    Object.values(this.renderers).forEach(function(r){ r.destroy(); });
    this.renderers = {};
    this.charsLayer.innerHTML = '';
    // Refresh artifacts layer
    if (typeof WorldObjects !== 'undefined') WorldObjects.render();

    var team = App.state.team;
    if (!team.length) return;
    var W = this.container.getBoundingClientRect().width || this.container.offsetWidth || 700;
    if (W < 100) { var self = this; requestAnimationFrame(function(){ self.render(); }); return; }

    var forwardIds = Chat.forwardIds;
    if (!forwardIds.length) return;

    var stageMembers = forwardIds.map(function(id) {
      return team.find(function(m){ return m.id === id; });
    }).filter(Boolean);

    var basePositions = this._calcPositions(forwardIds, W);

    stageMembers.forEach(function(member, i) {
      var isTalking    = Chat.talkingIds ? Chat.talkingIds.indexOf(member.id) !== -1 : Chat.talkingId === member.id;
      var isHandRaised = Chat.handRaisedIds.indexOf(member.id) !== -1;
      var colorIdx     = member.colorIdx % 12;

      var claudeBonus  = (colorIdx === CLAUDE_COLOR_IDX) ? CLAUDE_SCALE_BONUS : 0;
      var displayScale = (isTalking ? ACTIVE_PX : IDLE_PX) + claudeBonus;
      var displayW     = Math.round(SPRITE_FRAME * displayScale);
      var displayH     = Math.round(SPRITE_FRAME * displayScale);

      // Wander state
      var newBase = basePositions[i];
      if (!World.wanderState[member.id]) {
        World.wanderState[member.id] = { x: newBase, targetX: newBase, dir: 1, moving: false, base: newBase };
      } else {
        var ws = World.wanderState[member.id];
        var delta = newBase - ws.base;
        ws.base = newBase;
        if (Math.abs(delta) > 2) {
          ws.x = Math.max(40, Math.min(W - 80, ws.x + delta));
          ws.targetX = Math.max(40, Math.min(W - 80, ws.targetX + delta));
        }
      }
      var wx = isTalking ? newBase : World.wanderState[member.id].x;

      // Canvas
      var c = document.createElement('canvas');
      c.id     = 'canvas-' + member.id;
      c.width  = SPRITE_FRAME;
      c.height = SPRITE_FRAME;
      c.style.cssText = 'width:' + displayW + 'px;height:' + displayH + 'px;image-rendering:pixelated;display:block;';

      // Sprite renderer
      var renderer = new SpriteRenderer(colorIdx, c);
      World.renderers[member.id] = renderer;

      // Initial animation — front for talker, down for others
      renderer.still('idle', isTalking ? DIR.FRONT : DIR.FRONT);

      // Wrapper
      var wrapper = document.createElement('div');
      wrapper.id        = 'char-' + member.id;
      wrapper.className = 'character' + (isTalking ? ' selected' : '');
      var glow = isTalking
        ? ';filter:drop-shadow(0 0 10px rgba(255,204,68,0.9)) drop-shadow(0 0 4px rgba(255,204,68,0.6))'
        : '';
      wrapper.style.cssText =
        'position:absolute;left:' + Math.round(wx) + 'px;bottom:' + FLOOR_H + 'px;' +
        'width:' + displayW + 'px;height:' + displayH + 'px;' +
        'z-index:' + (isTalking ? 20 : 10) + ';' +
        'opacity:1;overflow:visible;cursor:pointer' + glow + ';';
      wrapper.appendChild(c);

      // Name label
      var nameEl = document.createElement('div');
      nameEl.className = 'char-name';
      nameEl.style.cssText =
        'position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);' +
        'white-space:nowrap;font-size:calc(6px * var(--ui-scale));' +
        'color:' + (isTalking ? '#ffcc44' : '#88aaff') + ';pointer-events:none;';
      nameEl.textContent = member.name;
      wrapper.appendChild(nameEl);

      // Hand raise — clickable, animated
      if (isHandRaised) {
        var hand = document.createElement('div');
        hand.className = 'char-hand';
        // CSS handles position/animation; override pointer-events so it's clickable
        hand.style.pointerEvents = 'all';
        hand.textContent = '✋';
        hand.title = 'Click to let ' + member.name.split(' ')[0] + ' speak';
        hand.addEventListener('click', (function(hid) { return function(e) {
          e.stopPropagation();
          Chat.speakHandRaised(hid);
        }; })(member.id));
        wrapper.appendChild(hand);
      }

      wrapper.addEventListener('click', function(e) {
        e.stopPropagation();
        World.selectChar(member.id);
      });
      World.charsLayer.appendChild(wrapper);

      // Start wander for non-talking characters
      if (!isTalking) {
        World._startWander(member.id, renderer, newBase, W);
      }
    });
  },

  _startWander(id, renderer, baseX, W) {
    var state = this.wanderState[id] || { x: baseX, targetX: baseX, dir: 1, moving: false, base: baseX };
    state.base = baseX;
    this.wanderState[id] = state;

    var MOVE_MS  = 16;
    var SPEED    = 0.05;   // px per ms
    var lastTime = Date.now();

    // Random idle behaviours
    var _scheduleIdleBehaviour = function() {
      var delay = 4000 + Math.random() * 8000;
      World.animTimers[id + '_idle_behaviour'] = setTimeout(function() {
        if (!document.getElementById('char-' + id)) return;
        if (!state.moving) {
          // Occasionally sit
          var r = Math.random();
          if (r < 0.3) {
            renderer.still('idle', DIR.FRONT);  // face front
            setTimeout(function() {
              if (document.getElementById('char-' + id) && !state.moving) {
                renderer.still('idle', DIR.FRONT);
              }
            }, 2000 + Math.random() * 3000);
          }
        }
        _scheduleIdleBehaviour();
      }, delay);
    };

    var pickTarget = function() {
      // 70% of the time just stand still for a while
      if (Math.random() < 0.7) {
        World.animTimers[id + '_still'] = setTimeout(function() {
          if (document.getElementById('char-' + id)) pickTarget();
        }, 4000 + Math.random() * 8000);
        return;
      }
      // Walk to a random position anywhere across the full stage width
      var target = 40 + Math.random() * (W - 120);
      state.targetX = target;
      state.dir     = state.targetX > state.x ? 1 : -1;
      state.moving  = true;
      renderer.switchAnim('walk', state.dir > 0 ? DIR.FRONT : DIR.LEFT);
    };

    // Start idle loop
    renderer.still('idle', DIR.FRONT);

    var moveTimer = setInterval(function() {
      var wrapper = document.getElementById('char-' + id);
      if (!wrapper) { clearInterval(moveTimer); return; }

      var now = Date.now();
      var dt  = Math.min(now - lastTime, 50);
      lastTime = now;

      if (state.moving) {
        var diff    = state.targetX - state.x;
        var absDiff = Math.abs(diff);
        if (absDiff < 1) {
          state.x = state.targetX;
          state.moving = false;
          wrapper.style.left = Math.round(state.x) + 'px';
          // Arrive — face front
          renderer.still('idle', DIR.FRONT);
          var stillTimer = setTimeout(function() {
            if (document.getElementById('char-' + id)) pickTarget();
          }, 5000 + Math.random() * 10000);
          World.animTimers[id + '_still'] = stillTimer;
        } else {
          var maxStep = SPEED * dt;
          if (absDiff < 15) maxStep = Math.max(maxStep * (absDiff / 15), 0.1);
          state.x += Math.min(absDiff, maxStep) * state.dir;
          wrapper.style.left = Math.round(state.x) + 'px';
        }
      }
    }, MOVE_MS);

    World.animTimers[id + '_move']  = moveTimer;
    var pauseTimer = setTimeout(function() {
      if (document.getElementById('char-' + id)) pickTarget();
    }, 2000 + Math.random() * 5000);
    World.animTimers[id + '_pause'] = pauseTimer;
    _scheduleIdleBehaviour();
  },

  // Play an action animation on a character
  playCharAction(id, actionName) {
    var renderer = this.renderers[id];
    if (!renderer) return;
    // Map old action names to animations
    var animName = ACTION_ANIM_MAP[actionName] || 'spellcast';
    // Pause wander movement briefly
    clearInterval(this.animTimers[id + '_move']);
    clearTimeout(this.animTimers[id + '_pause']);
    clearTimeout(this.animTimers[id + '_still']);
    var member = App.state.team.find(function(m){ return m.id === id; });
    if (!member) return;
    var W = World.container ? (World.container.getBoundingClientRect().width || World.container.offsetWidth || 700) : 700;
    var ws = World.wanderState[id];
    var base = ws ? ws.base : W / 2;
    renderer.playOnce(animName, function() {
      // Restart wander if not talking
      if (Chat.forwardIds.indexOf(id) !== -1 && Chat.talkingId !== id) {
        World._startWander(id, renderer, base, W);
      } else {
        renderer.still('idle', DIR.FRONT);
      }
    });
  },

  selectChar(id) {
    var wasForward = Chat.forwardIds.indexOf(id) !== -1;
    if (!wasForward) {
      Chat.forwardIds.push(id);
      Chat.talkingId  = id;
      if (!Chat.talkingIds) Chat.talkingIds = [];
      if (Chat.talkingIds.indexOf(id) === -1) Chat.talkingIds = [id];
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x !== id; });
      Chat._saveStage();
      World.render();
      Chat.openPanel();
    } else {
      Chat.talkingId = id;
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x !== id; });
      Chat.openPanel();
      World.refresh();
    }
    var m = App.state.team.find(function(m){ return m.id === id; });
    App.setStatus('talking to ' + (m ? m.name : '...'));
    if (typeof Roster !== 'undefined') Roster.render();
  },

  deselectAll() {
    document.querySelectorAll('.character').forEach(function(c){ c.classList.remove('selected'); });
    if (typeof Roster !== 'undefined') Roster.render();
  },

  toggleStage(id) {
    var idx = Chat.forwardIds.indexOf(id);
    if (idx !== -1) {
      Chat.forwardIds.splice(idx, 1);
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x !== id; });
      if (Chat.talkingId === id) {
        Chat.talkingId = Chat.forwardIds.length ? Chat.forwardIds[0] : null;
      }
      if (!Chat.forwardIds.length) Chat.closePanel();
      else Chat.renderPanel();
    } else {
      Chat.forwardIds.push(id);
      if (!Chat.talkingId) Chat.talkingId = id;
      Chat.openPanel();
    }
    Chat._saveStage();
    World.render();
    App.setStatus(Chat.forwardIds.length
      ? Chat.forwardIds.length + ' on stage'
      : 'stage is empty — use TEAM to summon someone');
    if (typeof Roster !== 'undefined') Roster.render();
  },

  _calcPositions(ids, W) {
    var count = ids.length;
    if (count === 0) return [];
    var drawerOpen = document.getElementById('roster-drawer') &&
                     document.getElementById('roster-drawer').classList.contains('open');
    var effectiveW = Math.max((drawerOpen ? W - 225 : W), 200);
    var charW      = Math.round(SPRITE_FRAME * IDLE_PX);
    var totalNeeded = count * charW;
    var margin = Math.max(40, Math.round((effectiveW - totalNeeded) / 2));
    margin = Math.min(margin, Math.round(effectiveW * 0.15));
    var usable = effectiveW - margin * 2;
    if (count === 1) return [Math.round(effectiveW / 2 - charW / 2)];
    return Array.from({length: count}, function(_, i) {
      return Math.round(margin + (usable / (count - 1)) * i - charW / 2);
    });
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(function(t) {
      if (typeof t === 'number') { clearInterval(t); clearTimeout(t); }
    });
    this.animTimers = {};
  },

  // ── Keyboard control ────────────────────────────────────────────────────────
  _keysHeld:    {},
  _keyTimer:    null,
  _jumpActive:  false,
  _duckActive:  false,

  initKeyboard() {
    var self = this;

    document.addEventListener('keydown', function(e) {
      // Don't hijack typing in chat input or any text field
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      self._keysHeld[e.key] = true;
      if (!self._keyTimer) self._startKeyLoop();
      // Trigger up/down immediately on keydown
      if (e.key === 'ArrowUp')   self._doJump();
      if (e.key === 'ArrowDown') self._doDuck();
    });

    document.addEventListener('keyup', function(e) {
      delete self._keysHeld[e.key];
      if (e.key === 'ArrowDown') self._unduck();
      if (Object.keys(self._keysHeld).filter(function(k){ return k.startsWith('Arrow'); }).length === 0) {
        self._stopKeyLoop();
        self._stopWalkAnim();
      }
    });
  },

  _getControlledId() {
    // Controlled character = active talker, or first forward character
    return Chat.talkingId || (Chat.forwardIds && Chat.forwardIds[0]) || null;
  },

  _startKeyLoop() {
    var self = this;
    var STEP = 3; // px per tick
    this._keyTimer = setInterval(function() {
      var id = self._getControlledId();
      if (!id) return;
      var wrapper = document.getElementById('char-' + id);
      if (!wrapper) return;
      var W = self.container ? (self.container.offsetWidth || 700) : 700;

      if (self._keysHeld['ArrowLeft'] || self._keysHeld['ArrowRight']) {
        var dir = self._keysHeld['ArrowRight'] ? 1 : -1;
        var ws  = self.wanderState[id];
        // Pause wander timers so they don't fight keyboard control
        if (self.animTimers[id + '_move']) {
          clearInterval(self.animTimers[id + '_move']);
          self.animTimers[id + '_move'] = null;
        }
        clearTimeout(self.animTimers[id + '_still']);
        clearTimeout(self.animTimers[id + '_pause']);
        if (ws) ws.moving = false;
        var curX = ws ? ws.x : parseInt(wrapper.style.left) || 0;
        var newX = Math.max(0, Math.min(W - 80, curX + dir * STEP));

        if (ws) { ws.x = newX; ws.moving = false; }
        wrapper.style.left = Math.round(newX) + 'px';

        // Walk animation in direction of movement (don't interrupt jump)
        if (!self._jumpActive && !self._duckActive) {
          var renderer = self.renderers[id];
          if (renderer) renderer.switchAnim('walk', dir > 0 ? DIR.FRONT : DIR.LEFT);
        }
      }
    }, 16); // ~60fps
  },

  _stopKeyLoop() {
    if (this._keyTimer) { clearInterval(this._keyTimer); this._keyTimer = null; }
  },

  _stopWalkAnim() {
    if (this._jumpActive || this._duckActive) return;
    var id = this._getControlledId();
    var renderer = id && this.renderers[id];
    if (renderer) renderer.still('idle', DIR.FRONT);
  },

  _doJump() {
    if (this._jumpActive) return;
    var id = this._getControlledId();
    var wrapper = id && document.getElementById('char-' + id);
    var renderer = id && this.renderers[id];
    if (!wrapper || !renderer) return;

    this._jumpActive = true;
    renderer.switchAnim('action', DIR.FRONT);

    // CSS jump arc — translateY up then back down
    var startBottom = parseInt(wrapper.style.bottom) || FLOOR_H;
    var peak = 60; // px to jump
    var duration = 400; // ms
    var start = null;
    var self = this;

    function jumpFrame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts - start) / duration, 1);
      // Sine arc: 0 → peak → 0
      var offset = Math.round(Math.sin(t * Math.PI) * peak);
      wrapper.style.bottom = (startBottom + offset) + 'px';
      if (t < 1) {
        requestAnimationFrame(jumpFrame);
      } else {
        wrapper.style.bottom = startBottom + 'px';
        self._jumpActive = false;
        if (!self._keysHeld['ArrowLeft'] && !self._keysHeld['ArrowRight']) {
          renderer.still('idle', DIR.FRONT);
        }
      }
    }
    requestAnimationFrame(jumpFrame);
  },

  _doDuck() {
    if (this._duckActive) return;
    var id = this._getControlledId();
    var wrapper = id && document.getElementById('char-' + id);
    var renderer = id && this.renderers[id];
    if (!wrapper || !renderer) return;

    this._duckActive = true;
    // Duck = face down direction and squish with CSS scaleY
    renderer.still('idle', DIR.FRONT);
    wrapper.style.transform = 'scaleY(0.55) translateY(45%)';
    wrapper.style.transformOrigin = 'bottom center';
  },

  _unduck() {
    this._duckActive = false;
    var id = this._getControlledId();
    var wrapper = id && document.getElementById('char-' + id);
    if (wrapper) wrapper.style.transform = '';
    if (!this._keysHeld['ArrowLeft'] && !this._keysHeld['ArrowRight']) {
      this._stopWalkAnim();
    }
  },

  refresh() {
    var team = App.state.team;
    if (!team || !this.charsLayer) return;
    Chat.forwardIds.forEach(function(id) {
      var wrapper = document.getElementById('char-' + id);
      if (!wrapper) return;
      var isTalking    = Chat.talkingIds ? Chat.talkingIds.indexOf(id) !== -1 : Chat.talkingId === id;
      var isHandRaised = Chat.handRaisedIds.indexOf(id) !== -1;
      var member       = team.find(function(m){ return m.id === id; });
      if (!member) return;

      wrapper.style.filter = isTalking
        ? 'drop-shadow(0 0 10px rgba(255,204,68,0.9)) drop-shadow(0 0 4px rgba(255,204,68,0.6))'
        : '';
      wrapper.style.zIndex = isTalking ? '20' : '10';
      wrapper.classList.toggle('selected', isTalking);

      var claudeBonus  = (member.colorIdx % 12 === CLAUDE_COLOR_IDX) ? CLAUDE_SCALE_BONUS : 0;
      var displayScale = (isTalking ? ACTIVE_PX : IDLE_PX) + claudeBonus;
      var displayW = Math.round(SPRITE_FRAME * displayScale);
      var displayH = Math.round(SPRITE_FRAME * displayScale);
      var canvas = document.getElementById('canvas-' + id);
      if (canvas) {
        canvas.style.width  = displayW + 'px';
        canvas.style.height = displayH + 'px';
      }
      wrapper.style.width  = displayW + 'px';
      wrapper.style.height = displayH + 'px';

      var nameEl = wrapper.querySelector('.char-name');
      if (nameEl) nameEl.style.color = isTalking ? '#ffcc44' : '#88aaff';

      var existingHand = wrapper.querySelector('.char-hand');
      if (isHandRaised && !existingHand) {
        var hand = document.createElement('div');
        hand.className = 'char-hand';
        hand.style.pointerEvents = 'all';
        hand.textContent = '✋';
        hand.title = 'Click to let ' + (member ? member.name.split(' ')[0] : '') + ' speak';
        hand.addEventListener('click', (function(hid) { return function(e) {
          e.stopPropagation();
          Chat.speakHandRaised(hid);
        }; })(id));
        wrapper.appendChild(hand);
      } else if (!isHandRaised && existingHand) {
        existingHand.remove();
      }
    });
    if (typeof Roster !== 'undefined') Roster.render();
  }
};



