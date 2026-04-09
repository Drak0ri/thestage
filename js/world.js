// js/world.js

const IDLE_SCALE   = 1;
const RENDER_SCALE = 2;   // always render at 2x for crisp pixels, use CSS scale to size
const IDLE_CSS     = 1.0; // CSS scale at rest
const ACTIVE_CSS   = 1.8; // CSS scale when talking (80% bigger)
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
    window.addEventListener('resize', function() { World.render(); });

    // Click on world background = deselect
    this.container.addEventListener('click', function(e) {
      if (e.target === World.container || e.target.id === 'bg-canvas' || e.target.className === 'floor-tile' || e.target.id === 'stars-layer') {
        World._deactivate();
      }
    });
  },

  _deactivate() {
    if (!Chat.currentId) return;
    Chat.close();
    this.render();
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
      s.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' + (Math.random()*100).toFixed(1) + '%;top:' + (Math.random()*58).toFixed(1) + '%;animation-delay:' + (Math.random()*2).toFixed(2) + 's;animation-duration:' + (1.5+Math.random()*2).toFixed(2) + 's';
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
      [515,H-145,45,105],[570,H-170,50,130],[628,H-135,42,95],
      [676,H-155,50,115],
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

  render() {
    this._clearTimers();
    this.charsLayer.innerHTML = '';

    var team = App.state.team;
    if (!team.length) return;

    var W         = this.container.offsetWidth || 700;
    var positions = this._calcPositions(team.length, W);
    var activeId  = Chat.currentId;

    // Native canvas size (pixels)
    var charW = 48 * RENDER_SCALE;
    var charH = 72 * RENDER_SCALE;

    team.forEach(function(member, i) {
      var isActive = member.id === activeId;
      var pal      = PALETTES[member.colorIdx % PALETTES.length];
      var cssScale = isActive ? ACTIVE_CSS : IDLE_CSS;

      var result = makeCharCanvas(pal, RENDER_SCALE);
      var canvas = result.canvas;
      canvas.id  = 'canvas-' + member.id;

      var wrapper = document.createElement('div');
      wrapper.className = 'character' + (isActive ? ' selected' : '');
      wrapper.id        = 'char-' + member.id;
      wrapper.style.left    = positions[i] + 'px';
      wrapper.style.bottom  = FLOOR_H + 'px';
      wrapper.style.width   = charW + 'px';
      wrapper.style.zIndex  = isActive ? '20' : '10';
      wrapper.style.opacity = (!isActive && activeId) ? '0.4' : '1';
      // CSS scale from bottom-centre so they grow up from the floor
      wrapper.style.transformOrigin = 'bottom center';
      wrapper.style.transform       = 'scale(' + cssScale + ')';
      wrapper.style.transition      = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease';

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

      wrapper.addEventListener('click', function() { World.selectChar(member.id); });
      World.charsLayer.appendChild(wrapper);

      // Idle walk-cycle
      if (!isActive) {
        var f = 0;
        World.animTimers[member.id] = setInterval(function() {
          redrawChar(canvas, pal, f % 2 === 0 ? 1 : 2, RENDER_SCALE);
          f++;
        }, 350);
        setTimeout(function() {
          clearInterval(World.animTimers[member.id]);
          redrawChar(canvas, pal, 0, RENDER_SCALE);
        }, 1400);
      } else {
        redrawChar(canvas, pal, 3, RENDER_SCALE);
      }
    });
  },

  selectChar(id) {
    // Clicking the already-active char = deselect
    if (Chat.currentId === id) {
      this._deactivate();
      return;
    }

    var member = App.state.team.find(function(m) { return m.id === id; });
    if (!member) return;

    // If someone else was active, close them first then re-render with new active
    Chat.currentId = id;
    Chat.open(member);
    this.render();
    App.setStatus('talking with ' + member.name);
  },

  deselectAll() {
    document.querySelectorAll('.character').forEach(function(c) { c.classList.remove('selected'); });
  },

  _calcPositions(count, W) {
    if (this.meetingMode) {
      var spacing = Math.min(60, Math.floor(W * 0.6 / (count + 1)));
      var centerX = W / 2;
      return Array.from({length: count}, function(_, i) {
        return Math.round(centerX + (i - (count-1)/2) * spacing - 48);
      });
    }
    var margin = 60;
    var usable = W - margin * 2;
    if (count === 1) return [Math.round(W/2 - 48)];
    return Array.from({length: count}, function(_, i) {
      return Math.round(margin + (usable/(count-1)) * i - 48);
    });
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(clearInterval);
    this.animTimers = {};
    Object.values(this.walkTimers).forEach(clearInterval);
    this.walkTimers = {};
  }
};
