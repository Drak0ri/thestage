// js/objects.js — Ambient world objects. Procedural, infrequent, room-aware.
// Max 2 objects on screen at once. Objects retire themselves. Easter eggs hidden in the pool.
// Draws to a dedicated canvas layered above the floor but below characters.

const WorldObjects = (function() {

  var _canvas = null;
  var _ctx    = null;
  var _active = [];       // currently visible objects, max 2
  var _timers = [];       // setInterval/setTimeout handles
  var _spawnTimer = null;
  var _frameTimer = null;
  var _t = 0;             // global tick counter for animations

  // ─── Cooldown tracking ────────────────────────────────────────────────────
  // Prevent the same object type spawning twice in a row
  var _lastSpawned = [];   // ring buffer of last 4 type ids

  // ─── Spawn probability table ──────────────────────────────────────────────
  // Weight: higher = more common. Easter eggs have very low weight.
  // rooms: which rooms it can appear in (null = all)
  var POOL = [
    // ── Passive ambient ──────────────────────────────────────────────────────
    { id:'leaf',       w:12, rooms:['stage','playground'], fn: spawnLeaf      },
    { id:'bubble',     w:8,  rooms:['stage','playground'], fn: spawnBubble    },
    { id:'paperplane', w:7,  rooms:['boardroom','stage'],  fn: spawnPaperPlane},
    { id:'dust',       w:10, rooms:null,                   fn: spawnDustMotes },
    { id:'spider',     w:5,  rooms:['stage','boardroom'],  fn: spawnSpider    },
    { id:'coin',       w:6,  rooms:null,                   fn: spawnCoin      },
    { id:'bird',       w:5,  rooms:['stage','playground'], fn: spawnBird      },
    { id:'clock',      w:4,  rooms:['boardroom'],          fn: spawnClock     },
    { id:'balloon',    w:4,  rooms:['playground'],         fn: spawnBalloon   },
    { id:'raindrop',   w:3,  rooms:['stage'],              fn: spawnRain      },
    // ── Interactive (char proximity triggers) ─────────────────────────────
    { id:'coffee',     w:9,  rooms:['boardroom','stage'],  fn: spawnCoffee    },
    { id:'ball',       w:7,  rooms:['playground'],         fn: spawnBall      },
    { id:'cat',        w:4,  rooms:['stage','playground'], fn: spawnCat       },
    { id:'stickynote', w:5,  rooms:['boardroom'],          fn: spawnStickyNote},
    // ── Easter eggs (rare) ───────────────────────────────────────────────
    { id:'ufo',        w:1,  rooms:['stage'],              fn: spawnUFO       },
    { id:'ghost',      w:1,  rooms:['stage'],              fn: spawnGhost     },
    { id:'duck',       w:1,  rooms:null,                   fn: spawnDuck      },
    { id:'404',        w:1,  rooms:['boardroom'],          fn: spawnFourOhFour},
    { id:'pizza',      w:1,  rooms:null,                   fn: spawnPizza     },
    { id:'tiny',       w:1,  rooms:['playground'],         fn: spawnTinyDancer},
  ];

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function W() { return _canvas ? _canvas.width  : 700; }
  function H() { return _canvas ? _canvas.height : 320; }
  function FLOOR() { return H() - FLOOR_H; } // y of floor top

  function rnd(a, b)  { return a + Math.random() * (b - a); }
  function rndInt(a,b){ return Math.floor(rnd(a, b+1)); }
  function pick(arr)  { return arr[Math.floor(Math.random()*arr.length)]; }

  function clear() {
    if (_ctx) _ctx.clearRect(0, 0, W(), H());
  }

  // Register a timer so we can clean up on room switch / destroy
  function addTimer(t) { _timers.push(t); return t; }

  function killObject(obj) {
    if (obj._intervals) obj._intervals.forEach(clearInterval);
    if (obj._timeouts)  obj._timeouts.forEach(clearTimeout);
    var i = _active.indexOf(obj);
    if (i !== -1) _active.splice(i, 1);
  }

  // Draw all active objects — called from main render loop
  function _drawAll() {
    clear();
    var t = _t;
    _active.forEach(function(obj) {
      if (obj.draw) {
        try { obj.draw(_ctx, t); } catch(e) {}
      }
    });
    _t++;
  }

  // Find nearest character x position
  function nearestCharX() {
    var chars = document.querySelectorAll('.character');
    var best = null, bestD = 9999;
    chars.forEach(function(el) {
      var x = parseFloat(el.style.left) + 24;
      var d = Math.abs(x - W()/2);
      if (d < bestD) { bestD = d; best = x; }
    });
    return best;
  }

  // Check if any char is within px of given x
  function charNear(x, px) {
    var chars = document.querySelectorAll('.character');
    for (var i=0; i<chars.length; i++) {
      var cx = parseFloat(chars[i].style.left) + 24;
      if (Math.abs(cx - x) < px) return true;
    }
    return false;
  }

  // ─── Spawn dispatcher ────────────────────────────────────────────────────

  function _trySpawn() {
    if (_active.length >= 2) return;                   // max 2

    var room = (typeof World !== 'undefined') ? World.currentRoom : 'stage';

    // Build weighted candidate list, excluding recently spawned and wrong rooms
    var candidates = [];
    POOL.forEach(function(entry) {
      if (_lastSpawned.indexOf(entry.id) !== -1) return; // avoid repeat
      if (entry.rooms && entry.rooms.indexOf(room) === -1) return;
      for (var i=0; i<entry.w; i++) candidates.push(entry);
    });

    if (!candidates.length) return;
    var chosen = pick(candidates);

    // Track last spawned
    _lastSpawned.push(chosen.id);
    if (_lastSpawned.length > 4) _lastSpawned.shift();

    var obj = chosen.fn();
    if (obj) _active.push(obj);
  }

  // ─── Init / destroy ──────────────────────────────────────────────────────

  function init() {
    // Create or reuse canvas
    _canvas = document.getElementById('objects-canvas');
    if (!_canvas) {
      _canvas = document.createElement('canvas');
      _canvas.id = 'objects-canvas';
      _canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
      var container = document.getElementById('world-container');
      if (container) {
        var charsLayer = document.getElementById('chars-layer');
        container.insertBefore(_canvas, charsLayer);
      }
    }
    _resize();
    _ctx = _canvas.getContext('2d');

    // Frame render loop ~30fps
    if (_frameTimer) clearInterval(_frameTimer);
    _frameTimer = setInterval(_drawAll, 33);

    // Spawn check every 12–25s — deliberately infrequent
    function scheduleSpawn() {
      _spawnTimer = setTimeout(function() {
        _trySpawn();
        scheduleSpawn();
      }, rnd(12000, 28000));
    }
    // First spawn: 5–12s after load (let scene settle)
    _spawnTimer = setTimeout(function() {
      _trySpawn();
      scheduleSpawn();
    }, rnd(5000, 12000));
  }

  function _resize() {
    if (!_canvas) return;
    var c = document.getElementById('world-container');
    if (c) {
      _canvas.width  = c.offsetWidth  || 700;
      _canvas.height = c.offsetHeight || 320;
    }
  }

  function onRoomSwitch() {
    // Kill all active objects cleanly on room switch
    _active.slice().forEach(killObject);
    _active = [];
    _lastSpawned = [];
    clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBJECT DEFINITIONS
  // Each returns an object with { draw(ctx,t), _intervals[], _timeouts[] }
  // The object removes itself from _active when done.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tumbling leaf ──────────────────────────────────────────────────────────
  function spawnLeaf() {
    var x = rnd(60, W()-60);
    var y = rnd(20, FLOOR()-80);
    var vx = rnd(-0.3, 0.3);
    var vy = rnd(0.15, 0.4);
    var angle = 0;
    var va = rnd(-0.04, 0.04);
    var col = pick(['#4a8c2a','#8c6a2a','#cc7722','#a83c10','#6a9c3a']);
    var obj = { _intervals:[], _timeouts:[], x:x, y:y };

    obj.draw = function(ctx, t) {
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(angle);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI*2);
      ctx.fill();
      // vein
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(3,0); ctx.stroke();
      ctx.restore();
      obj.x += vx + Math.sin(t*0.04)*0.2;
      obj.y += vy;
      angle += va;
      if (obj.y > FLOOR() || obj.x < 0 || obj.x > W()) killObject(obj);
    };
    return obj;
  }

  // ── Floating soap bubble ───────────────────────────────────────────────────
  function spawnBubble() {
    var x = rnd(80, W()-80);
    var y = FLOOR() - rnd(10, 30);
    var r = rnd(4, 9);
    var vx = rnd(-0.15, 0.15);
    var vy = -rnd(0.2, 0.5);
    var life = 0;
    var maxLife = rndInt(120, 280);
    var obj = { _intervals:[], _timeouts:[], x:x, y:y };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life < 20 ? life/20 : life > maxLife-20 ? (maxLife-life)/20 : 1;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = 'rgba(180,220,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI*2); ctx.stroke();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(obj.x - r*0.3, obj.y - r*0.3, r*0.25, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      obj.x += vx + Math.sin(t*0.03)*0.1;
      obj.y += vy;
      if (life >= maxLife || obj.y < 0) killObject(obj);
    };
    return obj;
  }

  // ── Paper aeroplane ────────────────────────────────────────────────────────
  function spawnPaperPlane() {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var x = dir === 1 ? -20 : W()+20;
    var y = rnd(30, FLOOR()-80);
    var speed = rnd(0.8, 1.5);
    var wobble = 0;
    var obj = { _intervals:[], _timeouts:[], x:x, y:y };

    obj.draw = function(ctx, t) {
      wobble = Math.sin(t * 0.08) * 6;
      ctx.save();
      ctx.translate(obj.x, obj.y + wobble);
      ctx.scale(dir, 1);
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-14, -4); ctx.lineTo(-10, 0); ctx.lineTo(-14, 4); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // fold line
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-10,0); ctx.stroke();
      ctx.restore();
      obj.x += speed * dir;
      if (obj.x > W()+30 || obj.x < -30) killObject(obj);
    };
    return obj;
  }

  // ── Dust motes (group of 5, slow drift) ───────────────────────────────────
  function spawnDustMotes() {
    var motes = [];
    for (var i=0; i<5; i++) {
      motes.push({
        x: rnd(50, W()-50),
        y: rnd(40, FLOOR()-60),
        r: rnd(1, 2.5),
        vx: rnd(-0.05, 0.05),
        vy: rnd(-0.05, 0.05),
        phase: rnd(0, Math.PI*2)
      });
    }
    var life = 0, maxLife = rndInt(200, 400);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life < 30 ? life/30 : life > maxLife-30 ? (maxLife-life)/30 : 1;
      motes.forEach(function(m) {
        m.x += m.vx + Math.sin(t*0.02 + m.phase)*0.08;
        m.y += m.vy + Math.cos(t*0.015 + m.phase)*0.06;
        ctx.save();
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = '#ffffee';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      });
      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Spider on thread ──────────────────────────────────────────────────────
  function spawnSpider() {
    var x = rnd(80, W()-80);
    var yTop = rnd(10, 50);
    var y = yTop;
    var vy = 0.2;
    var maxDrop = rnd(60, 130);
    var phase = 'down'; // down → pause → up → done
    var pauseCount = 0;
    var obj = { _intervals:[], _timeouts:[], x:x, y:y };

    obj.draw = function(ctx, t) {
      // Thread
      ctx.save();
      ctx.strokeStyle = 'rgba(200,200,200,0.5)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(obj.x, yTop); ctx.lineTo(obj.x, obj.y); ctx.stroke();
      // Body
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(obj.x, obj.y, 3, 2, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.arc(obj.x, obj.y-3, 1.5, 0, Math.PI*2); ctx.fill();
      // Legs
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.7;
      for (var i=0; i<4; i++) {
        var la = (i/3 - 0.5) * 1.2;
        var legWob = Math.sin(t*0.12 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(obj.x-2, obj.y);
        ctx.lineTo(obj.x-8-legWob, obj.y + la*4 + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obj.x+2, obj.y);
        ctx.lineTo(obj.x+8+legWob, obj.y + la*4 + 2);
        ctx.stroke();
      }
      ctx.restore();

      if (phase === 'down') {
        obj.y += vy;
        if (obj.y - yTop >= maxDrop) { phase = 'pause'; pauseCount = 0; }
      } else if (phase === 'pause') {
        pauseCount++;
        if (pauseCount > 80) phase = 'up';
      } else if (phase === 'up') {
        obj.y -= vy * 1.5;
        if (obj.y <= yTop + 2) killObject(obj);
      }
    };
    return obj;
  }

  // ── Spinning coin ─────────────────────────────────────────────────────────
  function spawnCoin() {
    var x = rnd(80, W()-80);
    var y = FLOOR() - 1;
    var life = 0, maxLife = rndInt(180, 320);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life < 20 ? life/20 : life > maxLife-20 ? (maxLife-life)/20 : 1;
      // Squish to simulate coin spin (perspective illusion)
      var scaleX = Math.abs(Math.sin(t * 0.15));
      if (scaleX < 0.05) scaleX = 0.05;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(scaleX, 1);
      ctx.fillStyle = '#d4aa00';
      ctx.beginPath(); ctx.ellipse(0, -4, 5, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0c800';
      ctx.beginPath(); ctx.ellipse(0, -4, 3, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Small bird landing and pecking ────────────────────────────────────────
  function spawnBird() {
    var x = rnd(100, W()-100);
    var y = FLOOR() - 4;
    var phase = 'land';
    var dropY = rnd(60, 120);
    var curY = y - dropY;
    var peckCount = 0, peckMax = rndInt(3, 8);
    var peckPhase = 0;
    var col = pick(['#222','#4a3a2a','#1a3a1a','#3a2a4a']);
    var obj = { _intervals:[], _timeouts:[], x:x };

    obj.draw = function(ctx, t) {
      ctx.save();
      ctx.translate(obj.x, 0);
      if (phase === 'land') {
        curY += 1.2;
        if (curY >= y) { curY = y; phase = 'peck'; }
      }
      // Wing flutter while landing
      var wingSpread = phase === 'land' ? Math.sin(t*0.3)*3 : 0;
      // Body
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, curY, 5, 3, -0.2, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.arc(4, curY-2, 2.5, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(5, curY-2.5, 0.7, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#cc9900';
      var beakDip = (phase==='peck' && peckPhase>0) ? 2 : 0;
      ctx.beginPath(); ctx.moveTo(6, curY-2+beakDip); ctx.lineTo(10, curY-1+beakDip); ctx.lineTo(6, curY-1+beakDip); ctx.closePath(); ctx.fill();
      // Wings
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(-2, curY, 5, 2-wingSpread*0.3, 0.3, 0, Math.PI*2); ctx.fill();
      // Tail
      ctx.beginPath(); ctx.moveTo(-5,curY); ctx.lineTo(-10,curY+2); ctx.lineTo(-5,curY+1); ctx.closePath(); ctx.fill();
      // Feet
      ctx.strokeStyle='#888'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(-1,curY+3); ctx.lineTo(-4,curY+5); ctx.moveTo(-1,curY+3); ctx.lineTo(2,curY+5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2,curY+3); ctx.lineTo(-1,curY+5); ctx.moveTo(2,curY+3); ctx.lineTo(5,curY+5); ctx.stroke();
      ctx.restore();

      if (phase === 'peck') {
        peckPhase = Math.floor(t % 20) < 8 ? 1 : 0;
        if (t % 20 === 0) { peckCount++; obj.x += rnd(-3,3); }
        if (peckCount >= peckMax) killObject(obj);
      }
    };
    return obj;
  }

  // ── Ticking wall clock (boardroom only) ───────────────────────────────────
  function spawnClock() {
    var x = rnd(80, W()-80);
    var y = rnd(40, 90);
    var startMs = Date.now();
    var life = 0, maxLife = rndInt(300, 600);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life < 20 ? life/20 : life > maxLife-20 ? (maxLife-life)/20 : 1;
      var elapsed = (Date.now() - startMs) / 1000;
      var secAngle  = (elapsed % 60) / 60 * Math.PI * 2 - Math.PI/2;
      var minAngle  = (elapsed % 3600) / 3600 * Math.PI * 2 - Math.PI/2;
      var r = 10;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      // Face
      ctx.fillStyle = '#f5f0e8';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
      ctx.stroke();
      // Hour marks
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
      for (var i=0; i<12; i++) {
        var a = i/12*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*(r-2), Math.sin(a)*(r-2));
        ctx.lineTo(Math.cos(a)*(r-3.5), Math.sin(a)*(r-3.5));
        ctx.stroke();
      }
      // Minute hand
      ctx.strokeStyle='#333'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(minAngle)*7, Math.sin(minAngle)*7); ctx.stroke();
      // Second hand
      ctx.strokeStyle='#cc2200'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(secAngle)*8, Math.sin(secAngle)*8); ctx.stroke();
      // Centre dot
      ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill();
      ctx.restore();
      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Balloon floating up ───────────────────────────────────────────────────
  function spawnBalloon() {
    var x = rnd(80, W()-80);
    var y = FLOOR() - 20;
    var col = pick(['#ff4444','#4488ff','#ffcc00','#44cc88','#ff88cc']);
    var vy = -rnd(0.15, 0.35);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      var wobbleX = Math.sin(t*0.05)*3;
      ctx.save();
      ctx.translate(x + wobbleX, y);
      // String
      ctx.strokeStyle='rgba(150,150,150,0.6)'; ctx.lineWidth=0.6;
      ctx.beginPath(); ctx.moveTo(0,8); ctx.quadraticCurveTo(wobbleX*0.5, 20, 0, 30); ctx.stroke();
      // Balloon
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-3,-4,3,4,Math.PI/6,0,Math.PI*2); ctx.fill();
      // Tie
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-2,10); ctx.lineTo(2,10); ctx.lineTo(0,14); ctx.closePath(); ctx.fill();
      ctx.restore();
      y += vy;
      if (y < -30) killObject(obj);
    };
    return obj;
  }

  // ── Rain streak (stage only, appears in window) ───────────────────────────
  function spawnRain() {
    var drops = [];
    for (var i=0; i<12; i++) {
      drops.push({ x: rnd(0, W()), y: rnd(-40, FLOOR()), vy: rnd(3, 6) });
    }
    var life=0, maxLife=rndInt(100,200);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life<15?life/15:life>maxLife-15?(maxLife-life)/15:1;
      ctx.save(); ctx.globalAlpha = alpha*0.35;
      ctx.strokeStyle = '#aaccff'; ctx.lineWidth = 0.8;
      drops.forEach(function(d) {
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x-1, d.y+8); ctx.stroke();
        d.y += d.vy;
        if (d.y > FLOOR()) { d.y = rnd(-20,0); d.x = rnd(0, W()); }
      });
      ctx.restore();
      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Steaming coffee cup (interactive — steams more when char is near) ──────
  function spawnCoffee() {
    var x = rnd(80, W()-80);
    var y = FLOOR() - 1;
    var life=0, maxLife=rndInt(250,450);
    var steamParticles = [];
    var obj = { _intervals:[], _timeouts:[] };

    function addSteam() {
      steamParticles.push({ x:x+rnd(-3,3), y:y-18, vy:-rnd(0.3,0.7), vx:rnd(-0.1,0.1), alpha:0.6, r:rnd(1.5,3) });
    }

    obj.draw = function(ctx, t) {
      life++;
      var near = charNear(x, 50);
      if (t % (near ? 4 : 12) === 0) addSteam();

      // Cup body
      ctx.save();
      ctx.fillStyle = '#dde8f0';
      ctx.fillRect(x-7, y-16, 14, 14);
      ctx.fillStyle='#b8ccdd';
      ctx.fillRect(x-7, y-16, 14, 2); // rim
      ctx.fillRect(x-7, y-3, 14, 1);  // base line
      // Handle
      ctx.strokeStyle='#b8ccdd'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x+9, y-10, 4, -Math.PI/2, Math.PI/2); ctx.stroke();
      // Liquid inside
      ctx.fillStyle='#5a2a00';
      ctx.fillRect(x-6, y-14, 12, 10);
      ctx.restore();

      // Steam
      steamParticles.forEach(function(s,i) {
        s.y  += s.vy;
        s.x  += s.vx + Math.sin(t*0.08 + i)*0.15;
        s.alpha -= 0.008;
        if (s.alpha <= 0) { steamParticles.splice(i,1); return; }
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#ddeeff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      });

      var alpha = life < 20 ? life/20 : life > maxLife-20 ? (maxLife-life)/20 : 1;
      _canvas.style.opacity !== undefined; // no-op hint
      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Rolling ball (interactive — rolls when char walks past) ───────────────
  function spawnBall() {
    var x = rnd(100, W()-100);
    var y = FLOOR() - 7;
    var vx = 0;
    var col = pick(['#ff4444','#4488ff','#ffcc00','#cc44ff']);
    var life=0, maxLife=rndInt(300,500);
    var angle = 0;
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      // Check if char is near — give ball a nudge
      var chars = document.querySelectorAll('.character');
      chars.forEach(function(el) {
        var cx = parseFloat(el.style.left)+24;
        if (Math.abs(cx - x) < 40) {
          vx += (x > cx) ? 0.15 : -0.15;
        }
      });
      vx *= 0.97; // friction
      x += vx;
      angle += vx * 0.3;
      // Bounce off edges
      if (x < 20) { x=20; vx=Math.abs(vx)*0.6; }
      if (x > W()-20) { x=W()-20; vx=-Math.abs(vx)*0.6; }

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
      // Stripe
      ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
      // Shine
      ctx.fillStyle='rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(-2,-2,2,0,Math.PI*2); ctx.fill();
      ctx.restore();

      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Small pixel cat watching characters ───────────────────────────────────
  function spawnCat() {
    var x = rnd(60, W()-60);
    var y = FLOOR() - 1;
    var phase = 'sit'; // sit → look → blink → sleep → done
    var blinkT = 0;
    var col = pick(['#555','#f5c5a3','#1a1a1a','#cc8844','#888']);
    var life=0, maxLife=rndInt(350,600);
    var obj = { _intervals:[], _timeouts:[] };

    // Cat looks toward nearest char
    function lookDir() {
      var chars = document.querySelectorAll('.character');
      var best = null, bestD = 9999;
      chars.forEach(function(el) {
        var cx = parseFloat(el.style.left)+24;
        var d = Math.abs(cx - x);
        if (d < bestD) { bestD=d; best=cx; }
      });
      return (best !== null && best < x) ? -1 : 1;
    }

    obj.draw = function(ctx, t) {
      life++;
      var dir = lookDir();
      var blink = (t % 90 < 3);
      var asleep = life > maxLife * 0.7;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(dir, 1);

      // Body (sitting — oval)
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -7, 7, 8, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.arc(0, -16, 6, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.beginPath(); ctx.moveTo(-4,-21); ctx.lineTo(-7,-26); ctx.lineTo(-1,-22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4,-21); ctx.lineTo(7,-26); ctx.lineTo(1,-22); ctx.closePath(); ctx.fill();
      // Inner ear
      ctx.fillStyle='rgba(255,150,150,0.4)';
      ctx.beginPath(); ctx.moveTo(-3,-21.5); ctx.lineTo(-5.5,-25); ctx.lineTo(-1.5,-22.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3,-21.5); ctx.lineTo(5.5,-25); ctx.lineTo(1.5,-22.5); ctx.closePath(); ctx.fill();
      // Eyes
      if (asleep) {
        ctx.strokeStyle='#333'; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(-3,-16); ctx.quadraticCurveTo(-2,-14.5,-1,-16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1,-16); ctx.quadraticCurveTo(2,-14.5,3,-16); ctx.stroke();
      } else if (blink) {
        ctx.strokeStyle='#333'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-3,-16); ctx.lineTo(-1,-16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1,-16); ctx.lineTo(3,-16); ctx.stroke();
      } else {
        ctx.fillStyle='#55cc99'; // eye colour
        ctx.beginPath(); ctx.ellipse(-2,-16,2,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(2,-16,2,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#111'; // pupil — slit
        ctx.beginPath(); ctx.ellipse(-2,-16,0.6,2,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(2,-16,0.6,2,0,0,Math.PI*2); ctx.fill();
      }
      // Nose
      ctx.fillStyle='#ffaaaa';
      ctx.beginPath(); ctx.moveTo(-1,-13); ctx.lineTo(1,-13); ctx.lineTo(0,-12); ctx.closePath(); ctx.fill();
      // Whiskers
      ctx.strokeStyle='rgba(200,200,200,0.7)'; ctx.lineWidth=0.5;
      [-1,0,1].forEach(function(i) {
        ctx.beginPath(); ctx.moveTo(0,-13+i*1); ctx.lineTo(10,-13+i*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-13+i*1); ctx.lineTo(-10,-13+i*2); ctx.stroke();
      });
      // Tail
      ctx.strokeStyle=col; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(-5,-2);
      ctx.quadraticCurveTo(-14+Math.sin(t*0.05)*3, 4, -8, -10);
      ctx.stroke();
      ctx.restore();

      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Sticky note flutter (boardroom) ───────────────────────────────────────
  function spawnStickyNote() {
    var x = rnd(80, W()-80);
    var y = rnd(30, 80); // on "wall"
    var col = pick(['#ffee44','#ff88aa','#88ddff','#aaffaa']);
    var life=0, maxLife=rndInt(300,600);
    var angle = rnd(-0.1, 0.1);
    var obj = { _intervals:[], _timeouts:[] };

    // Random "text" — just horizontal lines
    var lines = [];
    for (var i=0; i<rndInt(2,4); i++) lines.push(rnd(0.3,0.85));

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life<20?life/20:life>maxLife-20?(maxLife-life)/20:1;
      var flutter = Math.sin(t*0.04) * 0.015;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(angle + flutter);
      ctx.fillStyle = col;
      ctx.fillRect(-14,-14,28,26);
      ctx.fillStyle='rgba(0,0,0,0.08)'; // shadow
      ctx.fillRect(2,12,24,4);
      ctx.fillStyle='rgba(0,0,0,0.2)';
      lines.forEach(function(w,i) { ctx.fillRect(-10, -8+i*6, 20*w, 1); });
      ctx.restore();
      if (life >= maxLife) killObject(obj);
    };
    return obj;
  }

  // ══ EASTER EGGS ══════════════════════════════════════════════════════════

  // ── Tiny UFO crossing slowly behind skyline ────────────────────────────────
  function spawnUFO() {
    var dir = Math.random()<0.5?1:-1;
    var x = dir===1 ? -30 : W()+30;
    var y = rnd(15, 60);
    var speed = rnd(0.2, 0.5);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.translate(x, y);
      // Saucer body
      ctx.fillStyle='#aabbcc';
      ctx.beginPath(); ctx.ellipse(0, 2, 14, 5, 0, 0, Math.PI*2); ctx.fill();
      // Dome
      ctx.fillStyle='rgba(160,220,255,0.7)';
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 6, 0, Math.PI, 0); ctx.fill();
      // Lights
      var lCols=['#ff4444','#44ff88','#ffee44'];
      lCols.forEach(function(c,i) {
        ctx.fillStyle = (t%12 < 4+i*2) ? c : 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(-8+i*8, 4, 1.5, 0, Math.PI*2); ctx.fill();
      });
      // Beam (occasional)
      if (t%60 < 20) {
        ctx.fillStyle='rgba(200,255,150,0.12)';
        ctx.beginPath(); ctx.moveTo(-6,5); ctx.lineTo(6,5); ctx.lineTo(10,22); ctx.lineTo(-10,22); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      x += speed * dir;
      if (x > W()+40 || x < -40) killObject(obj);
    };
    return obj;
  }

  // ── Tiny ghost drifting ────────────────────────────────────────────────────
  function spawnGhost() {
    var x = rnd(80, W()-80);
    var y = rnd(30, FLOOR()-60);
    var vx = rnd(-0.12, 0.12);
    var vy = rnd(-0.08, 0.08);
    var life=0, maxLife=rndInt(200,350);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life<30?life/30:life>maxLife-30?(maxLife-life)/30:1;
      var bob = Math.sin(t*0.06)*3;
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      ctx.translate(x, y+bob);
      ctx.fillStyle='#ddeeff';
      // Ghost body
      ctx.beginPath();
      ctx.arc(0,-7,7,Math.PI,0);
      ctx.lineTo(7,4);
      ctx.quadraticCurveTo(4,8,0,5);
      ctx.quadraticCurveTo(-4,8,-7,4);
      ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle='rgba(80,80,120,0.8)';
      ctx.beginPath(); ctx.ellipse(-2.5,-8,1.5,2,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2.5,-8,1.5,2,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      x += vx + Math.sin(t*0.03)*0.1;
      y += vy + Math.cos(t*0.025)*0.08;
      if (life>=maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Rubber duck ───────────────────────────────────────────────────────────
  function spawnDuck() {
    var x = rnd(80, W()-80);
    var y = FLOOR() - 8;
    var life=0, maxLife=rndInt(280,500);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life<20?life/20:life>maxLife-20?(maxLife-life)/20:1;
      var bob = Math.sin(t*0.05)*1.5;
      ctx.save(); ctx.globalAlpha=alpha;
      ctx.translate(x, y+bob);
      // Body
      ctx.fillStyle='#ffdd00';
      ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.arc(8,-4,5,0,Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle='#ff8800';
      ctx.beginPath(); ctx.moveTo(12,-4); ctx.lineTo(17,-3); ctx.lineTo(12,-2); ctx.closePath(); ctx.fill();
      // Eye
      ctx.fillStyle='#111';
      ctx.beginPath(); ctx.arc(10,-5,1,0,Math.PI*2); ctx.fill();
      // Wing
      ctx.fillStyle='#f0c800';
      ctx.beginPath(); ctx.ellipse(-2,0,6,4,0.3,0,Math.PI*2); ctx.fill();
      ctx.restore();
      if (life>=maxLife) killObject(obj);
    };
    return obj;
  }

  // ── 404 on a tiny sign (boardroom only) ───────────────────────────────────
  function spawnFourOhFour() {
    var x = rnd(60, W()-60);
    var y = rnd(40, 90);
    var life=0, maxLife=rndInt(200,400);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life<25?life/25:life>maxLife-25?(maxLife-life)/25:1;
      // blink occasionally
      if (Math.floor(t/6)%8===0) { if (life<maxLife) killObject(obj); return; } // flicker off
      ctx.save(); ctx.globalAlpha=alpha*0.8;
      ctx.translate(x, y);
      // Sign post
      ctx.strokeStyle='#555'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,14); ctx.lineTo(0,28); ctx.stroke();
      // Sign board
      ctx.fillStyle='#cc2200';
      ctx.fillRect(-18,-2,36,16);
      ctx.fillStyle='#ffcc00';
      ctx.font='bold 8px monospace';
      ctx.textAlign='center';
      ctx.fillText('404',0,9);
      ctx.restore();
      if (life>=maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Pizza slice sliding in ─────────────────────────────────────────────────
  function spawnPizza() {
    var x = rnd(80, W()-80);
    var y = FLOOR()-2;
    var life=0, maxLife=rndInt(180,300);
    var slideIn = -20;
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      if (slideIn < 0) slideIn = Math.min(0, slideIn+1);
      var alpha = life<15?life/15:life>maxLife-15?(maxLife-life)/15:1;
      ctx.save(); ctx.globalAlpha=alpha;
      ctx.translate(x, y+slideIn);
      // Crust
      ctx.fillStyle='#cc8844';
      ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(-10,0); ctx.lineTo(10,0); ctx.closePath(); ctx.fill();
      // Cheese
      ctx.fillStyle='#ffdd44';
      ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(-7,0); ctx.lineTo(7,0); ctx.closePath(); ctx.fill();
      // Tomato
      ctx.fillStyle='#cc3300';
      ctx.beginPath(); ctx.arc(0,-7,2.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
      if (life>=maxLife) killObject(obj);
    };
    return obj;
  }

  // ── Tiny dancer (playground only) ─────────────────────────────────────────
  function spawnTinyDancer() {
    var x = rnd(80, W()-80);
    var y = FLOOR()-1;
    var life=0, maxLife=rndInt(300,500);
    var col = pick(['#ff44aa','#44aaff','#ffaa44']);
    var obj = { _intervals:[], _timeouts:[] };

    obj.draw = function(ctx, t) {
      life++;
      var alpha = life<20?life/20:life>maxLife-20?(maxLife-life)/20:1;
      var bounce = Math.abs(Math.sin(t*0.18))*3;
      var armL = Math.sin(t*0.18)*8;
      var armR = -armL;
      ctx.save(); ctx.globalAlpha=alpha;
      ctx.translate(x, y-bounce);
      // Body
      ctx.fillStyle=col;
      ctx.fillRect(-3,-14,6,10);
      // Head
      ctx.fillStyle='#f5c5a3';
      ctx.beginPath(); ctx.arc(0,-18,4,0,Math.PI*2); ctx.fill();
      // Arms
      ctx.strokeStyle=col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-3,-12); ctx.lineTo(-3-armL,-8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3,-12); ctx.lineTo(3-armR,-8); ctx.stroke();
      // Legs
      var legSwing = Math.sin(t*0.18)*4;
      ctx.beginPath(); ctx.moveTo(-2,-4); ctx.lineTo(-2+legSwing,4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2,-4); ctx.lineTo(2-legSwing,4); ctx.stroke();
      // Sparkles
      if (t%15<3) {
        ctx.fillStyle='#ffff88';
        [[-8,-20],[8,-20],[0,-26]].forEach(function(s) {
          ctx.beginPath(); ctx.arc(s[0],s[1],1.2,0,Math.PI*2); ctx.fill();
        });
      }
      ctx.restore();
      if (life>=maxLife) killObject(obj);
    };
    return obj;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    init:         init,
    onRoomSwitch: onRoomSwitch,
    resize:       _resize,
  };

})();
