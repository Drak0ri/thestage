// js/roster.js — Team roster drawer
// Collapsible panel showing all team members as pixel-face tiles.
// Gold border = speaking, green dot = listening, grey = off stage.
// Click to toggle on/off stage (and speaking). Hand-raise = wants to join.

const Roster = (function() {

  var _open = false;
  var _drawer = null;
  var _grid   = null;

  function init() {
    _drawer = document.getElementById('roster-drawer');
    _grid   = document.getElementById('roster-grid');
    if (!_drawer || !_grid) return;
    var btn = document.getElementById('roster-toggle');
    if (btn) btn.addEventListener('click', toggle);
    render();
  }

  function toggle() {
    _open = !_open;
    if (_drawer) _drawer.classList.toggle('open', _open);
    var btn = document.getElementById('roster-toggle');
    if (btn) btn.classList.toggle('active', _open);
    if (_open) render();
  }

  function open()  { _open = false; toggle(); }
  function close() { if (_open) toggle(); }

  function render() {
    if (!_grid) return;
    _grid.innerHTML = '';

    var team = (App && App.state && App.state.team) ? App.state.team : [];

    team.forEach(function(member) {
      var isOnStage    = Chat && Chat.forwardIds && Chat.forwardIds.indexOf(member.id) !== -1;
      var isSpeaking   = Chat && Chat.talkingIds && Chat.talkingIds.indexOf(member.id) !== -1;
      var isHandRaised = Chat && Chat.handRaisedIds && Chat.handRaisedIds.indexOf(member.id) !== -1;
      var tile = _makeTile(member, isOnStage, isSpeaking, isHandRaised);
      _grid.appendChild(tile);
    });

    // ADD slot
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

  function _makeTile(member, isOnStage, isSpeaking, isHandRaised) {
    var tile = document.createElement('div');
    tile.className = 'roster-tile';
    if (isOnStage) tile.classList.add('on-stage');
    if (isSpeaking) tile.classList.add('speaking');
    tile.dataset.id = member.id;

    // Pixel face canvas
    var canvas = document.createElement('canvas');
    canvas.width  = 48;
    canvas.height = 60;
    canvas.style.cssText = 'width:24px;height:30px;image-rendering:pixelated;display:block;';
    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(1.5, 1.5);
    var pal = PALETTES[member.colorIdx % PALETTES.length];
    drawPixelChar(ctx, pal, 0);
    ctx.restore();
    tile.appendChild(canvas);

    // Name label
    var nameEl = document.createElement('div');
    nameEl.className = 'roster-name';
    nameEl.textContent = member.name.split(' ')[0].substring(0, 8);
    tile.appendChild(nameEl);

    // Status dot — gold if speaking, green if listening on stage, grey if off
    var dot = document.createElement('div');
    dot.className = 'roster-dot';
    if (isSpeaking) {
      dot.classList.add('speaking');
    } else if (isOnStage) {
      dot.classList.add('active');
    }
    tile.appendChild(dot);

    // Hand raise badge
    if (isHandRaised) {
      var handBadge = document.createElement('div');
      handBadge.className = 'roster-hand';
      handBadge.textContent = '\u270b';
      tile.appendChild(handBadge);
      tile.classList.add('hand-raised');
    }

    // Tooltip
    var tip = document.createElement('div');
    tip.className = 'roster-tip';
    var role = member.role || 'team member';
    var state = isHandRaised ? 'wants to speak \u2014 click to let them in'
              : isSpeaking ? 'speaking \u2014 click to remove'
              : isOnStage ? 'listening \u2014 click to remove'
              : 'off stage \u2014 click to add';
    tip.innerHTML =
      '<strong>' + _esc(member.name) + '</strong>' +
      '<span>' + _esc(role) + '</span>' +
      '<em>' + state + '</em>';
    tile.appendChild(tip);

    // Click handler
    tile.addEventListener('click', function() {
      if (isHandRaised) {
        // Accept hand raise — add to speaking
        Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x) { return x !== member.id; });
        delete Chat.handRaisedIntents[member.id];
        if (Chat.forwardIds.indexOf(member.id) === -1) Chat.forwardIds.push(member.id);
        if (Chat.talkingIds.indexOf(member.id) === -1) Chat.talkingIds.push(member.id);
        Chat.talkingId = Chat.talkingIds[0];
        Chat.openPanel();
        Chat.renderPanel();
        // Let them speak now
        var respondMember = App.state.team.find(function(m) { return m.id === member.id; });
        if (respondMember) Chat._getResponse(respondMember);
      } else {
        // Normal toggle on/off stage
        World.toggleStage(member.id);
      }
      World.refresh();
      Roster.render();
    });

    return tile;
  }

  function _esc(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init: init, render: render, toggle: toggle };

})();
