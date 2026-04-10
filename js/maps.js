// js/maps.js — Tile map definitions
// Tile key:
//   0  = grass
//   1  = dirt path
//   2  = stone/pavement
//   3  = water
//   4  = wood floor (indoor)
//   5  = stone floor (indoor)
//   6  = carpet (indoor, dark)
//   7  = carpet (indoor, light)
//   8  = wall (solid, outdoor stone)
//   9  = wall (solid, indoor)
//  10  = tree (solid)
//  11  = bush (solid)
//  12  = door (threshold — triggers map transition)
//  13  = desk/table (solid object)
//  14  = chair (passable, visual only)
//  15  = water lily (passable on water)
//  16  = flower (passable)
//  17  = fence (solid)
//  18  = bookshelf (solid)
//  19  = window (wall variant)
//  20  = rug (passable)
//  21  = counter (solid)
//  22  = void / out of bounds (solid)
//  23  = gravel
//  24  = sand
//  25  = cobblestone

// Tile properties
const TILE_PROPS = {
   0: { solid:false, color:'#5a9e3a', label:'grass'       },
   1: { solid:false, color:'#b8956a', label:'dirt'        },
   2: { solid:false, color:'#9a9080', label:'stone'       },
   3: { solid:true,  color:'#4a88cc', label:'water'       },
   4: { solid:false, color:'#c8a870', label:'wood floor'  },
   5: { solid:false, color:'#a0a0a0', label:'stone floor' },
   6: { solid:false, color:'#4a3a6a', label:'dark carpet' },
   7: { solid:false, color:'#8a7ab0', label:'lit carpet'  },
   8: { solid:true,  color:'#606060', label:'stone wall'  },
   9: { solid:true,  color:'#4a3a30', label:'wood wall'   },
  10: { solid:true,  color:'#2a7a1a', label:'tree'        },
  11: { solid:true,  color:'#3a8a28', label:'bush'        },
  12: { solid:false, color:'#8a5a20', label:'door'        },
  13: { solid:true,  color:'#6a4a28', label:'furniture'   },
  14: { solid:false, color:'#7a5a38', label:'chair'       },
  15: { solid:false, color:'#5a9e3a', label:'lily'        },
  16: { solid:false, color:'#5a9e3a', label:'flower'      },
  17: { solid:true,  color:'#8a6a3a', label:'fence'       },
  18: { solid:true,  color:'#5a3a20', label:'bookshelf'   },
  19: { solid:true,  color:'#8090a0', label:'window'      },
  20: { solid:false, color:'#806090', label:'rug'         },
  21: { solid:true,  color:'#5a4a3a', label:'counter'     },
  22: { solid:true,  color:'#111111', label:'void'        },
  23: { solid:false, color:'#a09080', label:'gravel'      },
  24: { solid:false, color:'#d4c090', label:'sand'        },
  25: { solid:false, color:'#888070', label:'cobble'      },
};

// Tile size in pixels
const TILE = 16;

// ── Door definitions ─────────────────────────────────────────────────────────
// doorId → { toMap, spawnX, spawnY, facing }
// fromMap doorTile position → doorId
const DOORS = {
  'outdoor:stage_enter':   { toMap:'stage',      spawnX:7,  spawnY:12, facing:'down'  },
  'stage:outdoor_exit':    { toMap:'outdoor',    spawnX:30, spawnY:20, facing:'down'  },
  'outdoor:board_enter':   { toMap:'boardroom',  spawnX:6,  spawnY:7,  facing:'right' },
  'board:outdoor_exit':    { toMap:'outdoor',    spawnX:49, spawnY:22, facing:'right' },
  'outdoor:play_enter':    { toMap:'playground', spawnX:7,  spawnY:8,  facing:'down'  },
  'play:outdoor_exit':     { toMap:'outdoor',    spawnX:13, spawnY:33, facing:'down'  },
  'outdoor:cafe_enter':    { toMap:'cafe',       spawnX:6,  spawnY:10, facing:'up'    },
  'cafe:outdoor_exit':     { toMap:'outdoor',    spawnX:46, spawnY:32, facing:'down'  },
  'outdoor:library_enter': { toMap:'library',    spawnX:7,  spawnY:7,  facing:'down'  },
  'library:outdoor_exit':  { toMap:'outdoor',    spawnX:30, spawnY:36, facing:'down'  },
};

