// js/world.js — world rendering, character placement, animations

const World = {
  container: null,
  charsLayer: null,
  animTimers: {},
  meetingMode: false,

  init() {
    this.container = document.getElementById('world-container');
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
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() * 2 + 1;
      s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*58}%;animation-delay:${(Math.random()*2).toFixed(2)}s;animation-duration:${(1.5+Math.random()*2).toFixed(2)}s`;
      layer.appendChild(s);
    }
  },

  _buildBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 320;
    const ctx = canvas.getContext('2d');

    // Distant city silhouette
    ctx.fillStyle = '#0d0c22';
    const buildings = [
      [20,180,40,100],[70,200,30,80],[110,170,50,110],[175,190,35,90],
      [220,160,45,120],[280,185,30,95],[320,175,55,105],[390,190,40,90],
      [445,165,35,115],[490,180,50,100],[555,170,40,110],[610,188,35,92],
    ];
    buildings.forEach(([x,y,w,h]) => ctx.fillRect(x, y, w, h));

    // Windows
    ctx.fillStyle = '#ffcc4422';
    buildings.forEach(([x,y,w,h]) => {
      for (let wx = x+6; wx < x+w-4; wx += 10) {
        for (let wy = y+8; wy < y+h-4; wy += 12) {
          if (Math.random() > 0.4) ctx.fillRect(wx, wy, 5, 7);
        }
      }
    });
  },

  setMeetingMode(on) {
    this.meetingMode = on;
    this.render();
  },

  render() {
    // Clear old anim timers
    Object.values(this.animTimers).forEach(clearInterval);
    this.animTimers = {};
    this.charsLayer.innerHTML = '';

    const team = App.state.team;
    if (!team.length) return;

    const W = this.container.offsetWidth || 600;
    const positions = this._calcPositions(team.length, W);

    team.forEach((member, i) => {
      const pal = PALETTES[member.colorIdx % PALETTES.length];
      const { canvas, ctx } = makeCharCanvas(pal, 2);

      const wrapper = document.createElement('div');
      wrapper.className = 'character' + (Chat.currentId === member.id ? ' selected' : '');
      wrapper.id = 'char-' + member.id;
      wrapper.style.left = positions[i] + 'px';
      wrapper.style.animationDelay = (i * 0.25).toFixed(2) + 's';

      wrapper.appendChild(canvas);

      const nameEl = document.createElement('div');
      nameEl.className = 'char-name';
      nameEl.textContent = member.name.split(' ')[0].substring(0, 9);
      wrapper.appendChild(nameEl);

      if (member.bubble) {
        const bub = document.createElement('div');
        bub.className = 'speech-bubble';
        bub.textContent = member.bubble;
        wrapper.appendChild(bub);
      }

      wrapper.addEventListener('click', () => {
        this.selectChar(member.id);
      });

      this.charsLayer.appendChild(wrapper);

      // Idle bob anim — subtle frame cycling
      let f = 0;
      this.animTimers[member.id] = setInterval(() => {
        if (Chat.currentId !== member.id) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save(); ctx.scale(2, 2);
          drawPixelChar(ctx, pal, f % 3 === 0 ? 0 : 0); // idle = stand
          ctx.restore();
        }
        f++;
      }, 800);
    });
  },

  _calcPositions(count, W) {
    if (this.meetingMode) {
      // Huddle in centre
      const spacing = Math.min(44, Math.floor(W * 0.5 / (count + 1)));
      const centerX = W / 2;
      return Array.from({ length: count }, (_, i) => {
        return Math.round(centerX + (i - (count - 1) / 2) * spacing - 16);
      });
    }
    // Spread across world
    const margin = 60;
    const usable = W - margin * 2;
    if (count === 1) return [Math.round(W / 2 - 16)];
    return Array.from({ length: count }, (_, i) =>
      Math.round(margin + (usable / (count - 1)) * i - 16)
    );
  },

  selectChar(id) {
    const member = App.state.team.find(m => m.id === id);
    if (!member) return;
    Chat.open(member);
    this.render(); // re-render to apply .selected class
    App.setStatus('chatting with ' + member.name);
  },

  deselectAll() {
    document.querySelectorAll('.character').forEach(c => c.classList.remove('selected'));
  }
};
