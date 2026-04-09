// js/chat.js — AI chat logic

const Chat = {
  panel: null,
  messagesEl: null,
  inputEl: null,
  currentId: null,

  init() {
    this.panel = document.getElementById('chat-panel');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl = document.getElementById('chat-input');

    document.getElementById('chat-close').addEventListener('click', () => this.close());
    document.getElementById('chat-send').addEventListener('click', () => this.send());
    this.inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') this.send(); });
  },

  open(member) {
    this.currentId = member.id;
    this.panel.classList.add('open');

    document.getElementById('chat-name').textContent = member.name;
    document.getElementById('chat-role').textContent = member.role || 'Team Member';

    const av = document.getElementById('chat-avatar');
    const ctx = av.getContext('2d');
    ctx.clearRect(0, 0, av.width, av.height);
    const pal = PALETTES[member.colorIdx % PALETTES.length];
    ctx.save();
    ctx.scale(0.75, 0.75);
    drawPixelChar(ctx, pal, 0);
    ctx.restore();

    this.renderMessages(member.id);
    this.inputEl.focus();
  },

  close() {
    this.panel.classList.remove('open');
    this.currentId = null;
    World.deselectAll();
    App.setStatus('click a character to chat');
  },

  renderMessages(id) {
    this.messagesEl.innerHTML = '';
    const hist = App.state.chatHistory[id] || [];

    if (hist.length === 0) {
      this.appendSystem('no messages yet — say hello!');
    }

    hist.forEach(m => this._appendMsg(m.role, m.content, id));
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  },

  _appendMsg(role, content, id) {
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
    if (role === 'assistant') {
      const member = App.state.team.find(t => t.id === (id || this.currentId));
      div.innerHTML = '<div class="speaker">' + (member ? member.name.toUpperCase() : '') + '</div>' + this._esc(content);
    } else {
      div.textContent = content;
    }
    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return div;
  },

  appendSystem(text) {
    const div = document.createElement('div');
    div.className = 'msg system';
    div.textContent = text;
    this.messagesEl.appendChild(div);
  },

  async send() {
    const text = this.inputEl.value.trim();
    if (!text || !this.currentId) return;
    this.inputEl.value = '';

    const member = App.state.team.find(m => m.id === this.currentId);
    if (!member) return;

    if (!App.state.chatHistory[this.currentId]) App.state.chatHistory[this.currentId] = [];
    App.state.chatHistory[this.currentId].push({ role: 'user', content: text });
    this._appendMsg('user', text);

    member.bubble = '...';
    World.render();

    const thinking = document.createElement('div');
    thinking.className = 'msg ai thinking';
    thinking.textContent = '\u25cb thinking...';
    this.messagesEl.appendChild(thinking);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    const system = 'You are ' + member.name + ', a team member on Baz\'s team. Your job role: ' + (member.role || 'team member') + '. Your personality: ' + member.personality + '. You exist in a 2D pixel world called "The Stage" alongside your colleagues. The person talking to you is Baz. Keep ALL responses SHORT (2-3 sentences max). Be in-character and conversational. Never break character. Never be verbose.';

    const messages = (App.state.chatHistory[this.currentId] || [])
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system,
          messages
        })
      });

      const data = await resp.json();
      const reply = data.content && data.content[0] ? data.content[0].text : '...';

      App.state.chatHistory[this.currentId].push({ role: 'assistant', content: reply });
      thinking.remove();
      this._appendMsg('assistant', reply, this.currentId);

      member.bubble = reply.length > 50 ? reply.substring(0, 48) + '\u2026' : reply;
      World.render();
      setTimeout(() => { member.bubble = null; World.render(); }, 6000);

      Storage.cloudSave(App.state);
    } catch (e) {
      thinking.remove();
      const err = document.createElement('div');
      err.className = 'msg ai';
      err.innerHTML = '<div class="speaker">ERROR</div>Connection failed.';
      this.messagesEl.appendChild(err);
      member.bubble = null;
      World.render();
    }
  },

  _esc(t) {
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
};


