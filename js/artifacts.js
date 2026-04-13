// js/artifacts.js — World Artifact system
// Characters can create persistent objects in the world via [ARTIFACT:type|title|content]
// Types: note, doc, plan, code, idea, list, decision
// Artifacts live in App.state.artifacts[], render on the objects-canvas layer,
// and are clickable to read/edit full content.

const ARTIFACT_TYPES = {
  note:     { icon: '📝', color: '#ffee88', border: '#ccaa00', label: 'NOTE' },
  doc:      { icon: '📄', color: '#aaddff', border: '#4488cc', label: 'DOC' },
  plan:     { icon: '🗓', color: '#aaffcc', border: '#22aa66', label: 'PLAN' },
  code:     { icon: '💾', color: '#cc99ff', border: '#7744cc', label: 'CODE' },
  idea:     { icon: '💡', color: '#ffcc88', border: '#cc7700', label: 'IDEA' },
  list:     { icon: '📋', color: '#ffaacc', border: '#cc4488', label: 'LIST' },
  decision: { icon: '⚖️', color: '#88ddff', border: '#2266aa', label: 'DECISION' },
};

const WorldObjects = {
  _modal: null,
  _viewingId: null,

  init() {
    // Ensure objects layer exists in DOM
    var layer = document.getElementById('objects-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'objects-layer';
      var charsLayer = document.getElementById('chars-layer');
      if (charsLayer) charsLayer.parentNode.insertBefore(layer, charsLayer);
    }
    this._buildModal();
    this.render();
  },

  resize() { this.render(); },

  onRoomSwitch() { this.render(); },

  // ── Render all artifacts as pixel cards in the world ──────────────────────
  render() {
    var layer = document.getElementById('objects-layer');
    if (!layer) return;
    layer.innerHTML = '';

    var artifacts = (App.state && App.state.artifacts) ? App.state.artifacts : [];
    // Only show artifacts for the current room (or room-agnostic ones)
    var room = World.currentRoom || 'stage';
    var visible = artifacts.filter(function(a) {
      return !a.room || a.room === room;
    });

    if (!visible.length) return;

    var containerW = layer.offsetWidth || layer.parentElement.offsetWidth || 700;
    var CARD_W = 80;
    var CARD_H = 64;
    var FLOOR_OFFSET = 70; // px above floor
    var SPACING = 12;

    // Spread cards along the back of the room
    var totalW = visible.length * (CARD_W + SPACING) - SPACING;
    var startX = Math.max(20, Math.round((containerW - totalW) / 2));

    visible.forEach(function(artifact, i) {
      var type = ARTIFACT_TYPES[artifact.type] || ARTIFACT_TYPES.note;
      var x = startX + i * (CARD_W + SPACING);

      var card = document.createElement('div');
      card.className = 'artifact-card';
      card.dataset.id = artifact.id;
      card.style.cssText = [
        'position:absolute',
        'left:' + x + 'px',
        'bottom:' + FLOOR_OFFSET + 'px',
        'width:' + CARD_W + 'px',
        'height:' + CARD_H + 'px',
        'background:' + type.color,
        'border:2px solid ' + type.border,
        'border-radius:3px',
        'cursor:pointer',
        'z-index:5',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:flex-start',
        'padding:4px 3px 3px',
        'box-sizing:border-box',
        'image-rendering:pixelated',
        'transition:transform 0.1s',
        'box-shadow:2px 2px 0 rgba(0,0,0,0.4)',
      ].join(';');

      // Type badge
      var badge = document.createElement('div');
      badge.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:4px;color:' + type.border + ';background:rgba(255,255,255,0.5);padding:1px 3px;border-radius:2px;margin-bottom:2px;width:100%;text-align:center;box-sizing:border-box;';
      badge.textContent = type.icon + ' ' + type.label;
      card.appendChild(badge);

      // Title
      var titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:4px;color:#1a1a1a;text-align:center;line-height:1.5;overflow:hidden;word-break:break-word;flex:1;display:flex;align-items:center;justify-content:center;padding:0 2px;';
      titleEl.textContent = artifact.title.substring(0, 28);
      card.appendChild(titleEl);

      // Author
      var authorEl = document.createElement('div');
      authorEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:3px;color:' + type.border + ';opacity:0.7;margin-top:auto;';
      authorEl.textContent = 'by ' + (artifact.authorName || '?').split(' ')[0];
      card.appendChild(authorEl);

      // Hover effect
      card.addEventListener('mouseenter', function() { card.style.transform = 'scale(1.08) translateY(-3px)'; });
      card.addEventListener('mouseleave', function() { card.style.transform = ''; });

      // Click to view
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        WorldObjects.openArtifact(artifact.id);
      });

      layer.appendChild(card);
    });
  },

  // ── Modal for reading/editing an artifact ─────────────────────────────────
  _buildModal() {
    if (document.getElementById('artifact-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'artifact-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = [
      '<div class="modal-box artifact-modal-box">',
      '  <div id="artifact-modal-header">',
      '    <span id="artifact-modal-icon"></span>',
      '    <span id="artifact-modal-title"></span>',
      '    <span id="artifact-modal-meta"></span>',
      '  </div>',
      '  <div id="artifact-modal-body"></div>',
      '  <div class="modal-btns">',
      '    <button class="px-btn" id="artifact-modal-close">CLOSE</button>',
      '    <button class="px-btn danger" id="artifact-modal-delete">🗑 DELETE</button>',
      '  </div>',
      '</div>',
    ].join('');
    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) WorldObjects.closeArtifact();
    });
    document.getElementById('artifact-modal-close').addEventListener('click', function() {
      WorldObjects.closeArtifact();
    });
    document.getElementById('artifact-modal-delete').addEventListener('click', function() {
      WorldObjects.deleteArtifact(WorldObjects._viewingId);
    });
    this._modal = modal;
  },

  openArtifact(id) {
    var artifact = (App.state.artifacts || []).find(function(a) { return a.id === id; });
    if (!artifact) return;
    this._viewingId = id;
    var type = ARTIFACT_TYPES[artifact.type] || ARTIFACT_TYPES.note;

    document.getElementById('artifact-modal-icon').textContent = type.icon + ' ';
    document.getElementById('artifact-modal-title').textContent = artifact.title;
    document.getElementById('artifact-modal-meta').textContent =
      'by ' + (artifact.authorName || '?') + '  ·  ' + (artifact.room || 'stage') + '  ·  ' + new Date(artifact.createdAt).toLocaleDateString();

    var body = document.getElementById('artifact-modal-body');
    body.innerHTML = '';
    // Render content — support markdown-lite (newlines, code blocks)
    var content = artifact.content || '';
    var pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:11px;line-height:1.6;color:var(--text);margin:0;';
    pre.textContent = content;
    body.appendChild(pre);

    // If it's been updated since creation, show update history
    if (artifact.updates && artifact.updates.length) {
      var hist = document.createElement('div');
      hist.style.cssText = 'margin-top:12px;border-top:1px solid var(--border);padding-top:8px;font-size:8px;color:var(--text-muted);';
      hist.innerHTML = '<div style="font-family:\'Press Start 2P\',monospace;font-size:5px;margin-bottom:6px;color:var(--gold);">UPDATE HISTORY</div>';
      artifact.updates.forEach(function(u) {
        var entry = document.createElement('div');
        entry.style.cssText = 'margin-bottom:6px;';
        entry.innerHTML = '<span style="color:#88aaff;">' + (u.authorName || '?') + '</span>: ' + u.note;
        hist.appendChild(entry);
      });
      body.appendChild(hist);
    }

    this._modal.classList.add('open');
  },

  closeArtifact() {
    if (this._modal) this._modal.classList.remove('open');
    this._viewingId = null;
  },

  deleteArtifact(id) {
    if (!id) return;
    App.state.artifacts = (App.state.artifacts || []).filter(function(a) { return a.id !== id; });
    Storage.cloudSave(App.state);
    this.closeArtifact();
    this.render();
    Chat.appendSystem('🗑 Artifact deleted.');
  },

  // ── Create a new artifact (called from chat.js tag parser) ────────────────
  create(type, title, content, authorId, authorName, room) {
    if (!App.state.artifacts) App.state.artifacts = [];
    var id = 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    var artifact = {
      id: id,
      type: (ARTIFACT_TYPES[type] ? type : 'note'),
      title: title.substring(0, 60),
      content: content,
      authorId: authorId,
      authorName: authorName,
      room: room || World.currentRoom || 'stage',
      createdAt: Date.now(),
      updates: [],
    };
    App.state.artifacts.push(artifact);
    Storage.cloudSave(App.state);
    this.render();
    return artifact;
  },

  // Update an existing artifact's content
  update(id, newContent, updateNote, authorName) {
    var artifact = (App.state.artifacts || []).find(function(a) { return a.id === id; });
    if (!artifact) return null;
    artifact.updates.push({
      authorName: authorName,
      note: updateNote || 'updated',
      prevContent: artifact.content,
      at: Date.now(),
    });
    artifact.content = newContent;
    Storage.cloudSave(App.state);
    this.render();
    return artifact;
  },

  // Return a compact summary of all current-room artifacts for the system prompt
  getContextString(room) {
    var artifacts = (App.state && App.state.artifacts) || [];
    var roomArts = artifacts.filter(function(a) { return !a.room || a.room === (room || World.currentRoom); });
    if (!roomArts.length) return '';
    var lines = roomArts.map(function(a) {
      var type = ARTIFACT_TYPES[a.type] || ARTIFACT_TYPES.note;
      return type.icon + ' [' + a.id + '] ' + a.type.toUpperCase() + ' "' + a.title + '" by ' + (a.authorName || '?') + ': ' + a.content.substring(0, 120) + (a.content.length > 120 ? '…' : '');
    });
    return 'ARTIFACTS IN THIS ROOM (things created by the team — you can reference, build on, or update these):\n' + lines.join('\n');
  },
};
