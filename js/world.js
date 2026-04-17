// js/world.js — procedural pixel-art character rendering
// v2.16 — optional EnhancedCharRenderer for members with .enhanced flag

const IDLE_PX         = 1.8;
const ACTIVE_PX       = 2.2;
const FLOOR_H         = 58;
const CHAR_W          = 48;   // internal canvas size (px)
const CHAR_H          = 72;

// ── CharRenderer — procedural animated character canvas ──────────────────────
// pose:  0 = stand, 1 = walk-A, 2 = walk-B, 3 = talk, 4 = action/arm-up
// Animates by cycling frames via setInterval

function CharRenderer(member, canvas) {
  this.member  = member;
  this.canvas  = canvas;
  this.ctx     = canvas.getContext('2d');
  this._timer  = null;
  this._frame  = 0;
  this._anim   = 'idle';   // 'idle' | 'walk' | 'talk' | 'action'
  this._flip   = false;
  this._onDone = null;
  this._oneshotFrames = 0;
  this._oneshotDone   = false;

  // Compute role type and palette once
  this._roleType = detectRoleType(member.role || '');
  this._pal      = Object.assign(
    getRoleColors(this._roleType, member.colorIdx || 0),
    { roleType: this._roleType }
  );

  this._draw();
}

// Pose index for each animation frame
CharRenderer.ANIM_FRAMES = {
  idle:   [0, 0],                 // subtle bob — 2 frames, same pose
  walk:   [1, 0, 2, 0],          // walk-A, stand, walk-B, stand
  talk:   [3, 0, 3, 0],          // lean forward, back, repeat
  action: [4, 4, 4, 0, 0],       // arm up x3, return
};

CharRenderer.ANIM_FPS = {
  idle:   2,
  walk:   8,
  talk:   4,
  action: 7,
};

CharRenderer.prototype._draw = function() {
  var ctx = this.ctx;
  var W = CHAR_W, H = CHAR_H;
  ctx.clearRect(0, 0, W, H);

  var frames = CharRenderer.ANIM_FRAMES[this._anim] || [0];
  var frameIdx = this._frame % frames.length;
  var pose = frames[frameIdx];

  // Ghost floats — slight vertical offset
  var bobY = 0;
  if (this._anim === 'idle' && frameIdx === 0) bobY = 1;

  ctx.save();
  if (bobY) ctx.translate(0, bobY);
  drawPixelChar(ctx, this._pal, pose, { flip: this._flip, roleType: this._roleType });
  ctx.restore();
};

CharRenderer.prototype.startLoop = function() {
  this._stopLoop();
  var self = this;
  var fps = CharRenderer.ANIM_FPS[this._anim] || 4;
  var frames = CharRenderer.ANIM_FRAMES[this._anim] || [0];
  var totalFrames = frames.length;

  this._timer = setInterval(function() {
    self._frame = (self._frame + 1) % totalFrames;
    self._draw();

    // Oneshot — done when we loop back to start
    if (self._oneshotDone && self._frame === 0) {
      self._stopLoop();
      self._anim   = 'idle';
      self._frame  = 0;
      self._oneshotDone = false;
      self._draw();
      if (self._onDone) { var cb = self._onDone; self._onDone = null; cb(); }
    }
    if (self._oneshotDone && self._frame === totalFrames - 1) {
      self._oneshotDone = true; // catch next loop
    }
  }, Math.round(1000 / fps));
};

CharRenderer.prototype._stopLoop = function() {
  if (this._timer) { clearInterval(this._timer); this._timer = null; }
};

CharRenderer.prototype.still = function() {
  this._stopLoop();
  this._anim  = 'idle';
  this._frame = 0;
  this._oneshotDone = false;
  this._draw();
};

CharRenderer.prototype.switchAnim = function(animName, flip) {
  this._stopLoop();
  this._anim  = animName;
  this._frame = 0;
  if (flip !== undefined) this._flip = !!flip;
  this._oneshotDone = false;
  this._draw();
  this.startLoop();
};

