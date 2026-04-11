// js/world.js

const IDLE_PX      = 1;
const ACTIVE_PX    = 1.2;
const RENDER_SCALE = 2;
const FLOOR_H      = 58;

const World = {
  container:    null,
  charsLayer:   null,
  animTimers:   {},
  wanderTimers: {},
  wanderState:  {}, // id -> {x, targetX, dir, moving}
  meetingMode:  false,
  currentRoom:  'stage',

  init() {
    this.container  = document.getElementById('world-container');
    this.charsLayer = document.getElementById('chars-layer');
    this._buildFloor();
    this._buildStars();
    this._buildBgCanvas();
    if (typeof WorldObjects !== 'undefined') WorldObjects.init();
    window.addEventListener('resize', function() { World._buildBgCanvas(); World.render(); if (typeof WorldObjects !== 'undefined') WorldObjects.resize(); });
    this.container.addEventListener('click', function(e) {
      var t = e.target;
      if (t === World.container || t.id === 'bg-canvas' ||
          t.classList.contains('floor-tile') || t.id === 'stars-layer' ||
          t.id === 'world-hud' || t.id === 'status-bar' ||
          t.id === 'objects-canvas' || t.id === 'chars-layer') {
        // Close the chat panel but leave everyone on stage
        Chat.closePanel();
      }
    });
  },

  switchRoom(roomId) {
    if (!ROOMS[roomId]) return;
    this.currentRoom = roomId;
    // Close panel only — keep everyone on stage
    Chat.closePanel();
    if (typeof WorldObjects !== 'undefined') WorldObjects.onRoomSwitch();
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
    // Insert BEFORE chars-layer so chars always render on top in DOM order
    var charsLayer = document.getElementById('chars-layer');
    if (charsLayer) {
      this.container.insertBefore(f, charsLayer);
    } else {
      this.container.appendChild(f);
    }
  },

  _buildStars() {
    var layer = document.getElementById('stars-layer');
    layer.innerHTML = '';
    for (var i=0; i<45; i++) {
      var s=document.createElement('div'); s.className='star';
      var sz=(Math.random()*2+1).toFixed(1);
      s.style.cssText='width:'+sz+'px;height:'+sz+'px;left:'+(Math.random()*100).toFixed(1)+
        '%;top:'+(Math.random()*58).toFixed(1)+'%;animation-delay:'+(Math.random()*2).toFixed(2)+
        's;animation-duration:'+(1.5+Math.random()*2).toFixed(2)+'s';
      layer.appendChild(s);
    }
  },

  _buildBgCanvas() {
    var canvas=document.getElementById('bg-canvas');
    var W=canvas.width=this.container.offsetWidth||700;
    var H=canvas.height=this.container.offsetHeight||320;
    var ctx=canvas.getContext('2d'); ctx.clearRect(0,0,W,H);
    if      (this.currentRoom==='stage')      this._drawStageRoom(ctx,W,H);
    else if (this.currentRoom==='boardroom')  this._drawBoardroom(ctx,W,H);
    else if (this.currentRoom==='playground') this._drawPlayground(ctx,W,H);
  },

  _drawStageRoom(ctx,W,H) {
    var b=[[0,H-160,50,120],[55,H-130,40,90],[100,H-170,60,130],[170,H-145,40,105],[220,H-185,55,145],[285,H-140,38,100],[330,H-165,60,125],[400,H-150,45,110],[455,H-180,50,140],[515,H-145,45,105],[570,H-170,50,130],[628,H-135,42,95],[676,H-155,50,115]];
    b.forEach(function(b){ctx.fillStyle='#0d0c22';ctx.fillRect(b[0],b[1],b[2],b[3]);for(var wx=b[0]+5;wx<b[0]+b[2]-5;wx+=9)for(var wy=b[1]+8;wy<b[1]+b[3]-5;wy+=11){ctx.fillStyle=Math.random()>0.45?'#ffcc4418':'#3366ff10';ctx.fillRect(wx,wy,5,6);}});
    var fog=ctx.createLinearGradient(0,H-90,0,H-FLOOR_H);fog.addColorStop(0,'rgba(15,14,23,0)');fog.addColorStop(1,'rgba(15,14,23,0.6)');ctx.fillStyle=fog;ctx.fillRect(0,H-90,W,90);
  },

  _drawBoardroom(ctx,W,H) {
    var floor=H-FLOOR_H;

    // ── Ceiling — dark coffered with recessed LED strip ────────────────────
    var ceilH=Math.round(H*0.18);
    // Outer ceiling — dark charcoal
    ctx.fillStyle='#1a1a1e';ctx.fillRect(0,0,W,ceilH);
    // Inner coffer box — slightly lighter, inset rectangle
    var cofX=Math.round(W*0.15),cofW=Math.round(W*0.7),cofY=4,cofH2=ceilH-8;
    ctx.fillStyle='#222228';ctx.fillRect(cofX,cofY,cofW,cofH2);
    ctx.strokeStyle='#2a2a32';ctx.lineWidth=2;ctx.strokeRect(cofX,cofY,cofW,cofH2);
    // LED strip — warm white glowing line along ceiling/wall join
    var stripY=ceilH-4;
    var ledGrad=ctx.createLinearGradient(0,stripY-20,0,stripY+2);
    ledGrad.addColorStop(0,'rgba(255,248,220,0)');
    ledGrad.addColorStop(0.6,'rgba(255,248,220,0.18)');
    ledGrad.addColorStop(1,'rgba(255,248,220,0.45)');
    ctx.fillStyle=ledGrad;ctx.fillRect(0,stripY-20,W,24);
    ctx.fillStyle='rgba(255,250,230,0.9)';ctx.fillRect(0,stripY,W,2);
    // Ceiling downlights — subtle circles
    [W*0.3,W*0.5,W*0.7].forEach(function(lx){
      ctx.fillStyle='rgba(255,248,220,0.15)';
      ctx.beginPath();ctx.arc(lx,ceilH*0.5,18,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,248,220,0.7)';
      ctx.beginPath();ctx.arc(lx,ceilH*0.5,3,0,Math.PI*2);ctx.fill();
    });

    // ── Left wall — dark vertical wood panelling ───────────────────────────
    var wallTop=ceilH,wallBot=floor;
    var panelW=Math.round(W*0.28);
    var lwGrad=ctx.createLinearGradient(0,0,panelW,0);
    lwGrad.addColorStop(0,'#1a1510');lwGrad.addColorStop(0.4,'#221c14');lwGrad.addColorStop(1,'rgba(28,22,16,0)');
    ctx.fillStyle=lwGrad;ctx.fillRect(0,wallTop,panelW,wallBot-wallTop);
    // Vertical panel grooves
    ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1;
    for(var pvx=20;pvx<panelW;pvx+=28){
      ctx.beginPath();ctx.moveTo(pvx,wallTop);ctx.lineTo(pvx,wallBot);ctx.stroke();
    }

    // ── Right wall — sheer curtain / light wall ────────────────────────────
    var rwStart=W-Math.round(W*0.22);
    var rwGrad=ctx.createLinearGradient(rwStart,0,W,0);
    rwGrad.addColorStop(0,'rgba(220,225,230,0)');rwGrad.addColorStop(0.3,'rgba(220,225,230,0.55)');rwGrad.addColorStop(1,'rgba(235,240,245,0.85)');
    ctx.fillStyle=rwGrad;ctx.fillRect(rwStart,wallTop,W-rwStart,wallBot-wallTop);
    // Curtain fold lines
    ctx.strokeStyle='rgba(180,190,200,0.3)';ctx.lineWidth=1;
    for(var cf=rwStart+18;cf<W;cf+=18){
      ctx.beginPath();ctx.moveTo(cf,wallTop);ctx.lineTo(cf,wallBot);ctx.stroke();
    }

    // ── Back wall — mid grey with TV screen and two art panels ────────────
    var backL=panelW,backR=rwStart;
    ctx.fillStyle='#2e2e34';ctx.fillRect(backL,wallTop,backR-backL,wallBot-wallTop);
    // Subtle wall texture
    ctx.fillStyle='rgba(255,255,255,0.02)';
    for(var wy2=wallTop;wy2<wallBot;wy2+=12){ctx.fillRect(backL,wy2,backR-backL,1);}

    // TV screen — centre back wall
    var tvW=Math.round((backR-backL)*0.3),tvH=Math.round(tvW*0.55);
    var tvX=Math.round((backL+backR)/2-tvW/2),tvY=Math.round(wallTop+(wallBot-wallTop)*0.12);
    ctx.fillStyle='#0a0a0a';ctx.fillRect(tvX,tvY,tvW,tvH);
    ctx.strokeStyle='#3a3a3a';ctx.lineWidth=2;ctx.strokeRect(tvX,tvY,tvW,tvH);
    // TV screen glow — faint blue
    var tvGlow=ctx.createRadialGradient(tvX+tvW/2,tvY+tvH/2,2,tvX+tvW/2,tvY+tvH/2,tvW*0.6);
    tvGlow.addColorStop(0,'rgba(40,80,180,0.12)');tvGlow.addColorStop(1,'rgba(40,80,180,0)');
    ctx.fillStyle=tvGlow;ctx.fillRect(tvX,tvY,tvW,tvH);
    // TV stand/mount
    ctx.fillStyle='#222';ctx.fillRect(tvX+tvW/2-2,tvY+tvH,4,8);
    ctx.fillRect(tvX+tvW/2-10,tvY+tvH+8,20,3);

    // Art panels flanking TV — warm wood texture rectangles
    var apH=Math.round(tvH*0.9),apW=Math.round(tvW*0.35);
    var apY=tvY+Math.round(tvH*0.05);
    // Left art panel
    var apLX=tvX-apW-18;
    ctx.fillStyle='#5c3d18';ctx.fillRect(apLX,apY,apW,apH);
    ctx.fillStyle='rgba(255,200,100,0.06)';
    ctx.beginPath();ctx.moveTo(apLX+apW*0.3,apY+4);ctx.lineTo(apLX+apW*0.7,apY+apH*0.5);ctx.lineTo(apLX+apW*0.4,apY+apH-4);ctx.stroke();
    ctx.strokeStyle='#7a5530';ctx.lineWidth=1.5;ctx.strokeRect(apLX,apY,apW,apH);
    // Right art panel
    var apRX=tvX+tvW+18;
    ctx.fillStyle='#5c3d18';ctx.fillRect(apRX,apY,apW,apH);
    ctx.strokeStyle='#7a5530';ctx.lineWidth=1.5;ctx.strokeRect(apRX,apY,apW,apH);
    ctx.strokeStyle='rgba(255,200,100,0.06)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(apRX+apW*0.5,apY+4);ctx.lineTo(apRX+apW*0.2,apY+apH*0.6);ctx.lineTo(apRX+apW*0.7,apY+apH-4);ctx.stroke();

    // Presenter chair hint — small dark shape at back-centre
    var chrX=Math.round((backL+backR)/2),chrY=Math.round(wallBot*0.72);
    ctx.fillStyle='#1a1a1a';
    ctx.beginPath();ctx.ellipse(chrX,chrY,12,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillRect(chrX-6,chrY-22,12,22);
    ctx.beginPath();ctx.ellipse(chrX,chrY-22,8,5,0,Math.PI*2);ctx.fill();

    // ── Conference table — long dark rectangle, proper perspective ─────────
    var tMid=Math.round(W/2);

    var tBotY   = floor;
    var tH_face = 28;
    var tTopY   = tBotY - tH_face;
    var tSurfH  = 14;
    var tSurfTopY = tTopY - tSurfH;

    var tFrontL = Math.round(W*0.08);
    var tFrontR = Math.round(W*0.92);
    var tBackY2  = tSurfTopY - 12;
    var tBackL   = Math.round(W*0.18);
    var tBackR   = Math.round(W*0.82);

    var tDark    = '#1e1810';
    var tMid2    = '#2a2016';
    var tLight   = '#3a2c1c';
    var tGloss   = 'rgba(255,220,150,0.06)';

    function trap(x1,y1,x2,y2,x3,y3,x4,y4,fill,stroke,lw){
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.lineTo(x4,y4);ctx.closePath();
      if(fill){ctx.fillStyle=fill;ctx.fill();}
      if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}
    }

    trap(tFrontL,tSurfTopY, tFrontR,tSurfTopY,
         tBackR,tBackY2, tBackL,tBackY2,
         tLight, tDark, 0.5);

    ctx.save();
    ctx.beginPath();ctx.moveTo(tFrontL,tSurfTopY);ctx.lineTo(tFrontR,tSurfTopY);ctx.lineTo(tBackR,tBackY2);ctx.lineTo(tBackL,tBackY2);ctx.closePath();ctx.clip();
    var gloss2=ctx.createLinearGradient(0,tBackY2,0,tSurfTopY+4);
    gloss2.addColorStop(0,'rgba(255,220,150,0)');gloss2.addColorStop(0.4,'rgba(255,220,150,0.08)');gloss2.addColorStop(0.7,'rgba(255,220,150,0.04)');gloss2.addColorStop(1,'rgba(255,220,150,0)');
    ctx.fillStyle=gloss2;ctx.fillRect(tFrontL,tBackY2,tFrontR-tFrontL,tSurfTopY-tBackY2);
    ctx.restore();

    trap(tFrontL,tSurfTopY, tFrontR,tSurfTopY,
         tFrontR,tBotY, tFrontL,tBotY,
         tMid2, tDark, 0.5);

    ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(tFrontL,tBotY-3,tFrontR-tFrontL,3);

    trap(tFrontL,tSurfTopY, tBackL,tBackY2,
         tBackL,tBackY2+tH_face+tSurfH, tFrontL,tBotY,
         tDark, '#111', 0.5);

    trap(tFrontR,tSurfTopY, tBackR,tBackY2,
         tBackR,tBackY2+tH_face+tSurfH, tFrontR,tBotY,
         tDark, '#111', 0.5);

    ctx.save();
    ctx.beginPath();ctx.moveTo(tFrontL,tSurfTopY);ctx.lineTo(tFrontR,tSurfTopY);ctx.lineTo(tBackR,tBackY2);ctx.lineTo(tBackL,tBackY2);ctx.closePath();ctx.clip();
    ctx.fillStyle='rgba(0,0,0,0.25)';
    ctx.fillRect(tMid-20,tBackY2,8,tSurfTopY-tBackY2);
    ctx.fillRect(tMid+12,tBackY2,8,tSurfTopY-tBackY2);
    [[tFrontL+30, tSurfTopY-3],[tFrontL+70, tSurfTopY-3],[tFrontL+110, tSurfTopY-3]].forEach(function(p){
      ctx.fillStyle='#f0ede0';ctx.fillRect(p[0],p[1]-10,22,10);
      ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=0.5;ctx.strokeRect(p[0],p[1]-10,22,10);
    });
    [[tFrontR-50, tSurfTopY-3],[tFrontR-90, tSurfTopY-3],[tFrontR-130, tSurfTopY-3]].forEach(function(p){
      ctx.fillStyle='#f0ede0';ctx.fillRect(p[0],p[1]-10,22,10);
      ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=0.5;ctx.strokeRect(p[0],p[1]-10,22,10);
    });
    ctx.restore();

    var chairPositions=[0.18,0.30,0.42,0.58,0.70,0.82];
    chairPositions.forEach(function(xf){
      var cx=Math.round(W*xf);
      var cy=floor+6;
      ctx.fillStyle='#1a1a1e';
      ctx.beginPath();ctx.ellipse(cx,cy-18,11,14,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111';ctx.fillRect(cx-9,cy-18,18,22);
      ctx.beginPath();ctx.ellipse(cx,cy,14,5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#252525';
      ctx.fillRect(cx-14,cy-10,3,10);
      ctx.fillRect(cx+11,cy-10,3,10);
    });

    var backChairY=tBackY2-8;
    [0.22,0.34,0.46,0.54,0.66,0.78].forEach(function(xf){
      var cx=Math.round(W*xf);
      ctx.fillStyle='rgba(15,15,18,0.8)';
      ctx.beginPath();ctx.ellipse(cx,backChairY,7,3,0,0,Math.PI*2);ctx.fill();
      ctx.fillRect(cx-5,backChairY-12,10,12);
      ctx.beginPath();ctx.ellipse(cx,backChairY-12,6,3,0,0,Math.PI*2);ctx.fill();
    });

    var floorGrad=ctx.createLinearGradient(0,floor,0,H);
    floorGrad.addColorStop(0,'rgba(255,248,220,0.06)');floorGrad.addColorStop(0.3,'rgba(0,0,0,0)');
    ctx.fillStyle=floorGrad;ctx.fillRect(0,floor,W,H-floor);
    var shadowGrad=ctx.createLinearGradient(0,floor,0,floor+16);
    shadowGrad.addColorStop(0,'rgba(0,0,0,0.5)');shadowGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=shadowGrad;ctx.fillRect(tFrontL,floor,tFrontR-tFrontL,16);
  },


  _drawPlayground(ctx,W,H) {
    ctx.fillStyle='#0a1a2e';ctx.fillRect(0,0,W,H);
    [[80,40,90],[220,25,70],[420,50,100],[580,30,80],[750,45,60]].forEach(function(c){ctx.fillStyle='rgba(180,210,255,0.12)';ctx.beginPath();ctx.arc(c[0],c[1],c[2]*0.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(c[0]+c[2]*0.3,c[1]+5,c[2]*0.35,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(c[0]-c[2]*0.3,c[1]+8,c[2]*0.3,0,Math.PI*2);ctx.fill();});
    var tc=['#2d8a2d','#3aaa3a','#1a6a1a','#44bb44'];
    [[60,H-FLOOR_H],[160,H-FLOOR_H],[W-80,H-FLOOR_H],[W-200,H-FLOOR_H]].forEach(function(t,ti){ctx.fillStyle='#6b3a1a';ctx.fillRect(t[0]-4,t[1]-35,8,35);ctx.fillStyle=tc[ti%tc.length];ctx.fillRect(t[0]-18,t[1]-55,36,20);ctx.fillRect(t[0]-14,t[1]-70,28,18);ctx.fillRect(t[0]-10,t[1]-82,20,14);ctx.fillStyle='rgba(150,255,150,0.3)';ctx.fillRect(t[0]-10,t[1]-68,10,8);});
    [{x:120,y:H-FLOOR_H-8,c:'#ff4444',s:10},{x:300,y:H-FLOOR_H-6,c:'#4444ff',s:8},{x:480,y:H-FLOOR_H-9,c:'#ffaa00',s:11},{x:650,y:H-FLOOR_H-7,c:'#aa44ff',s:9}].forEach(function(sh){ctx.fillStyle=sh.c;ctx.beginPath();ctx.arc(sh.x,sh.y,sh.s,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(sh.x-sh.s*0.3,sh.y-sh.s*0.3,sh.s*0.3,0,Math.PI*2);ctx.fill();});
    for(var hx=W/2-80;hx<W/2+80;hx+=36){ctx.strokeStyle='rgba(255,200,50,0.25)';ctx.lineWidth=2;ctx.strokeRect(hx,H-FLOOR_H-2,32,20);}
  },

  setMeetingMode(on) { this.meetingMode=on; this.render(); },

  render() {
    this._clearTimers();
    this.charsLayer.innerHTML = '';
    var team = App.state.team;
    if (!team.length) return;
    // Force layout measurement after any panel open/close changes
    var W = this.container.getBoundingClientRect().width || this.container.offsetWidth || 700;
    if (W < 100) { var self=this; requestAnimationFrame(function(){self.render();}); return; }
    var forwardIds = Chat.forwardIds;
    if (!forwardIds.length) return; // empty stage — nothing to draw

    // Build ordered list of members who are on stage
    var stageMembers = forwardIds.map(function(id) {
      return team.find(function(m) { return m.id === id; });
    }).filter(Boolean);

    var basePositions = this._calcPositions(forwardIds, W);

    stageMembers.forEach(function(member, i) {
      var isTalking    = Chat.talkingId === member.id;
      var isHandRaised = Chat.handRaisedIds.indexOf(member.id) !== -1;
      var pal          = PALETTES[member.colorIdx % PALETTES.length];

      var displayScale = isTalking ? ACTIVE_PX : IDLE_PX;
      var displayW     = Math.round(48 * displayScale);
      var displayH     = Math.round(72 * displayScale);

      // Wander state — initialise or smoothly update base
      var newBase = basePositions[i];
      if (!World.wanderState[member.id]) {
        World.wanderState[member.id] = {
          x: newBase, targetX: newBase,
          dir: 1, moving: false, base: newBase
        };
      } else {
        var ws = World.wanderState[member.id];
        var oldBase = ws.base;
        ws.base = newBase;
        // If the base position shifted (e.g. new char added, layout changed),
        // shift current x by the same delta so the character doesn't snap/slide
        if (Math.abs(newBase - oldBase) > 2) {
          var delta = newBase - oldBase;
          ws.x += delta;
          ws.targetX += delta;
          // Clamp to world bounds
          ws.x = Math.max(40, Math.min(W - 80, ws.x));
          ws.targetX = Math.max(40, Math.min(W - 80, ws.targetX));
        }
      }
      var wx = isTalking ? newBase : World.wanderState[member.id].x;

      // Canvas — id used by _startWander and playCharAction
      var c = document.createElement('canvas');
      c.id     = 'canvas-' + member.id;
      c.width  = 48 * RENDER_SCALE;
      c.height = 72 * RENDER_SCALE;
      c.style.cssText = 'width:' + displayW + 'px;height:' + displayH + 'px;image-rendering:pixelated;display:block;';
      var ctx = c.getContext('2d');
      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
      if (isTalking) {
        drawChar(ctx, pal, 3, { facing: 'front' });
      } else {
        drawChar(ctx, pal, 0, { facing: 'side', walkPhase: 1, flipX: false, offsetY: 0 });
      }

      // Wrapper — id used by _startWander to find and move the element
      var wrapper = document.createElement('div');
      wrapper.id        = 'char-' + member.id;
      wrapper.className = 'character' + (isTalking ? ' selected' : '');
      var glow = isTalking
        ? ';filter:drop-shadow(0 0 8px rgba(255,204,68,0.9)) drop-shadow(0 0 3px rgba(255,204,68,0.6))'
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
        'white-space:nowrap;font-size:6px;' +
        'color:' + (isTalking ? '#ffcc44' : '#88aaff') + ';pointer-events:none;';
      nameEl.textContent = member.name;
      wrapper.appendChild(nameEl);

      // Hand raise
      if (isHandRaised) {
        var hand = document.createElement('div');
        hand.className = 'char-hand';
        hand.style.cssText = 'position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:14px;pointer-events:none;';
        hand.textContent = '✋';
        wrapper.appendChild(hand);
      }

      // Click: open chat / switch active speaker — never removes from stage
      wrapper.addEventListener('click', function(e) {
        e.stopPropagation();
        World.selectChar(member.id);
      });
      World.charsLayer.appendChild(wrapper);

      // Wander for all non-talking stage characters
      if (!isTalking) {
        World._startWander(member.id, c, pal, newBase, W);
      }
    });
  },

  _startWander(id, canvas, pal, baseX, W) {
    var state=this.wanderState[id]||{x:baseX,targetX:baseX,dir:1,moving:false,base:baseX};
    state.base=baseX;
    this.wanderState[id]=state;

    // Walk animation state
    var walkPhase=0;
    var WALK_MS=160;   // ms per animation frame
    var MOVE_MS=16;    // physics tick ~60fps
    var msSinceLastFrame=0;
    var lastTime=Date.now();

    var SPEED=0.04; // px per ms — slower for more natural walking

    var drawIdle=function() {
      var ctx2=canvas.getContext('2d');
      ctx2.setTransform(1,0,0,1,0,0);
      ctx2.clearRect(0,0,canvas.width,canvas.height);
      ctx2.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
      drawChar(ctx2,pal,0,{facing:'side',walkPhase:1,flipX:state.dir<0,offsetY:0});
    };

    var drawWalk=function() {
      var ctx2=canvas.getContext('2d');
      ctx2.setTransform(1,0,0,1,0,0);
      ctx2.clearRect(0,0,canvas.width,canvas.height);
      ctx2.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
      var isContact=(walkPhase===0||walkPhase===2);
      drawChar(ctx2,pal,0,{facing:'side',walkPhase:walkPhase,flipX:state.dir<0,offsetY:isContact?1:0});
    };

    var pickTarget=function() {
      // Small natural steps relative to current position
      var range  = 20 + Math.random() * 40; // 20-60px steps (smaller = more natural)
      var dir    = Math.random() < 0.5 ? -1 : 1;
      var target = state.x + dir * range;
      // Gently drift back toward base if straying too far
      var distFromBase = target - state.base;
      if (Math.abs(distFromBase) > 80) {
        // Bias direction back toward base
        target = state.base + (Math.random() - 0.5) * 60;
      }
      state.targetX = Math.max(40, Math.min(W - 80, target));
      state.dir     = state.targetX > state.x ? 1 : -1;
      state.moving  = true;
      walkPhase = 0; msSinceLastFrame = 0;
    };

    drawIdle();

    var moveTimer=setInterval(function(){
      var wrapper=document.getElementById('char-'+id);
      if (!wrapper){clearInterval(moveTimer);return;}

      var now=Date.now();
      var dt=Math.min(now-lastTime, 50); // cap dt to avoid big jumps after tab switch
      lastTime=now;

      if (state.moving) {
        var diff=state.targetX-state.x;
        if (Math.abs(diff)<1) {
          state.x=state.targetX;
          state.moving=false;
          wrapper.style.left=Math.round(state.x)+'px';
          drawIdle();
          var stillTimer=setTimeout(function(){
            if (document.getElementById('char-'+id)) pickTarget();
          }, 2000+Math.random()*3000); // longer pauses between walks
          World.animTimers[id+'_still']=stillTimer;
        } else {
          // Smooth easing — slow down as approaching target
          var maxStep = SPEED * dt;
          var absDiff = Math.abs(diff);
          // Ease out: decelerate in the last 15px
          if (absDiff < 15) {
            maxStep *= (absDiff / 15);
            maxStep = Math.max(maxStep, 0.15); // minimum so we don't stall
          }
          state.x += Math.min(absDiff, maxStep) * state.dir;
          wrapper.style.left=Math.round(state.x)+'px';
          msSinceLastFrame+=dt;
          if (msSinceLastFrame>=WALK_MS) {
            msSinceLastFrame-=WALK_MS;
            walkPhase=(walkPhase+1)%4;
            drawWalk();
          }
        }
      }
    }, MOVE_MS);
    World.animTimers[id+'_move']=moveTimer;

    // Initial pause before first wander (staggered)
    var pauseTimer=setTimeout(function(){
      if (document.getElementById('char-'+id)) pickTarget();
    }, 1000+Math.random()*2500);
    World.animTimers[id+'_pause']=pauseTimer;
  },

  // Play an action on a specific character's canvas
  async playCharAction(id, actionName) {
    var canvas=document.getElementById('canvas-'+id);
    if (!canvas) return;
    var member=App.state.team.find(function(m){return m.id===id;});
    if (!member) return;
    var pal=PALETTES[member.colorIdx%PALETTES.length];
    // Pause wander during action
    clearInterval(this.animTimers[id+'_move']);
    clearTimeout(this.animTimers[id+'_pause']);
    clearTimeout(this.animTimers[id+'_still']);
    await playAction(canvas, pal, RENDER_SCALE, actionName);
    // Restart wander if character is still on stage and not the active talker
    if (Chat.forwardIds.indexOf(id) !== -1 && Chat.talkingId !== id) {
      var W = World.container ? (World.container.getBoundingClientRect().width || World.container.offsetWidth || 700) : 700;
      var ws = World.wanderState[id];
      var base = ws ? ws.base : (W / 2);
      World._startWander(id, canvas, pal, base, W);
    }
  },

  selectChar(id) {
    var wasForward = Chat.forwardIds.indexOf(id) !== -1;
    if (!wasForward) {
      Chat.forwardIds.push(id);
      Chat.talkingId = id;
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x !== id; });
      Chat._saveStage();
      World.render();   // full rebuild — new character added to stage
      Chat.openPanel();
    } else {
      // Already on stage — just switch active speaker, no rebuild needed
      Chat.talkingId = id;
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x !== id; });
      Chat.openPanel();
      World.refresh();  // update glow/name only, wander continues uninterrupted
    }
    var m = App.state.team.find(function(m){ return m.id === id; });
    App.setStatus('talking to ' + (m ? m.name : '...'));
    if (typeof Roster !== 'undefined') Roster.render();
  },

  deselectAll() { document.querySelectorAll('.character').forEach(function(c){c.classList.remove('selected');}); if (typeof Roster!=='undefined') Roster.render(); },

  // Called by roster tile — toggles a member on/off stage
  toggleStage(id) {
    var idx = Chat.forwardIds.indexOf(id);
    if (idx !== -1) {
      // Remove from stage
      Chat.forwardIds.splice(idx, 1);
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x !== id; });
      if (Chat.talkingId === id) {
        Chat.talkingId = Chat.forwardIds.length ? Chat.forwardIds[0] : null;
      }
      if (Chat.forwardIds.length === 0) {
        Chat.closePanel();
      } else {
        Chat.renderPanel();
      }
    } else {
      // Add to stage
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

  _calcPositions(ids,W) {
    var count = ids.length;
    if (count === 0) return [];
    var drawerOpen = document.getElementById('roster-drawer') &&
                     document.getElementById('roster-drawer').classList.contains('open');
    var effectiveW = Math.max((drawerOpen ? W - 225 : W), 200);
    // Each character needs ~60px of space; spread evenly with generous margins
    var charW = 60;
    var totalNeeded = count * charW;
    var margin = Math.max(40, Math.round((effectiveW - totalNeeded) / 2));
    margin = Math.min(margin, Math.round(effectiveW * 0.15));
    var usable = effectiveW - margin * 2;
    if (count === 1) return [Math.round(effectiveW / 2 - 24)];
    return Array.from({length:count}, function(_,i) {
      return Math.round(margin + (usable / (count - 1)) * i - 24);
    });
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(function(t){ if(typeof t==='number') clearInterval(t); clearTimeout(t); });
    this.animTimers={};
  },

  // Lightweight visual refresh — updates glow/sprite/badge without rebuilding DOM or resetting wander
  refresh() {
    var team = App.state.team;
    if (!team || !this.charsLayer) return;
    Chat.forwardIds.forEach(function(id) {
      var wrapper = document.getElementById('char-' + id);
      if (!wrapper) return;
      var isTalking    = Chat.talkingId === id;
      var isHandRaised = Chat.handRaisedIds.indexOf(id) !== -1;
      var member       = team.find(function(m){ return m.id === id; });
      if (!member) return;
      var pal = PALETTES[member.colorIdx % PALETTES.length];

      // Update glow and z-index
      wrapper.style.filter = isTalking
        ? 'drop-shadow(0 0 8px rgba(255,204,68,0.9)) drop-shadow(0 0 3px rgba(255,204,68,0.6))'
        : '';
      wrapper.style.zIndex = isTalking ? '20' : '10';
      wrapper.classList.toggle('selected', isTalking);

      // Update sprite — talker faces front, others stay side-idle
      var canvas = document.getElementById('canvas-' + id);
      if (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
        if (isTalking) {
          drawChar(ctx, pal, 3, { facing: 'front' });
        } else {
          // Restore side idle — wander timer will take over sprite from here
          drawChar(ctx, pal, 0, { facing: 'side', walkPhase: 1, flipX: false, offsetY: 0 });
        }
      }

      // Update canvas display size
      var displayScale = isTalking ? ACTIVE_PX : IDLE_PX;
      var displayW = Math.round(48 * displayScale);
      var displayH = Math.round(72 * displayScale);
      if (canvas) {
        canvas.style.width  = displayW + 'px';
        canvas.style.height = displayH + 'px';
      }
      wrapper.style.width  = displayW + 'px';
      wrapper.style.height = displayH + 'px';

      // Update name colour
      var nameEl = wrapper.querySelector('.char-name');
      if (nameEl) nameEl.style.color = isTalking ? '#ffcc44' : '#88aaff';

      // Hand raise badge
      var existingHand = wrapper.querySelector('.char-hand');
      if (isHandRaised && !existingHand) {
        var hand = document.createElement('div');
        hand.className = 'char-hand';
        hand.style.cssText = 'position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:14px;pointer-events:none;';
        hand.textContent = '✋';
        wrapper.appendChild(hand);
      } else if (!isHandRaised && existingHand) {
        existingHand.remove();
      }
    });
    if (typeof Roster !== 'undefined') Roster.render();
  }
};
