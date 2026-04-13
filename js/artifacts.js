// js/artifacts.js — World Artifact system
// Two kinds of artifact:
//   • Text artifacts (note, doc, plan, code, idea, list, decision) — stored as text, shown as cards
//   • Widget artifacts (widget) — stored as self-contained HTML, rendered as live iframes in the world

const ARTIFACT_TYPES = {
  note:     { icon: '📝', color: '#fffacc', border: '#ccaa00', label: 'NOTE'     },
  doc:      { icon: '📄', color: '#ddeeff', border: '#4488cc', label: 'DOC'      },
  plan:     { icon: '🗓', color: '#ccffdd', border: '#22aa66', label: 'PLAN'     },
  code:     { icon: '💾', color: '#eebbff', border: '#7744cc', label: 'CODE'     },
  idea:     { icon: '💡', color: '#ffeeaa', border: '#cc8800', label: 'IDEA'     },
  list:     { icon: '📋', color: '#ffddee', border: '#cc4488', label: 'LIST'     },
  decision: { icon: '⚖️', color: '#cceeff', border: '#2266aa', label: 'DECISION' },
  widget:   { icon: '⚙️', color: '#1a1a2e', border: '#6644cc', label: 'WIDGET'  },
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

  // ── Render artifacts in the world ─────────────────────────────────────────
  render() {
    var layer = document.getElementById('objects-layer');
    if (!layer) return;
    layer.innerHTML = '';

    var artifacts = (App.state && App.state.artifacts) ? App.state.artifacts : [];
    var room = (typeof World !== 'undefined' && World.currentRoom) ? World.currentRoom : 'stage';
    var visible = artifacts.filter(function(a) { return !a.room || a.room === room; });
    if (!visible.length) return;

    var containerW = (layer.parentElement && layer.parentElement.offsetWidth) || 700;
    var CARD_W  = 90;
    var CARD_H  = 70;
    var WIDGET_W = 160;
    var WIDGET_H = 110;
    var CARD_BOTTOM_BASE = 195;

    var count    = visible.length;
    var totalW   = visible.reduce(function(sum, a) { return sum + (a.type === 'widget' ? WIDGET_W : CARD_W) + 14; }, 0) - 14;
    var startX   = Math.max(20, Math.round((containerW - totalW) / 2));
    var curX     = startX;

    visible.forEach(function(artifact, i) {
      var isWidget = artifact.type === 'widget';
      var w = isWidget ? WIDGET_W : CARD_W;
      var h = isWidget ? WIDGET_H : CARD_H;
      var staggerY = (i % 2 === 0) ? 0 : 10;
      var bottom   = CARD_BOTTOM_BASE + staggerY;

      var el = isWidget
        ? WorldObjects._makeWidget(artifact, w, h, bottom, curX)
        : WorldObjects._makeCard(artifact, w, h, bottom, curX);

      layer.appendChild(el);
      curX += w + 14;
    });
  },

  // ── Text artifact card ────────────────────────────────────────────────────
  _makeCard(artifact, w, h, bottom, x) {
    var type = ARTIFACT_TYPES[artifact.type] || ARTIFACT_TYPES.note;

    var card = document.createElement('div');
    card.className = 'artifact-card';
    card.dataset.id = artifact.id;
    card.style.cssText = [
      'position:absolute',
      'left:' + x + 'px',
      'bottom:' + bottom + 'px',
      'width:' + w + 'px',
      'height:' + h + 'px',
      'background:' + type.color,
      'border:2px solid ' + type.border,
      'border-radius:2px',
      'cursor:pointer',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'padding:3px 2px 2px',
      'box-sizing:border-box',
      'transition:transform 0.12s, box-shadow 0.12s',
      'box-shadow:2px 3px 0 rgba(0,0,0,0.5)',
    ].join(';');

    var badge = document.createElement('div');
    badge.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:4px;color:' + type.border + ';' +
      'background:rgba(255,255,255,0.6);padding:1px 3px;border-radius:1px;width:100%;text-align:center;' +
      'box-sizing:border-box;margin-bottom:2px;overflow:hidden;white-space:nowrap;pointer-events:none;';
    badge.textContent = type.icon + ' ' + type.label;
    card.appendChild(badge);

    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:4px;color:#111;' +
      'text-align:center;line-height:1.5;overflow:hidden;flex:1;display:flex;align-items:center;' +
      'justify-content:center;padding:0 2px;word-break:break-word;pointer-events:none;';
    titleEl.textContent = artifact.title.substring(0, 28);
    card.appendChild(titleEl);

    var authorEl = document.createElement('div');
    authorEl.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:3px;color:' + type.border + ';' +
      'opacity:0.8;margin-top:2px;pointer-events:none;';
    authorEl.textContent = '\u2014 ' + (artifact.authorName || '?').split(' ')[0];
    card.appendChild(authorEl);

    card.addEventListener('mouseenter', function() {
      card.style.transform = 'scale(1.06) translateY(-3px)';
      card.style.boxShadow = '3px 6px 0 rgba(0,0,0,0.5)';
    });
    card.addEventListener('mouseleave', function() {
      card.style.transform = '';
      card.style.boxShadow = '2px 3px 0 rgba(0,0,0,0.5)';
    });
    card.addEventListener('click', function(e) {
      e.stopPropagation();
      WorldObjects.openArtifact(artifact.id);
    });

    return card;
  },

  // ── Live widget (iframe) ──────────────────────────────────────────────────
  _makeWidget(artifact, w, h, bottom, x) {
    var type = ARTIFACT_TYPES.widget;

    var wrapper = document.createElement('div');
    wrapper.className = 'artifact-card artifact-widget';
    wrapper.dataset.id = artifact.id;
    wrapper.style.cssText = [
      'position:absolute',
      'left:' + x + 'px',
      'bottom:' + bottom + 'px',
      'width:' + w + 'px',
      'height:' + h + 'px',
      'border:2px solid ' + type.border,
      'border-radius:3px',
      'cursor:pointer',
      'display:flex',
      'flex-direction:column',
      'box-shadow:2px 3px 0 rgba(0,0,0,0.7)',
      'overflow:hidden',
      'transition:transform 0.12s, box-shadow 0.12s',
      'background:#0a0820',
    ].join(';');

    // Tiny title bar
    var titleBar = document.createElement('div');
    titleBar.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:3px;' +
      'color:#aaaaff;background:#110d2a;padding:2px 4px;flex-shrink:0;' +
      'border-bottom:1px solid ' + type.border + ';pointer-events:none;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    titleBar.textContent = type.icon + ' ' + artifact.title;
    wrapper.appendChild(titleBar);

    // Live iframe — sandboxed but allows scripts
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;flex:1;border:none;pointer-events:none;display:block;';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('scrolling', 'no');
    iframe.srcdoc = artifact.content;
    wrapper.appendChild(iframe);

    wrapper.addEventListener('mouseenter', function() {
      wrapper.style.transform = 'scale(1.04) translateY(-3px)';
      wrapper.style.boxShadow = '3px 8px 0 rgba(0,0,0,0.7)';
    });
    wrapper.addEventListener('mouseleave', function() {
      wrapper.style.transform = '';
      wrapper.style.boxShadow = '2px 3px 0 rgba(0,0,0,0.7)';
    });
    // Click opens full-size version
    wrapper.addEventListener('click', function(e) {
      e.stopPropagation();
      WorldObjects.openArtifact(artifact.id);
    });

    return wrapper;
  },

  // ── Modal: text content or full-size live widget ──────────────────────────
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
      if (art && navigator.clipboard) {
        navigator.clipboard.writeText(art.content).then(function() {
          var btn = document.getElementById('artifact-modal-copy');
          btn.textContent = '✓ COPIED';
          setTimeout(function() { btn.textContent = '📋 COPY'; }, 1500);
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

    if (artifact.type === 'widget') {
      // Full-size live iframe
      var iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.style.cssText = 'width:100%;height:400px;border:none;border-radius:4px;background:#0a0820;';
      iframe.srcdoc = artifact.content;
      body.appendChild(iframe);
    } else {
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
    artifact.updates.push({ authorName: authorName, note: updateNote || 'updated', prevContent: artifact.content, at: Date.now() });
    artifact.content = newContent;
    Storage.cloudSave(App.state);
    this.render();
    return artifact;
  },

  getContextString(room) {
    var artifacts = (App.state && App.state.artifacts) || [];
    var r = room || (typeof World !== 'undefined' ? World.currentRoom : 'stage');
    var roomArts = artifacts.filter(function(a) { return !a.room || a.room === r; });
    if (!roomArts.length) return '';
    var lines = roomArts.map(function(a) {
      var type = ARTIFACT_TYPES[a.type] || ARTIFACT_TYPES.note;
      var who = 'by ' + (a.authorName || '?');
      var when = new Date(a.createdAt).toLocaleDateString();
      var updates = a.updates && a.updates.length
        ? ' [updated ' + a.updates.length + ' time(s), last by ' + a.updates[a.updates.length-1].authorName + ': ' + a.updates[a.updates.length-1].note + ']'
        : '';
      // For widgets: extract meaningful description from HTML (title tag or first heading)
      var content;
      if (a.type === 'widget') {
        var titleMatch = a.content.match(/<title>([^<]+)<\/title>/i);
        var h1Match = a.content.match(/<h[123][^>]*>([^<]+)<\/h[123]>/i);
        var desc = (titleMatch && titleMatch[1]) || (h1Match && h1Match[1]) || '';
        content = 'LIVE WIDGET — a working interactive ' + a.title + (desc && desc !== a.title ? ' (' + desc + ')' : '') +
          '. You built this and it runs in the world. You can update it with [UPDATE_ARTIFACT:' + a.id + '|what changed|new HTML].';
      } else {
        // Full content for text artifacts — they should read it completely
        content = a.content;
      }
      return type.icon + ' [id:' + a.id + '] ' + a.type.toUpperCase() + ': "' + a.title + '" — ' + who + ', ' + when + updates + '\nCONTENT: ' + content;
    });
    return 'THINGS THE TEAM HAS CREATED (you can see, reference, discuss and update all of these):\n\n' + lines.join('\n\n');
  },
};