// Helper: given a map name and tile position, return the door id if it's a door tile
// Each map defines its door positions as part of its metadata
const MAP_DOORS = {
  outdoor:    { '29,17':'outdoor:stage_enter', '30,17':'outdoor:stage_enter',
                '46,21':'outdoor:board_enter', '47,21':'outdoor:board_enter',
                '12,31':'outdoor:play_enter',  '13,31':'outdoor:play_enter',
                '45,30':'outdoor:cafe_enter',  '46,30':'outdoor:cafe_enter',
                '29,38':'outdoor:library_enter','30,38':'outdoor:library_enter' },
  stage:      { '6,15':'stage:outdoor_exit',   '7,15':'stage:outdoor_exit'   },
  boardroom:  { '0,7':'board:outdoor_exit'                                    },
  playground: { '6,12':'play:outdoor_exit',    '7,12':'play:outdoor_exit'    },
  cafe:       { '5,13':'cafe:outdoor_exit',    '6,13':'cafe:outdoor_exit'    },
  library:    { '6,12':'library:outdoor_exit', '7,12':'library:outdoor_exit' },
};

// ── OUTDOOR MAP (60×40 tiles) ─────────────────────────────────────────────────
// prettier-ignore
function buildOutdoorMap() {
  // Build programmatically for readability
  var W=60, H=40;
  var g = Array.from({length:H}, function(){ return Array(W).fill(0); }); // grass base

  function rect(x,y,w,h,t){ for(var r=y;r<y+h;r++) for(var c=x;c<x+w;c++) if(r>=0&&r<H&&c>=0&&c<W) g[r][c]=t; }
  function hline(x,y,len,t){ for(var c=x;c<x+len;c++) if(c>=0&&c<W) g[y][c]=t; }
  function vline(x,y,len,t){ for(var r=y;r<y+len;r++) if(r>=0&&r<H) g[r][x]=t; }

  // Main dirt paths
  hline(0, 20, 60, 1);        // horizontal main road
  vline(30, 0, 40, 1);        // vertical main road
  rect(28,18,5,5,1);          // central square dirt
  rect(28,18,5,5,25);         // cobblestone square

  // Pond top-left
  rect(3, 4, 9, 6, 3);
  rect(4, 5, 7, 4, 3);
  g[5][5]=15; g[6][8]=15; g[7][6]=15; // lily pads

  // Trees scattered
  var trees=[[2,2],[2,9],[10,3],[12,8],[55,3],[57,7],[55,15],[58,17],[2,28],[4,32],[57,25],[55,33],[10,35],[15,36],[50,36]];
  trees.forEach(function(t){ if(t[1]<H&&t[0]<W) g[t[1]][t[0]]=10; });

  // Bushes lining some paths
  var bushes=[[14,19],[14,21],[45,19],[45,21],[29,13],[31,13]];
  bushes.forEach(function(b){ if(b[1]<H&&b[0]<W) g[b[1]][b[0]]=11; });

  // Flowers
  var flowers=[[6,18],[8,22],[22,15],[38,14],[50,22],[20,30],[40,30]];
  flowers.forEach(function(f){ if(f[1]<H&&f[0]<W) g[f[1]][f[0]]=16; });

  // Gravel around buildings
  // Stage building area (x:24-37, y:8-18)
  rect(23,8,16,11,23);
  // Stage building walls
  rect(25,9,12,9,8);
  // Stage windows
  g[10][25]=19; g[10][26]=19; g[10][33]=19; g[10][34]=19;
  g[12][25]=19; g[12][26]=19; g[12][33]=19; g[12][34]=19;
  // Stage door (bottom centre)
  g[17][29]=12; g[17][30]=12;
  g[18][29]=1;  g[18][30]=1;   // path leading to door

  // Boardroom (x:42-52, y:14-22)
  rect(41,14,13,9,23);
  rect(43,15,10,7,8);
  g[16][43]=19; g[16][44]=19; g[16][50]=19; g[16][51]=19;
  g[21][46]=12; g[21][47]=12; // door
  g[20][46]=1;  g[20][47]=1;

  // Playground (x:8-18, y:24-32)
  rect(7,24,13,9,0);
  rect(9,25,10,7,8);
  g[24][13]=19; g[24][14]=19;
  g[31][12]=12; g[31][13]=12; // door
  g[30][12]=1;  g[30][13]=1;

  // Café (x:42-50, y:26-33)
  rect(41,26,11,8,23);
  rect(43,27,8,6,8);
  g[27][47]=19; g[27][48]=19;
  g[30][45]=12; g[30][46]=12; // door top
  g[29][45]=1;  g[29][46]=1;

  // Library (locked, bottom centre, x:24-37, y:33-39)
  rect(23,33,16,7,23);
  rect(25,34,12,5,8);
  g[34][26]=19; g[34][27]=19; g[34][33]=19; g[34][34]=19;
  g[38][29]=12; g[38][30]=12; // door
  g[39][29]=1;  g[39][30]=1;

  // Fence around pond
  hline(2,3,11,17); hline(2,10,11,17);
  vline(2,3,8,17);  vline(12,3,8,17);
  g[3][2]=0; g[7][2]=0; // gate gaps

  return { w:W, h:H, tiles:g };
}