CharRenderer.prototype.playOnce = function(animName, onDone) {
  this._stopLoop();
  this._anim        = animName;
  this._frame       = 0;
  this._onDone      = onDone || null;
  this._oneshotDone = false;
  this._draw();
  // mark that after one full cycle we stop
  var frames = CharRenderer.ANIM_FRAMES[animName] || [0];
  var self = this;
  var count = 0;
  var total = frames.length;
  var fps   = CharRenderer.ANIM_FPS[animName] || 7;
  this._timer = setInterval(function() {
    count++;
    self._frame = count % total;
    self._draw();
    if (count >= total) {
      self._stopLoop();
      self._anim  = 'idle';
      self._frame = 0;
      self._draw();
      if (self._onDone) { var cb = self._onDone; self._onDone = null; cb(); }
    }
  }, Math.round(1000 / fps));
};

CharRenderer.prototype.setFlip = function(flip) {
  if (this._flip === !!flip) return;
  this._flip = !!flip;
  this._draw();
};

CharRenderer.prototype.destroy = function() {
  this._stopLoop();
};

// ── World object ─────────────────────────────────────────────────────────────
const World = {
  container:    null,
  charsLayer:   null,
  animTimers:   {},
  wanderTimers: {},
  wanderState:  {},
  renderers:    {},   // id → CharRenderer
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
    var skyGrad = ctx.createLinearGradient(0, 0, 0, floor);
    skyGrad.addColorStop(0, '#0d1118');
    skyGrad.addColorStop(1, '#1a1f10');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, floor);
    ctx.fillStyle = '#1e1c12';
    ctx.fillRect(0, 0, W, floor);
    var winW = Math.round(W * 0.10), winH = Math.round((floor) * 0.45), winY = Math.round(floor * 0.08);
    [[Math.round(W * 0.04)], [Math.round(W * 0.86)]].forEach(function(wx) {
      ctx.fillStyle = '#1a2840';
      ctx.fillRect(wx[0], winY, winW, winH);
      ctx.strokeStyle = '#2a3a50'; ctx.lineWidth = 2;
      ctx.strokeRect(wx[0], winY, winW, winH);
      ctx.beginPath(); ctx.moveTo(wx[0] + winW/2, winY); ctx.lineTo(wx[0] + winW/2, winY + winH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx[0], winY + winH/2); ctx.lineTo(wx[0] + winW, winY + winH/2); ctx.stroke();
      var spill = ctx.createRadialGradient(wx[0] + winW/2, winY + winH/2, 0, wx[0] + winW/2, winY + winH/2, winW * 2);
      spill.addColorStop(0, 'rgba(180,210,255,0.07)');
      spill.addColorStop(1, 'rgba(180,210,255,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(0, 0, W, floor);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(wx[0] - 8, winY - 4, 10, winH + 8);
      ctx.fillRect(wx[0] + winW - 2, winY - 4, 10, winH + 8);
    });
    var cbX = Math.round(W * 0.18), cbW = Math.round(W * 0.64);
    var cbY = Math.round(floor * 0.05), cbH = Math.round(floor * 0.52);
    ctx.fillStyle = '#2a1a08';
    ctx.fillRect(cbX - 10, cbY - 8, cbW + 20, cbH + 16);
    ctx.strokeStyle = '#3a2810'; ctx.lineWidth = 3;
    ctx.strokeRect(cbX - 10, cbY - 8, cbW + 20, cbH + 16);
    var boardGrad = ctx.createLinearGradient(cbX, cbY, cbX + cbW, cbY + cbH);
    boardGrad.addColorStop(0, '#1a2e1a');
    boardGrad.addColorStop(0.5, '#1e3320');
    boardGrad.addColorStop(1, '#182818');
    ctx.fillStyle = boardGrad;
    ctx.fillRect(cbX, cbY, cbW, cbH);
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (var gy = cbY; gy < cbY + cbH; gy += 4) ctx.fillRect(cbX, gy, cbW, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    var ghostPhrases = [{x:0.12, y:0.2, w:0.35, h:0.03},{x:0.08, y:0.45, w:0.25, h:0.025},{x:0.5, y:0.3, w:0.4, h:0.025}];
    ghostPhrases.forEach(function(g) { ctx.fillRect(cbX + g.x * cbW, cbY + g.y * cbH, g.w * cbW, g.h * cbH); });
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.strokeRect(cbX + 2, cbY + 2, cbW - 4, cbH - 4);
    ctx.fillStyle = '#2a1a08';
    ctx.fillRect(cbX - 10, cbY + cbH + 8, cbW + 20, 8);
    ctx.fillStyle = '#fffde0';
    for (var ci = 0; ci < 5; ci++) { ctx.fillRect(cbX + 15 + ci * 28, cbY + cbH + 10, 20, 4); }
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(cbX + cbW - 50, cbY + cbH + 9, 36, 6);
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
    var deskColor = '#3a2a10', deskTop = '#4a3618', deskShadow = '#2a1c08';
    var deskPositions = [0.12, 0.28, 0.44, 0.60, 0.76, 0.90];
    deskPositions.forEach(function(xf) {
      var dx = Math.round(W * xf - 20), dy = floor - 28;
      var dw = 42, dh = 10;
      ctx.fillStyle = deskShadow; ctx.fillRect(dx + 3, dy + dh, dw - 6, 4);
      ctx.fillStyle = deskColor;  ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = deskTop;    ctx.fillRect(dx + 2, dy, dw - 4, dh - 3);
      ctx.fillStyle = deskShadow;
      ctx.fillRect(dx + 4,  dy + dh, 4, 12);
      ctx.fillRect(dx + dw - 8, dy + dh, 4, 12);
    });
    var tdX = Math.round(W * 0.04), tdY = floor - 32, tdW = 80, tdH = 14;
    ctx.fillStyle = '#1e1208'; ctx.fillRect(tdX + 4, tdY + tdH, tdW - 8, 6);
    ctx.fillStyle = '#2e1e0a'; ctx.fillRect(tdX, tdY, tdW, tdH);
    ctx.fillStyle = '#3a280e'; ctx.fillRect(tdX + 2, tdY, tdW - 4, tdH - 4);
    ctx.fillStyle = '#1e1208';
    ctx.fillRect(tdX + 6,  tdY + tdH, 5, 16);
    ctx.fillRect(tdX + tdW - 11, tdY + tdH, 5, 16);
    ctx.fillStyle = '#cc3322'; ctx.fillRect(tdX + tdW - 22, tdY - 8, 10, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(tdX + tdW - 21, tdY - 7, 8, 3);
    var floorGrad = ctx.createLinearGradient(0, floor, 0, H);
    floorGrad.addColorStop(0, 'rgba(255,220,160,0.08)');
    floorGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floor, W, H - floor);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    for (var px2 = 0; px2 < W; px2 += Math.round(W / 10)) {
      ctx.beginPath(); ctx.moveTo(px2, floor); ctx.lineTo(px2, H); ctx.stroke();
    }
  },

  setMeetingMode(on) { this.meetingMode = on; this.render(); },

  render() {
    this._clearTimers();
    Object.values(this.renderers).forEach(function(r){ r.destroy(); });
    this.renderers = {};
    this.charsLayer.innerHTML = '';
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

      var displayScale = isTalking ? ACTIVE_PX : IDLE_PX;
      var displayW     = Math.round(CHAR_W * displayScale);
      var displayH     = Math.round(CHAR_H * displayScale);

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

      // Canvas — size depends on whether enhanced renderer is active.
      // Enhanced needs extra pixels around the sprite for jump/tilt/squash.
      var useEnhanced = !!(member.enhanced && typeof EnhancedCharRenderer !== 'undefined');
      var pad = useEnhanced ? EnhancedCharRenderer.PAD : 0;
      var c = document.createElement('canvas');
      c.id     = 'canvas-' + member.id;
      c.width  = CHAR_W + pad * 2;
      c.height = CHAR_H + pad * 2;
      // CSS size scaled proportionally so visual sprite size stays consistent
      var cssW = displayW * (CHAR_W + pad * 2) / CHAR_W;
      var cssH = displayH * (CHAR_H + pad * 2) / CHAR_H;
      c.style.cssText = 'width:'+cssW+'px;height:'+cssH+'px;image-rendering:pixelated;display:block;' +
                        (pad ? 'margin-left:' + (-pad * displayW / CHAR_W) + 'px;margin-top:' + (-pad * displayH / CHAR_H) + 'px;' : '');

      // Choose renderer
      var RendererClass = useEnhanced ? EnhancedCharRenderer : CharRenderer;
      var renderer = new RendererClass(member, c);
      World.renderers[member.id] = renderer;
      renderer.still();

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

      // Role label (small, under name)
      if (member.role) {
        var roleEl = document.createElement('div');
        roleEl.className = 'char-role';
        roleEl.style.cssText =
          'position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);' +
          'white-space:nowrap;font-size:calc(5px * var(--ui-scale));' +
          'color:#556677;pointer-events:none;opacity:0.8;';
        roleEl.textContent = member.role;
        wrapper.appendChild(roleEl);
      }

      // Hand raise
      if (isHandRaised) {
        var hand = document.createElement('div');
        hand.className = 'char-hand';
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

      // Start animations
      if (isTalking) {
        renderer.switchAnim('talk', false);
      } else {
        World._startWander(member.id, renderer, newBase, W);
      }
    });
  },

  _startWander(id, renderer, baseX, W) {
    var state = this.wanderState[id] || { x: baseX, targetX: baseX, dir: 1, moving: false, base: baseX };
    state.base = baseX;
    this.wanderState[id] = state;

    var MOVE_MS = 16;
    var SPEED   = 0.05;
    var lastTime = Date.now();

    var pickTarget = function() {
      if (Math.random() < 0.65) {
        World.animTimers[id + '_still'] = setTimeout(function() {
          if (document.getElementById('char-' + id)) pickTarget();
        }, 4000 + Math.random() * 8000);
        return;
      }
      var target = 40 + Math.random() * (W - 120);
      state.targetX = target;
      state.dir     = state.targetX > state.x ? 1 : -1;
      state.moving  = true;
      renderer.switchAnim('walk', state.dir < 0);  // flip when walking left
    };

    renderer.still();

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
          renderer.still();
          renderer.setFlip(false);
          World.animTimers[id + '_still'] = setTimeout(function() {
            if (document.getElementById('char-' + id)) pickTarget();
          }, 5000 + Math.random() * 10000);
        } else {
          var maxStep = SPEED * dt;
          if (absDiff < 15) maxStep = Math.max(maxStep * (absDiff / 15), 0.1);
          state.x += Math.min(absDiff, maxStep) * state.dir;
          wrapper.style.left = Math.round(state.x) + 'px';
        }
      }
    }, MOVE_MS);

    World.animTimers[id + '_move']  = moveTimer;
    World.animTimers[id + '_pause'] = setTimeout(function() {
      if (document.getElementById('char-' + id)) pickTarget();
    }, 2000 + Math.random() * 5000);
  },

  playCharAction(id, actionName) {
    var renderer = this.renderers[id];
    if (!renderer) return;
    clearInterval(this.animTimers[id + '_move']);
    clearTimeout(this.animTimers[id + '_pause']);
    clearTimeout(this.animTimers[id + '_still']);
    var member = App.state.team.find(function(m){ return m.id === id; });
    if (!member) return;
    var W = World.container ? (World.container.getBoundingClientRect().width || World.container.offsetWidth || 700) : 700;
    var ws = World.wanderState[id];
    var base = ws ? ws.base : W / 2;
    // Enhanced renderer can use the specific action name; legacy uses generic 'action'
    var isEnhanced = typeof EnhancedCharRenderer !== 'undefined' && renderer instanceof EnhancedCharRenderer;
    var actionArg = (isEnhanced && actionName) ? actionName : 'action';
    renderer.playOnce(actionArg, function() {
      if (Chat.forwardIds.indexOf(id) !== -1 && Chat.talkingId !== id) {
        World._startWander(id, renderer, base, W);
      } else {
        renderer.still();
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
      Chat.talkingIds = Chat.talkingIds.filter(function(x){ return x !== id; });
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x !== id; });
      Chat.talkingId = Chat.talkingIds.length ? Chat.talkingIds[0] : (Chat.forwardIds.length ? Chat.forwardIds[0] : null);
      if (!Chat.forwardIds.length) Chat.closePanel();
      else Chat.renderPanel();
    } else {
      Chat.forwardIds.push(id);
      Chat.talkingIds.push(id);
      if (!Chat.talkingId) Chat.talkingId = id;
      Chat.openPanel();
    }
    Chat._saveStage();
    World.render();
    var speakCount = Chat.talkingIds.length;
    var listenCount = Chat.forwardIds.length - speakCount;
    var status = speakCount + ' speaking';
    if (listenCount > 0) status += ', ' + listenCount + ' listening';
    App.setStatus(Chat.forwardIds.length ? status : 'stage is empty — use TEAM to summon someone');
    if (typeof Roster !== 'undefined') Roster.render();
  },

  _calcPositions(ids, W) {
    var count = ids.length;
    if (count === 0) return [];
    var drawerOpen = document.getElementById('roster-drawer') &&
                     document.getElementById('roster-drawer').classList.contains('open');
    var effectiveW = Math.max((drawerOpen ? W - 225 : W), 200);
    var charW      = Math.round(CHAR_W * IDLE_PX);
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
  _keysHeld:   {},
  _keyTimer:   null,
  _jumpActive: false,
  _duckActive: false,

  initKeyboard() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      self._keysHeld[e.key] = true;
      if (!self._keyTimer) self._startKeyLoop();
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
    return Chat.talkingId || (Chat.forwardIds && Chat.forwardIds[0]) || null;
  },

  _startKeyLoop() {
    var self = this;
    var STEP = 3;
    this._keyTimer = setInterval(function() {
      var id = self._getControlledId();
      if (!id) return;
      var wrapper = document.getElementById('char-' + id);
      if (!wrapper) return;
      var W = self.container ? (self.container.offsetWidth || 700) : 700;
      if (self._keysHeld['ArrowLeft'] || self._keysHeld['ArrowRight']) {
        var dir = self._keysHeld['ArrowRight'] ? 1 : -1;
        var ws  = self.wanderState[id];
        if (self.animTimers[id + '_move']) { clearInterval(self.animTimers[id + '_move']); self.animTimers[id + '_move'] = null; }
        clearTimeout(self.animTimers[id + '_still']);
        clearTimeout(self.animTimers[id + '_pause']);
        if (ws) ws.moving = false;
        var curX = ws ? ws.x : parseInt(wrapper.style.left) || 0;
        var newX = Math.max(0, Math.min(W - 80, curX + dir * STEP));
        if (ws) { ws.x = newX; ws.moving = false; }
        wrapper.style.left = Math.round(newX) + 'px';
        if (!self._jumpActive && !self._duckActive) {
          var renderer = self.renderers[id];
          if (renderer) renderer.switchAnim('walk', dir < 0);
        }
      }
    }, 16);
  },

  _stopKeyLoop() {
    if (this._keyTimer) { clearInterval(this._keyTimer); this._keyTimer = null; }
  },

  _stopWalkAnim() {
    if (this._jumpActive || this._duckActive) return;
    var id = this._getControlledId();
    var renderer = id && this.renderers[id];
    if (renderer) { renderer.still(); renderer.setFlip(false); }
  },

  _doJump() {
    if (this._jumpActive) return;
    var id = this._getControlledId();
    var wrapper = id && document.getElementById('char-' + id);
    var renderer = id && this.renderers[id];
    if (!wrapper || !renderer) return;
    this._jumpActive = true;
    renderer.switchAnim('action', false);
    var startBottom = parseInt(wrapper.style.bottom) || FLOOR_H;
    var peak = 60;
    var duration = 400;
    var start = null;
    var self = this;
    function jumpFrame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts - start) / duration, 1);
      var offset = Math.round(Math.sin(t * Math.PI) * peak);
      wrapper.style.bottom = (startBottom + offset) + 'px';
      if (t < 1) {
        requestAnimationFrame(jumpFrame);
      } else {
        wrapper.style.bottom = startBottom + 'px';
        self._jumpActive = false;
        if (!self._keysHeld['ArrowLeft'] && !self._keysHeld['ArrowRight']) renderer.still();
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
    renderer.still();
    wrapper.style.transform = 'scaleY(0.55) translateY(45%)';
    wrapper.style.transformOrigin = 'bottom center';
  },

  _unduck() {
    this._duckActive = false;
    var id = this._getControlledId();
    var wrapper = id && document.getElementById('char-' + id);
    if (wrapper) wrapper.style.transform = '';
    if (!this._keysHeld['ArrowLeft'] && !this._keysHeld['ArrowRight']) this._stopWalkAnim();
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

      var displayScale = isTalking ? ACTIVE_PX : IDLE_PX;
      var displayW = Math.round(CHAR_W * displayScale);
      var displayH = Math.round(CHAR_H * displayScale);
      var canvas = document.getElementById('canvas-' + id);
      if (canvas) { canvas.style.width = displayW + 'px'; canvas.style.height = displayH + 'px'; }
      wrapper.style.width  = displayW + 'px';
      wrapper.style.height = displayH + 'px';

      var nameEl = wrapper.querySelector('.char-name');
      if (nameEl) nameEl.style.color = isTalking ? '#ffcc44' : '#88aaff';

      // Switch animation on talking state change
      var renderer = World.renderers[id];
      if (renderer) {
        if (isTalking) {
          renderer.switchAnim('talk', false);
        } else if (renderer._anim === 'talk') {
          renderer.still();
        }
      }

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
