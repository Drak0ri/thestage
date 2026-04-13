// js/props.js — Physical world props with simple physics
// Props live in the same 2D space as characters.
// Characters interact by proximity. Props persist in App.state.props[].
// Spawned via [PROP:type|name] tag in chat responses.
//
// Supported types: ball, box, cushion, lamp, plant
// Physics: gravity + bounce for ball; static with open/close state for box

const PROP_TYPES = {
  ball:    { emoji: '⚽', label: 'Ball',    physics: true,  interactive: 'kick',   w: 28, h: 28 },
  box:     { emoji: '📦', label: 'Box',     physics: false, interactive: 'open',   w: 36, h: 32 },
  cushion: { emoji: '🛋️', label: 'Cushion', physics: false, interactive: 'sit',    w: 40, h: 22 },
  lamp:    { emoji: '💡', label: 'Lamp',    physics: false, interactive: 'toggle', w: 24, h: 40 },
  plant:   { emoji: '🌿', label: 'Plant',   physics: false, interactive: 'water',  w: 30, h: 38 },
  dice:    { emoji: '🎲', label: 'Dice',    physics: true,  interactive: 'roll',   w: 30, h: 30 },
  balloon: { emoji: '🎈', label: 'Balloon', physics: true,  interactive: 'pop',    w: 24, h: 32 },
};