// ── STAGE INDOOR (14×17 tiles) ────────────────────────────────────────────────
function buildStageMap() {
  var W=14, H=17;
  var g = Array.from({length:H}, function(){ return Array(W).fill(4); }); // wood floor

  function rect(x,y,w,h,t){ for(var r=y;r<y+h;r++) for(var c=x;c<x+w;c++) if(r>=0&&r<H&&c>=0&&c<W) g[r][c]=t; }

  // Walls
  rect(0,0,W,1,9); rect(0,H-1,W,1,9); // top/bottom walls
  rect(0,0,1,H,9); rect(W-1,0,1,H,9); // left/right walls

  // Stage platform at top
  rect(2,2,10,4,2);
  rect(3,2,8,1,8); // stage front edge wall

  // Curtains (visual, passable)
  rect(1,2,2,4,20); rect(11,2,2,4,20);

  // Spotlights (chairs area)
  rect(3,7,8,6,4); // main floor area

  // Chairs facing stage
  g[8][3]=14; g[8][5]=14; g[8][7]=14; g[8][9]=14; g[8][11]=14;
  g[9][3]=14; g[9][5]=14; g[9][7]=14; g[9][9]=14; g[9][11]=14;
  g[11][4]=14; g[11][6]=14; g[11][8]=14; g[11][10]=14;

  // Windows on side walls
  g[4][0]=19; g[6][0]=19; g[4][W-1]=19; g[6][W-1]=19;

  // Exit door (bottom centre)
  g[15][6]=12; g[15][7]=12;

  // Rug on stage
  rect(4,3,6,2,20);

  return { w:W, h:H, tiles:g };
}

