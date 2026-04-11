// js/roster.js — Team roster drawer
// Collapsible panel showing all team members as pixel-face tiles.
// Green dot = on stage, grey = parked. Click to toggle. Hover for name + role.

const Roster = (function() {

  var _open = false;
  var _drawer = null;
  var _grid   = null;

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    _drawer = document.getElementById('roster-drawer');
    _grid   = document.getElementById('roster-grid');
    if (!_drawer || !_grid) return;

    // Toggle button
    var btn = document.getElementById('roster-toggle');
    if (btn) btn.addEventListener('click', toggle);

    render();
  }

  // ── Open / close ────────────────────────────────────────────────────────
  function toggle() {
    _open = !_open;
    if (_drawer) _drawer.classList.toggle('open', _open);
    var btn = document.getElementById('roster-toggle');
    if (btn) btn.classList.toggle('active', _open);
    if (_open) render();
  }

  function open()  { _open = false; toggle(); }
  function close() { if (_open) toggle(); }

  // ── Render all tiles ─────────────────────────────────────────────────────
  function render() {
    if (!_grid) return;
    _grid.innerHTML = '';

    var team = (App && App.state && App.state.team) ? App.state.team : [];

    team.forEach(function(member) {
      var isOnStage = Chat && Chat.forwardIds && Chat.forwardIds.indexOf(member.id) !== -1;
      var tile = _makeTile(member, isOnStage);
      _grid.appendChild(tile);
    });

    // ADD slot at end
    var addSlot = document.createElement('div');
    addSlot.className = 'roster-tile roster-add';
    addSlot.title = 'Add team member';
    addSlot.innerHTML = '<span class="roster-plus">+</span>';
    addSlot.addEventListener('click', function() {
      document.getElementById('add-modal').classList.add('open');
      document.getElementById('new-name').focus();
    });
    _grid.appendChild(addSlot);
  }

  // ── Build one tile ────────────────────────────────────────────────────────
  function _makeTile(member, isOnStage) {
    var tile = document.createElement('div');
    tile.className = 'roster-tile' + (isOnStage ? ' on-stage' : '');
    tile.dataset.id = member.id;

    // Pixel face canvas — 32×40 rendered at 2× internal scale
    var canvas = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 80;
    canvas.style.cssText = 'width:32px;height:40px;image-rendering:pixelated;display:block;';
    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(2, 2);
    var pal = PALETTES[member.colorIdx % PALETTES.length];
    drawPixelChar(ctx, pal, 0);
    ctx.restore();
    tile.appendChild(canvas);

    // Name label
    var nameEl = document.createElement('div');
    nameEl.className = 'roster-name';
    nameEl.textContent = member.name.split(' ')[0].substring(0, 8);
    tile.appendChild(nameEl);

    // Status dot
    var dot = document.createElement('div');
    dot.className = 'roster-dot' + (isOnStage ? ' active' : '');
    tile.appendChild(dot);

    // Tooltip
    var tip = document.createElement('div');
    tip.className = 'roster-tip';
    var role = member.role || 'team member';
    var action = isOnStage ? 'click to park' : 'click to summon';
    tip.innerHTML =
      '<strong>' + _esc(member.name) + '</strong>' +
      '<span>' + _esc(role) + '</span>' +
      '<em>' + action + '</em>';
    tile.appendChild(tip);

    // Click: toggle on/off stage
    tile.addEventListener('click', function() {
      World.selectChar(member.id);
      render(); // re-render dots
    });

    return tile;
  }

  function _esc(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Public ────────────────────────────────────────────────────────────────
  return { init: init, render: render, toggle: toggle };

})();
