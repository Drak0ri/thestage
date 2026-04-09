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
    window.addEventListener('resize', function() { World._buildBgCanvas(); World.render(); });
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
    ctx.fillStyle='#1a0e06';ctx.fillRect(0,0,W,H);
    for(var px2=0;px2<W;px2+=60){ctx.fillStyle='rgba(80,40,10,0.15)';ctx.fillRect(px2,0,2,H-FLOOR_H);}
    for(var py=30;py<H-FLOOR_H;py+=50){ctx.fillStyle='rgba(80,40,10,0.1)';ctx.fillRect(0,py,W,2);}
    var wX=W/2-160,wY=20,wW=320,wH=H-FLOOR_H-40;
    ctx.fillStyle='#0a1628';ctx.fillRect(wX,wY,wW,wH);
    ctx.strokeStyle='#8b6914';ctx.lineWidth=4;ctx.strokeRect(wX,wY,wW,wH);
    ctx.beginPath();ctx.moveTo(wX+wW/2,wY);ctx.lineTo(wX+wW/2,wY+wH);ctx.moveTo(wX,wY+wH/2);ctx.lineTo(wX+wW,wY+wH/2);ctx.strokeStyle='#8b6914';ctx.lineWidth=2;ctx.stroke();
    for(var bx=wX+10;bx<wX+wW-10;bx+=18){var bh2=20+Math.random()*40;ctx.fillStyle='#0d0c22';ctx.fillRect(bx,wY+wH-bh2,14,bh2);for(var wy2=wY+wH-bh2+4;wy2<wY+wH-4;wy2+=8){ctx.fillStyle=Math.random()>0.4?'#ffcc4425':'#3366ff15';ctx.fillRect(bx+2,wy2,4,5);ctx.fillRect(bx+8,wy2,4,5);}}
    var tx=W/2-180,ty=H-FLOOR_H-28,tw=360,th=22;ctx.fillStyle='#5c3310';ctx.fillRect(tx,ty,tw,th);ctx.fillStyle='#7a4518';ctx.fillRect(tx,ty,tw,4);ctx.strokeStyle='#8b6914';ctx.lineWidth=2;ctx.strokeRect(tx,ty,tw,th);ctx.fillStyle='rgba(255,200,100,0.06)';ctx.fillRect(tx+10,ty+6,tw-20,4);
    for(var lx=100;lx<W-80;lx+=120){ctx.fillStyle='#ffeeaa22';ctx.beginPath();ctx.arc(lx,8,20,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe8aa';ctx.fillRect(lx-3,0,6,12);}
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
    var range=60;

    // 4-phase walk cycle: contact-A(0), passing(1), contact-B(2), passing(3)
    // Matches classic pixel art walk cycle research — contact frames bob down 1px,
    // passing frames are at neutral height. ~150ms per phase = natural walking pace.
    var walkPhase=0;
    var WALK_MS=150; // ms per animation frame — Shovel Knight pacing
    var MOVE_MS=16;  // physics tick rate (smooth position update, ~60fps feel)
    var msSinceLastFrame=0;
    var lastTime=Date.now();

    var pickTarget=function() {
      var offset=(Math.random()-0.5)*range*2;
      state.targetX=Math.max(20,Math.min(W-60,state.base+offset));
      state.dir=state.targetX>state.x?1:-1;
      state.moving=true;
    };

    var redrawWalk=function() {
      var ctx2=canvas.getContext('2d');
      ctx2.clearRect(0,0,canvas.width,canvas.height);
      ctx2.save(); ctx2.scale(RENDER_SCALE,RENDER_SCALE);
      // phases 0 and 2 are contact (foot plant) — bob body down 1px for weight
      var isContact=(walkPhase===0||walkPhase===2);
      drawChar(ctx2,pal,0,{
        facing:'side',
        walkPhase:walkPhase,
        flipX:state.dir<0,
        offsetY:isContact?1:0
      });
      ctx2.restore();
    };

    var pauseTimer=setTimeout(function(){
      pickTarget();
      var moveTimer=setInterval(function(){
        var wrapper=document.getElementById('char-'+id);
        if (!wrapper){clearInterval(moveTimer);return;}
        if (state.moving) {
          var now=Date.now();
          var dt=now-lastTime;
          lastTime=now;
          // Advance position smoothly every tick
          var speed=0.18; // px per ms — gentle idle wander pace
          var diff=state.targetX-state.x;
          if (Math.abs(diff)<2) {
            state.x=state.targetX;
            state.moving=false;
            walkPhase=0;
            msSinceLastFrame=0;
            var stillTimer=setTimeout(function(){
              if (document.getElementById('char-'+id)) pickTarget();
            }, 1500+Math.random()*2000);
            World.animTimers[id+'_still']=stillTimer;
            // Turn front on stop
            var ctx2=canvas.getContext('2d');
            ctx2.clearRect(0,0,canvas.width,canvas.height);
            ctx2.save();ctx2.scale(RENDER_SCALE,RENDER_SCALE);
            drawChar(ctx2,pal,0,{facing:'front'});
            ctx2.restore();
          } else {
            state.x+=Math.min(Math.abs(diff), speed*dt)*state.dir;
            wrapper.style.left=Math.round(state.x)+'px';
            // Advance walk frame on its own slower timer
            msSinceLastFrame+=dt;
            if (msSinceLastFrame>=WALK_MS) {
              msSinceLastFrame=0;
              walkPhase=(walkPhase+1)%4;
              redrawWalk();
            }
          }
          lastTime=now;
        }
      },MOVE_MS);
      World.animTimers[id+'_move']=moveTimer;
    }, 500+Math.random()*2000);
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