// ── BOARDROOM INDOOR (13×15 tiles) ───────────────────────────────────────────
function buildBoardroomMap() {
  var W=13, H=15;
  var g = Array.from({length:H}, function(){ return Array(W).fill(7); }); // carpet

  function rect(x,y,w,h,t){ for(var r=y;r<y+h;r++) for(var c=x;c<x+w;c++) if(r>=0&&r<H&&c>=0&&c<W) g[r][c]=t; }

  // Walls
  rect(0,0,W,1,9); rect(0,H-1,W,1,9);
  rect(0,0,1,H,9); rect(W-1,0,1,H,9);

  // Windows on back wall
  g[0][3]=19; g[0][4]=19; g[0][7]=19; g[0][8]=19;

  // TV on back wall (visual — wall tile)
  g[1][5]=9; g[1][6]=9; g[1][7]=9;

  // Dark carpet centre
  rect(2,2,9,11,6);

  // Conference table (big, centre)
  rect(3,4,7,6,13);
  // Passable head positions at ends
  g[4][6]=13; g[9][6]=13;

  // Chairs around table
  var chairs=[[2,4],[2,6],[2,8],[10,4],[10,6],[10,8],[4,3],[6,3],[8,3],[4,10],[6,10],[8,10]];
  chairs.forEach(function(c){ if(c[1]<H&&c[0]<W) g[c[1]][c[0]]=14; });

  // Door (left wall, mid)
  g[7][0]=12;

  // Bookshelf on right wall
  g[3][W-2]=18; g[4][W-2]=18; g[5][W-2]=18;

  return { w:W, h:H, tiles:g };
}

// ── PLAYGROUND INDOOR (14×13 tiles) ──────────────────────────────────────────
function buildPlaygroundMap() {
  var W=14, H=13;
  var g = Array.from({length:H}, function(){ return Array(W).fill(0); }); // grass floor inside

  function rect(x,y,w,h,t){ for(var r=y;r<y+h;r++) for(var c=x;c<x+w;c++) if(r>=0&&r<H&&c>=0&&c<W) g[r][c]=t; }

  // Walls
  rect(0,0,W,1,9); rect(0,H-1,W,1,9);
  rect(0,0,1,H,9); rect(W-1,0,1,H,9);

  // Indoor grass / soft surface
  rect(1,1,12,11,0);
  // Bouncy floor area (carpet)
  rect(2,2,10,8,20);

  // Windows
  g[0][4]=19; g[0][5]=19; g[0][8]=19; g[0][9]=19;
  g[5][0]=19; g[7][0]=19; g[5][W-1]=19; g[7][W-1]=19;

  // Ball pit corner
  rect(9,2,3,3,3); // water-blue for ball pit

  // Table tennis table
  rect(2,2,4,2,13);

  // Chairs/beanbags
  g[9][2]=14; g[9][3]=14; g[10][5]=14; g[10][6]=14; g[10][7]=14;

  // Exit door
  g[12][6]=12; g[12][7]=12;

  return { w:W, h:H, tiles:g };
}

// ── CAFÉ INDOOR (12×14 tiles) ─────────────────────────────────────────────────
function buildCafeMap() {
  var W=12, H=14;
  var g = Array.from({length:H}, function(){ return Array(W).fill(5); }); // stone floor

  function rect(x,y,w,h,t){ for(var r=y;r<y+h;r++) for(var c=x;c<x+w;c++) if(r>=0&&r<H&&c>=0&&c<W) g[r][c]=t; }

  // Walls
  rect(0,0,W,1,9); rect(0,H-1,W,1,9);
  rect(0,0,1,H,9); rect(W-1,0,1,H,9);

  // Warm wood floor
  rect(1,1,10,12,4);

  // Windows (front)
  g[0][3]=19; g[0][4]=19; g[0][7]=19; g[0][8]=19;

  // Counter (top, solid)
  rect(2,2,8,1,21);
  g[2][2]=21; g[2][9]=21;

  // Tables + chairs
  rect(2,5,2,2,13); rect(7,5,2,2,13); // two tables
  g[4][2]=14; g[4][3]=14; g[7][4]=14; g[7][5]=14;
  g[4][7]=14; g[4][8]=14; g[7][7]=14; g[7][8]=14;

  // Cosy corner with rug
  rect(8,9,3,3,20);
  g[10][9]=14; g[10][10]=14;

  // Secret bookshelf on back wall (easter egg)
  g[1][W-2]=18; g[2][W-2]=18;

  // Exit door
  g[13][5]=12; g[13][6]=12;

  return { w:W, h:H, tiles:g };
}

