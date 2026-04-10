// js/world.js — orchestrator, delegates rendering to TileMap
// Keeps the public API (selectChar, playCharAction, render, switchRoom, etc.)
// so chat.js and app.js need no changes.

const IDLE_PX      = 1;
const ACTIVE_PX    = 1.8;
const RENDER_SCALE = 2;
const FLOOR_H      = 58;  // kept for objects.js compat

const World = {
  currentMap:   'outdoor',
  meetingMode:  false,
  wanderState:  {},
  animTimers:   {},
  charsLayer:   null,
  container:    null,

  init() {
    this.container  = document.getElementById('world-container');
    this.charsLayer = document.getElementById('chars-layer');

    // Hide the old side-scroll elements — TileMap owns rendering now
    ['bg-canvas','stars-layer','chars-layer'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    TileMap.init();
    this._ensureAvatarStates();

    if (typeof WorldObjects !== 'undefined') WorldObjects.init();
    if (typeof Puzzles      !== 'undefined') Puzzles.init();

    window.addEventListener('resize', function() { TileMap.resize(); });

    this.container.addEventListener('click', function(e) {
      var t = e.target;
      if (t === World.container || t.id === 'world-hud' || t.id === 'status-bar') {
        Chat.dismissAll();
      }
    });
  },

  _ensureAvatarStates() {
    if (!App.state || !App.state.team) return;
    App.state.team.forEach(function(m, i) {
      if (!TopDown.avatarStates[m.id]) {
        TopDown.ensureState(m, 'outdoor');
        var s = TopDown.avatarStates[m.id];
        s.x = 28 + (i % 4) * 2;
        s.y = 19 + Math.floor(i / 4) * 2;
        s._wanderCooldown = i * 30;
      }
    });
  },

  render() {
    this._ensureAvatarStates();
    // TileMap renders via its own timer
  },

  switchRoom(roomId) {
    var warpTargets = {
      stage:      { x:30, y:18 },
      boardroom:  { x:46, y:21 },
      playground: { x:13, y:30 },
    };
    var target = warpTargets[roomId];
    if (!target) return;
    TileMap.movePlayerTo(target.x, target.y);
    App.setStatus('Heading to ' + roomId + '...');
    document.querySelectorAll('.room-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.room === roomId);
    });
  },

  setMeetingMode(on) {
    this.meetingMode = on;
    if (on) {
      App.state.team.forEach(function(m) {
        TileMap.navigateToPlayer(m.id);
      });
    }
  },

  selectChar(id) {
    var idx = Chat.forwardIds.indexOf(id);
    if (idx !== -1) {
      Chat.forwardIds.splice(idx,1);
      Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x){ return x!==id; });
      if (Chat.talkingId===id) Chat.talkingId=Chat.forwardIds.length?Chat.forwardIds[0]:null;
      if (Chat.forwardIds.length===0) Chat.dismissAll();
      else Chat.renderPanel();
    } else {
      Chat.forwardIds.push(id);
      if (!Chat.talkingId) Chat.talkingId=id;
      Chat.openPanel();
      TileMap.navigateToPlayer(id);
    }
    App.setStatus(Chat.forwardIds.length
      ? Chat.forwardIds.length+' selected — click to talk, click again to dismiss'
      : 'click an avatar to chat');
  },

  async playCharAction(id, actionName) {
    var canvas = document.getElementById('chat-avatar');
    if (!canvas) return;
    var member = App.state.team.find(function(m){ return m.id===id; });
    if (!member) return;
    var pal = PALETTES[member.colorIdx%PALETTES.length];
    await playAction(canvas, pal, 1, actionName);
  },

  _clearTimers() {
    Object.values(this.animTimers).forEach(function(t){
      if (typeof t==='number'){ clearInterval(t); clearTimeout(t); }
    });
    this.animTimers={};
  },
};
