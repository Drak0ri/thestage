// js/app.js — main controller, bootstraps everything

const App = {
  pin: null,
  localMode: false,
  localModel: 'qwen3:1.7b',
  useLocal: false,   // hybrid toggle: true = Ollama, false = Cloud (Claude)

  toggleAiMode() {
    if (this.localMode && !this.useLocal) {
      // In pure local mode, switching to cloud needs a PIN
      var pin = prompt('Enter PIN to switch to Cloud mode:');
      if (!pin) return;
      this.pin = pin;
      this.localMode = false;
      this.useLocal = false;
      sessionStorage.removeItem('stage_local');
      sessionStorage.setItem('stage_pin', pin);
      sessionStorage.setItem('stage_useLocal', '0');
      // Reload state from cloud
      Storage.cloudLoad().then(function(state) {
        if (state && state.team && state.team.length) {
          App.state = state;
          World.render();
        }
      });
      this._updateAiModeBtn();
      this.setStatus('☁️ Switched to CLOUD mode (Claude)');
      return;
    }
    this.useLocal = !this.useLocal;
    sessionStorage.setItem('stage_useLocal', this.useLocal ? '1' : '0');
    this._updateAiModeBtn();
    this.setStatus(this.useLocal
      ? '💻 Switched to LOCAL mode (Ollama — ' + this.localModel + ')'
      : '☁️ Switched to CLOUD mode (Claude)');
  },

  toggleModelPrompt() {
    // Clicking the indicator cycles: auto (smart) → always Haiku → always Sonnet → auto
    var modes = ['auto', 'haiku', 'sonnet'];
    var current = this._modelMode || 'auto';
    var next = modes[(modes.indexOf(current) + 1) % modes.length];
    this._modelMode = next;
    var indicator = document.getElementById('model-indicator');
    if (next === 'auto') {
      this.modelPromptEnabled = true;
      if (indicator) { indicator.textContent = '\u25c6 Auto'; indicator.style.color = '#88aaff'; indicator.title = 'Smart: Haiku for chat, Sonnet for complex tasks'; }
      this.setStatus('Model: AUTO — Haiku for chat, Sonnet for complex tasks');
    } else if (next === 'haiku') {
      this.modelPromptEnabled = false;
      if (indicator) { indicator.textContent = '\u25c6 Haiku'; indicator.style.color = '#aaddff'; indicator.title = 'Always use Haiku (cheaper)'; }
      this.setStatus('Model: always Haiku');
    } else {
      this.modelPromptEnabled = false;
      if (indicator) { indicator.textContent = '\u2736 Sonnet'; indicator.style.color = '#ffcc44'; indicator.title = 'Always use Sonnet (more capable)'; }
      this.setStatus('Model: always Sonnet');
    }
  },

  _updateAiModeBtn() {
    var btn = document.getElementById('btn-ai-mode');
    if (!btn) return;
    var indicator = document.getElementById('model-indicator');
    if (this.localMode || this.useLocal) {
      btn.textContent = '💻 LOCAL';
      btn.style.borderColor = '#44cc66';
      btn.style.opacity = '1';
      btn.title = 'Using Ollama (' + this.localModel + ') — click to switch to Cloud' + (this.localMode ? ' (PIN required)' : '');
      if (indicator) {
        var shortName = this.localModel.split(':')[0];
        indicator.textContent = '◆ ' + shortName;
        indicator.style.color = '#44cc66';
        indicator.title = 'Local: ' + this.localModel;
      }
    } else {
      btn.textContent = '☁️ CLOUD';
      btn.style.borderColor = '';
      btn.style.opacity = '1';
      btn.title = 'Using Claude API — click to switch to Local';
      if (indicator) {
        var mode = this._modelMode || 'auto';
        if (mode === 'sonnet') { indicator.textContent = '✦ Sonnet'; indicator.style.color = '#ffcc44'; }
        else if (mode === 'haiku') { indicator.textContent = '◆ Haiku'; indicator.style.color = '#aaddff'; }
        else { indicator.textContent = '◆ Auto'; indicator.style.color = '#88aaff'; }
      }
    }
  },

  startLocal() {
    App.localMode = true;
    App.localModel = (document.getElementById('local-model-select')?.value || 'qwen3:1.7b').trim();
    App.pin = 'local';
    sessionStorage.setItem('stage_local', '1');
    sessionStorage.setItem('stage_local_model', App.localModel);
    document.getElementById('pin-overlay').style.display = 'none';
    App.init();
  },

  async detectOllamaModels() {
    var btn = document.querySelector('#ollama-detect-area button');
    var origText = btn.textContent;
    btn.textContent = '\u231B DETECTING...';
    btn.disabled = true;
    try {
      var resp = await fetch('http://localhost:11434/api/tags');
      var data = await resp.json();
      var models = (data.models || []).map(function(m) { return m.name; });
      if (!models.length) {
        App.setStatus('Ollama running but no models found — run: ollama pull <model>');
        btn.textContent = origText;
        btn.disabled = false;
        return;
      }
      var select = document.getElementById('local-model-select');
      select.innerHTML = '';
      // Check if we have a previously used model
      var lastModel = sessionStorage.getItem('stage_local_model') || '';
      models.forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === lastModel) opt.selected = true;
        select.appendChild(opt);
      });
      document.getElementById('ollama-detect-area').style.display = 'none';
      document.getElementById('ollama-picker').style.display = 'flex';
    } catch (e) {
      btn.textContent = origText;
      btn.disabled = false;
      App.setStatus('Could not connect to Ollama — is it running? (localhost:11434)');
      // Show a brief red flash on the button
      btn.style.borderColor = '#cc4444';
      btn.style.background = '#442222';
      setTimeout(function() {
        btn.style.borderColor = '#44cc66';
        btn.style.background = '#227744';
      }, 1500);
    }
  },

  startLocalWithSelection() {
    var select = document.getElementById('local-model-select');
    App.localModel = select ? select.value : 'qwen3:1.7b';
    App.startLocal();
  },

  submitPin() {
    var val = document.getElementById('pin-input').value.trim();
    if (!val) return;
    App.pin = val;
    sessionStorage.setItem('stage_pin', val);
    sessionStorage.setItem('stage_pin_ts', Date.now().toString());
    document.getElementById('pin-overlay').style.display = 'none';
    var note = document.getElementById('pin-expiry-note');
    if (note) note.style.display = 'none';
    // If any cloud calls were waiting for PIN re-entry, resume them all.
    if (App._pinWaiters && App._pinWaiters.length) {
      App._resumePinWaiters(val);
    } else {
      // First-time PIN entry after page load — kick off app init.
      App.init();
    }
  },

  // ── Cloud PIN expiry ────────────────────────────────────────────────────────
  // Cloud mode requires a PIN. The PIN expires every 5 minutes so the user is
  // periodically reminded (and must explicitly re-confirm) that cloud is in use.
  //
  //   await App.getCloudPin()   → returns fresh pin, or null if user cancels.
  //                               If stale, shows overlay and waits for re-entry.
  //   App.isCloudPinFresh()     → sync true/false. Background tasks use this to
  //                               silently skip rather than interrupt the user.
  //
  // Local-mode calls should NOT use either — they use App.pin === 'local' marker.
  PIN_MAX_AGE_MS: 5 * 60 * 1000,

  isCloudPinFresh() {
    var pin = App.pin;
    if (pin === 'local') pin = sessionStorage.getItem('stage_pin') || '';
    var ts = parseInt(sessionStorage.getItem('stage_pin_ts') || '0', 10);
    return !!(pin && ts && (Date.now() - ts) < App.PIN_MAX_AGE_MS);
  },

  // Queue of promises waiting for PIN re-entry. Multiple concurrent cloud calls
  // during a stale-PIN window all resolve off the same next submitPin.
  _pinWaiters: [],

  getCloudPin() {
    return new Promise(function(resolve) {
      if (App.isCloudPinFresh()) {
        var pin = App.pin;
        if (pin === 'local') pin = sessionStorage.getItem('stage_pin') || '';
        return resolve(pin);
      }
      // Stale — clear state, queue, show overlay
      sessionStorage.removeItem('stage_pin');
      sessionStorage.removeItem('stage_pin_ts');
      if (App.pin !== 'local') App.pin = null;
      App._pinWaiters.push(resolve);
      App._showPinExpiredOverlay();
    });
  },

  _showPinExpiredOverlay() {
    var overlay = document.getElementById('pin-overlay');
    if (!overlay) {
      // No overlay — fallback to native prompt (also resumes all waiters at once)
      var entered = prompt('PIN expired. Re-enter PIN to continue using cloud:');
      if (entered) {
        App.pin = entered;
        sessionStorage.setItem('stage_pin', entered);
        sessionStorage.setItem('stage_pin_ts', Date.now().toString());
      }
      App._resumePinWaiters(entered || null);
      return;
    }
    overlay.style.display = 'flex';
    // Inject expiry notice so user understands why overlay appeared
    var note = document.getElementById('pin-expiry-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'pin-expiry-note';
      note.style.cssText = "font-family:'Press Start 2P',monospace;font-size:7px;color:#ffaa44;text-align:center;max-width:240px;line-height:1.7;";
      // Insert near the top of the overlay, after the title & subtitle blocks
      var children = overlay.children;
      var insertBefore = children.length > 2 ? children[2] : null;
      if (insertBefore) overlay.insertBefore(note, insertBefore);
      else overlay.appendChild(note);
    }
    note.textContent = 'PIN expired — cloud mode requires re-entry every 5 minutes';
    note.style.display = 'block';
    var input = document.getElementById('pin-input');
    if (input) { input.value = ''; setTimeout(function(){ input.focus(); }, 50); }
  },

  _resumePinWaiters(pin) {
    var waiters = App._pinWaiters;
    App._pinWaiters = [];
    waiters.forEach(function(resolve) { resolve(pin); });
  },

  state: { team: [], chatHistory: {} },
  meetingMode: false,
  inviteList: [], // ids currently "on stage" in meeting mode

  async init() {
    this.state = await Storage.cloudLoad();
    // Ensure all fields exist regardless of what Gist returned
    if (!this.state.briefing)       this.state.briefing       = '';
    if (!this.state.chatHistory)    this.state.chatHistory    = {};
    if (!this.state.team)           this.state.team           = [];
    if (!this.state.conversations)  this.state.conversations  = {};
    if (!this.state.stageIds)       this.state.stageIds       = [];
    if (this.state.stageTalkingId === undefined) this.state.stageTalkingId = null;
    if (!this.state.artifacts)      this.state.artifacts      = [];
    if (!this.state.props)          this.state.props          = [];
    // Migrate: flag any existing "Claude" member for the enhanced renderer
    this.state.team.forEach(function(m) {
      if (m && typeof m.name === 'string' && m.name.trim().toLowerCase() === 'claude' && !m.enhanced) {
        m.enhanced = true;
      }
    });
    // Migrate any flat chatHistory arrays to two-layer format {summary,recent}
    Object.keys(this.state.chatHistory).forEach(function(id) {
      var h = App.state.chatHistory[id];
      if (Array.isArray(h)) {
        App.state.chatHistory[id] = { summary: '', recent: h };
      } else if (!h || typeof h !== 'object') {
        App.state.chatHistory[id] = { summary: '', recent: [] };
      }
      if (!App.state.chatHistory[id].recent) App.state.chatHistory[id].recent = [];
      if (!App.state.chatHistory[id].summary) App.state.chatHistory[id].summary = '';
    });
    World.init();
    Chat.init();
    if (typeof Roster !== 'undefined') Roster.init();
    if (typeof Props !== 'undefined') Props.init();
    this._bindToolbar();
    this._bindModal();
    // Restore hybrid toggle
    if (!this.localMode && sessionStorage.getItem('stage_useLocal') === '1') {
      this.useLocal = true;
    }
    this._updateAiModeBtn();
    // Restore stage first, then render once with restored forwardIds
    Chat._restoreStage();
    World.render();
    if (typeof Roster !== 'undefined') Roster.render();
    this.setStatus(
      this.state.team.length
        ? 'click a character to chat'
        : 'no team yet — click + ADD to invite someone'
    );
  },

  logout() {
    sessionStorage.removeItem('stage_pin');
    sessionStorage.removeItem('stage_local');
    sessionStorage.removeItem('stage_local_model');
    sessionStorage.removeItem('stage_useLocal');
    App.pin = null;
    App.localMode = false;
    App.useLocal = false;
    App.localModel = 'qwen3:1.7b';
    this._updateAiModeBtn();
    document.getElementById('pin-overlay').style.display = 'flex';
  },

  setStatus(msg) {
    document.getElementById('status-bar').textContent = msg;
  },

  _bindToolbar() {
    // Room buttons
    document.querySelectorAll('.room-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { World.switchRoom(btn.dataset.room); });
    });

    // AI mode toggle
    document.getElementById('btn-ai-mode').addEventListener('click', function() {
      App.toggleAiMode();
    });

    var btnBriefing = document.getElementById('btn-briefing');
    if (btnBriefing) btnBriefing.addEventListener('click', () => {
      var bm = document.getElementById('briefing-modal');
      var bt = document.getElementById('briefing-text');
      if (bm) bm.classList.add('open');
      if (bt) { bt.value = App.state.briefing || ''; bt.focus(); }
    });

    document.getElementById('btn-add').addEventListener('click', () => {
      document.getElementById('add-modal').classList.add('open');
      document.getElementById('new-name').focus();
    });

    document.getElementById('btn-meeting').addEventListener('click', () => {
      this.meetingMode = !this.meetingMode;
      document.getElementById('btn-meeting').classList.toggle('active', this.meetingMode);
      document.getElementById('btn-dismiss').style.display = this.meetingMode ? '' : 'none';
      World.setMeetingMode(this.meetingMode);
      this.setStatus(this.meetingMode
        ? '⚑ meeting mode — everyone gathered, pick who to talk to'
        : 'click a character to chat'
      );
    });

    document.getElementById('btn-dismiss').addEventListener('click', () => {
      this.meetingMode = false;
      document.getElementById('btn-meeting').classList.remove('active');
      document.getElementById('btn-dismiss').style.display = 'none';
      World.setMeetingMode(false);
      Chat.close();
      this.setStatus('meeting dismissed — click a character to chat');
    });
  },

  _bindModal() {
    document.getElementById('add-cancel').addEventListener('click', () => {
      document.getElementById('add-modal').classList.remove('open');
    });

    document.getElementById('add-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('add-modal')) {
        document.getElementById('add-modal').classList.remove('open');
      }
    });

    document.getElementById('add-confirm').addEventListener('click', () => this._addMember());

    var bModal  = document.getElementById('briefing-modal');
    var bCancel = document.getElementById('briefing-cancel');
    var bSave   = document.getElementById('briefing-save');
    if (bCancel) bCancel.addEventListener('click', () => { if(bModal) bModal.classList.remove('open'); });
    if (bModal)  bModal.addEventListener('click', e => { if (e.target === bModal) bModal.classList.remove('open'); });
    if (bSave)   bSave.addEventListener('click', () => {
      var ta = document.getElementById('briefing-text');
      App.state.briefing = ta ? ta.value.trim() : '';
      Storage.cloudSave(App.state);
      if (bModal) bModal.classList.remove('open');
      App.setStatus('Project briefing saved — all characters now share this context.');
    });

    document.getElementById('new-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('new-role').focus();
    });
    document.getElementById('new-role').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._addMember();
    });
  },

  // Reusable: create a member from name+role and add to state
  // Called both from the UI modal and from chat.js [CREATE:] tag
  createMember(name, role) {
    const member = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      name: name,
      role: role || '',
      colorIdx: this.state.team.length,
      personality: PERSONALITIES[this.state.team.length % PERSONALITIES.length]
    };
    // Enhanced animation layer — currently opt-in for "Claude" only
    if (typeof name === 'string' && name.trim().toLowerCase() === 'claude') {
      member.enhanced = true;
    }
    this.state.team.push(member);
    Storage.cloudSave(this.state);
    World.render();
    // Create template character files
    this._createCharFiles(member);
    return member;
  },

  async _createCharFiles(member) {
    var r = member.role || 'Team Member';
    var n = member.name;
    var templates = {
      'soul.md': '# ' + n + ' \u2014 Soul\n\n## Identity\n- **Name:** ' + n + '\n- **Role:** ' + r + '\n\n## Personality\n<!-- Core personality traits, values, communication style -->\n\n## Values\n<!-- What matters most to this person -->\n\n## Communication Style\n<!-- How they talk, what phrases they use, their tone -->',
      'st_mem.md': '# ' + n + ' \u2014 Short-Term Memory\n\n<!-- Updated automatically after each conversation. Contains recent context. -->\n<!-- Rolled into long-term memory periodically. -->\n\n## Current Focus\n<!-- What are they working on right now? -->\n\n## Recent Conversations\n<!-- Last few interactions, key points -->\n\n## Open Threads\n<!-- Unresolved questions, pending tasks, things to follow up on -->',
      'lt_mem.md': '# ' + n + ' \u2014 Long-Term Memory\n\n<!-- Persistent knowledge accumulated over time. Rarely changes. -->\n\n## Key Decisions\n<!-- Important decisions made, with context -->\n\n## Lessons Learned\n<!-- Insights gained from experience -->\n\n## Important Facts\n<!-- Things worth remembering permanently -->',
      'skills.md': '# ' + n + ' \u2014 Skills & Expertise\n\n## Primary Skills\n<!-- Core competencies for their role as ' + r + ' -->\n\n## Secondary Skills\n<!-- Additional abilities and knowledge areas -->\n\n## Tools & Methods\n<!-- Preferred tools, frameworks, approaches -->',
      'goals.md': '# ' + n + ' \u2014 Goals & Tasks\n\n## Active Goals\n<!-- Current objectives they\'re working toward -->\n\n## Completed\n<!-- Recently achieved goals -->',
      'relationships.md': '# ' + n + ' \u2014 Relationships\n\n## Team Dynamics\n<!-- How they interact with each specific team member -->\n\n## Notes\n<!-- Observations about team relationships -->'
    };
    var pin = App.pin;
    if (pin === 'local') pin = sessionStorage.getItem('stage_pin') || '';
    if (!pin) return;
    var relayUrl = (typeof RELAY_URL !== 'undefined') ? RELAY_URL : 'https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec';
    var slug = member.name.toLowerCase() + '-' + member.id;
    var files = Object.keys(templates);
    for (var i = 0; i < files.length; i++) {
      var fname = files[i];
      try {
        await fetch(relayUrl, {
          method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'writeFile', pin: pin, path: 'characters/' + slug + '/' + fname, content: templates[fname] })
        });
      } catch(e) { console.warn('Failed to create ' + fname + ' for ' + member.name, e); }
    }
    console.log('[STAGE] Created template files for ' + member.name);
  },

  _addMember() {
    const name = document.getElementById('new-name').value.trim();
    if (!name) { document.getElementById('new-name').focus(); return; }
    const role = document.getElementById('new-role').value.trim();

    const member = this.createMember(name, role);

    document.getElementById('add-modal').classList.remove('open');
    document.getElementById('new-name').value = '';
    document.getElementById('new-role').value = '';

    this.setStatus(name + ' has joined The Stage!');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Check for local mode first
  if (sessionStorage.getItem('stage_local') === '1') {
    App.localMode = true;
    App.localModel = sessionStorage.getItem('stage_local_model') || 'qwen3:1.7b';
    App.pin = 'local';
    App.init();
    return;
  }
  // PIN check — try sessionStorage first so reload doesn't re-prompt,
  // but only if the stored PIN is still fresh (<5 min old).
  var saved = sessionStorage.getItem('stage_pin');
  var savedTs = parseInt(sessionStorage.getItem('stage_pin_ts') || '0', 10);
  var savedAge = Date.now() - savedTs;
  if (saved && savedTs && savedAge < (5 * 60 * 1000)) {
    App.pin = saved;
    App.init();
  } else {
    // Clear any stale PIN data and force re-entry
    sessionStorage.removeItem('stage_pin');
    sessionStorage.removeItem('stage_pin_ts');
    document.getElementById('pin-overlay').style.display = 'flex';
  }
});




