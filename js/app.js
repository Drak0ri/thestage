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

  _updateAiModeBtn() {
    var btn = document.getElementById('btn-ai-mode');
    if (!btn) return;
    if (this.localMode) {
      btn.textContent = '💻 LOCAL';
      btn.style.borderColor = '#44cc66';
      btn.style.opacity = '1';
      btn.title = 'Using Ollama — click to switch to Cloud (PIN required)';
    } else if (this.useLocal) {
      btn.textContent = '💻 LOCAL';
      btn.style.borderColor = '#44cc66';
      btn.style.opacity = '1';
      btn.title = 'Using Ollama (' + this.localModel + ') — click to switch to Cloud';
    } else {
      btn.textContent = '☁️ CLOUD';
      btn.style.borderColor = '';
      btn.style.opacity = '1';
      btn.title = 'Using Claude API — click to switch to Local';
    }
  },

  startLocal() {
    App.localMode = true;
    App.localModel = (document.getElementById('local-model').value || 'qwen3:1.7b').trim();
    App.pin = 'local';
    sessionStorage.setItem('stage_local', '1');
    sessionStorage.setItem('stage_local_model', App.localModel);
    document.getElementById('pin-overlay').style.display = 'none';
    App.init();
  },

  submitPin() {
    var val = document.getElementById('pin-input').value.trim();
    if (!val) return;
    App.pin = val;
    sessionStorage.setItem('stage_pin', val);
    document.getElementById('pin-overlay').style.display = 'none';
    App.init();
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
    this.state.team.push(member);
    Storage.cloudSave(this.state);
    World.render();
    return member;
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
  // PIN check — try sessionStorage first so reload doesn't re-prompt
  var saved = sessionStorage.getItem('stage_pin');
  if (saved) { App.pin = saved; App.init(); }
  else { document.getElementById('pin-overlay').style.display = 'flex'; }
});
