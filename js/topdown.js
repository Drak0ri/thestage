// js/topdown.js — top-down sprite renderer + pathfinding (BFS)

// ── Top-down sprite drawing ──────────────────────────────────────────────────
// Sprites are 16×20px in top-down view.
// facing: 'down'(default), 'up', 'left', 'right'
// walkFrame: 0 or 1 (alternating legs)

function drawTopDownChar(ctx, pal, facing, walkFrame, opts) {
  opts = opts || {};
  ctx.clearRect(0, 0, 16, 20);

  var isMoving = opts.moving || false;
  var f = walkFrame || 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(8, 19, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (facing === 'up') {
    _drawTopBack(ctx, pal, isMoving, f);
  } else if (facing === 'left') {
    ctx.save(); ctx.translate(16, 0); ctx.scale(-1, 1);
    _drawTopSide(ctx, pal, isMoving, f);
    ctx.restore();
  } else if (facing === 'right') {
    _drawTopSide(ctx, pal, isMoving, f);
  } else {
    _drawTopFront(ctx, pal, isMoving, f);
  }
}

function _drawTopFront(ctx, p, moving, f) {
  var px = function(x,y,c,w,h){ ctx.fillStyle=c; ctx.fillRect(x,y,w||1,h||1); };
  var legSwing = moving ? (f===0 ? 1 : -1) : 0;

  // Shoes
  px(4, 17, p.shoes, 3, 2); px(9, 17, p.shoes, 3, 2);
  // Legs
  px(4+legSwing, 13, p.pants, 3, 5); px(9-legSwing, 13, p.pants, 3, 5);
  px(4, 13, p.pantsS, 1, 5); px(11, 13, p.pantsS, 1, 5);
  // Belt
  px(4, 12, p.belt, 8, 1);
  // Body
  px(3, 6, p.shirt, 10, 7);
  px(3, 6, p.shirtS, 1, 7); px(12, 6, p.shirtS, 1, 7);
  px(3, 12, p.shirtS, 10, 1);
  // Arms
  var armSwing = moving ? (f===0 ? -1 : 1) : 0;
  px(1, 6+armSwing, p.shirt, 2, 6); px(13, 6-armSwing, p.shirt, 2, 6);
  px(1, 12+armSwing, p.skin, 2, 2); px(13, 12-armSwing, p.skin, 2, 2);
  // Neck
  px(6, 4, p.skin, 4, 2);
  // Head
  px(3, 0, p.skin, 10, 5);
  px(3, 0, p.hair, 10, 2);
  px(3, 0, p.hair, 2, 4); px(11, 0, p.hair, 2, 4);
  // Eyes
  px(5, 3, p.eyes, 1, 1); px(10, 3, p.eyes, 1, 1);
}

function _drawTopBack(ctx, p, moving, f) {
  var px = function(x,y,c,w,h){ ctx.fillStyle=c; ctx.fillRect(x,y,w||1,h||1); };
  var legSwing = moving ? (f===0 ? 1 : -1) : 0;

  // Shoes
  px(4, 17, p.shoes, 3, 2); px(9, 17, p.shoes, 3, 2);
  // Legs
  px(4+legSwing, 13, p.pants, 3, 5); px(9-legSwing, 13, p.pants, 3, 5);
  px(4, 13, p.pantsS, 1, 5); px(11, 13, p.pantsS, 1, 5);
  // Belt
  px(4, 12, p.belt, 8, 1);
  // Body (back)
  px(3, 6, p.shirt, 10, 7);
  px(3, 6, p.shirtS, 1, 7); px(12, 6, p.shirtS, 1, 7);
  // Back seam
  px(7, 7, p.shirtS, 2, 5);
  // Arms
  var armSwing = moving ? (f===0 ? -1 : 1) : 0;
  px(1, 6+armSwing, p.shirt, 2, 6); px(13, 6-armSwing, p.shirt, 2, 6);
  px(1, 12+armSwing, p.skin, 2, 2); px(13, 12-armSwing, p.skin, 2, 2);
  // Neck
  px(6, 4, p.skin, 4, 2);
  // Head (back — just hair)
  px(3, 0, p.hair, 10, 5);
  px(4, 1, p.hairH, 4, 1);
}

function _drawTopSide(ctx, p, moving, f) {
  var px = function(x,y,c,w,h){ ctx.fillStyle=c; ctx.fillRect(x,y,w||1,h||1); };
  var legSwing = moving ? (f===0 ? 2 : -2) : 0;

  // Shoes
  px(5, 17, p.shoes, 5, 2);
  // Legs (side — one in front one behind)
  px(5+legSwing, 13, p.pants, 4, 5);
  px(5-legSwing, 14, p.pantsS, 3, 4);
  // Belt
  px(4, 12, p.belt, 7, 1);
  // Body (profile)
  px(4, 6, p.shirt, 7, 7);
  px(4, 6, p.shirtS, 1, 7); px(10, 6, p.shirtS, 1, 7);
  // Arm (front)
  var armSwing = moving ? (f===0 ? -2 : 2) : 0;
  px(2, 7+armSwing, p.shirt, 3, 5);
  px(2, 12+armSwing, p.skin, 3, 2);
  // Neck
  px(6, 4, p.skin, 3, 2);
  // Head (side profile)
  px(4, 0, p.skin, 7, 5);
  px(4, 0, p.hair, 7, 2);
  px(4, 0, p.hair, 2, 4); // hair back
  px(11, 2, p.skinS, 1, 2); // nose
  px(9, 3, p.eyes, 1, 1);
}

// ── Pathfinding (BFS grid) ───────────────────────────────────────────────────

function bfsPath(mapData, startX, startY, goalX, goalY) {
  if (!mapData) return [];
  var w = mapData.w, h = mapData.h, tiles = mapData.tiles;

  function solid(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return TILE_PROPS[tiles[y][x]] && TILE_PROPS[tiles[y][x]].solid;
  }

  if (solid(goalX, goalY)) return [];

  var key = function(x,y) { return x+','+y; };
  var visited = {};
  var queue = [{x:startX, y:startY, path:[]}];
  visited[key(startX,startY)] = true;

  var dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
  var MAX_STEPS = 400;
  var steps = 0;

  while (queue.length && steps++ < MAX_STEPS) {
    var cur = queue.shift();
    if (cur.x === goalX && cur.y === goalY) return cur.path;
    for (var d=0; d<dirs.length; d++) {
      var nx = cur.x+dirs[d].dx, ny = cur.y+dirs[d].dy;
      var k = key(nx,ny);
      if (!visited[k] && !solid(nx,ny)) {
        visited[k] = true;
        queue.push({x:nx, y:ny, path:cur.path.concat({x:nx,y:ny})});
      }
    }
  }
  return []; // no path
}

// ── Avatar top-down state ────────────────────────────────────────────────────
// Each avatar in the world has:
// { id, x, y, map, facing, moving, walkFrame, path[], pathTimer }

var TopDown = {
  avatarStates: {}, // id → state

  ensureState(member, mapName) {
    if (!this.avatarStates[member.id]) {
      this.avatarStates[member.id] = {
        id:        member.id,
        x:         30, y: 20,  // default outdoor spawn
        map:       mapName || 'outdoor',
        facing:    'down',
        moving:    false,
        walkFrame: 0,
        walkTimer: 0,
        path:      [],
        wanderTimer: null,
        wanderPause: 0,
      };
    }
    return this.avatarStates[member.id];
  },

  // Move avatar one step along its path
  stepPath(state) {
    if (!state.path || state.path.length === 0) {
      state.moving = false;
      return;
    }
    var next = state.path.shift();
    var dx = next.x - state.x, dy = next.y - state.y;
    state.x = next.x;
    state.y = next.y;
    state.moving = true;
    if      (dy < 0) state.facing = 'up';
    else if (dy > 0) state.facing = 'down';
    else if (dx < 0) state.facing = 'left';
    else if (dx > 0) state.facing = 'right';
  },

  // Walk frame tick
  tickWalkFrame(state) {
    if (state.moving) {
      state.walkTimer = (state.walkTimer||0)+1;
      if (state.walkTimer >= 6) { state.walkTimer=0; state.walkFrame=(state.walkFrame||0)===0?1:0; }
    } else {
      state.walkFrame = 0;
    }
  },

  // Navigate avatar to target tile on current map
  navigateTo(id, tx, ty) {
    var state = this.avatarStates[id];
    if (!state) return;
    var mapData = getMap(state.map);
    state.path = bfsPath(mapData, state.x, state.y, tx, ty);
  },

  // Teleport avatar to new map (called after threshold)
  teleport(id, newMap, spawnX, spawnY, facing) {
    var state = this.avatarStates[id];
    if (!state) return;
    state.map   = newMap;
    state.x     = spawnX;
    state.y     = spawnY;
    state.facing= facing || 'down';
    state.path  = [];
    state.moving= false;
  },

  // Check if any avatar is on a door tile and return the door info
  checkThreshold(state) {
    var mapDoors = MAP_DOORS[state.map];
    if (!mapDoors) return null;
    var k = state.x+','+state.y;
    return mapDoors[k] ? DOORS[mapDoors[k]] : null;
  },
};
