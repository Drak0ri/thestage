// js/artifacts.js — World Artifact system
// Characters create persistent objects in the world via [ARTIFACT:type|title|content]
// Objects appear as pixel-art props on the floor of the current room.
// Click to read full content. Persists in App.state.artifacts[].

const ARTIFACT_TYPES = {
  note:     { icon: '📝', color: '#fffacc', border: '#ccaa00', label: 'NOTE',     z: 8 },
  doc:      { icon: '📄', color: '#ddeeff', border: '#4488cc', label: 'DOC',      z: 8 },
  plan:     { icon: '🗓', color: '#ccffdd', border: '#22aa66', label: 'PLAN',     z: 8 },
  code:     { icon: '💾', color: '#eebbff', border: '#7744cc', label: 'CODE',     z: 8 },
  idea:     { icon: '💡', color: '#ffeeaa', border: '#cc8800', label: 'IDEA',     z: 8 },
  list:     { icon: '📋', color: '#ffddee', border: '#cc4488', label: 'LIST',     z: 8 },
  decision: { icon: '⚖️', color: '#cceeff', border: '#2266aa', label: 'DECISION', z: 8 },
};

const WorldObjects = {
  _modal: null,
  _viewingId: null,

  init() {
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

  // ── Render artifact cards in the world ────────────────────────────────────
  render() {
    var layer = document.getElementById('objects-layer');
    if (!layer) return;
    layer.innerHTML = '';

    var artifacts = (App.state && App.state.artifacts) ? App.state.artifacts : [];
    var room = (typeof World !== 'undefined' && World.currentRoom) ? World.currentRoom : 'stage';
    var visible = artifacts.filter(function(a) { return !a.room || a.room === room; });
    if (!visible.length) return;

    var containerW = (layer.parentElement && layer.parentElement.offsetWidth) || 700;
    var containerH = (layer.parentElement && layer.parentElement.offsetHeight) || 320;
    var FLOOR_H = 58;
    var CARD_W  = 72;
    var CARD_H  = 58;

    // Place cards along the back wall area, evenly distributed with some vertical stagger
    var count   = visible.length;
    var usableW = containerW - 80;
    var startX  = 40;
    var spacingX = count > 1 ? Math.min(100, usableW / (count - 1)) : 0;
    if (count === 1) startX = Math.round(containerW / 2 - CARD_W / 2);

    visible.forEach(function(artifact, i) {
      var type = ARTIFACT_TYPES[artifact.type] || ARTIFACT_TYPES.note;
      var x    = Math.round(startX + i * spacingX);
      // Stagger vertically — alternating heights for visual depth
      var staggerY = (i % 2 === 0) ? 0 : 8;
      // Cards sit at floor level: bottom = FLOOR_H px, so top = containerH - FLOOR_H - CARD_H - staggerY
      var bottom   = FLOOR_H + staggerY;

      var card = document.createElement('div');
      card.className = 'artifact-card';
      card.dataset.id = artifact.id;
      card.style.cssText = [
        'position:absolute',
        'left:' + x + 'px',
        'bottom:' + bottom + 'px',
        'width:' + CARD_W + 'px',
        'height:' + CARD_H + 'px',
        'background:' + type.color,
        'border:2px solid ' + type.border,
        'border-radius:2px',
        'cursor:pointer',
        'z-index:' + type.z,
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'padding:3px 2px 2px',
        'box-sizing:border-box',
        'transition:transform 0.12s, box-shadow 0.12s',
        'box-shadow:2px 3px 0 rgba(0,0,0,0.5)',
        'pointer-events:all',
      ].join(';');

      // Type badge row
      var badge = document.createElement('div');
      badge.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:4px;color:' + type.border + ';' +
        'background:rgba(255,255,255,0.6);padding:1px 3px;border-radius:1px;width:100%;text-align:center;' +
        'box-sizing:border-box;margin-bottom:2px;overflow:hidden;white-space:nowrap;';
      badge.textContent = type.icon + ' ' + type.label;
      card.appendChild(badge);

      // Title
      var titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:4px;color:#111;' +
        'text-align:center;line-height:1.5;overflow:hidden;flex:1;display:flex;align-items:center;' +
        'justify-content:center;padding:0 2px;word-break:break-word;';
      titleEl.textContent = artifact.title.substring(0, 24);
      card.appendChild(titleEl);

      // Author tag
      var authorEl = document.createElement('div');
      authorEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:3px;color:' + type.border + ';' +
        'opacity:0.8;margin-top:2px;';
      authorEl.textContent = '\u2014 ' + (artifact.authorName || '?').split(' ')[0];
      card.appendChild(authorEl);

      // Shadow element (simulates 3D base)
      var shadow = document.createElement('div');
      shadow.style.cssText = 'position:absolute;bottom:-5px;left:4px;right:4px;height:4px;' +
        'background:rgba(0,0,0,0.25);border-radius:50%;filter:blur(2px);';
      card.appendChild(shadow);

      card.addEventListener('mouseenter', function() {
        card.style.transform = 'scale(1.1) translateY(-4px)';
        card.style.boxShadow = '3px 6px 0 rgba(0,0,0,0.5)';
        card.style.zIndex = '25';
      });
      card.addEventListener('mouseleave', function() {
        card.style.transform = '';
        card.style.boxShadow = '2px 3px 0 rgba(0,0,0,0.5)';
        card.style.zIndex = type.z;
      });
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        WorldObjects.openArtifact(artifact.id);
      });

      layer.appendChild(card);
    });
  },

  // ── Artifact viewer modal ─────────────────────────────────────────────────
  _buildModal() {
    if (document.getElementById('artifact-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'artifact-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = [
      '<div class="modal-box artifact-modal-box">',
      '  <div id="artifact-modal-header">',
      '    <span id="artifact-modal-icon" style="font-size:20px;"></span>',
      '    <div style="flex:1;min-width:0;">',
      '      <div id="artifact-modal-title" style="font-family:\'Press Start 2P\',monospace;font-size:8px;color:var(--gold);margin-bottom:4px;"></div>',
      '      <div id="artifact-modal-meta" style="font-family:\'Press Start 2P\',monospace;font-size:5px;color:var(--text-muted);"></div>',
      '    </div>',
      '  </div>',
      '  <div id="artifact-modal-body"></div>',
      '  <div class="modal-btns" style="gap:8px;">',
      '    <button class="px-btn danger" id="artifact-modal-delete">🗑 DELETE</button>',
      '    <button class="px-btn" id="artifact-modal-copy">📋 COPY</button>',
      '    <button class="px-btn accent" id="artifact-modal-close">CLOSE</button>',
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
      if (confirm('Delete this artifact?')) WorldObjects.deleteArtifact(WorldObjects._viewingId);
    });
    document.getElementById('artifact-modal-copy').addEventListener('click', function() {
      var art = (App.state.artifacts || []).find(function(a) { return a.id === WorldObjects._viewingId; });
      if (art) {
        navigator.clipboard.writeText(art.title + '\n\n' + art.content).then(function() {
          document.getElementById('artifact-modal-copy').textContent = '✓ COPIED';
          setTimeout(function() { document.getElementById('artifact-modal-copy').textContent = '📋 COPY'; }, 1500);
        });
      }
    });
    this._modal = modal;
  },

  openArtifact(id) {
    var artifact = (App.state.artifacts || []).find(function(a) { return a.id === id; });
    if (!artifact) return;
    this._viewingId = id;
    var type = ARTIFACT_TYPES[artifact.type] || ARTIFACT_TYPES.note;

    document.getElementById('artifact-modal-icon').textContent = type.icon;
    document.getElementById('artifact-modal-title').textContent = artifact.title;
    document.getElementById('artifact-modal-meta').textContent =
      type.label + '  ·  by ' + (artifact.authorName || '?') + '  ·  ' +
      new Date(artifact.createdAt).toLocaleDateString();

    var body = document.getElementById('artifact-modal-body');
    body.innerHTML = '';

    var pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:11px;' +
      'line-height:1.7;color:var(--text);margin:0;';
    pre.textContent = artifact.content || '';
    body.appendChild(pre);

    if (artifact.updates && artifact.updates.length) {
      var hist = document.createElement('div');
      hist.style.cssText = 'margin-top:14px;border-top:1px solid var(--border);padding-top:10px;';
      hist.innerHTML = '<div style="font-family:\'Press Start 2P\',monospace;font-size:5px;color:var(--gold);margin-bottom:8px;">REVISION HISTORY</div>';
      artifact.updates.slice().reverse().forEach(function(u) {
        var entry = document.createElement('div');
        entry.style.cssText = 'font-size:9px;margin-bottom:6px;color:var(--text-muted);line-height:1.5;';
        entry.innerHTML = '<span style="color:#88aaff;">' + (u.authorName || '?') + '</span>: ' + u.note +
          '<span style="font-size:8px;opacity:0.5;margin-left:6px;">' + new Date(u.at).toLocaleDateString() + '</span>';
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
    if (typeof Chat !== 'undefined') Chat.appendSystem('🗑 Artifact deleted.');
  },

  // ── Create (called by chat.js tag parser) ────────────────────────────────
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
      room: room || (typeof World !== 'undefined' ? World.currentRoom : 'stage'),
      createdAt: Date.now(),
      updates: [],
    };
    App.state.artifacts.push(artifact);
    Storage.cloudSave(App.state);
    this.render();
    return artifact;
  },

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

  // Context string injected into character system prompts
  getContextString(room) {
    var artifacts = (App.state && App.state.artifacts) || [];
    var r = room || (typeof World !== 'undefined' ? World.currentRoom : 'stage');
    var roomArts = artifacts.filter(function(a) { return !a.room || a.room === r; });
    if (!roomArts.length) return '';
    var lines = roomArts.map(function(a) {
      var type = ARTIFACT_TYPES[a.type] || ARTIFACT_TYPES.note;
      var preview = a.content.substring(0, 150) + (a.content.length > 150 ? '…' : '');
      return type.icon + ' [id:' + a.id + '] ' + a.type.toUpperCase() + ' "' + a.title +
        '" (by ' + (a.authorName || '?') + '): ' + preview;
    });
    return 'ARTIFACTS IN THIS ROOM — things the team has written into existence. ' +
      'You can reference these, build on them, or update them with [UPDATE_ARTIFACT:id|what changed|new full content]:\n' +
      lines.join('\n');
  },
};
