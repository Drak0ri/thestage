// js/world.js — world rendering, character placement, walk-forward animation

const IDLE_SCALE   = 2;   // 96x144px at rest
const ACTIVE_SCALE = 3;   // 144x216px when active — big but fits in world
const FLOOR_H      = 70;

const World = {
  container:   null,
  charsLayer:  null,
  animTimers:  {},
  walkTimers:  {},
  meetingMode: false,

  init() {
    this.container  = document.getElementById('world-container');
    this.charsLayer = document.getElementById('chars-layer');
    this._buildFloor();
    this._buildStars();
    this._buildBgCanvas();
    window.addEventListener('resize', () => this.render());
  },

  _buildFloor() {
    const existing = this.container.querySelector('.floor-tile');
    if (existing) return;
    const f = document.createElement('div');
    f.className = 'floor-tile';
    this.container.appendChild(f);
  },

  _buildStars() {
    const layer = document.getElementById('stars-layer');
    layer.innerHTML = '';
    for (let i = 0; i < 45; i++) {
      const s  = document.createElement('div');
      s.className = 'star';
      const sz = (Math.random() * 2 + 1).toFixed(1);
      s.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' + (Math.random()*100).toFixed(1) + '%;top:' + (Math.random()*58).toFixed(1) + '%;animation-delay:' + (Math.random()*2).toFixed(2) + 's;animation-duration:' + (1.5+Math.random()*2).toFixed(2) + 's';
      layer.appendChild(s);
    }
  },

  _buildBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    const W = canvas.width  = this.container.offsetWidth  || 700;
    const H = canvas.height = this.container.offsetHeight || 320;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0d0c22';
    const buildings = [
      [0,   H-160, 50, 120],[55,  H-130, 40,  90],[100, H-170, 60, 130],
      [170, H-145, 40, 105],[220, H-185, 55, 145],[285, H-140, 38, 100],
      [330, H-165, 60, 125],[400, H-150, 45, 110],[455, H-180, 50, 140],
      [515, H-145, 45, 105],[570, H-170, 50, 130],[628, H-135, 42,  95],
      [676, H-155, 50, 115],
    ];
    buildings.forEach(function(b) {
      var x=b[0],y=b[1],w=b[2],h=b[3];
      ctx.fillStyle = '#0d0c22';
      ctx.fillRect(x, y, w, h);
      for (var wx = x+5; wx < x+w-5; wx += 9) {
        for (var wy = y+8; wy < y+h-5; wy += 11) {
          ctx.fillStyle = Math.random() > 0.45 ? '#ffcc4418' : '#3366ff10';
          ctx.fillRect(wx, wy, 5, 6);
        }
      }
    });

    var fog = ctx.createLinearGradient(0, H-90, 0, H-FLOOR_H);
    fog.addColorStop(0, 'rgba(15,14,23,0)');
    fog.addColorStop(1, 'rgba(15,14,23,0.6)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, H-90, W, 90);
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

    var W         = this.container.offsetWidth || 700;
    var positions = this._calcPositions(team.length, W);
    var activeId  = Chat.currentId;

    team.forEach(function(member, i) {
      var isActive = member.id === activeId;
      var pal      = PALETTES[member.colorIdx % PALETTES.length];
      var scale    = isActive ? ACTIVE_SCALE : IDLE_SCALE;

      var charW    = 48 * scale;
      var charH    = 72 * scale;

      var result   = makeCharCanvas(pal, scale);
      var canvas   = result.canvas;
      canvas.dataset.scale = scale;
      canvas.id = 'canvas-' + member.id;

      var wrapper = document.createElement('div');
      wrapper.className = 'character' + (isActive ? ' selected' : '');
      wrapper.id = 'char-' + member.id;

      // For active: centre horizontally in world, sit on floor
      if (isActive) {
        wrapper.style.left   = Math.round(W / 2 - charW / 2) + 'px';
        wrapper.style.bottom = FLOOR_H + 'px';
        wrapper.style.zIndex = '20';
        wrapper.style.opacity = '1';
      } else {
        wrapper.style.left   = positions[i] + 'px';
        wrapper.style.bottom = FLOOR_H + 'px';
        wrapper.style.zIndex = '10';
        wrapper.style.opacity = activeId ? '0.4' : '1';
      }
      wrapper.style.width = charW + 'px';
      wrapper.style.transition = 'opacity 0.4s ease';

      wrapper.appendChild(canvas);

      var nameEl = document.createElement('div');
      nameEl.className = 'char-name';
      nameEl.textContent = member.name.split(' ')[0].substring(0, 10);
      nameEl.style.fontSize = isActive ? '8px' : '5px';
      nameEl.style.color    = isActive ? '#ffcc44' : '';
      wrapper.appendChild(nameEl);

      if (member.bubble) {
        var bub = document.createElement('div');
        bub.className = 'speech-bubble';
        if (isActive) {
          bub.style.fontSize = '7px';
          bub.style.maxWidth = '180px';
          bub.style.padding  = '8px 10px';
        }
        bub.textContent = member.bubble;
        wrapper.appendChild(bub);
      }

      wrapper.addEventListener('click', function() { World.selectChar(member.id); });
      World.charsLayer.appendChild(wrapper);

      // Idle walk-cycle anim
      if (!isActive) {
        var f = 0;
        World.animTimers[member.id] = setInterval(function() {
          redrawChar(canvas, pal, f % 2 === 0 ? 1 : 2, IDLE_SCALE);
          f++;
        }, 350);
        setTimeout(function() {
          clearInterval(World.animTimers[member.id]);
          redrawChar(canvas, pal, 0, IDLE_SCALE);
        }, 1400);
      } else {
        redrawChar(canvas, pal, 3, ACTIVE_SCALE);
      }
    });
  },

  selectChar(id) {
    if (Chat.currentId === id) return;

    var member = App.state.team.find(function(m) { return m.id === id; });
    if (!member) return;

    var wrapper = document.getElementById('char-' + id);
    var canvas  = document.getElementById('canvas-' + id);
    if (!wrapper || !canvas) return;

    var pal = PALETTES[member.colorIdx % PALETTES.length];
    this._clearWalkTimers(id);

    var W = this.container.offsetWidth || 700;
    var step = 0;
    var steps = 5;
    var startScale = IDLE_SCALE;
    var endScale   = ACTIVE_SCALE;
    var walkFrames = [1, 2, 1, 2, 3];

    // Starting left position
    var startLeft = parseInt(wrapper.style.left) || 0;
    var endLeft   = Math.round(W / 2 - 48 * endScale / 2);

    var walkTimer = setInterval(function() {
      if (step >= steps) {
        clearInterval(walkTimer);
        Chat.open(member);
        World.render();
        App.setStatus('talking with ' + member.name);
        return;
      }

      var t = step / (steps - 1);
      var s = Math.round(startScale + (endScale - startScale) * t);
      var charW = 48 * s;
      var charH = 72 * s;

      // Interpolate left position toward centre
      var newLeft = Math.round(startLeft + (endLeft - startLeft) * t);

      canvas.width  = charW;
      canvas.height = charH;
      canvas.style.width  = charW + 'px';
      canvas.style.height = charH + 'px';
      canvas.dataset.scale = s;

      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, charW, charH);
      ctx.save();
      ctx.scale(s, s);
      drawPixelChar(ctx, pal, walkFrames[step]);
      ctx.restore();

      wrapper.style.width  = charW + 'px';
      wrapper.style.left   = newLeft + 'px';
      wrapper.style.bottom = FLOOR_H + 'px';

      step++;
    }, 100);

    this.walkTimers[id] = walkTimer;
    App.setStatus(member.name + ' is coming over...');
  },

  deselectAll() {
    document.querySelectorAll('.character').forEach(function(c) { c.classList.remove('selected'); });
  },

  _calcPositions(count, W) {
    if (this.meetingMode) {
      var spacing = Math.min(60, Math.floor(W * 0.6 / (count + 1)));
      var centerX = W / 2;
      return Array.from({ length: count }, function(_, i) {
        return Math.round(centerX + (i - (count - 1) / 2) * spacing - 24);
      });
    }
    var margin = 60;
    var usable = W - margin * 2;
    if (count === 1) return [Math.round(W / 2 - 24)];
    return Array.from({ length: count }, function(_, i) {
      return Math.round(margin + (usable / (count - 1)) * i - 24);
    });
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(clearInterval);
    this.animTimers = {};
    Object.values(this.walkTimers).forEach(clearInterval);
    this.walkTimers = {};
  },

  _clearWalkTimers(id) {
    if (this.walkTimers[id]) {
      clearInterval(this.walkTimers[id]);
      delete this.walkTimers[id];
    }
  }
};
