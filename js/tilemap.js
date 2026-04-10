// js/tilemap.js — Tile renderer, camera, threshold transitions, player movement

const TileMap = (function() {

  // ── Constants ──────────────────────────────────────────────────────────────
  var SCALE    = 3;          // pixels per tile pixel (tile is 16px → 48px on screen)
  var TSIZE    = TILE * SCALE; // rendered tile size in screen pixels
  var CAM_LERP = 0.12;       // camera smoothing (0=instant, 1=never moves)

  // ── State ──────────────────────────────────────────────────────────────────
  var _canvas     = null;
  var _ctx        = null;
  var _currentMap = 'outdoor';
  var _camera     = { x:0, y:0, tx:0, ty:0 }; // actual and target positions
  var _frameTimer = null;
  var _moveTimer  = null;
  var _t          = 0;
  var _transitioning = false;
  var _transitionCooldown = false;
  var _transAlpha = 0;

  // Player tile position (the human user's cursor avatar)
  var _player     = { x:30, y:20, map:'outdoor', facing:'down', moving:false, walkFrame:0, walkTimer:0 };
  var _playerPath = [];

  // Sprite cache: { id → { canvas, ctx } }
  var _spriteCache = {};

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Get or create the canvas
    _canvas = document.getElementById('world-canvas');
    if (!_canvas) {
      _canvas = document.createElement('canvas');
      _canvas.id = 'world-canvas';
      _canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;image-rendering:pixelated;cursor:crosshair;z-index:3;';
      var wc = document.getElementById('world-container');
      if (wc) wc.insertBefore(_canvas, wc.firstChild);
    } else {
      // Make sure it's visible and correctly layered
      _canvas.style.zIndex = '3';
      _canvas.style.display = 'block';
    }
    _resize();
    _ctx = _canvas.getContext('2d');
    // Force a background colour so we know it's rendering
    _ctx.fillStyle = '#1a2a10';
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Click to move player
    _canvas.addEventListener('click', function(e) {
      var rect = _canvas.getBoundingClientRect();
      var sx = e.clientX - rect.left;
      var sy = e.clientY - rect.top;
      var scaleX = _canvas.width / rect.width;
      var scaleY = _canvas.height / rect.height;
      var px = sx * scaleX, py = sy * scaleY;
      // Convert screen to tile
      var tx = Math.floor((_camera.x + px) / TSIZE);
      var ty = Math.floor((_camera.y + py) / TSIZE);
      _movePlayerTo(tx, ty);
    });

    window.addEventListener('resize', _resize);
    window.addEventListener('keydown', _onKey);

    if (_frameTimer) clearInterval(_frameTimer);
    _frameTimer = setInterval(_tick, 1000/30); // 30fps
  }

  function _resize() {
    if (!_canvas) return;
    var c = document.getElementById('world-container');
    if (c) { _canvas.width = c.offsetWidth||700; _canvas.height = c.offsetHeight||320; }
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  function _updateCamera(focusX, focusY) {
    // Target: keep focus tile centred
    _camera.tx = focusX * TSIZE - _canvas.width/2  + TSIZE/2;
    _camera.ty = focusY * TSIZE - _canvas.height/2 + TSIZE/2;
    // Clamp to map bounds
    var map = getMap(_currentMap);
    if (map) {
      _camera.tx = Math.max(0, Math.min(_camera.tx, map.w*TSIZE - _canvas.width));
      _camera.ty = Math.max(0, Math.min(_camera.ty, map.h*TSIZE - _canvas.height));
    }
    // Smooth lerp
    _camera.x += (_camera.tx - _camera.x) * CAM_LERP;
    _camera.y += (_camera.ty - _camera.y) * CAM_LERP;
  }

  // ── Tile rendering ─────────────────────────────────────────────────────────
  function _drawTile(ctx, tileId, screenX, screenY) {
    var prop = TILE_PROPS[tileId] || TILE_PROPS[0];
    ctx.fillStyle = prop.color;
    ctx.fillRect(screenX, screenY, TSIZE, TSIZE);

    // Tile details (drawn on top of base colour)
    _drawTileDetail(ctx, tileId, screenX, screenY);
  }

  function _drawTileDetail(ctx, tileId, sx, sy) {
    var s = TSIZE;
    ctx.save();
    ctx.translate(sx, sy);

    switch(tileId) {
      case 0: // grass — static positional variation (no animation)
        // Use tile position hash for static texture — never changes
        var gh = (Math.floor(sx/s)*31 + Math.floor(sy/s)*17) & 0xff;
        if (gh % 5 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(3,3,s-6,s-6);
        } else if (gh % 7 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(2,5,4,3);
        }
        break;
      case 1: // dirt — texture lines
        ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=0.5;
        ctx.beginPath();ctx.moveTo(0,s*0.3);ctx.lineTo(s,s*0.3);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,s*0.7);ctx.lineTo(s,s*0.7);ctx.stroke();
        break;
      case 3: // water — shimmer
        var wave = Math.sin(_t*0.05 + sx*0.01 + sy*0.01);
        ctx.fillStyle = 'rgba(255,255,255,'+(0.05+wave*0.03)+')';
        ctx.fillRect(2, s*0.3, s-4, 2);
        ctx.fillStyle = 'rgba(255,255,255,'+(0.03+wave*0.02)+')';
        ctx.fillRect(4, s*0.65, s-8, 1);
        break;
      case 4: // wood floor — planks
        ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=0.5;
        ctx.beginPath();ctx.moveTo(0,s/2);ctx.lineTo(s,s/2);ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.08)';
        ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(s,2);ctx.stroke();
        break;
      case 6: // dark carpet
        ctx.fillStyle='rgba(255,255,255,0.04)';
        ctx.fillRect(2,2,s-4,s-4);
        break;
      case 8: case 9: // walls — shadow edge
        ctx.fillStyle='rgba(0,0,0,0.25)';
        ctx.fillRect(0, s-3, s, 3);
        ctx.fillStyle='rgba(255,255,255,0.08)';
        ctx.fillRect(0, 0, s, 2);
        break;
      case 10: // tree
        ctx.fillStyle='#1a5a0a'; ctx.beginPath();
        ctx.arc(s/2,s/2+2,s*0.38,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#2a7a18'; ctx.beginPath();
        ctx.arc(s/2-2,s/2,s*0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#4a9a2a'; ctx.beginPath();
        ctx.arc(s/2,s/2-2,s*0.28,0,Math.PI*2); ctx.fill();
        // trunk
        ctx.fillStyle='#6b3a1a'; ctx.fillRect(s/2-2,s*0.65,4,s*0.35);
        break;
      case 11: // bush
        ctx.fillStyle='#2a7a18'; ctx.beginPath();
        ctx.arc(s/2,s/2,s*0.38,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#4a9a2a'; ctx.beginPath();
        ctx.arc(s/2-3,s/2-2,s*0.25,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#3a8a20'; ctx.beginPath();
        ctx.arc(s/2+3,s/2-2,s*0.22,0,Math.PI*2); ctx.fill();
        break;
      case 12: // door
        ctx.fillStyle='#a07030';
        ctx.fillRect(s*0.2,0,s*0.6,s);
        ctx.fillStyle='#c89040';
        ctx.fillRect(s*0.25,s*0.1,s*0.2,s*0.2); // panel
        ctx.fillRect(s*0.55,s*0.1,s*0.2,s*0.2);
        ctx.fillStyle='#ffd060'; ctx.beginPath(); // knob
        ctx.arc(s*0.65,s*0.55,2,0,Math.PI*2); ctx.fill();
        break;
      case 13: // furniture
        ctx.fillStyle='rgba(0,0,0,0.15)';
        ctx.fillRect(1,1,s-2,s-2);
        ctx.fillStyle='rgba(255,255,255,0.06)';
        ctx.fillRect(2,2,s-4,3);
        break;
      case 14: // chair
        ctx.fillStyle='#5a3a20';
        ctx.fillRect(s*0.2,s*0.4,s*0.6,s*0.5);   // seat
        ctx.fillRect(s*0.2,s*0.1,s*0.6,s*0.3);   // back
        ctx.fillRect(s*0.2,s*0.1,s*0.08,s*0.85); // left leg
        ctx.fillRect(s*0.72,s*0.1,s*0.08,s*0.85);// right leg
        break;
      case 15: // water lily
        ctx.fillStyle='#5ab840';
        ctx.beginPath();ctx.arc(s/2,s/2,s*0.3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ff6090';
        ctx.beginPath();ctx.arc(s/2,s/2,s*0.12,0,Math.PI*2);ctx.fill();
        break;
      case 16: // flower
        var fc=['#ff6060','#ffcc44','#cc44ff','#ff88aa','#44ccff'];
        ctx.fillStyle=fc[Math.floor((sx+sy)/TSIZE)%fc.length];
        ctx.beginPath();ctx.arc(s/2,s/2,s*0.25,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ffff88';
        ctx.beginPath();ctx.arc(s/2,s/2,s*0.1,0,Math.PI*2);ctx.fill();
        break;
      case 17: // fence
        ctx.fillStyle='#a07840';
        ctx.fillRect(s/2-2,0,4,s); // post
        ctx.fillRect(0,s*0.3,s,3);  // rail
        ctx.fillRect(0,s*0.65,s,3);
        break;
      case 18: // bookshelf
        ctx.fillStyle='#7a4a20'; ctx.fillRect(1,1,s-2,s-2);
        var bc=['#cc4444','#44aa44','#4444cc','#cc8844','#aa44cc'];
        for(var bi=0;bi<5;bi++){
          ctx.fillStyle=bc[bi];
          ctx.fillRect(2+bi*((s-4)/5), 2, (s-4)/5-1, s-4);
        }
        break;
      case 19: // window
        ctx.fillStyle='rgba(180,220,255,0.4)'; ctx.fillRect(1,1,s-2,s-2);
        ctx.strokeStyle='rgba(200,230,255,0.6)'; ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(s/2,1);ctx.lineTo(s/2,s-1);ctx.stroke();
        ctx.beginPath();ctx.moveTo(1,s/2);ctx.lineTo(s-1,s/2);ctx.stroke();
        break;
      case 20: // rug
        ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(2,2,s-4,s-4);
        ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
        ctx.strokeRect(3,3,s-6,s-6);
        break;
      case 21: // counter
        ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(0,0,s,3);
        ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(0,s-3,s,3);
        break;
      case 23: // gravel
        ctx.fillStyle='rgba(0,0,0,0.08)';
        for(var gi=0;gi<4;gi++) ctx.fillRect(gi*6+1,gi*4+2,3,2);
        break;
      case 25: // cobblestone
        ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5;
        ctx.strokeRect(2,2,s/2-3,s-4);
        ctx.strokeRect(s/2+1,2,s/2-3,s-4);
        break;
    }
    ctx.restore();
  }

  // ── Sprite cache ───────────────────────────────────────────────────────────
  function _getSpriteCanvas(id, pal, facing, walkFrame) {
    var key = id+'_'+facing+'_'+walkFrame;
    if (!_spriteCache[key]) {
      var c = document.createElement('canvas');
      c.width = 16; c.height = 20;
      var sctx = c.getContext('2d');
      drawTopDownChar(sctx, pal, facing, walkFrame, {moving: walkFrame!==0});
      _spriteCache[key] = c;
    }
    return _spriteCache[key];
  }

  // Invalidate sprite cache for a member (called when avatar changes)
  function _invalidateSprite(id) {
    Object.keys(_spriteCache).forEach(function(k) {
      if (k.startsWith(id+'_')) delete _spriteCache[k];
    });
  }

  // ── Draw avatars ───────────────────────────────────────────────────────────
  function _drawAvatars() {
    if (!App || !App.state || !App.state.team) return;
    var team = App.state.team;
    // Collect all entities on current map sorted by Y (painter's algorithm)
    var entities = [];

    // Player
    if (_player.map === _currentMap) {
      entities.push({ type:'player', x:_player.x, y:_player.y, facing:_player.facing, walkFrame:_player.walkFrame, pal: PALETTES[0] });
    }

    // Team members
    team.forEach(function(m) {
      var s = TopDown.avatarStates[m.id];
      if (s && s.map === _currentMap) {
        entities.push({ type:'avatar', member:m, x:s.x, y:s.y, facing:s.facing, walkFrame:s.walkFrame, pal: PALETTES[m.colorIdx%PALETTES.length] });
      }
    });

    // Sort by Y for depth
    entities.sort(function(a,b){ return a.y-b.y; });

    entities.forEach(function(e) {
      var sx = e.x * TSIZE - _camera.x;
      var sy = e.y * TSIZE - _camera.y;
      // Only draw if on screen
      if (sx < -TSIZE*2 || sx > _canvas.width+TSIZE || sy < -TSIZE*2 || sy > _canvas.height+TSIZE) return;

      var spriteW = TSIZE, spriteH = Math.round(TSIZE*1.25);

      _ctx.save();
      _ctx.translate(sx, sy - Math.round(TSIZE*0.25));
      _ctx.imageSmoothingEnabled = false;

      if (e.type === 'player') {
        // Player: red dot with direction indicator (no sprite cache needed — simple shape)
        _ctx.fillStyle = '#e74c3c';
        _ctx.beginPath(); _ctx.arc(TSIZE/2, TSIZE/2, TSIZE*0.38, 0, Math.PI*2); _ctx.fill();
        _ctx.fillStyle = '#fff';
        _ctx.beginPath(); _ctx.arc(TSIZE/2, TSIZE/2, TSIZE*0.18, 0, Math.PI*2); _ctx.fill();
        // Direction pip
        var pip = _dirPip(e.facing, TSIZE);
        _ctx.fillStyle='rgba(255,255,255,0.8)';
        _ctx.beginPath();_ctx.arc(pip.x,pip.y,3,0,Math.PI*2);_ctx.fill();
        // Label "you"
        _ctx.fillStyle='rgba(255,255,255,0.9)'; _ctx.font='bold 8px sans-serif'; _ctx.textAlign='center';
        _ctx.fillText('you', TSIZE/2, TSIZE+8);
      } else {
        // Avatar sprite
        var spriteCanvas = _getSpriteCanvas(e.member.id, e.pal, e.facing, e.walkFrame);
        _ctx.drawImage(spriteCanvas, 0, 0, spriteW, spriteH);
        // Name tag
        var isForward = Chat.forwardIds.indexOf(e.member.id) !== -1;
        var isTalking = Chat.talkingId === e.member.id;
        _ctx.fillStyle = isTalking ? '#ffcc44' : isForward ? '#88aaff' : 'rgba(255,255,255,0.7)';
        _ctx.font = 'bold 7px monospace';
        _ctx.textAlign = 'center';
        _ctx.fillText(e.member.name.split(' ')[0].substring(0,10), spriteW/2, spriteH+8);

        // Speech bubble for talking avatar
        if (isTalking) {
          _ctx.fillStyle = 'rgba(255,204,68,0.15)';
          _ctx.beginPath(); _ctx.arc(spriteW/2, -4, 5, 0, Math.PI*2); _ctx.fill();
          _ctx.fillStyle='#ffcc44'; _ctx.font='6px sans-serif'; _ctx.textAlign='center';
          _ctx.fillText('💬', spriteW/2, -1);
        }
      }
      _ctx.restore();
    });
  }

  function _dirPip(facing, size) {
    var h = size/2;
    switch(facing) {
      case 'up':    return {x:h, y:h*0.4};
      case 'down':  return {x:h, y:h*1.6};
      case 'left':  return {x:h*0.4, y:h};
      case 'right': return {x:h*1.6, y:h};
      default:      return {x:h, y:h*1.6};
    }
  }

  // ── Main render ────────────────────────────────────────────────────────────
  function _render() {
    try {
    if (!_ctx || !_canvas) return;
    var map = getMap(_currentMap);
    if (!map) return;

    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    // Determine camera focus: player if on this map, else first avatar on map
    var focusX = _player.x, focusY = _player.y;
    if (_player.map !== _currentMap) {
      var team = App.state.team;
      for (var i=0; i<team.length; i++) {
        var s = TopDown.avatarStates[team[i].id];
        if (s && s.map === _currentMap) { focusX=s.x; focusY=s.y; break; }
      }
    }
    _updateCamera(focusX, focusY);

    // Visible tile range
    var startCol = Math.max(0, Math.floor(_camera.x / TSIZE));
    var endCol   = Math.min(map.w-1, Math.ceil((_camera.x + _canvas.width) / TSIZE));
    var startRow = Math.max(0, Math.floor(_camera.y / TSIZE));
    var endRow   = Math.min(map.h-1, Math.ceil((_camera.y + _canvas.height) / TSIZE));

    // Draw tiles
    for (var row=startRow; row<=endRow; row++) {
      for (var col=startCol; col<=endCol; col++) {
        var tileId = map.tiles[row][col];
        var sx = col*TSIZE - Math.round(_camera.x);
        var sy = row*TSIZE - Math.round(_camera.y);
        _drawTile(_ctx, tileId, sx, sy);
      }
    }

    // Draw avatars
    _drawAvatars();

    // Grid overlay (subtle, for development — can be disabled)
    // _drawGrid();

    // Transition fade overlay
    if (_transAlpha > 0) {
      _ctx.fillStyle = 'rgba(0,0,0,'+_transAlpha+')';
      _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }

    // Map name HUD
    var meta = MAP_META[_currentMap];
    if (meta) {
      _ctx.fillStyle='rgba(0,0,0,0.45)';
      _ctx.fillRect(8, 8, 120, 18);
      _ctx.fillStyle='rgba(255,255,255,0.8)';
      _ctx.font='bold 8px monospace';
      _ctx.textAlign='left';
      _ctx.fillText(meta.label.toUpperCase(), 14, 20);
    }
    } catch(e) { console.warn('TileMap render error:', e); }
  }

  // ── Movement tick ──────────────────────────────────────────────────────────
  function _tick() {
    _t++;
    // Don't tick until App is ready
    if (!App || !App.state) { _render(); return; }

    // Step player path
    if (_playerPath.length > 0 && _t % 4 === 0) {
      var next = _playerPath.shift();
      var dx = next.x - _player.x, dy = next.y - _player.y;
      _player.x = next.x; _player.y = next.y;
      _player.moving = true;
      if      (dy < 0) _player.facing = 'up';
      else if (dy > 0) _player.facing = 'down';
      else if (dx < 0) _player.facing = 'left';
      else if (dx > 0) _player.facing = 'right';
      _player.walkTimer = (_player.walkTimer||0)+1;
      if (_player.walkTimer >= 2) { _player.walkTimer=0; _player.walkFrame=_player.walkFrame===0?1:0; }

      // Check player threshold
      if (!_transitioning && !_transitionCooldown) _checkPlayerThreshold();
    } else if (_playerPath.length === 0) {
      _player.moving = false;
    }

    // Step avatar paths
    var team = (App && App.state && App.state.team) ? App.state.team : [];
    team.forEach(function(m) {
      var s = TopDown.avatarStates[m.id];
      if (!s) return;
      if (s.path && s.path.length > 0 && _t % 5 === 0) {
        TopDown.stepPath(s);
        // Check avatar threshold
        if (!_transitioning && !_transitionCooldown) _checkAvatarThreshold(s);
      }
      TopDown.tickWalkFrame(s);
      // Idle wander for avatars on current map
      if (s.map === _currentMap && s.path.length === 0 && !_transitioning) {
        _wanderAvatar(s);
      }
    });

    _render();
  }

  // ── Threshold detection ────────────────────────────────────────────────────
  function _checkPlayerThreshold() {
    var mapDoors = MAP_DOORS[_player.map];
    if (!mapDoors) return;
    var k = _player.x+','+_player.y;
    var doorId = mapDoors[k];
    if (!doorId) return;
    // Library lock check
    if (doorId === 'outdoor:library_enter' && isLibraryLocked()) {
      App.setStatus('📚 The library is locked. Explore to find the key...');
      return;
    }
    var door = DOORS[doorId];
    if (!door) return;
    _doTransition(_player, null, door);
  }

  function _checkAvatarThreshold(state) {
    var door = TopDown.checkThreshold(state);
    if (!door) return;
    _doTransition(null, state, door);
  }

  // ── Fade transition ────────────────────────────────────────────────────────
  function _doTransition(playerState, avatarState, door) {
    if (_transitioning || _transitionCooldown) return;
    _transitioning = true;
    _transitionCooldown = true;

    // Fade to black
    var fadeIn = setInterval(function() {
      _transAlpha = Math.min(1, _transAlpha + 0.08);
      if (_transAlpha >= 1) {
        clearInterval(fadeIn);
        try {
          var newMap = door.toMap;
          _currentMap = newMap;
          if (playerState) {
            _player.x = door.spawnX; _player.y = door.spawnY;
            _player.facing = door.facing; _player.map = newMap;
            _playerPath = [];
          }
          if (avatarState) {
            TopDown.teleport(avatarState.id, newMap, door.spawnX, door.spawnY, door.facing);
          }
          if (MAP_META[newMap]) World.currentMap = newMap;
          App.setStatus('Entered ' + (MAP_META[newMap]||{label:newMap}).label);
          // Snap camera to spawn point
          var fx = playerState ? door.spawnX : door.spawnX;
          var fy = playerState ? door.spawnY : door.spawnY;
          _camera.x = Math.max(0, fx*TSIZE - _canvas.width/2 + TSIZE/2);
          _camera.y = Math.max(0, fy*TSIZE - _canvas.height/2 + TSIZE/2);
          _camera.tx = _camera.x; _camera.ty = _camera.y;
        } catch(e) { console.error('Transition error:', e); }

        // Fade back out — always runs even on error
        var fadeOut = setInterval(function() {
          _transAlpha = Math.max(0, _transAlpha - 0.06);
          if (_transAlpha <= 0) {
            clearInterval(fadeOut);
            _transitioning = false;
            // Brief cooldown so player does not immediately re-trigger
            setTimeout(function(){ _transitionCooldown = false; }, 800);
          }
        }, 30);
      }
    }, 30);
  }

  // ── Player movement ────────────────────────────────────────────────────────
  function _movePlayerTo(tx, ty) {
    if (_transitioning) return;
    var map = getMap(_currentMap);
    if (!map) return;
    // Don't allow moving to solid tiles
    if (tx<0||ty<0||tx>=map.w||ty>=map.h) return;
    var prop = TILE_PROPS[map.tiles[ty][tx]];
    if (prop && prop.solid) return;

    _playerPath = bfsPath(map, _player.x, _player.y, tx, ty);
  }

  function _onKey(e) {
    if (_transitioning) return;
    var dx=0, dy=0;
    switch(e.key) {
      case 'ArrowUp':    case 'w': case 'W': dy=-1; break;
      case 'ArrowDown':  case 's': case 'S': dy=1;  break;
      case 'ArrowLeft':  case 'a': case 'A': dx=-1; break;
      case 'ArrowRight': case 'd': case 'D': dx=1;  break;
      default: return;
    }
    e.preventDefault();
    var nx=_player.x+dx, ny=_player.y+dy;
    var map=getMap(_currentMap);
    if (!map||nx<0||ny<0||nx>=map.w||ny>=map.h) return;
    var prop=TILE_PROPS[map.tiles[ny][nx]];
    if (prop&&prop.solid) return;
    _playerPath=[{x:nx,y:ny}];
    if (dy<0) _player.facing='up';
    if (dy>0) _player.facing='down';
    if (dx<0) _player.facing='left';
    if (dx>0) _player.facing='right';
  }

  // ── Avatar wander (idle) ───────────────────────────────────────────────────
  function _wanderAvatar(state) {
    if (state._wanderCooldown > 0) { state._wanderCooldown--; return; }
    // Only wander occasionally
    if (Math.random() > 0.005) return;
    var map = getMap(state.map);
    if (!map) return;
    // Pick random nearby tile within 6 tiles
    var range = 6;
    var tx = state.x + Math.floor((Math.random()-0.5)*range*2);
    var ty = state.y + Math.floor((Math.random()-0.5)*range*2);
    tx = Math.max(1, Math.min(map.w-2, tx));
    ty = Math.max(1, Math.min(map.h-2, ty));
    var prop = TILE_PROPS[map.tiles[ty][tx]];
    if (prop && prop.solid) return;
    state.path = bfsPath(map, state.x, state.y, tx, ty);
    state._wanderCooldown = 60 + Math.floor(Math.random()*120);
  }

  // ── Click avatar to select ─────────────────────────────────────────────────
  function _clickedTile(tx, ty) {
    var team = App.state.team;
    for (var i=0; i<team.length; i++) {
      var s = TopDown.avatarStates[team[i].id];
      if (s && s.x===tx && s.y===ty && s.map===_currentMap) {
        World.selectChar(team[i].id);
        return true;
      }
    }
    return false;
  }

  // ── Navigate avatar to player (for chat) ──────────────────────────────────
  function navigateAvatarToPlayer(id) {
    var state = TopDown.avatarStates[id];
    if (!state || state.map !== _player.map) return;
    // Walk adjacent to player
    var tx = _player.x, ty = _player.y+1;
    var map = getMap(state.map);
    if (!map) return;
    var prop = TILE_PROPS[(map.tiles[ty]||[])[tx]];
    if (prop && prop.solid) ty = _player.y-1;
    state.path = bfsPath(map, state.x, state.y, tx, ty);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    init:              init,
    resize:            _resize,
    getCurrentMap:     function(){ return _currentMap; },
    getPlayer:         function(){ return _player; },
    navigateToPlayer:  navigateAvatarToPlayer,
    invalidateSprite:  _invalidateSprite,
    movePlayerTo:      _movePlayerTo,
    get t(){ return _t; },
  };

})();
