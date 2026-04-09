// js/world.js

const IDLE_PX    = 1;   // render scale at rest: 48x72 display px
const ACTIVE_PX  = 1.8; // render scale active: ~86x130 display px
const RENDER_SCALE = 2; // canvas internal resolution multiplier (for crispness)
const FLOOR_H    = 58;  // height of floor tile

const World = {
  container:   null,
  charsLayer:  null,
  animTimers:  {},
  meetingMode: false,

  init() {
    this.container  = document.getElementById('world-container');
    this.charsLayer = document.getElementById('chars-layer');
    this._buildFloor();
    this._buildStars();
    this._buildBgCanvas();
    window.addEventListener('resize', function() { World.render(); });

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

  _buildFloor() {
    if (this.container.querySelector('.floor-tile')) return;
    var f = document.createElement('div');
    f.className = 'floor-tile';
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

  setMeetingMode(on) {
    this.meetingMode = on;
    this.render();
  },

  // Convert a fractional display scale to canvas pixels
  // We always render internally at RENDER_SCALE for crispness,
  // then set CSS width/height to the desired display size.
  _makeChar(pal, displayScale) {
    var internalW = 48 * RENDER_SCALE;
    var internalH = 72 * RENDER_SCALE;
    var displayW  = Math.round(48 * displayScale);
    var displayH  = Math.round(72 * displayScale);

    var c = document.createElement('canvas');
    c.width  = internalW;
    c.height = internalH;
    c.style.imageRendering = 'pixelated';
    c.style.width  = displayW + 'px';
    c.style.height = displayH + 'px';
    c.style.display = 'block';

    var ctx = c.getContext('2d');
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    drawPixelChar(ctx, pal, 0);

    return { canvas: c, displayW: displayW, displayH: displayH };
  },

  render() {
    this._clearTimers();
    this.charsLayer.innerHTML = '';

    var team = App.state.team;
    if (!team.length) return;

    var W         = this.container.offsetWidth || 700;
    var H         = this.container.offsetHeight || 320;
    var activeId  = Chat.currentId;
    var positions = this._calcPositions(team.length, W, activeId);

    team.forEach(function(member, i) {
      var isActive    = member.id === activeId;
      var pal         = PALETTES[member.colorIdx % PALETTES.length];
      var displayScale = isActive ? ACTIVE_PX : IDLE_PX;

      var built     = World._makeChar(pal, displayScale);
      var canvas    = built.canvas;
      var displayW  = built.displayW;
      var displayH  = built.displayH;
      canvas.id     = 'canvas-' + member.id;

      var wrapper = document.createElement('div');
      wrapper.className = 'character' + (isActive ? ' selected' : '');
      wrapper.id        = 'char-' + member.id;

      // Position: left = given position, bottom = floor level so feet touch floor
      wrapper.style.position = 'absolute';
      wrapper.style.left     = positions[i] + 'px';
      wrapper.style.bottom   = FLOOR_H + 'px';
      wrapper.style.width    = displayW + 'px';
      wrapper.style.height   = displayH + 'px';
      wrapper.style.zIndex   = isActive ? '20' : '10';
      wrapper.style.opacity  = (!isActive && activeId) ? '0.4' : '1';
      wrapper.style.transition = 'opacity 0.3s ease';
      wrapper.style.overflow = 'visible';

      wrapper.appendChild(canvas);

      var nameEl = document.createElement('div');
      nameEl.className   = 'char-name';
      nameEl.textContent = member.name.split(' ')[0].substring(0, 10);
      nameEl.style.fontSize = isActive ? '7px' : '5px';
      nameEl.style.color    = isActive ? '#ffcc44' : '';
      wrapper.appendChild(nameEl);

      if (member.bubble) {
        var bub = document.createElement('div');
        bub.className = 'speech-bubble';
        if (isActive) {
          bub.style.fontSize = '7px';
          bub.style.maxWidth = '160px';
          bub.style.padding  = '7px 9px';
        }
        bub.textContent = member.bubble;
        wrapper.appendChild(bub);
      }

      wrapper.addEventListener('click', function(e) {
        e.stopPropagation();
        World.selectChar(member.id);
      });
      World.charsLayer.appendChild(wrapper);

      // Idle walk-cycle anim
      if (!isActive) {
        var f = 0;
        World.animTimers[member.id] = setInterval(function() {
          var ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0, 0, canvas.width, canvas.height);
          ctx2.save();
          ctx2.scale(RENDER_SCALE, RENDER_SCALE);
          drawPixelChar(ctx2, pal, f % 2 === 0 ? 1 : 2);
          ctx2.restore();
          f++;
        }, 350);
        setTimeout(function() {
          clearInterval(World.animTimers[member.id]);
          var ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0, 0, canvas.width, canvas.height);
          ctx2.save();
          ctx2.scale(RENDER_SCALE, RENDER_SCALE);
          drawPixelChar(ctx2, pal, 0);
          ctx2.restore();
        }, 1400);
      } else {
        var ctx2 = canvas.getContext('2d');
        ctx2.clearRect(0, 0, canvas.width, canvas.height);
        ctx2.save();
        ctx2.scale(RENDER_SCALE, RENDER_SCALE);
        drawPixelChar(ctx2, pal, 3);
        ctx2.restore();
      }
    });
  },

  selectChar(id) {
    if (Chat.currentId === id) {
      this._deactivate();
      return;
    }
    var member = App.state.team.find(function(m) { return m.id === id; });
    if (!member) return;
    Chat.currentId = id;
    Chat.open(member);
    World.render();
    App.setStatus('talking with ' + member.name);
  },

  deselectAll() {
    document.querySelectorAll('.character').forEach(function(c) { c.classList.remove('selected'); });
  },

  _calcPositions(count, W, activeId) {
    if (this.meetingMode) {
      var spacing = Math.min(60, Math.floor(W * 0.6 / (count + 1)));
      var centerX = W / 2;
      return Array.from({length: count}, function(_, i) {
        return Math.round(centerX + (i - (count-1)/2) * spacing - 24);
      });
    }
    var margin = 60;
    var usable = W - margin * 2;
    // Base positions spread evenly
    var base = count === 1
      ? [Math.round(W/2 - 24)]
      : Array.from({length: count}, function(_, i) {
          return Math.round(margin + (usable/(count-1)) * i - 24);
        });
    return base;
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(clearInterval);
    this.animTimers = {};
  }
};
