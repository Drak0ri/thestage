// js/world.js

const IDLE_PX      = 1;
const ACTIVE_PX    = 1.8;
const RENDER_SCALE = 2;
const FLOOR_H      = 58;

const World = {
  container:   null,
  charsLayer:  null,
  animTimers:  {},
  meetingMode: false,
  currentRoom: 'stage',

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
        World._deactivate();
      }
    });
  },

  _deactivate() {
    if (!Chat.currentId) return;
    Chat.close();
    World.render();
  },

  switchRoom(roomId) {
    if (!ROOMS[roomId]) return;
    this.currentRoom = roomId;
    Chat.close();
    this._buildFloor();
    this._buildBgCanvas();
    this.render();
    App.setStatus('Entered ' + ROOMS[roomId].statusLabel);
    // Update toolbar buttons
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
      room.floor.color1 + ' 0px,' + room.floor.color1 + ' 31px,' +
      room.floor.color2 + ' 32px,' + room.floor.color2 + ' 63px)';
    f.style.borderTopColor = room.floor.border;
    this.container.appendChild(f);
  },

  _buildStars() {
    var layer = document.getElementById('stars-layer');
    layer.innerHTML = '';
    for (var i = 0; i < 45; i++) {
      var s = document.createElement('div');
      s.className = 'star';
      var sz = (Math.random() * 2 + 1).toFixed(1);
      s.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' +
        (Math.random()*100).toFixed(1) + '%;top:' + (Math.random()*58).toFixed(1) +
        '%;animation-delay:' + (Math.random()*2).toFixed(2) +
        's;animation-duration:' + (1.5+Math.random()*2).toFixed(2) + 's';
      layer.appendChild(s);
    }
  },

  _buildBgCanvas() {
    var canvas = document.getElementById('bg-canvas');
    var W = canvas.width  = this.container.offsetWidth  || 700;
    var H = canvas.height = this.container.offsetHeight || 320;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    var room = ROOMS[this.currentRoom];

    if (this.currentRoom === 'stage') {
      this._drawStageRoom(ctx, W, H);
    } else if (this.currentRoom === 'boardroom') {
      this._drawBoardroom(ctx, W, H);
    } else if (this.currentRoom === 'playground') {
      this._drawPlayground(ctx, W, H);
    }
  },

  _drawStageRoom(ctx, W, H) {
    // Night city skyline
    var buildings = [
      [0,H-160,50,120],[55,H-130,40,90],[100,H-170,60,130],
      [170,H-145,40,105],[220,H-185,55,145],[285,H-140,38,100],
      [330,H-165,60,125],[400,H-150,45,110],[455,H-180,50,140],
      [515,H-145,45,105],[570,H-170,50,130],[628,H-135,42,95],[676,H-155,50,115],
    ];
    buildings.forEach(function(b) {
      ctx.fillStyle = '#0d0c22';
      ctx.fillRect(b[0],b[1],b[2],b[3]);
      for (var wx=b[0]+5; wx<b[0]+b[2]-5; wx+=9) {
        for (var wy=b[1]+8; wy<b[1]+b[3]-5; wy+=11) {
          ctx.fillStyle = Math.random()>0.45 ? '#ffcc4418' : '#3366ff10';
          ctx.fillRect(wx,wy,5,6);
        }
      }
    });
    var fog = ctx.createLinearGradient(0,H-90,0,H-FLOOR_H);
    fog.addColorStop(0,'rgba(15,14,23,0)');
    fog.addColorStop(1,'rgba(15,14,23,0.6)');
    ctx.fillStyle = fog;
    ctx.fillRect(0,H-90,W,90);
  },

  _drawBoardroom(ctx, W, H) {
    // Dark panelled walls
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(0, 0, W, H);

    // Wood panel strips on walls
    for (var px2 = 0; px2 < W; px2 += 60) {
      ctx.fillStyle = 'rgba(80,40,10,0.15)';
      ctx.fillRect(px2, 0, 2, H - FLOOR_H);
    }
    for (var py = 30; py < H - FLOOR_H; py += 50) {
      ctx.fillStyle = 'rgba(80,40,10,0.1)';
      ctx.fillRect(0, py, W, 2);
    }

    // Large window with city view
    var winX = W/2 - 160, winY = 20, winW = 320, winH = H - FLOOR_H - 40;
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(winX, winY, winW, winH);
    // Window frame
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 4;
    ctx.strokeRect(winX, winY, winW, winH);
    // Window cross bar
    ctx.beginPath();
    ctx.moveTo(winX + winW/2, winY);
    ctx.lineTo(winX + winW/2, winY + winH);
    ctx.moveTo(winX, winY + winH/2);
    ctx.lineTo(winX + winW, winY + winH/2);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.stroke();
    // City lights in window
    for (var bx = winX+10; bx < winX+winW-10; bx += 18) {
      var bh2 = 20 + Math.random() * 40;
      ctx.fillStyle = '#0d0c22';
      ctx.fillRect(bx, winY + winH - bh2, 14, bh2);
      for (var wy2 = winY + winH - bh2 + 4; wy2 < winY + winH - 4; wy2 += 8) {
        ctx.fillStyle = Math.random()>0.4 ? '#ffcc4425' : '#3366ff15';
        ctx.fillRect(bx+2, wy2, 4, 5);
        ctx.fillRect(bx+8, wy2, 4, 5);
      }
    }

    // Conference table
    var tx = W/2 - 180, ty = H - FLOOR_H - 28, tw = 360, th = 22;
    ctx.fillStyle = '#5c3310';
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = '#7a4518';
    ctx.fillRect(tx, ty, tw, 4);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, tw, th);
    // Table reflection
    ctx.fillStyle = 'rgba(255,200,100,0.06)';
    ctx.fillRect(tx+10, ty+6, tw-20, 4);

    // Ceiling lights
    for (var lx = 100; lx < W - 80; lx += 120) {
      ctx.fillStyle = '#ffeeaa22';
      ctx.beginPath();
      ctx.arc(lx, 8, 20, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffe8aa';
      ctx.fillRect(lx-3, 0, 6, 12);
    }
  },

  _drawPlayground(ctx, W, H) {
    // Bright daytime sky gradient
    ctx.fillStyle = '#0a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Clouds (puffy pixel clouds)
    var clouds = [[80,40,90],[220,25,70],[420,50,100],[580,30,80],[750,45,60]];
    clouds.forEach(function(c) {
      ctx.fillStyle = 'rgba(180,210,255,0.12)';
      ctx.beginPath(); ctx.arc(c[0], c[1], c[2]*0.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(c[0]+c[2]*0.3, c[1]+5, c[2]*0.35, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(c[0]-c[2]*0.3, c[1]+8, c[2]*0.3, 0, Math.PI*2); ctx.fill();
    });

    // Colourful pixel trees
    var trees = [[60,H-FLOOR_H],[160,H-FLOOR_H],[W-80,H-FLOOR_H],[W-200,H-FLOOR_H]];
    var treeColors = ['#2d8a2d','#3aaa3a','#1a6a1a','#44bb44'];
    trees.forEach(function(t, ti) {
      // trunk
      ctx.fillStyle = '#6b3a1a';
      ctx.fillRect(t[0]-4, t[1]-35, 8, 35);
      // canopy layers
      ctx.fillStyle = treeColors[ti % treeColors.length];
      ctx.fillRect(t[0]-18, t[1]-55, 36, 20);
      ctx.fillRect(t[0]-14, t[1]-70, 28, 18);
      ctx.fillRect(t[0]-10, t[1]-82, 20, 14);
      // highlight
      ctx.fillStyle = 'rgba(150,255,150,0.3)';
      ctx.fillRect(t[0]-10, t[1]-68, 10, 8);
    });

    // Scattered colourful pixel shapes (toys/balls)
    var shapes = [
      {x:120,y:H-FLOOR_H-8, c:'#ff4444', s:10},
      {x:300,y:H-FLOOR_H-6, c:'#4444ff', s:8},
      {x:480,y:H-FLOOR_H-9, c:'#ffaa00', s:11},
      {x:650,y:H-FLOOR_H-7, c:'#aa44ff', s:9},
    ];
    shapes.forEach(function(sh) {
      ctx.fillStyle = sh.c;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.s, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(sh.x-sh.s*0.3, sh.y-sh.s*0.3, sh.s*0.3, 0, Math.PI*2); ctx.fill();
    });

    // Hopscotch grid on floor area
    for (var hx = W/2-80; hx < W/2+80; hx += 36) {
      ctx.strokeStyle = 'rgba(255,200,50,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, H-FLOOR_H-2, 32, 20);
    }
  },

  setMeetingMode(on) {
    this.meetingMode = on;
    this.render();
  },

  render() {
    this._clearTimers();
    this.charsLayer.innerHTML = '';

    var team = App.state.team;
    if (!team.length) return;

    var W        = this.container.offsetWidth || 700;
    var activeId = Chat.currentId;
    var positions = this._calcPositions(team.length, W);

    team.forEach(function(member, i) {
      var isActive     = member.id === activeId;
      var pal          = PALETTES[member.colorIdx % PALETTES.length];
      var displayScale = isActive ? ACTIVE_PX : IDLE_PX;
      var displayW     = Math.round(48 * displayScale);
      var displayH     = Math.round(72 * displayScale);

      var c = document.createElement('canvas');
      c.width  = 48 * RENDER_SCALE;
      c.height = 72 * RENDER_SCALE;
      c.style.imageRendering = 'pixelated';
      c.style.width   = displayW + 'px';
      c.style.height  = displayH + 'px';
      c.style.display = 'block';
      c.id = 'canvas-' + member.id;

      var ctx = c.getContext('2d');
      ctx.save();
      ctx.scale(RENDER_SCALE, RENDER_SCALE);
      drawPixelChar(ctx, pal, isActive ? 3 : 0);
      ctx.restore();

      var wrapper = document.createElement('div');
      wrapper.className = 'character' + (isActive ? ' selected' : '');
      wrapper.id        = 'char-' + member.id;
      wrapper.style.position = 'absolute';
      wrapper.style.left     = positions[i] + 'px';
      wrapper.style.bottom   = FLOOR_H + 'px';
      wrapper.style.width    = displayW + 'px';
      wrapper.style.height   = displayH + 'px';
      wrapper.style.zIndex   = isActive ? '20' : '10';
      wrapper.style.opacity  = (!isActive && activeId) ? '0.4' : '1';
      wrapper.style.transition = 'opacity 0.3s ease';
      wrapper.style.overflow = 'visible';
      wrapper.style.cursor   = 'pointer';
      wrapper.appendChild(c);

      var nameEl = document.createElement('div');
      nameEl.className = 'char-name';
      nameEl.style.position  = 'absolute';
      nameEl.style.bottom    = '-14px';
      nameEl.style.left      = '50%';
      nameEl.style.transform = 'translateX(-50%)';
      nameEl.style.fontSize  = isActive ? '7px' : '5px';
      nameEl.style.color     = isActive ? '#ffcc44' : '#6677aa';
      nameEl.style.whiteSpace = 'nowrap';
      nameEl.textContent = member.name.split(' ')[0].substring(0, 10);
      wrapper.appendChild(nameEl);



      wrapper.addEventListener('click', function(e) {
        e.stopPropagation();
        World.selectChar(member.id);
      });
      World.charsLayer.appendChild(wrapper);

      if (!isActive) {
        var f = 0;
        World.animTimers[member.id] = setInterval(function() {
          var ctx2 = c.getContext('2d');
          ctx2.clearRect(0,0,c.width,c.height);
          ctx2.save(); ctx2.scale(RENDER_SCALE,RENDER_SCALE);
          drawPixelChar(ctx2, pal, f%2===0?1:2);
          ctx2.restore(); f++;
        }, 350);
        setTimeout(function() {
          clearInterval(World.animTimers[member.id]);
          var ctx2 = c.getContext('2d');
          ctx2.clearRect(0,0,c.width,c.height);
          ctx2.save(); ctx2.scale(RENDER_SCALE,RENDER_SCALE);
          drawPixelChar(ctx2, pal, 0);
          ctx2.restore();
        }, 1400);
      }
    });
  },

  selectChar(id) {
    if (Chat.currentId === id) { this._deactivate(); return; }
    var member = App.state.team.find(function(m) { return m.id === id; });
    if (!member) return;
    Chat.currentId = id;
    Chat.open(member);
    World.render();
    App.setStatus('talking with ' + member.name + ' in ' + ROOMS[World.currentRoom].statusLabel);
  },

  deselectAll() {
    document.querySelectorAll('.character').forEach(function(c) { c.classList.remove('selected'); });
  },

  _calcPositions(count, W) {
    if (this.meetingMode) {
      var spacing = Math.min(60, Math.floor(W * 0.6 / (count + 1)));
      return Array.from({length: count}, function(_, i) {
        return Math.round(W/2 + (i-(count-1)/2)*spacing - 24);
      });
    }
    var margin = 60, usable = W - margin * 2;
    if (count === 1) return [Math.round(W/2 - 24)];
    return Array.from({length: count}, function(_, i) {
      return Math.round(margin + (usable/(count-1))*i - 24);
    });
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(clearInterval);
    this.animTimers = {};
  }
};
