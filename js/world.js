// js/world.js — world rendering, character placement, walk-forward animation

const IDLE_SCALE   = 2;   // 96×144px at rest
const ACTIVE_SCALE = 5;   // 240×360px when talking — BIG
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
      s.style.cssText = `width:${sz}px;height:${sz}px;left:${(Math.random()*100).toFixed(1)}%;top:${(Math.random()*58).toFixed(1)}%;animation-delay:${(Math.random()*2).toFixed(2)}s;animation-duration:${(1.5+Math.random()*2).toFixed(2)}s`;
      layer.appendChild(s);
    }
  },

  _buildBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    const W = canvas.width  = this.container.offsetWidth  || 700;
    const H = canvas.height = this.container.offsetHeight || 320;
    const ctx = canvas.getContext('2d');

    // Distant skyline silhouette
    ctx.fillStyle = '#0d0c22';
    const buildings = [
      [0,   H-160, 50, 120],[55,  H-130, 40,  90],[100, H-170, 60, 130],
      [170, H-145, 40, 105],[220, H-185, 55, 145],[285, H-140, 38, 100],
      [330, H-165, 60, 125],[400, H-150, 45, 110],[455, H-180, 50, 140],
      [515, H-145, 45, 105],[570, H-170, 50, 130],[628, H-135, 42,  95],
      [676, H-155, 50, 115],
    ];
    buildings.forEach(([x, y, w, h]) => {
      ctx.fillRect(x, y, w, h);
      // windows
      for (let wx = x+5; wx < x+w-5; wx += 9) {
        for (let wy = y+8; wy < y+h-5; wy += 11) {
          ctx.fillStyle = Math.random() > 0.45 ? '#ffcc4418' : '#3366ff10';
          ctx.fillRect(wx, wy, 5, 6);
        }
      }
      ctx.fillStyle = '#0d0c22';
    });

    // Ground fog gradient
    const fog = ctx.createLinearGradient(0, H-90, 0, H-FLOOR_H);
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

    const team = App.state.team;
    if (!team.length) return;

    const W         = this.container.offsetWidth || 700;
    const positions = this._calcPositions(team.length, W);
    const activeId  = Chat.currentId;

    team.forEach((member, i) => {
      const isActive = member.id === activeId;
      const pal      = PALETTES[member.colorIdx % PALETTES.length];
      const scale    = isActive ? ACTIVE_SCALE : IDLE_SCALE;

      const { canvas, ctx } = makeCharCanvas(pal, scale);
      canvas.dataset.scale  = scale;
      canvas.id = 'canvas-' + member.id;

      const wrapper = document.createElement('div');
      wrapper.className   = 'character' + (isActive ? ' selected' : '');
      wrapper.id          = 'char-' + member.id;
      wrapper.style.left  = positions[i] + 'px';
      wrapper.style.bottom = isActive ? (FLOOR_H + 10) + 'px' : FLOOR_H + 'px';
      wrapper.style.width = (48 * scale) + 'px';
      wrapper.style.zIndex = isActive ? '20' : '10';
      wrapper.style.opacity = (!isActive && activeId) ? '0.45' : '1';
      wrapper.style.transition = 'opacity 0.4s ease, bottom 0.4s ease';

      wrapper.appendChild(canvas);

      const nameEl = document.createElement('div');
      nameEl.className   = 'char-name';
      nameEl.textContent = member.name.split(' ')[0].substring(0, 10);
      nameEl.style.fontSize = isActive ? '8px' : '5px';
      nameEl.style.color    = isActive ? '#ffcc44' : '';
      wrapper.appendChild(nameEl);

      if (member.bubble) {
        const bub = document.createElement('div');
        bub.className = 'speech-bubble';
        if (isActive) {
          bub.style.fontSize  = '7px';
          bub.style.maxWidth  = '180px';
          bub.style.padding   = '8px 10px';
        }
        bub.textContent = member.bubble;
        wrapper.appendChild(bub);
      }

      wrapper.addEventListener('click', () => this.selectChar(member.id));
      this.charsLayer.appendChild(wrapper);

      // Idle walk-cycle anim for non-active chars
      if (!isActive) {
        let f = 0;
        this.animTimers[member.id] = setInterval(() => {
          redrawChar(canvas, pal, f % 2 === 0 ? 1 : 2, IDLE_SCALE);
          f++;
        }, 350);
        // Pause after a few steps → stand
        setTimeout(() => {
          clearInterval(this.animTimers[member.id]);
          redrawChar(canvas, pal, 0, IDLE_SCALE);
        }, 1400);
      } else {
        // Active: forward-lean frame
        redrawChar(canvas, pal, 3, ACTIVE_SCALE);
      }
    });
  },

  /**
   * Animate the selected character walking toward camera before switching to big frame.
   */
  selectChar(id) {
    if (Chat.currentId === id) return;

    const member = App.state.team.find(m => m.id === id);
    if (!member) return;

    const wrapper = document.getElementById('char-' + id);
    const canvas  = document.getElementById('canvas-' + id);
    if (!wrapper || !canvas) return;

    const pal = PALETTES[member.colorIdx % PALETTES.length];
    this._clearWalkTimers(id);

    // Walk animation toward camera: 3 steps growing
    let step = 0;
    const steps = 5;
    const startScale = IDLE_SCALE;
    const endScale   = ACTIVE_SCALE;

    const walkFrames = [1, 2, 1, 2, 3];
    const walkTimer = setInterval(() => {
      if (step >= steps) {
        clearInterval(walkTimer);
        // Done walking — open chat
        Chat.open(member);
        World.render();
        App.setStatus('talking with ' + member.name);
        return;
      }

      const t = step / (steps - 1);
      const s = Math.round(startScale + (endScale - startScale) * t);

      // Resize canvas
      canvas.width  = 48 * s;
      canvas.height = 72 * s;
      canvas.style.width  = (48 * s) + 'px';
      canvas.style.height = (72 * s) + 'px';
      canvas.dataset.scale = s;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(s, s);
      drawPixelChar(ctx, pal, walkFrames[step]);
      ctx.restore();

      wrapper.style.width  = (48 * s) + 'px';
      wrapper.style.bottom = (FLOOR_H + step * 2) + 'px';

      step++;
    }, 100);

    this.walkTimers[id] = walkTimer;
    App.setStatus(member.name + ' is coming over...');
  },

  deselectAll() {
    document.querySelectorAll('.character').forEach(c => c.classList.remove('selected'));
  },

  _calcPositions(count, W) {
    if (this.meetingMode) {
      const spacing = Math.min(50, Math.floor(W * 0.5 / (count + 1)));
      const centerX = W / 2;
      return Array.from({ length: count }, (_, i) =>
        Math.round(centerX + (i - (count - 1) / 2) * spacing - 24)
      );
    }
    const margin = 60;
    const usable = W - margin * 2;
    if (count === 1) return [Math.round(W / 2 - 24)];
    return Array.from({ length: count }, (_, i) =>
      Math.round(margin + (usable / (count - 1)) * i - 24)
    );
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