// ── LIBRARY INDOOR (14×13 tiles) — unlockable ─────────────────────────────────
function buildLibraryMap() {
  var W=14, H=13;
  var g = Array.from({length:H}, function(){ return Array(W).fill(5); }); // stone

  function rect(x,y,w,h,t){ for(var r=y;r<y+h;r++) for(var c=x;c<x+w;c++) if(r>=0&&r<H&&c>=0&&c<W) g[r][c]=t; }

  // Walls
  rect(0,0,W,1,9); rect(0,H-1,W,1,9);
  rect(0,0,1,H,9); rect(W-1,0,1,H,9);

  // Wood floor
  rect(1,1,12,11,4);

  // Bookshelves lining walls
  rect(1,1,12,1,18); // top shelf
  rect(1,1,1,5,18);  // left shelf
  rect(W-2,1,1,5,18);// right shelf

  // Reading tables
  rect(3,4,3,2,13); rect(8,4,3,2,13);

  // Chairs
  g[3][3]=14; g[3][5]=14; g[6][3]=14; g[6][5]=14;
  g[3][8]=14; g[3][10]=14; g[6][8]=14; g[6][10]=14;

  // Rug centre
  rect(4,6,6,3,20);

  // Secret passage hint (dark wall)
  g[6][W-2]=22;

  // Windows
  g[0][5]=19; g[0][6]=19; g[0][7]=19; g[0][8]=19;

  // Exit door
  g[12][6]=12; g[12][7]=12;

  return { w:W, h:H, tiles:g };
}

// ── Map registry ─────────────────────────────────────────────────────────────
const MAPS = {
  outdoor:    null, // built lazily (large)
  stage:      null,
  boardroom:  null,
  playground: null,
  cafe:       null,
  library:    null,
};

function getMap(name) {
  if (!MAPS[name]) {
    switch(name) {
      case 'outdoor':    MAPS[name] = buildOutdoorMap();    break;
      case 'stage':      MAPS[name] = buildStageMap();      break;
      case 'boardroom':  MAPS[name] = buildBoardroomMap();  break;
      case 'playground': MAPS[name] = buildPlaygroundMap(); break;
      case 'cafe':       MAPS[name] = buildCafeMap();       break;
      case 'library':    MAPS[name] = buildLibraryMap();    break;
    }
  }
  return MAPS[name];
}

// Map metadata (name label, ambient colour, music mood for AI)
const MAP_META = {
  outdoor:    { label:'Outside',    ambient:'#2a4a1a', aiContext:'You\'re outside in a pleasant open world with grass, trees, and buildings around you.' },
  stage:      { label:'The Stage',  ambient:'#0a0818', aiContext:'You\'re inside The Stage — a theatrical space with a performance platform and seats.' },
  boardroom:  { label:'Boardroom',  ambient:'#0a0c18', aiContext:'You\'re in a formal boardroom. Professional, meeting-focused tone.' },
  playground: { label:'Playground', ambient:'#0a1a0a', aiContext:'You\'re in the recreational space. Casual, playful, energetic tone.' },
  cafe:       { label:'Café',       ambient:'#1a0e08', aiContext:'You\'re in the café. Relaxed, conversational, warm.' },
  library:    { label:'Library',    ambient:'#080810', aiContext:'You\'re in the secret library. Curious, thoughtful, slightly mysterious.' },
};

// Library unlock state (persisted in state)
var libraryUnlocked = false;

function unlockLibrary() { libraryUnlocked = true; }
function isLibraryLocked() { return !libraryUnlocked; }
