// js/puzzles.js — Avatar puzzle system
// Avatars autonomously walk to puzzles, attempt them, succeed or fail.
// Max 1 puzzle active. Rare spawn: 45–120s gaps. Self-retiring.
// Each puzzle is drawn on its own small canvas overlaid on the world.

const Puzzles = (function() {

  var _canvas  = null;
  var _ctx     = null;
  var _current = null;   // the one active puzzle object, or null
  var _timers  = [];
  var _spawnTimer = null;
  var _frameTimer = null;
  var _t = 0;

  // Recently used puzzle types — avoid repeats
  var _recent = [];

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function W()     { return _canvas ? _canvas.width  : 700; }
  function H()     { return _canvas ? _canvas.height : 320; }
  function FLOOR() { return H() - FLOOR_H; }
  function rnd(a,b){ return a + Math.random()*(b-a); }
  function rndInt(a,b){ return Math.floor(rnd(a,b+1)); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function addTimer(t){ _timers.push(t); return t; }

  function clearCurrent() {
    if (_current) {
      if (_current._timers) _current._timers.forEach(function(t){ clearTimeout(t); clearInterval(t); });
      _current = null;
    }
    if (_ctx) _ctx.clearRect(0, 0, W(), H());
  }

  // Find a random non-forward character's x position (they'll walk to puzzle)
  function pickAvatarX() {
    var team = (typeof App !== 'undefined' && App.state) ? App.state.team : [];
    var forwardIds = (typeof Chat !== 'undefined') ? Chat.forwardIds : [];
    var bg = team.filter(function(m){ return forwardIds.indexOf(m.id) === -1; });
    if (!bg.length) bg = team;
    if (!bg.length) return W() / 2;
    var m = pick(bg);
    var ws = (typeof World !== 'undefined' && World.wanderState) ? World.wanderState[m.id] : null;
    return ws ? ws.x : W() / 2;
  }

  // Trigger an action on a random avatar near the puzzle
  function triggerAction(actionName) {
    var team = (typeof App !== 'undefined' && App.state) ? App.state.team : [];
    if (!team.length) return;
    var m = pick(team);
    if (typeof World !== 'undefined') World.playCharAction(m.id, actionName);
  }

  // ─── Puzzle catalogue ─────────────────────────────────────────────────────
  // Each entry: { id, weight, rooms, fn }
  // fn() returns a puzzle object with { draw(ctx,t), _timers:[], x, y, w, h }

  var CATALOGUE = [
    { id:'rubik',      w:10, rooms:null,            fn: puzzleRubik      },
    { id:'chess',      w:9,  rooms:['boardroom'],   fn: puzzleChess      },
    { id:'whiteboard', w:8,  rooms:['boardroom','stage'], fn: puzzleWhiteboard },
    { id:'jigsaw',     w:8,  rooms:null,            fn: puzzleJigsaw     },
    { id:'hanoi',      w:7,  rooms:null,            fn: puzzleHanoi      },
    { id:'sliding',    w:7,  rooms:null,            fn: puzzleSliding    },
    { id:'maze',       w:7,  rooms:null,            fn: puzzleMaze       },
    { id:'crossword',  w:6,  rooms:['boardroom','stage'], fn: puzzleCrossword },
    { id:'circuit',    w:6,  rooms:['stage','boardroom'], fn: puzzleCircuit   },
    { id:'balance',    w:6,  rooms:null,            fn: puzzleBalance    },
    { id:'combo',      w:5,  rooms:null,            fn: puzzleCombo      },
    { id:'cards',      w:5,  rooms:['stage','playground'], fn: puzzleCards },
    { id:'abacus',     w:5,  rooms:null,            fn: puzzleAbacus     },
    { id:'sudoku',     w:6,  rooms:['boardroom'],   fn: puzzleSudoku     },
    { id:'stars',      w:4,  rooms:['stage'],       fn: puzzleStars      },
  ];

  // ─── Main render loop ─────────────────────────────────────────────────────
  function _drawCurrent() {
    if (!_ctx) return;
    _ctx.clearRect(0, 0, W(), H());
    if (_current && _current.draw) {
      try { _current.draw(_ctx, _t); } catch(e) { console.warn('puzzle draw err', e); }
    }
    _t++;
  }

  // ─── Spawn logic ──────────────────────────────────────────────────────────
  function _trySpawn() {
    if (_current) return; // already one active

    var room = (typeof World !== 'undefined') ? World.currentRoom : 'stage';

    var candidates = CATALOGUE.filter(function(e) {
      if (_recent.indexOf(e.id) !== -1) return false;
      if (e.rooms && e.rooms.indexOf(room) === -1) return false;
      return true;
    });

    // Weighted pick
    var total = candidates.reduce(function(s,c){ return s+c.w; }, 0);
    var r = Math.random() * total, acc = 0;
    var chosen = candidates[0];
    for (var i=0; i<candidates.length; i++) {
      acc += candidates[i].w;
      if (r <= acc) { chosen = candidates[i]; break; }
    }

    _recent.push(chosen.id);
    if (_recent.length > 5) _recent.shift();

    _current = chosen.fn();
    if (!_current) _current = null;
  }

  function _scheduleSpawn() {
    _spawnTimer = setTimeout(function() {
      _trySpawn();
      _scheduleSpawn();
    }, rnd(50000, 120000)); // 50–120s between puzzles
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    _canvas = document.getElementById('puzzles-canvas');
    if (!_canvas) {
      _canvas = document.createElement('canvas');
      _canvas.id = 'puzzles-canvas';
      _canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:6;';
      var container = document.getElementById('world-container');
      if (container) container.appendChild(_canvas);
    }
    _resize();
    _ctx = _canvas.getContext('2d');

    if (_frameTimer) clearInterval(_frameTimer);
    _frameTimer = setInterval(_drawCurrent, 33);

    // First puzzle after 20–40s
    _spawnTimer = setTimeout(function() {
      _trySpawn();
      _scheduleSpawn();
    }, rnd(20000, 40000));
  }

  function _resize() {
    if (!_canvas) return;
    var c = document.getElementById('world-container');
    if (c) { _canvas.width = c.offsetWidth||700; _canvas.height = c.offsetHeight||320; }
  }

  function onRoomSwitch() {
    clearCurrent();
    _recent = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUZZLE DEFINITIONS
  // Each returns a puzzle object. The puzzle animates itself over ~20–60s,
  // then triggers an avatar reaction and self-destructs.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Shared lifecycle helper ───────────────────────────────────────────────
  function makePuzzle(opts) {
    // opts: { x, y, w, h, duration, draw(ctx,t,phase,progress), onSolve, onFail }
    var p = {
      x: opts.x, y: opts.y, w: opts.w, h: opts.h,
      _timers: [],
      _phase: 'intro',   // intro → working → (solved|failed) → done
      _progress: 0,
      _solved: null,
    };

    var duration = opts.duration || rndInt(18000, 45000);
    var solveChance = opts.solveChance !== undefined ? opts.solveChance : 0.65;

    // Intro: label appears (~1s)
    p._timers.push(setTimeout(function() {
      p._phase = 'working';
      // Walking avatar action
      triggerAction(pick(['think','point','nod']));
    }, 800));

    // Progress ticker
    var startTime = Date.now();
    var progTimer = setInterval(function() {
      if (p._phase !== 'working') return;
      p._progress = Math.min(1, (Date.now()-startTime) / duration);
      // Occasional mid-puzzle actions
      if (Math.random() < 0.004) triggerAction(pick(['think','shrug','nod','facepalm']));
    }, 100);
    p._timers.push(progTimer);

    // Resolution
    p._timers.push(setTimeout(function() {
      clearInterval(progTimer);
      p._solved = Math.random() < solveChance;
      p._phase = p._solved ? 'solved' : 'failed';
      triggerAction(p._solved ? pick(['jump','wave','dance','bow']) : pick(['shrug','facepalm','stomp']));

      // Linger then retire
      p._timers.push(setTimeout(function() {
        p._phase = 'done';
        _current = null;
      }, 3000));

    }, duration));

    p.draw = function(ctx, t) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Fade in/out
      var alpha = p._phase==='intro'    ? Math.min(1, t/15)
                : p._phase==='done'     ? 0
                : p._phase==='solved'   ? Math.max(0,1-(t%50)/15)  // flicker celebration
                : p._phase==='failed'   ? Math.max(0,1-(t%60)/20)
                : 1;
      ctx.globalAlpha = alpha;

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur  = 8;
      ctx.shadowOffsetY = 3;

      opts.draw(ctx, t, p._phase, p._progress, p._solved);

      // Progress bar
      if (p._phase === 'working') {
        ctx.shadowBlur = 0;
        var barW = p.w - 8, barH = 4;
        var barX = 4, barY = p.h + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#44ee88'; ctx.fillRect(barX, barY, barW*p._progress, barH);
      }

      // Solved/failed badge
      if (p._phase === 'solved' || p._phase === 'failed') {
        ctx.shadowBlur = 0;
        ctx.fillStyle = p._phase === 'solved' ? '#44ee88' : '#ee4444';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p._phase === 'solved' ? '✓ SOLVED!' : '✗ STUMPED', p.w/2, p.h + 12);
      }

      ctx.restore();
    };

    return p;
  }

  // ── 1. Rubik's Cube ───────────────────────────────────────────────────────
  function puzzleRubik() {
    var px = rnd(60, W()-120), py = FLOOR()-90;
    var colours = [
      ['#ff4444','#ff8844','#ffff44','#44ff44','#4488ff','#ffffff'],
      ['#ff4444','#ff8844','#ffff44','#44ff44','#4488ff','#ffffff'],
    ];
    // Random face state
    var faces = Array.from({length:6}, function() {
      return Array.from({length:9}, function(){ return rndInt(0,5); });
    });
    var rotAngle = 0;

    return makePuzzle({
      x: px, y: py, w: 70, h: 70,
      duration: rndInt(20000, 40000),
      solveChance: 0.6,
      draw: function(ctx, t, phase, progress) {
        // Isometric cube view — 3 visible faces
        var cs = 12; // cell size
        // Animate rotation
        rotAngle = progress * Math.PI * 6 * (1 + Math.sin(t*0.02));

        // Occasionally scramble/update face during working
        if (phase === 'working' && t % 18 === 0) {
          var fIdx = rndInt(0,5), cIdx = rndInt(0,8);
          faces[fIdx][cIdx] = rndInt(0, 5);
        }
        // On solve, make faces uniform
        if (phase === 'solved') {
          faces = faces.map(function(f, fi){ return Array(9).fill(fi); });
        }

        ctx.save();
        ctx.translate(35, 35);
        ctx.rotate(rotAngle * 0.05);

        // Draw top face
        var topCols = faces[0];
        for (var row=0; row<3; row++) {
          for (var col=0; col<3; col++) {
            var x2 = (col-row)*cs - cs/2;
            var y2 = (col+row)*cs*0.5 - cs*1.5;
            ctx.fillStyle = colours[0][topCols[row*3+col]];
            ctx.beginPath();
            ctx.moveTo(x2,     y2);
            ctx.lineTo(x2+cs,  y2+cs*0.5);
            ctx.lineTo(x2,     y2+cs);
            ctx.lineTo(x2-cs,  y2+cs*0.5);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.stroke();
          }
        }
        // Left face
        var leftCols = faces[1];
        for (var row2=0; row2<3; row2++) {
          for (var col2=0; col2<3; col2++) {
            var lx = -cs - col2*cs;
            var ly = row2*cs + col2*cs*0.5 - cs*0.5;
            ctx.fillStyle = colours[0][leftCols[row2*3+col2]];
            ctx.beginPath();
            ctx.moveTo(lx, ly); ctx.lineTo(lx, ly+cs);
            ctx.lineTo(lx+cs, ly+cs+cs*0.5); ctx.lineTo(lx+cs, ly+cs*0.5);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.5; ctx.stroke();
          }
        }
        // Right face
        var rightCols = faces[2];
        for (var row3=0; row3<3; row3++) {
          for (var col3=0; col3<3; col3++) {
            var rx = col3*cs + cs;
            var ry = row3*cs + col3*cs*0.5 - cs*0.5;
            ctx.fillStyle = colours[0][rightCols[row3*3+col3]];
            ctx.beginPath();
            ctx.moveTo(rx, ry); ctx.lineTo(rx, ry+cs);
            ctx.lineTo(rx+cs, ry+cs-cs*0.5); ctx.lineTo(rx+cs, ry-cs*0.5);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.5; ctx.stroke();
          }
        }
        ctx.restore();

        // Label
        ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign='center';
        ctx.fillText("RUBIK'S CUBE", 35, 68);
      }
    });
  }

  // ── 2. Chess Board ────────────────────────────────────────────────────────
  function puzzleChess() {
    var px = rnd(60, W()-120), py = FLOOR()-85;
    var pieces = [
      [' ','♜',' ','♛',' ','♝',' ','♚'],
      ['♟',' ','♟',' ','♟','♟',' ','♟'],
      [' ',' ',' ','♞',' ',' ',' ',' '],
      [' ',' ',' ',' ','♟',' ','♙',' '],
      [' ',' ','♙',' ',' ',' ',' ',' '],
      [' ',' ','♞',' ',' ','♙',' ',' '],
      ['♙','♙',' ','♙','♙',' ','♙','♙'],
      ['♖',' ','♗','♕','♔','♗','♘','♖'],
    ];
    var moveQueue = []; // planned moves
    var lastMove = 0;

    // Generate plausible-looking moves
    function generateMove() {
      var fromR = rndInt(2,7), fromC = rndInt(0,7);
      var toR   = rndInt(0,5), toC   = rndInt(0,7);
      moveQueue.push([fromR, fromC, toR, toC]);
    }
    for (var i=0;i<20;i++) generateMove();

    var cs = 8;
    return makePuzzle({
      x: px, y: py, w: 72, h: 74,
      duration: rndInt(22000, 45000),
      solveChance: 0.5,
      draw: function(ctx, t, phase, progress) {
        // Execute moves periodically
        if (phase === 'working' && t % 40 === 0 && moveQueue.length > 0) {
          var mv = moveQueue.shift();
          var piece = pieces[mv[0]][mv[1]];
          if (piece && piece !== ' ') {
            pieces[mv[0]][mv[1]] = ' ';
            pieces[mv[2]][mv[3]] = piece;
          }
          lastMove = t;
          generateMove();
        }

        // Board
        for (var row=0; row<8; row++) {
          for (var col=0; col<8; col++) {
            var light = (row+col)%2===0;
            ctx.fillStyle = light ? '#f0d9b5' : '#b58863';
            ctx.fillRect(col*cs, row*cs, cs, cs);

            // Highlight last moved square
            if (t - lastMove < 20) {
              ctx.fillStyle = 'rgba(100,200,100,0.3)';
              ctx.fillRect(col*cs, row*cs, cs, cs);
            }

            var piece2 = pieces[row][col];
            if (piece2 && piece2 !== ' ') {
              ctx.fillStyle = piece2 === piece2.toLowerCase() ? '#111' : '#eee';
              ctx.strokeStyle = piece2 === piece2.toLowerCase() ? '#eee' : '#111';
              ctx.lineWidth = 0.4;
              ctx.font = (cs-1)+'px sans-serif';
              ctx.textAlign='center';
              ctx.fillText(piece2, col*cs+cs/2, row*cs+cs-1);
              ctx.strokeText(piece2, col*cs+cs/2, row*cs+cs-1);
            }
          }
        }
        // Border
        ctx.strokeStyle='#5a3010'; ctx.lineWidth=1.5;
        ctx.strokeRect(0,0,64,64);

        ctx.fillStyle='#fff'; ctx.font='7px monospace'; ctx.textAlign='center';
        ctx.fillText('CHESS', 32, 72);
      }
    });
  }

  // ── 3. Whiteboard equation ────────────────────────────────────────────────
  function puzzleWhiteboard() {
    var px = rnd(80, W()-160), py = FLOOR()-100;
    var lines = [];
    var symbols = ['∫','∑','∏','√','∂','∞','≠','≈','±','×','÷','∈','∀','∃'];
    var vars = ['x','y','z','n','k','λ','μ','θ','α','β'];

    function randomEquation() {
      var v1 = pick(vars), v2 = pick(vars), sym = pick(symbols);
      var n1 = rndInt(1,20), n2 = rndInt(1,10);
      return pick([
        n1+''+v1+' + '+n2+''+v2+' = '+rndInt(10,99),
        sym+'('+v1+'^'+n2+') = '+v2,
        v1+'/'+v2+' '+sym+' '+n1,
        n1+v1+sym+v2+' = ?',
      ]);
    }

    // Generate initial lines
    for (var i=0;i<4;i++) lines.push({ text: randomEquation(), crossed: false, y: 12+i*16 });

    var eraseTimer = 0;
    return makePuzzle({
      x: px, y: py, w: 120, h: 90,
      duration: rndInt(25000, 50000),
      solveChance: 0.55,
      draw: function(ctx, t, phase, progress) {
        // Board surface
        ctx.fillStyle = '#eefaf6';
        ctx.fillRect(0, 0, 120, 80);
        ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 120, 80);
        // Tray
        ctx.fillStyle = '#ccc'; ctx.fillRect(0, 80, 120, 6);
        // Marker
        ctx.fillStyle = '#333'; ctx.fillRect(10, 81, 20, 3);

        // Draw lines with animated writing
        if (phase === 'working' && t % 60 === 0) {
          // Cross out a random line and add new one
          var uncrossed = lines.filter(function(l){ return !l.crossed; });
          if (uncrossed.length > 0) {
            pick(uncrossed).crossed = true;
            lines.push({ text: randomEquation(), crossed: false, y: pick([12,28,44,60]) });
            if (lines.length > 6) lines.shift();
          }
        }

        lines.forEach(function(line) {
          ctx.font = '8px monospace';
          ctx.textAlign = 'left';
          // Ink colour varies
          ctx.fillStyle = line.crossed ? 'rgba(30,80,50,0.3)' : '#1a5a3a';
          // Partial write animation
          var chars = line.text;
          ctx.fillText(chars, 6, line.y);
          if (line.crossed) {
            ctx.strokeStyle = '#cc2200'; ctx.lineWidth = 1;
            var tw = ctx.measureText(chars).width;
            ctx.beginPath(); ctx.moveTo(6, line.y-3); ctx.lineTo(6+tw, line.y-3); ctx.stroke();
          }
        });

        // On solved: circle an answer
        if (phase === 'solved') {
          ctx.strokeStyle = '#cc2200'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(60, 44, 45, 12, 0, 0, Math.PI*2); ctx.stroke();
          ctx.fillStyle = '#cc2200'; ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('Q.E.D.', 60, 47);
        }

        ctx.fillStyle='#555'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('WHITEBOARD', 60, 88);
      }
    });
  }

  // ── 4. Jigsaw ─────────────────────────────────────────────────────────────
  function puzzleJigsaw() {
    var px = rnd(60, W()-120), py = FLOOR()-85;
    var COLS=5, ROWS=4, cs=12;
    var pieces = [];
    // Each piece has: target (tx,ty), current (cx,cy), placed
    for (var r=0;r<ROWS;r++) {
      for (var c=0;c<COLS;c++) {
        var tx=c*cs, ty=r*cs;
        pieces.push({
          tx:tx, ty:ty,
          cx: rnd(-20,80), cy: rnd(-15,70),
          placed: false,
          col: 'hsl('+(rndInt(180,230))+',40%,'+(40+r*8)+'%)',
        });
      }
    }
    var placedCount = 0;

    return makePuzzle({
      x: px, y: py, w: 80, h: 75,
      duration: rndInt(20000, 40000),
      solveChance: 0.7,
      draw: function(ctx, t, phase, progress) {
        // Snap pieces into place progressively
        var targetPlaced = Math.floor(progress * pieces.length);
        while (placedCount < targetPlaced) {
          var unplaced = pieces.filter(function(p){ return !p.placed; });
          if (!unplaced.length) break;
          var p = unplaced[0];
          p.placed = true;
          p.cx = p.tx; p.cy = p.ty;
          placedCount++;
        }

        // Board outline
        ctx.fillStyle = '#888'; ctx.fillRect(-2,-2,COLS*cs+4,ROWS*cs+4);
        ctx.fillStyle = '#ddd'; ctx.fillRect(0,0,COLS*cs,ROWS*cs);

        pieces.forEach(function(piece, i) {
          // Float unplaced pieces
          if (!piece.placed && phase === 'working') {
            piece.cx += Math.sin(t*0.03 + i)*0.3;
            piece.cy += Math.cos(t*0.025 + i)*0.2;
          }
          ctx.save();
          ctx.translate(piece.cx, piece.cy);
          ctx.fillStyle = piece.col;
          ctx.fillRect(0, 0, cs-1, cs-1);
          // Simple tab indicator
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(1, 1, cs-3, 3);
          if (!piece.placed) {
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth=0.5;
            ctx.strokeRect(0,0,cs-1,cs-1);
          }
          ctx.restore();
        });

        ctx.fillStyle='#555'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('JIGSAW', COLS*cs/2, ROWS*cs+10);
      }
    });
  }

  // ── 5. Tower of Hanoi ────────────────────────────────────────────────────
  function puzzleHanoi() {
    var px = rnd(60, W()-110), py = FLOOR()-80;
    var NUM = 5;
    // State: three pegs as stacks
    var pegs = [
      Array.from({length:NUM}, function(_,i){ return NUM-i; }),
      [], []
    ];
    var moves = [];

    // Generate optimal Hanoi moves
    function genMoves(n, from, to, aux) {
      if (n===0) return;
      genMoves(n-1, from, aux, to);
      moves.push([from, to]);
      genMoves(n-1, aux, to, from);
    }
    genMoves(NUM, 0, 2, 1);
    moves = moves.slice(0, Math.min(moves.length, 40)); // limit

    var moveIdx = 0;
    var lastMoveT = 0;

    return makePuzzle({
      x: px, y: py, w: 96, h: 72,
      duration: rndInt(20000, 38000),
      solveChance: 0.75,
      draw: function(ctx, t, phase, progress) {
        // Execute move on timer
        if (phase === 'working' && t - lastMoveT > 15 && moveIdx < moves.length) {
          var mv = moves[moveIdx++];
          if (pegs[mv[0]].length > 0) {
            var disc = pegs[mv[0]].pop();
            pegs[mv[1]].push(disc);
          }
          lastMoveT = t;
        }

        // Base
        ctx.fillStyle = '#8b6914'; ctx.fillRect(4, 60, 88, 5);
        // Pegs
        var pegX = [20, 48, 76];
        pegX.forEach(function(px2) {
          ctx.fillStyle = '#5a3010'; ctx.fillRect(px2-2, 10, 4, 50);
        });
        // Discs
        var discCols = ['#ff4444','#ff8844','#ffcc44','#44bb44','#4488ff'];
        pegs.forEach(function(peg, pi) {
          peg.forEach(function(disc, di) {
            var dw = disc * 8 + 6;
            var dx = pegX[pi] - dw/2;
            var dy = 55 - di*9;
            ctx.fillStyle = discCols[(disc-1) % discCols.length];
            ctx.fillRect(dx, dy, dw, 7);
            ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=0.5;
            ctx.strokeRect(dx, dy, dw, 7);
          });
        });

        ctx.fillStyle='#555'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('TOWER OF HANOI', 48, 72);
      }
    });
  }

  // ── 6. Sliding tile puzzle ────────────────────────────────────────────────
  function puzzleSliding() {
    var px = rnd(60, W()-110), py = FLOOR()-85;
    var SIZE = 3, cs = 22;
    // Create scrambled grid (0 = blank)
    var grid = [1,2,3,4,5,6,7,8,0];
    for (var i=0;i<50;i++) {
      var blankIdx = grid.indexOf(0);
      var bRow = Math.floor(blankIdx/SIZE), bCol = blankIdx%SIZE;
      var dirs = [];
      if (bRow>0) dirs.push(-SIZE);
      if (bRow<SIZE-1) dirs.push(SIZE);
      if (bCol>0) dirs.push(-1);
      if (bCol<SIZE-1) dirs.push(1);
      var d = pick(dirs);
      var swapIdx = blankIdx+d;
      var tmp = grid[blankIdx]; grid[blankIdx]=grid[swapIdx]; grid[swapIdx]=tmp;
    }

    var moveTimer2 = 0;
    return makePuzzle({
      x: px, y: py, w: SIZE*cs+2, h: SIZE*cs+12,
      duration: rndInt(18000, 35000),
      solveChance: 0.65,
      draw: function(ctx, t, phase, progress) {
        // Auto-move toward solution
        if (phase === 'working' && t - moveTimer2 > 20) {
          var blankIdx2 = grid.indexOf(0);
          var bRow2 = Math.floor(blankIdx2/SIZE), bCol2 = blankIdx2%SIZE;
          var dirs2 = [];
          if (bRow2>0) dirs2.push(-SIZE);
          if (bRow2<SIZE-1) dirs2.push(SIZE);
          if (bCol2>0) dirs2.push(-1);
          if (bCol2<SIZE-1) dirs2.push(1);
          if (dirs2.length) {
            // Bias toward correct moves
            var swapIdx2 = blankIdx2+pick(dirs2);
            var tmp2=grid[blankIdx2]; grid[blankIdx2]=grid[swapIdx2]; grid[swapIdx2]=tmp2;
          }
          moveTimer2 = t;
        }
        if (phase === 'solved') grid = [1,2,3,4,5,6,7,8,0];

        ctx.fillStyle='#334'; ctx.fillRect(0,0,SIZE*cs+2,SIZE*cs+2);
        grid.forEach(function(val, i) {
          var r=Math.floor(i/SIZE), c=i%SIZE;
          if (val===0) return; // blank
          var correct = val===i+1;
          ctx.fillStyle = correct ? '#4488cc' : '#556688';
          ctx.fillRect(c*cs+1, r*cs+1, cs-1, cs-1);
          ctx.fillStyle='#fff'; ctx.font='bold 10px monospace'; ctx.textAlign='center';
          ctx.fillText(val, c*cs+cs/2+1, r*cs+cs/2+4+1);
        });
        ctx.fillStyle='#888'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('SLIDING PUZZLE', SIZE*cs/2+1, SIZE*cs+11);
      }
    });
  }

  // ── 7. Maze ───────────────────────────────────────────────────────────────
  function puzzleMaze() {
    var px = rnd(60, W()-110), py = FLOOR()-85;
    var COLS2=8, ROWS2=7, cs=10;
    // Simple pre-defined maze walls (bitmask: N=1,E=2,S=4,W=8)
    var walls = Array.from({length:ROWS2}, function() {
      return Array.from({length:COLS2}, function(){ return rndInt(0,15); });
    });
    // Pen trace
    var penX = 0, penY = 0, penPath = [{x:0,y:0}];
    var solved = false;

    return makePuzzle({
      x: px, y: py, w: COLS2*cs+2, h: ROWS2*cs+12,
      duration: rndInt(20000, 38000),
      solveChance: 0.6,
      draw: function(ctx, t, phase, progress) {
        // Advance pen
        if (phase === 'working' && t % 8 === 0 && !solved) {
          var dirs2 = [{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0},{dx:0,dy:-1}];
          var valid = dirs2.filter(function(d) {
            var nx=penX+d.dx, ny=penY+d.dy;
            return nx>=0&&nx<COLS2&&ny>=0&&ny<ROWS2;
          });
          if (valid.length) {
            var chosen = pick(valid);
            penX+=chosen.dx; penY+=chosen.dy;
            penPath.push({x:penX,y:penY});
            if (penPath.length > 30) penPath.shift();
            if (penX===COLS2-1 && penY===ROWS2-1) solved=true;
          }
        }

        // Paper background
        ctx.fillStyle='#fffef8'; ctx.fillRect(0,0,COLS2*cs+2,ROWS2*cs+2);
        // Grid lines
        ctx.strokeStyle='rgba(180,180,200,0.5)'; ctx.lineWidth=0.5;
        for (var r=0;r<=ROWS2;r++){ctx.beginPath();ctx.moveTo(0,r*cs);ctx.lineTo(COLS2*cs,r*cs);ctx.stroke();}
        for (var c=0;c<=COLS2;c++){ctx.beginPath();ctx.moveTo(c*cs,0);ctx.lineTo(c*cs,ROWS2*cs);ctx.stroke();}

        // Walls (random thick lines)
        ctx.strokeStyle='#334'; ctx.lineWidth=2;
        for (var r2=0;r2<ROWS2;r2++) {
          for (var c2=0;c2<COLS2;c2++) {
            var w=walls[r2][c2];
            if(w&1&&r2===0){ctx.beginPath();ctx.moveTo(c2*cs,r2*cs);ctx.lineTo((c2+1)*cs,r2*cs);ctx.stroke();}
            if(w&4&&r2===ROWS2-1){ctx.beginPath();ctx.moveTo(c2*cs,(r2+1)*cs);ctx.lineTo((c2+1)*cs,(r2+1)*cs);ctx.stroke();}
            if(w&8&&c2===0){ctx.beginPath();ctx.moveTo(c2*cs,r2*cs);ctx.lineTo(c2*cs,(r2+1)*cs);ctx.stroke();}
            if(w&2&&c2===COLS2-1){ctx.beginPath();ctx.moveTo((c2+1)*cs,r2*cs);ctx.lineTo((c2+1)*cs,(r2+1)*cs);ctx.stroke();}
          }
        }

        // Start/end markers
        ctx.fillStyle='#44bb44'; ctx.beginPath(); ctx.arc(cs*0.5,cs*0.5,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#cc2200'; ctx.beginPath(); ctx.arc((COLS2-0.5)*cs,(ROWS2-0.5)*cs,3,0,Math.PI*2); ctx.fill();

        // Pen trail
        if (penPath.length > 1) {
          ctx.strokeStyle='rgba(0,80,200,0.7)'; ctx.lineWidth=1.5;
          ctx.beginPath();
          penPath.forEach(function(pt,i){
            var px3=pt.x*cs+cs*0.5, py3=pt.y*cs+cs*0.5;
            i===0?ctx.moveTo(px3,py3):ctx.lineTo(px3,py3);
          });
          ctx.stroke();
          // Pen tip
          var last=penPath[penPath.length-1];
          ctx.fillStyle='#0044cc';
          ctx.beginPath();ctx.arc(last.x*cs+cs*0.5,last.y*cs+cs*0.5,2,0,Math.PI*2);ctx.fill();
        }

        ctx.fillStyle='#888'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('MAZE', COLS2*cs/2+1, ROWS2*cs+11);
      }
    });
  }

  // ── 8. Crossword ──────────────────────────────────────────────────────────
  function puzzleCrossword() {
    var px = rnd(60, W()-120), py = FLOOR()-90;
    var COLS3=8, ROWS3=8, cs2=9;
    // Simple crossword-ish grid: some black cells, some letters being filled
    var blacks = [[0,0],[0,7],[7,0],[7,7],[1,3],[3,1],[3,5],[5,3],[2,2],[5,5]];
    var cells = Array.from({length:ROWS3},function(){return Array(COLS3).fill('');});
    blacks.forEach(function(b){ cells[b[0]][b[1]]='#'; });
    var wordChars = 'ABCDEFGHIJKLMNOPRSTUW';
    var filledCount = 0;
    var allFillable = [];
    for(var r=0;r<ROWS3;r++) for(var c=0;c<COLS3;c++) if(cells[r][c]==='') allFillable.push([r,c]);

    return makePuzzle({
      x: px, y: py, w: COLS3*cs2+2, h: ROWS3*cs2+12,
      duration: rndInt(22000, 45000),
      solveChance: 0.55,
      draw: function(ctx, t, phase, progress) {
        // Fill cells progressively
        var target = Math.floor(progress * allFillable.length);
        while (filledCount < target && filledCount < allFillable.length) {
          var cell = allFillable[filledCount];
          cells[cell[0]][cell[1]] = wordChars[rndInt(0,wordChars.length-1)];
          filledCount++;
        }

        // Grid
        for(var r2=0;r2<ROWS3;r2++) {
          for(var c2=0;c2<COLS3;c2++) {
            var v=cells[r2][c2];
            ctx.fillStyle = v==='#' ? '#111' : '#fff';
            ctx.fillRect(c2*cs2+1, r2*cs2+1, cs2-1, cs2-1);
            ctx.strokeStyle='#999'; ctx.lineWidth=0.5;
            ctx.strokeRect(c2*cs2+1, r2*cs2+1, cs2-1, cs2-1);
            if(v&&v!=='#') {
              ctx.fillStyle='#222'; ctx.font='bold 6px monospace'; ctx.textAlign='center';
              ctx.fillText(v, c2*cs2+cs2/2+1, r2*cs2+cs2-2+1);
            }
          }
        }

        ctx.fillStyle='#888'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('CROSSWORD', COLS3*cs2/2+1, ROWS3*cs2+11);
      }
    });
  }

  // ── 9. Circuit board ──────────────────────────────────────────────────────
  function puzzleCircuit() {
    var px = rnd(60, W()-120), py = FLOOR()-85;
    // Static circuit layout with blinking LEDs
    var leds = [
      {x:15,y:20,on:true,col:'#44ff44'},
      {x:45,y:35,on:false,col:'#ff4444'},
      {x:75,y:18,on:true,col:'#44ff44'},
      {x:30,y:55,on:false,col:'#ffaa00'},
      {x:60,y:60,on:true,col:'#44ff44'},
      {x:90,y:45,on:false,col:'#44ff44'},
    ];
    var traces = [
      [[10,20],[25,20],[25,35],[45,35]],
      [[45,35],[75,35],[75,18]],
      [[10,55],[30,55],[30,20]],
      [[30,55],[60,55],[60,60]],
      [[60,60],[90,60],[90,45]],
    ];

    return makePuzzle({
      x: px, y: py, w: 105, h: 75,
      duration: rndInt(18000, 35000),
      solveChance: 0.6,
      draw: function(ctx, t, phase, progress) {
        // PCB background
        ctx.fillStyle = '#0a2a0a'; ctx.fillRect(0, 0, 105, 70);
        // Grid dots
        ctx.fillStyle='rgba(0,80,0,0.3)';
        for(var gx=8;gx<105;gx+=8) for(var gy=8;gy<70;gy+=8) {
          ctx.beginPath();ctx.arc(gx,gy,0.8,0,Math.PI*2);ctx.fill();
        }
        // Traces
        ctx.strokeStyle='rgba(100,180,80,0.8)'; ctx.lineWidth=1.5;
        traces.forEach(function(pts) {
          ctx.beginPath();
          pts.forEach(function(pt,i){ i===0?ctx.moveTo(pt[0],pt[1]):ctx.lineTo(pt[0],pt[1]); });
          ctx.stroke();
        });
        // Components
        ctx.fillStyle='#334455';
        [[35,25,20,10],[55,48,14,8],[20,42,12,8]].forEach(function(c) {
          ctx.fillRect(c[0],c[1],c[2],c[3]);
          ctx.strokeStyle='rgba(180,180,200,0.5)'; ctx.lineWidth=0.5;
          ctx.strokeRect(c[0],c[1],c[2],c[3]);
        });

        // LEDs — blink based on progress, more blink = closer to solved
        leds.forEach(function(led, i) {
          var blinkRate = phase==='working' ? 20+i*8-Math.floor(progress*15) : 5;
          var on = phase==='solved' ? true : (phase==='failed' ? false : Math.floor(t/blinkRate)%2===0 ? led.on : !led.on);
          // Glow
          if (on) {
            var glow=ctx.createRadialGradient(led.x,led.y,0,led.x,led.y,8);
            glow.addColorStop(0,led.col+'99'); glow.addColorStop(1,'transparent');
            ctx.fillStyle=glow; ctx.beginPath();ctx.arc(led.x,led.y,8,0,Math.PI*2);ctx.fill();
          }
          ctx.fillStyle = on ? led.col : '#333';
          ctx.beginPath();ctx.arc(led.x,led.y,3,0,Math.PI*2);ctx.fill();
        });

        ctx.fillStyle='rgba(0,200,0,0.7)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('CIRCUIT', 52, 76);
      }
    });
  }

  // ── 10. Balance scale ─────────────────────────────────────────────────────
  function puzzleBalance() {
    var px = rnd(60, W()-110), py = FLOOR()-90;
    var leftWeight = rndInt(1,9), rightWeight = rndInt(1,9);
    var tilt = (rightWeight - leftWeight) * 4; // positive = right heavier

    return makePuzzle({
      x: px, y: py, w: 90, h: 80,
      duration: rndInt(15000, 30000),
      solveChance: 0.7,
      draw: function(ctx, t, phase, progress) {
        // Animate tilt moving toward balance as progress increases
        var currentTilt = tilt * (1 - progress*0.9);
        if (phase==='solved') currentTilt = 0;

        var cx=45, baseY=70, poleH=45;
        // Base
        ctx.fillStyle='#6b4422'; ctx.fillRect(30,baseY,30,6);
        ctx.fillStyle='#8b5a2a'; ctx.fillRect(35,baseY-poleH,5,poleH);
        // Pivot
        ctx.fillStyle='#aaa'; ctx.beginPath();ctx.arc(38,baseY-poleH+2,4,0,Math.PI*2);ctx.fill();
        // Beam (tilted)
        ctx.save(); ctx.translate(38,baseY-poleH+2);
        ctx.rotate(Math.atan2(currentTilt,35));
        ctx.fillStyle='#8b5a2a'; ctx.fillRect(-35,-2,70,4);
        // Left pan + string
        ctx.strokeStyle='#aaa'; ctx.lineWidth=0.8;
        ctx.beginPath();ctx.moveTo(-35,0);ctx.lineTo(-35,14);ctx.stroke();
        ctx.beginPath();ctx.moveTo(-32,0);ctx.lineTo(-32,14);ctx.stroke();
        ctx.fillStyle='#c8a060'; ctx.fillRect(-38,14,10,4);
        // Left weight
        ctx.fillStyle='#666';
        for(var i=0;i<leftWeight;i++) {
          ctx.beginPath();ctx.arc(-33+i%2*3,10-Math.floor(i/2)*4,3,0,Math.PI*2);ctx.fill();
        }
        // Right pan + string
        ctx.beginPath();ctx.moveTo(35,0);ctx.lineTo(35,14);ctx.stroke();
        ctx.beginPath();ctx.moveTo(32,0);ctx.lineTo(32,14);ctx.stroke();
        ctx.fillStyle='#c8a060'; ctx.fillRect(28,14,10,4);
        // Right weight
        ctx.fillStyle='#666';
        for(var j=0;j<rightWeight;j++) {
          ctx.beginPath();ctx.arc(33+j%2*3,10-Math.floor(j/2)*4,3,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
        // Numbers hint
        ctx.fillStyle='#aaa'; ctx.font='7px monospace'; ctx.textAlign='left';
        ctx.fillText(leftWeight+'kg', 2, baseY-5);
        ctx.textAlign='right';
        ctx.fillText(rightWeight+'kg', 88, baseY-5);

        ctx.fillStyle='#888'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('BALANCE', 45, 80);
      }
    });
  }

  // ── 11. Combination lock ──────────────────────────────────────────────────
  function puzzleCombo() {
    var px = rnd(60, W()-90), py = FLOOR()-80;
    var target = [rndInt(0,9),rndInt(0,9),rndInt(0,9),rndInt(0,9)];
    var current = [rndInt(0,9),rndInt(0,9),rndInt(0,9),rndInt(0,9)];

    return makePuzzle({
      x: px, y: py, w: 70, h: 75,
      duration: rndInt(15000, 30000),
      solveChance: 0.6,
      draw: function(ctx, t, phase, progress) {
        // Move each digit toward target
        if (phase === 'working' && t % 12 === 0) {
          current.forEach(function(v,i) {
            if (Math.random() < progress+0.1) {
              if (current[i] !== target[i]) current[i] = (current[i]+1)%10;
            }
          });
        }
        if (phase==='solved') current = target.slice();

        // Lock body
        ctx.fillStyle='#444'; ctx.beginPath();ctx.roundRect(0,0,70,65,6);ctx.fill();
        ctx.fillStyle='#555'; ctx.beginPath();ctx.roundRect(2,2,66,61,5);ctx.fill();
        // Shackle
        ctx.strokeStyle='#888'; ctx.lineWidth=5;
        ctx.beginPath();ctx.arc(35,-8,14,Math.PI,0);ctx.stroke();
        // Dials
        current.forEach(function(digit, i) {
          var dx=8+i*16;
          ctx.fillStyle='#222'; ctx.fillRect(dx,20,14,28);
          ctx.fillStyle='#ffcc44'; ctx.font='bold 12px monospace'; ctx.textAlign='center';
          ctx.fillText(digit, dx+7, 38);
          // Scroll marks
          ctx.fillStyle='rgba(255,200,0,0.2)';
          ctx.fillText((digit+1)%10, dx+7, 22);
          ctx.fillText((digit+9)%10, dx+7, 54);
        });
        // Indicator line
        ctx.strokeStyle='#ff4444'; ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(4,34);ctx.lineTo(66,34);ctx.stroke();

        ctx.fillStyle='#888'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('COMBO LOCK', 35, 72);
      }
    });
  }

  // ── 12. Card trick ────────────────────────────────────────────────────────
  function puzzleCards() {
    var px = rnd(60, W()-110), py = FLOOR()-85;
    var suits = ['♠','♥','♦','♣'];
    var vals  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    var hand  = Array.from({length:5}, function() {
      return { suit:pick(suits), val:pick(vals), faceUp: Math.random()>0.4, x:0, y:0 };
    });
    var fanAngle = 0;

    return makePuzzle({
      x: px, y: py, w: 100, h: 80,
      duration: rndInt(15000, 28000),
      solveChance: 0.65,
      draw: function(ctx, t, phase, progress) {
        // Fan cards
        fanAngle = Math.sin(t*0.02)*5;
        hand.forEach(function(card, i) {
          var angle = (i-2)*18 + fanAngle;
          var rad = angle * Math.PI/180;
          ctx.save();
          ctx.translate(50, 55);
          ctx.rotate(rad);
          // Card body
          ctx.fillStyle = '#fff';
          ctx.fillRect(-10,-28,20,32);
          ctx.strokeStyle='#ccc'; ctx.lineWidth=0.5;
          ctx.strokeRect(-10,-28,20,32);

          if (card.faceUp) {
            var red = card.suit==='♥'||card.suit==='♦';
            ctx.fillStyle = red ? '#cc2200' : '#111';
            ctx.font='bold 7px serif'; ctx.textAlign='center';
            ctx.fillText(card.val, 0, -18);
            ctx.font='9px serif';
            ctx.fillText(card.suit, 0, -6);
          } else {
            ctx.fillStyle='#224488';
            ctx.fillRect(-9,-27,18,30);
            // Pattern
            ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
            for(var py2=-24;py2<4;py2+=4){ctx.beginPath();ctx.moveTo(-8,py2);ctx.lineTo(8,py2);ctx.stroke();}
          }

          // Flip during solve
          if (phase==='working' && t%80===i*12) card.faceUp=!card.faceUp;
          if (phase==='solved') card.faceUp=true;
          ctx.restore();
        });

        ctx.fillStyle='#888'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('CARD TRICK', 50, 77);
      }
    });
  }

  // ── 13. Abacus ────────────────────────────────────────────────────────────
  function puzzleAbacus() {
    var px = rnd(60, W()-110), py = FLOOR()-80;
    var RODS=7, BEADS=9;
    var beadPos = Array.from({length:RODS}, function(){ return rndInt(0,BEADS); });
    var targetPos = Array.from({length:RODS}, function(){ return rndInt(0,BEADS); });
    var bcs=8;

    return makePuzzle({
      x: px, y: py, w: RODS*bcs+18, h: 72,
      duration: rndInt(16000, 30000),
      solveChance: 0.7,
      draw: function(ctx, t, phase, progress) {
        // Move beads toward target
        if (phase==='working' && t%20===0) {
          beadPos.forEach(function(v,i) {
            if (Math.random()<0.3) {
              if(beadPos[i]<targetPos[i]) beadPos[i]++;
              else if(beadPos[i]>targetPos[i]) beadPos[i]--;
            }
          });
        }
        if (phase==='solved') beadPos=targetPos.slice();

        // Frame
        ctx.fillStyle='#6b3310'; ctx.fillRect(0,0,RODS*bcs+16,66);
        ctx.fillStyle='#5a2808'; ctx.fillRect(2,2,RODS*bcs+12,62);
        ctx.fillStyle='#8b4a18'; ctx.fillRect(0,0,RODS*bcs+16,5);
        ctx.fillRect(0,61,RODS*bcs+16,5);

        // Rods and beads
        var bcols=['#cc6600','#dd7710','#ee8820'];
        for(var r=0;r<RODS;r++) {
          var rx=10+r*bcs;
          ctx.strokeStyle='#aaa'; ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(rx,6);ctx.lineTo(rx,60);ctx.stroke();
          // Beads
          for(var b=0;b<BEADS;b++) {
            var by=8+b*6;
            var above = b < beadPos[r];
            ctx.fillStyle = above ? bcols[r%bcols.length] : '#333';
            ctx.beginPath();ctx.ellipse(rx,by,3,2.5,0,0,Math.PI*2);ctx.fill();
            if(above){
              ctx.fillStyle='rgba(255,200,100,0.3)';
              ctx.beginPath();ctx.ellipse(rx-1,by-1,1.5,1,0,0,Math.PI*2);ctx.fill();
            }
          }
        }

        ctx.fillStyle='#aaa'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('ABACUS', RODS*bcs/2+8, 71);
      }
    });
  }

  // ── 14. Sudoku ────────────────────────────────────────────────────────────
  function puzzleSudoku() {
    var px = rnd(60, W()-120), py = FLOOR()-92;
    var cs3=10;
    // Pre-filled partial grid (simple, for display)
    var given = [
      [5,3,0, 0,7,0, 0,0,0],
      [6,0,0, 1,9,5, 0,0,0],
      [0,9,8, 0,0,0, 0,6,0],
      [8,0,0, 0,6,0, 0,0,3],
      [4,0,0, 8,0,3, 0,0,1],
      [7,0,0, 0,2,0, 0,0,6],
      [0,6,0, 0,0,0, 2,8,0],
      [0,0,0, 4,1,9, 0,0,5],
      [0,0,0, 0,8,0, 0,7,9],
    ];
    var filled = given.map(function(row){ return row.slice(); });
    var empties = [];
    for(var r=0;r<9;r++) for(var c=0;c<9;c++) if(given[r][c]===0) empties.push([r,c]);
    var filledEmpties = 0;
    var sols = [1,4,2,3,1,8,9,2,3,7,4,4,1,2,7,5,4,9,8,2,6,5,4,3,7,1,8,5,3,6,2,7,4,6,1]; // fake solves

    return makePuzzle({
      x: px, y: py, w: 9*cs3+2, h: 9*cs3+12,
      duration: rndInt(25000, 50000),
      solveChance: 0.5,
      draw: function(ctx, t, phase, progress) {
        var target2 = Math.floor(progress * empties.length);
        while(filledEmpties < target2 && filledEmpties < empties.length) {
          var cell2=empties[filledEmpties];
          filled[cell2[0]][cell2[1]] = rndInt(1,9);
          filledEmpties++;
        }

        ctx.fillStyle='#fffef8'; ctx.fillRect(0,0,9*cs3+2,9*cs3+2);

        for(var r2=0;r2<9;r2++) {
          for(var c2=0;c2<9;c2++) {
            var isGiven2 = given[r2][c2]!==0;
            ctx.strokeStyle='rgba(150,150,150,0.5)'; ctx.lineWidth=0.4;
            ctx.strokeRect(c2*cs3+1,r2*cs3+1,cs3,cs3);
            var v2=filled[r2][c2];
            if(v2!==0) {
              ctx.fillStyle = isGiven2 ? '#111' : '#4466cc';
              ctx.font = (isGiven2?'bold ':'')+'7px monospace';
              ctx.textAlign='center';
              ctx.fillText(v2, c2*cs3+cs3/2+1, r2*cs3+cs3-2+1);
            }
          }
        }
        // 3x3 box lines
        ctx.strokeStyle='#444'; ctx.lineWidth=1.5;
        [0,3,6,9].forEach(function(i){
          ctx.beginPath();ctx.moveTo(i*cs3+1,1);ctx.lineTo(i*cs3+1,9*cs3+1);ctx.stroke();
          ctx.beginPath();ctx.moveTo(1,i*cs3+1);ctx.lineTo(9*cs3+1,i*cs3+1);ctx.stroke();
        });

        ctx.fillStyle='#888'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('SUDOKU', 9*cs3/2+1, 9*cs3+11);
      }
    });
  }

  // ── 15. Constellation ─────────────────────────────────────────────────────
  function puzzleStars() {
    var px = rnd(60, W()-110), py = FLOOR()-90;
    var stars2 = Array.from({length:12}, function(){
      return { x:rnd(8,92), y:rnd(8,75), r:rnd(1,2.5), con:false };
    });
    var conLines=[]; // connected pairs
    var lineProgress=0;

    return makePuzzle({
      x: px, y: py, w:100, h:80,
      duration: rndInt(18000, 35000),
      solveChance: 0.65,
      draw: function(ctx, t, phase, progress) {
        // Dark sky
        ctx.fillStyle='#04060e'; ctx.fillRect(0,0,100,80);
        // Nebula wisps
        ctx.fillStyle='rgba(30,20,80,0.3)';
        ctx.beginPath();ctx.ellipse(50,40,35,20,0.3,0,Math.PI*2);ctx.fill();

        // Draw connecting lines progressively
        var targetLines=Math.floor(progress*(stars2.length-1));
        while(conLines.length<targetLines && conLines.length<stars2.length-1) {
          var i1=conLines.length, i2=(i1+1)%stars2.length;
          conLines.push([i1,i2]);
          stars2[i1].con=true; stars2[i2].con=true;
        }
        ctx.strokeStyle='rgba(150,180,255,0.4)'; ctx.lineWidth=0.8;
        conLines.forEach(function(l) {
          ctx.beginPath();
          ctx.moveTo(stars2[l[0]].x,stars2[l[0]].y);
          ctx.lineTo(stars2[l[1]].x,stars2[l[1]].y);
          ctx.stroke();
        });

        // Stars
        stars2.forEach(function(s, i) {
          var twinkle=Math.sin(t*0.05+i)*0.3+0.7;
          ctx.fillStyle=s.con?'rgba(200,220,255,'+twinkle+')':'rgba(140,150,180,'+twinkle+')';
          // Glow
          if(s.con) {
            var sg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3);
            sg.addColorStop(0,'rgba(150,180,255,0.4)');sg.addColorStop(1,'transparent');
            ctx.fillStyle=sg; ctx.beginPath();ctx.arc(s.x,s.y,s.r*3,0,Math.PI*2);ctx.fill();
          }
          ctx.fillStyle=s.con?'#e0eaff':'#9090b0';
          ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
        });

        // Constellation name hint
        if(phase==='solved') {
          ctx.fillStyle='rgba(150,180,255,0.7)'; ctx.font='7px monospace'; ctx.textAlign='center';
          ctx.fillText(pick(['ORION','URSA MAJOR','CASSIOPEIA','LYRA']), 50, 74);
        }

        ctx.fillStyle='rgba(100,120,180,0.8)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('CONSTELLATION', 50, 80);
      }
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  return {
    init:         init,
    onRoomSwitch: onRoomSwitch,
    resize:       _resize,
  };

})();