const Props = {
  _loop:    null,
  _divs:    {},    // id → DOM div
  _physics: {},    // id → { vx, vy, onFloor }
  _layer:   null,

  init() {
    // Use the chars-layer for props too — same coordinate space, same floor
    this._layer = document.getElementById('props-layer');
    if (!this._layer) {
      this._layer = document.createElement('div');
      this._layer.id = 'props-layer';
      this._layer.style.cssText = 'position:absolute;inset:0;z-index:12;pointer-events:none;';
      var charsLayer = document.getElementById('chars-layer');
      if (charsLayer) charsLayer.parentNode.insertBefore(this._layer, charsLayer);
    }
    if (!App.state.props) App.state.props = [];
    this.render();
    this._startLoop();
  },

  render() {
    if (!this._layer) return;
    this._layer.innerHTML = '';
    this._divs = {};
    var props = App.state.props || [];
    var room = typeof World !== 'undefined' ? World.currentRoom : 'stage';
    props.filter(function(p) { return !p.room || p.room === room; })
      .forEach(function(p) { Props._makeDiv(p); });
  },

  _makeDiv(p) {
    var def = PROP_TYPES[p.type] || PROP_TYPES.ball;
    var FLOOR_H = 58;

    var div = document.createElement('div');
    div.id = 'prop-' + p.id;
    div.style.cssText = [
      'position:absolute',
      'left:' + Math.round(p.x) + 'px',
      'bottom:' + (FLOOR_H + (p.y || 0)) + 'px',
      'width:' + def.w + 'px',
      'height:' + def.h + 'px',
      'font-size:' + Math.min(def.w, def.h) + 'px',
      'line-height:' + def.h + 'px',
      'text-align:center',
      'cursor:pointer',
      'pointer-events:all',
      'user-select:none',
      'transition:filter 0.15s',
      'filter:drop-shadow(0 3px 4px rgba(0,0,0,0.5))',
    ].join(';');
    div.textContent = p.state === 'open' ? '📭' : (p.state === 'off' ? '🔦' : def.emoji);
    div.title = def.label + (p.name ? ': ' + p.name : '') + ' — click to interact';

    // Hover glow
    div.addEventListener('mouseenter', function() {
      div.style.filter = 'drop-shadow(0 3px 4px rgba(0,0,0,0.5)) brightness(1.4)';
    });
    div.addEventListener('mouseleave', function() {
      div.style.filter = 'drop-shadow(0 3px 4px rgba(0,0,0,0.5))';
    });

    // Click to interact
    div.addEventListener('click', function(e) {
      e.stopPropagation();
      Props.interact(p.id);
    });

    this._layer.appendChild(div);
    this._divs[p.id] = div;

    // Init physics state for physics props
    if (def.physics && !this._physics[p.id]) {
      this._physics[p.id] = { vx: 0, vy: 0, onFloor: true };
    }

    return div;
  },

  // ── Physics loop ────────────────────────────────────────────────────────
  _startLoop() {
    if (this._loop) cancelAnimationFrame(this._loop);
    var GRAVITY  = 0.4;
    var BOUNCE   = 0.55;
    var FRICTION = 0.92;
    var FLOOR_H  = 58;
    var last = 0;

    var step = function(ts) {
      Props._loop = requestAnimationFrame(step);
      if (ts - last < 16) return; // cap at ~60fps
      last = ts;

      var containerW = Props._layer ? (Props._layer.parentElement && Props._layer.parentElement.offsetWidth) || 700 : 700;
      var props = App.state.props || [];

      props.forEach(function(p) {
        var def = PROP_TYPES[p.type];
        if (!def || !def.physics) return;
        var ph = Props._physics[p.id];
        if (!ph) return;
        var div = Props._divs[p.id];
        if (!div) return;

        // Check proximity to characters — kick the prop
        var room = typeof World !== 'undefined' ? World.currentRoom : 'stage';
        if (!p.room || p.room === room) {
          var propCX = p.x + def.w / 2;
          Object.keys(World.wanderState || {}).forEach(function(cid) {
            var ws = World.wanderState[cid];
            if (!ws) return;
            var charCX = ws.x + 58; // approx char center
            var dist = propCX - charCX;
            if (Math.abs(dist) < 40 && ph.onFloor) {
              // Kick! velocity from character direction
              var kickDir = dist > 0 ? 1 : -1;
              ph.vx = kickDir * (4 + Math.random() * 3);
              ph.vy = 5 + Math.random() * 4;
              ph.onFloor = false;
              Props._bounce(p.id);
            }
          });
        }

        // Apply physics
        if (!ph.onFloor) {
          ph.vy -= GRAVITY;
          p.x += ph.vx;
          p.y = (p.y || 0) + ph.vy;
          ph.vx *= FRICTION;

          // Floor collision
          if (p.y <= 0) {
            p.y = 0;
            if (Math.abs(ph.vy) > 0.8) {
              ph.vy = Math.abs(ph.vy) * BOUNCE;
              ph.vx *= FRICTION;
            } else {
              ph.vy = 0;
              ph.vx *= 0.85;
              if (Math.abs(ph.vx) < 0.2) ph.vx = 0;
              ph.onFloor = true;
            }
          }

          // Wall bounce
          if (p.x < 0) { p.x = 0; ph.vx = Math.abs(ph.vx) * 0.7; }
          if (p.x > containerW - def.w) { p.x = containerW - def.w; ph.vx = -Math.abs(ph.vx) * 0.7; }

          div.style.left = Math.round(p.x) + 'px';
          div.style.bottom = (FLOOR_H + Math.round(p.y || 0)) + 'px';
        }
      });
    };
    Props._loop = requestAnimationFrame(step);
  },

  _bounce(id) {
    // CSS wiggle animation for feedback
    var div = this._divs[id];
    if (!div) return;
    div.style.transform = 'rotate(20deg)';
    setTimeout(function() { if (div) div.style.transform = ''; }, 200);
  },

  // ── Interact with a prop ─────────────────────────────────────────────────
  interact(id) {
    var p = (App.state.props || []).find(function(x) { return x.id === id; });
    if (!p) return;
    var def = PROP_TYPES[p.type] || {};

    if (def.interactive === 'kick') {
      var ph = this._physics[id] || { vx: 0, vy: 0, onFloor: true };
      this._physics[id] = ph;
      ph.vx = (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 4);
      ph.vy = 6 + Math.random() * 4;
      ph.onFloor = false;
      this._bounce(id);
      Chat.appendSystem(def.emoji + ' ' + (p.name || 'Ball') + ' kicked!');

    } else if (def.interactive === 'open') {
      p.state = p.state === 'open' ? 'closed' : 'open';
      var div = this._divs[id];
      if (div) div.textContent = p.state === 'open' ? '📭' : '📦';
      Storage.cloudSave(App.state);
      Chat.appendSystem((p.state === 'open' ? '📭 Opened' : '📦 Closed') + ': ' + (p.name || 'box'));

    } else if (def.interactive === 'roll') {
      var val = Math.ceil(Math.random() * 6);
      var faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      var div = this._divs[id];
      if (div) {
        div.textContent = '🎲';
        div.style.transform = 'rotate(360deg)';
        div.style.transition = 'transform 0.4s';
        setTimeout(function() {
          if (div) { div.textContent = faces[val]; div.style.transform = ''; }
        }, 400);
      }
      Chat.appendSystem('🎲 ' + (p.name || 'Dice') + ' rolled: ' + val + ' ' + faces[val]);

    } else if (def.interactive === 'toggle') {
      p.state = p.state === 'off' ? 'on' : 'off';
      var div = this._divs[id];
      if (div) div.textContent = p.state === 'off' ? '🔦' : '💡';
      Storage.cloudSave(App.state);
      Chat.appendSystem((p.state === 'on' ? '💡 On' : '🔦 Off') + ': ' + (p.name || 'lamp'));

    } else if (def.interactive === 'pop') {
      var div = this._divs[id];
      if (div) {
        div.textContent = '💥';
        div.style.fontSize = '40px';
        setTimeout(function() { Props.remove(id); }, 500);
      }
      Chat.appendSystem('💥 ' + (p.name || 'Balloon') + ' popped!');

    } else if (def.interactive === 'sit') {
      Chat.appendSystem('🛋️ ' + (p.name || 'Cushion') + ' — comfortable.');

    } else if (def.interactive === 'water') {
      var div = this._divs[id];
      if (div) {
        div.textContent = '🌱';
        setTimeout(function() { if (div) div.textContent = '🌿'; }, 1000);
      }
      Chat.appendSystem('💧 ' + (p.name || 'Plant') + ' watered.');
    }
  },

  // ── Create a prop (called from chat.js tag parser) ───────────────────────
  create(type, name, authorName, room) {
    if (!App.state.props) App.state.props = [];
    if (!PROP_TYPES[type]) type = 'ball';
    var containerW = (Props._layer && Props._layer.parentElement) ? Props._layer.parentElement.offsetWidth : 700;
    var id = 'prop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 4);
    var prop = {
      id: id,
      type: type,
      name: name || PROP_TYPES[type].label,
      authorName: authorName,
      room: room || (typeof World !== 'undefined' ? World.currentRoom : 'stage'),
      // Random position across the floor
      x: 80 + Math.random() * Math.max(200, containerW - 200),
      y: 0,
      state: type === 'lamp' ? 'on' : (type === 'box' ? 'closed' : null),
      createdAt: Date.now(),
    };
    App.state.props.push(prop);
    Storage.cloudSave(App.state);
    this._makeDiv(prop);
    return prop;
  },

  remove(id) {
    App.state.props = (App.state.props || []).filter(function(p) { return p.id !== id; });
    var div = this._divs[id];
    if (div) div.remove();
    delete this._divs[id];
    delete this._physics[id];
    Storage.cloudSave(App.state);
  },

  onRoomSwitch() { this.render(); },
  resize() {},

  // Context string for character system prompts
  getContextString(room) {
    var props = (App.state && App.state.props) || [];
    var r = room || (typeof World !== 'undefined' ? World.currentRoom : 'stage');
    var here = props.filter(function(p) { return !p.room || p.room === r; });
    if (!here.length) return '';
    var lines = here.map(function(p) {
      var def = PROP_TYPES[p.type] || {};
      var state = p.state ? ' [' + p.state + ']' : '';
      return def.emoji + ' ' + (p.name || def.label) + state + ' (placed by ' + (p.authorName || '?') + ', you can interact with it)';
    });
    return 'PHYSICAL OBJECTS IN THIS ROOM — you can kick, open, roll, toggle or reference these:\n' + lines.join('\n');
  },
};
