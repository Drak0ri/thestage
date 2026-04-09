// js/app.js — main controller, bootstraps everything

const App = {
  state: { team: [], chatHistory: {} },
  meetingMode: false,
  inviteList: [], // ids currently "on stage" in meeting mode

  init() {
    this.state = Storage.load();
    World.init();
    Chat.init();
    this._bindToolbar();
    this._bindModal();
    World.render();
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

    document.getElementById('new-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('new-role').focus();
    });
    document.getElementById('new-role').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._addMember();
    });
  },

  _addMember() {
    const name = document.getElementById('new-name').value.trim();
    if (!name) {
      document.getElementById('new-name').focus();
      return;
    }
    const role = document.getElementById('new-role').value.trim();

    const member = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      name,
      role,
      colorIdx: this.state.team.length,
      personality: PERSONALITIES[this.state.team.length % PERSONALITIES.length],
      bubble: null
    };

    this.state.team.push(member);
    Storage.save(this.state);

    document.getElementById('add-modal').classList.remove('open');
    document.getElementById('new-name').value = '';
    document.getElementById('new-role').value = '';

    World.render();
    this.setStatus(name + ' has joined The Stage!');

    // Welcome bubble
    member.bubble = 'Hey! 👾';
    World.render();
    setTimeout(() => { member.bubble = null; World.render(); }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
