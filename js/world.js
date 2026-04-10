// js/world.js

const IDLE_PX      = 1;
const ACTIVE_PX    = 1.8;
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
    WorldObjects.init();
    window.addEventListener('resize', function() { World._buildBgCanvas(); World.render(); WorldObjects.resize(); });
    this.container.addEventListener('click', function(e) {
      var t = e.target;
      if (t === World.container || t.id === 'bg-canvas' ||
          t.classList.contains('floor-tile') || t.id === 'stars-layer' ||
          t.id === 'world-hud' || t.id === 'status-bar') {
        Chat.dismissAll(); World.render();
      }
    });
  },

  switchRoom(roomId) {
    if (!ROOMS[roomId]) return;
    this.currentRoom = roomId;
    Chat.dismissAll();
    WorldObjects.onRoomSwitch();
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
    this.container.appendChild(f);
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

    // ── Ceiling — white acoustic tile panels ──────────────────────────────
    var ceilH=Math.round(H*0.22);
    ctx.fillStyle='#e8eaec';ctx.fillRect(0,0,W,ceilH);
    // Ceiling tile grid
    ctx.strokeStyle='rgba(180,185,190,0.7)';ctx.lineWidth=0.8;
    var tileW=Math.round(W/10),tileH=Math.round(ceilH/3);
    for(var tx2=0;tx2<W;tx2+=tileW){ctx.beginPath();ctx.moveTo(tx2,0);ctx.lineTo(tx2,ceilH);ctx.stroke();}
    for(var ty2=0;ty2<ceilH;ty2+=tileH){ctx.beginPath();ctx.moveTo(0,ty2);ctx.lineTo(W,ty2);ctx.stroke();}
    // Recessed fluorescent strips
    var stripY=Math.round(ceilH*0.55),stripH=8;
    [W*0.25,W*0.5,W*0.75].forEach(function(sx){
      var sw=Math.round(W*0.15);
      ctx.fillStyle='rgba(240,250,255,0.9)';ctx.fillRect(sx-sw/2,stripY,sw,stripH);
      var gl=ctx.createLinearGradient(0,stripY,0,stripY+30);
      gl.addColorStop(0,'rgba(220,240,255,0.35)');gl.addColorStop(1,'rgba(220,240,255,0)');
      ctx.fillStyle=gl;ctx.fillRect(sx-sw/2-10,stripY,sw+20,30);
    });

    // ── Back wall — floor-to-ceiling panoramic windows ─────────────────────
    var wallTop=ceilH, wallBot=floor;
    // Sky/outside — bright overcast daylight
    var skyGrad=ctx.createLinearGradient(0,wallTop,0,wallBot);
    skyGrad.addColorStop(0,'#c8dff0');skyGrad.addColorStop(0.6,'#ddeeff');skyGrad.addColorStop(1,'#ccd8e8');
    ctx.fillStyle=skyGrad;ctx.fillRect(0,wallTop,W,wallBot-wallTop);

    // Window frame grid — horizontal rails
    var railCols=['rgba(160,170,175,0.9)','rgba(140,150,155,0.7)'];
    var numH=4;
    for(var ri=0;ri<=numH;ri++){
      var ry=wallTop+(wallBot-wallTop)*ri/numH;
      ctx.fillStyle=railCols[ri%2];ctx.fillRect(0,ry-1,W,2);
    }
    // Window frame grid — vertical mullions (perspective: closer together at edges)
    var numV=9;
    for(var vi=0;vi<=numV;vi++){
      var vx=Math.round(W*vi/numV);
      ctx.fillStyle='rgba(150,160,165,0.6)';ctx.fillRect(vx-1,wallTop,2,wallBot-wallTop);
    }
    // Window glare — bright wash on upper panes
    var glare=ctx.createLinearGradient(0,wallTop,0,wallTop+(wallBot-wallTop)*0.4);
    glare.addColorStop(0,'rgba(255,255,255,0.55)');glare.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=glare;ctx.fillRect(0,wallTop,W,(wallBot-wallTop)*0.4);
    // Horizontal blinds — partially open, subtle
    for(var bi=0;bi<6;bi++){
      var by=wallTop+(wallBot-wallTop)*0.05+bi*((wallBot-wallTop)*0.08);
      ctx.fillStyle='rgba(200,215,225,0.18)';ctx.fillRect(0,by,W,4);
    }
    // Distant building / tree silhouette hints through glass
    ctx.fillStyle='rgba(100,130,110,0.12)';
    ctx.beginPath();ctx.ellipse(W*0.15,wallBot-20,30,45,0,Math.PI,0);ctx.fill();
    ctx.beginPath();ctx.ellipse(W*0.82,wallBot-15,25,38,0,Math.PI,0);ctx.fill();
    ctx.fillStyle='rgba(130,140,150,0.1)';
    ctx.fillRect(W*0.38,wallTop+10,18,wallBot-wallTop-10);  // distant column hint

    // ── Side walls — grey/beige painted drywall ───────────────────────────
    // Left wall strip (perspective)
    var lwGrad=ctx.createLinearGradient(0,0,Math.round(W*0.08),0);
    lwGrad.addColorStop(0,'#b8bfc4');lwGrad.addColorStop(1,'rgba(185,192,198,0)');
    ctx.fillStyle=lwGrad;ctx.fillRect(0,ceilH,Math.round(W*0.08),floor-ceilH);
    // Right wall strip
    var rwGrad=ctx.createLinearGradient(W,0,W-Math.round(W*0.08),0);
    rwGrad.addColorStop(0,'#b8bfc4');rwGrad.addColorStop(1,'rgba(185,192,198,0)');
    ctx.fillStyle=rwGrad;ctx.fillRect(W-Math.round(W*0.08),ceilH,Math.round(W*0.08),floor-ceilH);

    // ── Floor — carpet (dark charcoal, like the image) ────────────────────
    // Already drawn by _buildFloor — but add a subtle perspective gradient
    var carpetGrad=ctx.createLinearGradient(0,floor,0,floor+FLOOR_H);
    carpetGrad.addColorStop(0,'rgba(30,30,35,0.4)');carpetGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=carpetGrad;ctx.fillRect(0,floor,W,FLOOR_H);

    // ── U-shaped conference table — dark mahogany, perspective view ────────
    // The table in the image is a U/horseshoe opening toward camera.
    // We draw it as a thick U in perspective: two side arms coming toward viewer
    // and a connecting back bar, all with a glossy dark-red-brown surface.
    var tMid=Math.round(W/2);
    var tBackY=Math.round(floor*0.62);   // back of table (far end, near window)
    var tFrontY=floor-2;                 // front edge at floor level
    var tArmX_L=Math.round(W*0.14);     // left arm outer edge
    var tArmX_R=Math.round(W*0.86);     // right arm outer edge
    var tThick=18;                        // table top thickness in pixels
    var tInnerL=Math.round(W*0.30);      // inner channel left
    var tInnerR=Math.round(W*0.70);      // inner channel right

    var tableCol='#3d1a08';
    var tableHighlight='#6b3318';
    var tableShadow='#1a0803';
    var tableGloss='rgba(255,180,100,0.07)';

    // Helper: draw a filled trapezoid (perspective table surface)
    function trapezoid(x1,y1,x2,y2,x3,y3,x4,y4,fill,stroke){
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.lineTo(x4,y4);ctx.closePath();
      if(fill){ctx.fillStyle=fill;ctx.fill();}
      if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
    }

    // Back connecting bar (horizontal, far end, narrow in perspective)
    var backBarH=tThick*0.6;
    var backBarW_half=tInnerR-tMid; // half width of the back bar top face
    trapezoid(tArmX_L,tBackY, tArmX_R,tBackY, tArmX_R,tBackY+backBarH, tArmX_L,tBackY+backBarH, tableCol,'#2a1005');
    // Top face of back bar — lighter
    trapezoid(tArmX_L,tBackY-4, tArmX_R,tBackY-4, tArmX_R+4,tBackY+2, tArmX_L-4,tBackY+2, tableHighlight, null);
    // Gloss streak
    ctx.fillStyle=tableGloss;ctx.fillRect(tArmX_L+20,tBackY-4,tArmX_R-tArmX_L-40,2);

    // Left arm — runs from back bar to camera (trapezoid, wider at front)
    var leftArmOuterX_back=tArmX_L, leftArmOuterX_front=tArmX_L;
    var leftArmInnerX_back=tInnerL+20, leftArmInnerX_front=tInnerL;
    // Top face of left arm
    trapezoid(
      leftArmOuterX_back, tBackY,
      leftArmInnerX_back, tBackY,
      leftArmInnerX_front, tFrontY-tThick,
      leftArmOuterX_front, tFrontY-tThick,
      tableHighlight, null
    );
    // Front face of left arm (thin edge facing camera)
    trapezoid(
      leftArmOuterX_front, tFrontY-tThick,
      leftArmInnerX_front, tFrontY-tThick,
      leftArmInnerX_front, tFrontY,
      leftArmOuterX_front, tFrontY,
      tableCol, '#2a1005'
    );
    // Gloss on left arm top
    ctx.fillStyle=tableGloss;
    ctx.beginPath();ctx.moveTo(leftArmOuterX_back+4,tBackY+2);ctx.lineTo(leftArmInnerX_back-4,tBackY+2);ctx.lineTo(leftArmInnerX_front-4,tFrontY-tThick-1);ctx.lineTo(leftArmOuterX_front+4,tFrontY-tThick-1);ctx.closePath();ctx.fill();
    // Underside shadow left arm
    ctx.fillStyle=tableShadow;
    ctx.fillRect(leftArmOuterX_front, tFrontY, leftArmInnerX_front-leftArmOuterX_front, 6);

    // Right arm — mirror
    var rightArmOuterX_back=tArmX_R, rightArmOuterX_front=tArmX_R;
    var rightArmInnerX_back=tInnerR-20, rightArmInnerX_front=tInnerR;
    // Top face of right arm
    trapezoid(
      rightArmInnerX_back, tBackY,
      rightArmOuterX_back, tBackY,
      rightArmOuterX_front, tFrontY-tThick,
      rightArmInnerX_front, tFrontY-tThick,
      tableHighlight, null
    );
    // Front face of right arm
    trapezoid(
      rightArmInnerX_front, tFrontY-tThick,
      rightArmOuterX_front, tFrontY-tThick,
      rightArmOuterX_front, tFrontY,
      rightArmInnerX_front, tFrontY,
      tableCol, '#2a1005'
    );
    // Gloss on right arm
    ctx.fillStyle=tableGloss;
    ctx.beginPath();ctx.moveTo(rightArmInnerX_back+4,tBackY+2);ctx.lineTo(rightArmOuterX_back-4,tBackY+2);ctx.lineTo(rightArmOuterX_front-4,tFrontY-tThick-1);ctx.lineTo(rightArmInnerX_front+4,tFrontY-tThick-1);ctx.closePath();ctx.fill();
    // Underside shadow right arm
    ctx.fillStyle=tableShadow;
    ctx.fillRect(rightArmInnerX_front, tFrontY, rightArmOuterX_front-rightArmInnerX_front, 6);

    // Table legs — visible under front arms
    ctx.fillStyle='#2a1005';
    [[tArmX_L+8,tFrontY],[tInnerL-8,tFrontY],[tInnerR+8,tFrontY],[tArmX_R-8,tFrontY]].forEach(function(leg){
      ctx.fillRect(leg[0]-3,leg[1],6,14);
    });

    // Notepads / laptops on table surface — tiny details
    [[tArmX_L+20,tFrontY-tThick-2,'#fffef8'],[tArmX_L+45,tFrontY-tThick-2,'#e0e8f0'],
     [tArmX_R-35,tFrontY-tThick-2,'#fffef8'],[tArmX_R-60,tFrontY-tThick-2,'#e0e8f0']].forEach(function(p){
      ctx.fillStyle=p[2];ctx.fillRect(p[0],p[1]-6,18,6);
      ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=0.5;ctx.strokeRect(p[0],p[1]-6,18,6);
    });

    // ── Ambient light pool on floor inside U (carpet glow from windows) ────
    var poolGrad=ctx.createRadialGradient(tMid,floor-10,10,tMid,floor-30,tInnerR-tMid);
    poolGrad.addColorStop(0,'rgba(200,220,240,0.08)');poolGrad.addColorStop(1,'rgba(200,220,240,0)');
    ctx.fillStyle=poolGrad;ctx.fillRect(tInnerL,tBackY+backBarH,tInnerR-tInnerL,floor-tBackY-backBarH);
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
    this.charsLayer.innerHTML='';
    var team=App.state.team;
    if (!team.length) return;
    var W=this.container.offsetWidth||700;
    var forwardIds=Chat.forwardIds;
    var basePositions=this._calcPositions(team.length,W);

    team.forEach(function(member,i) {
      var isForward   = forwardIds.indexOf(member.id)!==-1;
      var isTalking   = Chat.talkingId===member.id;
      var isHandRaised= Chat.handRaisedIds.indexOf(member.id)!==-1;
      var pal         = PALETTES[member.colorIdx%PALETTES.length];
      var displayScale= isForward?ACTIVE_PX:IDLE_PX;
      var displayW    = Math.round(48*displayScale);
      var displayH    = Math.round(72*displayScale);

      // Wander state
      if (!World.wanderState[member.id]) {
        World.wanderState[member.id]={x:basePositions[i],targetX:basePositions[i],dir:1,moving:false,base:basePositions[i]};
      } else {
        World.wanderState[member.id].base=basePositions[i];
      }
      var wx=isForward?basePositions[i]:World.wanderState[member.id].x;

      var c=document.createElement('canvas');
      c.width=48*RENDER_SCALE; c.height=72*RENDER_SCALE;
      c.style.imageRendering='pixelated';
      c.style.width=displayW+'px'; c.style.height=displayH+'px';
      c.style.display='block';
      c.id='canvas-'+member.id;
      var ctx=c.getContext('2d');
      ctx.save(); ctx.scale(RENDER_SCALE,RENDER_SCALE);
      drawChar(ctx,pal,isForward?3:0,isForward?{facing:'front'}:{facing:'front'});
      ctx.restore();

      var wrapper=document.createElement('div');
      wrapper.className='character'+(isForward?' selected':'');
      wrapper.id='char-'+member.id;
      wrapper.style.cssText='position:absolute;left:'+wx+'px;bottom:'+FLOOR_H+'px;width:'+displayW+'px;height:'+displayH+'px;z-index:'+(isForward?20:10)+';opacity:'+(!isForward&&forwardIds.length>0?0.35:1)+';transition:opacity 0.3s ease;overflow:visible;cursor:pointer;';
      wrapper.appendChild(c);

      var nameEl=document.createElement('div');
      nameEl.className='char-name';
      nameEl.style.cssText='position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:'+(isForward?'7px':'5px')+';color:'+(isTalking?'#ffcc44':isForward?'#88aaff':'#6677aa')+';';
      nameEl.textContent=member.name.split(' ')[0].substring(0,10);
      wrapper.appendChild(nameEl);

      if (isHandRaised) {
        var hand=document.createElement('div');
        hand.style.cssText='position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:14px;cursor:pointer;animation:bob 0.6s ease-in-out infinite;';
        hand.textContent='✋';
        hand.addEventListener('click',function(e){e.stopPropagation();Chat.activateTalking(member.id);});
        wrapper.appendChild(hand);
      }

      wrapper.addEventListener('click',function(e){e.stopPropagation();World.selectChar(member.id);});
      World.charsLayer.appendChild(wrapper);

      // Idle wander for background chars
      if (!isForward) {
        World._startWander(member.id,c,pal,basePositions[i],W);
      }
    });
  },

  _startWander(id, canvas, pal, baseX, W) {
    var state=this.wanderState[id]||{x:baseX,targetX:baseX,dir:1,moving:false,base:baseX};
    state.base=baseX;
    this.wanderState[id]=state;

    // Walk animation state — kept outside the timer so it persists across ticks
    var walkPhase=0;
    var WALK_MS=160;   // ms per animation frame (4 frames = ~640ms per full cycle)
    var MOVE_MS=16;    // physics tick ~60fps
    var msSinceLastFrame=0;
    var lastTime=Date.now();

    // Speed chosen so a 120px journey takes ~2.5 walk cycles = feels natural
    // 120px / (0.06 px/ms) = 2000ms, 4 frames * 160ms = 640ms per cycle => ~3 cycles
    var SPEED=0.06; // px per ms

    var drawFront=function() {
      var ctx2=canvas.getContext('2d');
      ctx2.clearRect(0,0,canvas.width,canvas.height);
      ctx2.save(); ctx2.scale(RENDER_SCALE,RENDER_SCALE);
      drawChar(ctx2,pal,0,{facing:'front'});
      ctx2.restore();
    };

    var drawSide=function() {
      var ctx2=canvas.getContext('2d');
      ctx2.clearRect(0,0,canvas.width,canvas.height);
      ctx2.save(); ctx2.scale(RENDER_SCALE,RENDER_SCALE);
      var isContact=(walkPhase===0||walkPhase===2);
      drawChar(ctx2,pal,0,{facing:'side',walkPhase:walkPhase,flipX:state.dir<0,offsetY:isContact?1:0});
      ctx2.restore();
    };

    var pickTarget=function() {
      // Range big enough that walks last multiple full animation cycles
      var range=80+Math.random()*60; // 80–140px
      var offset=(Math.random()<0.5?-1:1)*range;
      state.targetX=Math.max(30,Math.min(W-70,state.base+offset));
      state.dir=state.targetX>state.x?1:-1;
      state.moving=true;
      // Draw side immediately so the first frame isn't a front-facing flash
      walkPhase=0; msSinceLastFrame=0;
      drawSide();
    };

    // Draw initial front pose (character starts standing)
    drawFront();

    var moveTimer=setInterval(function(){
      var wrapper=document.getElementById('char-'+id);
      if (!wrapper){clearInterval(moveTimer);return;}

      var now=Date.now();
      var dt=Math.min(now-lastTime, 100); // cap dt to avoid huge jumps after tab switch
      lastTime=now;

      if (state.moving) {
        var diff=state.targetX-state.x;
        if (Math.abs(diff)<1) {
          // Arrived — stop, face front, pause then wander again
          state.x=state.targetX;
          state.moving=false;
          wrapper.style.left=Math.round(state.x)+'px';
          drawFront();
          var stillTimer=setTimeout(function(){
            if (document.getElementById('char-'+id)) pickTarget();
          }, 2000+Math.random()*2500);
          World.animTimers[id+'_still']=stillTimer;
        } else {
          state.x+=Math.min(Math.abs(diff), SPEED*dt)*state.dir;
          wrapper.style.left=Math.round(state.x)+'px';
          // Advance walk frame on its own slower clock
          msSinceLastFrame+=dt;
          if (msSinceLastFrame>=WALK_MS) {
            msSinceLastFrame-=WALK_MS; // subtract rather than reset, keeps timing accurate
            walkPhase=(walkPhase+1)%4;
            drawSide();
          }
        }
      }
    }, MOVE_MS);
    World.animTimers[id+'_move']=moveTimer;

    // Initial pause before first wander (staggered so not all chars move at once)
    var pauseTimer=setTimeout(function(){
      if (document.getElementById('char-'+id)) pickTarget();
    }, 800+Math.random()*2000);
    World.animTimers[id+'_pause']=pauseTimer;
  },

  // Play an action on a specific character's canvas
  async playCharAction(id, actionName) {
    var canvas=document.getElementById('canvas-'+id);
    if (!canvas) return;
    var member=App.state.team.find(function(m){return m.id===id;});
    if (!member) return;
    var pal=PALETTES[member.colorIdx%PALETTES.length];
    var isForward=Chat.forwardIds.indexOf(id)!==-1;
    var scale=isForward?RENDER_SCALE*ACTIVE_PX/IDLE_PX:RENDER_SCALE;
    // Pause wander during action
    clearInterval(this.animTimers[id+'_move']);
    await playAction(canvas, pal, RENDER_SCALE, actionName);
  },

  selectChar(id) {
    var idx=Chat.forwardIds.indexOf(id);
    if (idx!==-1) {
      Chat.forwardIds.splice(idx,1);
      Chat.handRaisedIds=Chat.handRaisedIds.filter(function(x){return x!==id;});
      if (Chat.talkingId===id) Chat.talkingId=Chat.forwardIds.length?Chat.forwardIds[0]:null;
      if (Chat.forwardIds.length===0) Chat.dismissAll();
      else { Chat.renderPanel(); World.render(); }
    } else {
      Chat.forwardIds.push(id);
      if (!Chat.talkingId) Chat.talkingId=id;
      Chat.openPanel(); World.render();
    }
    App.setStatus(Chat.forwardIds.length
      ?Chat.forwardIds.length+' forward — click to talk, click again to send back'
      :'click a character to chat');
  },

  deselectAll() { document.querySelectorAll('.character').forEach(function(c){c.classList.remove('selected');}); },

  _calcPositions(count,W) {
    if (this.meetingMode) {
      var sp=Math.min(60,Math.floor(W*0.6/(count+1)));
      return Array.from({length:count},function(_,i){return Math.round(W/2+(i-(count-1)/2)*sp-24);});
    }
    var margin=60,usable=W-margin*2;
    if (count===1) return [Math.round(W/2-24)];
    return Array.from({length:count},function(_,i){return Math.round(margin+(usable/(count-1))*i-24);});
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(function(t){ if(typeof t==='number') clearInterval(t); clearTimeout(t); });
    this.animTimers={};
  }
};
