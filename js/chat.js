// js/chat.js

const Chat = {
  panel:         null,
  messagesEl:    null,
  inputEl:       null,
  forwardIds:    [],   // all characters stepped forward
  talkingId:     null, // who is currently selected to talk to
  handRaisedIds: [],   // who wants to chime in
  sharedHistory: [],   // shared conversation log [{role, content, speakerId}]

  init() {
    this.panel     = document.getElementById('chat-panel');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl   = document.getElementById('chat-input');
    document.getElementById('chat-close').addEventListener('click', function() { Chat.dismissAll(); World.render(); });
    document.getElementById('chat-send').addEventListener('click', function() { Chat.send(); });
    this.inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') Chat.send(); });
  },

  openPanel() {
    this.panel.classList.add('open');
    this.renderPanel();
    this.inputEl.focus();
  },

  renderPanel() {
    // Header: avatars of all forward characters, active one highlighted
    var header = document.getElementById('chat-header');
    header.innerHTML = '';

    var avatarRow = document.createElement('div');
    avatarRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap;';

    var self = this;
    this.forwardIds.forEach(function(id) {
      var member = App.state.team.find(function(m) { return m.id === id; });
      if (!member) return;
      var pal = PALETTES[member.colorIdx % PALETTES.length];

      var pill = document.createElement('div');
      pill.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:20px;cursor:pointer;border:1.5px solid;transition:all 0.15s;';
      pill.style.borderColor = id === self.talkingId ? '#ffcc44' : '#2d2b55';
      pill.style.background  = id === self.talkingId ? 'rgba(255,204,68,0.12)' : 'rgba(45,43,85,0.5)';

      var av = document.createElement('canvas');
      av.width = 24; av.height = 36;
      av.style.cssText = 'image-rendering:pixelated;width:24px;height:36px;';
      var ctx = av.getContext('2d');
      ctx.save(); ctx.scale(0.5, 0.5);
      drawPixelChar(ctx, pal, 0);
      ctx.restore();
      pill.appendChild(av);

      var nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:6px;color:' +
        (id === self.talkingId ? '#ffcc44' : '#88aaff') + ';';
      nameSpan.textContent = member.name.split(' ')[0].substring(0,8);
      pill.appendChild(nameSpan);

      pill.addEventListener('click', function() { Chat.activateTalking(id); });
      avatarRow.appendChild(pill);
    });

    header.appendChild(avatarRow);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'px-btn danger';
    closeBtn.textContent = '✕';
    closeBtn.style.flexShrink = '0';
    closeBtn.addEventListener('click', function() { Chat.dismissAll(); World.render(); });
    header.appendChild(closeBtn);

    this.renderMessages();
  },

  activateTalking(id) {
    if (this.forwardIds.indexOf(id) === -1) return;
    this.talkingId = id;
    this.renderPanel();
    World.render();
    // Remove hand raise
    this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== id; });
  },

  renderMessages() {
    this.messagesEl.innerHTML = '';
    if (!this.sharedHistory.length) {
      this.appendSystem('everyone is forward — click a name to talk to them');
      return;
    }
    this.sharedHistory.forEach(function(m) {
      var div = document.createElement('div');
      if (m.role === 'user') {
        div.className = 'msg user';
        div.textContent = m.content;
      } else {
        div.className = 'msg ai';
        var member = App.state.team.find(function(t) { return t.id === m.speakerId; });
        div.innerHTML = '<div class="speaker">' + (member ? member.name.toUpperCase() : '') + '</div>' + Chat._esc(m.content);
      }
      Chat.messagesEl.appendChild(div);
    });
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  },

  appendSystem(text) {
    var div = document.createElement('div');
    div.className = 'msg system';
    div.textContent = text;
    this.messagesEl.appendChild(div);
  },

  async send() {
    var text = this.inputEl.value.trim();
    if (!text || !this.talkingId) return;
    this.inputEl.value = '';

    var member = App.state.team.find(function(m) { return m.id === Chat.talkingId; });
    if (!member) return;

    // Add user message to shared history
    this.sharedHistory.push({ role: 'user', content: text, speakerId: null });

    var userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.textContent = text;
    this.messagesEl.appendChild(userDiv);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Get response from talkingId character
    await this._getResponse(member, text);

    // After response, maybe other forward characters raise their hand
    this._maybeRaiseHands(member.id, text);

    Storage.cloudSave(App.state);
  },

  async _getResponse(member, userText) {
    var thinking = document.createElement('div');
    thinking.className = 'msg ai thinking';
    thinking.textContent = '\u25cb ' + member.name + ' thinking...';
    this.messagesEl.appendChild(thinking);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Build this character's history from sharedHistory
    var messages = this.sharedHistory
      .filter(function(m) { return m.role === 'user' || m.speakerId === member.id; })
      .map(function(m) { return { role: m.role, content: m.content }; });

    var roomCtx = (typeof ROOMS !== 'undefined' && ROOMS[World.currentRoom]) ? ROOMS[World.currentRoom].aiContext : '';
    var othersForward = Chat.forwardIds.filter(function(id) { return id !== member.id; })
      .map(function(id) { var m = App.state.team.find(function(t) { return t.id === id; }); return m ? m.name : ''; })
      .filter(Boolean).join(', ');
    var groupCtx = othersForward ? 'Also present in the conversation: ' + othersForward + '. You may reference them.' : '';

    var system = 'You are ' + member.name + ', a team member on Baz\'s team. Role: ' + (member.role || 'team member') +
      '. Personality: ' + member.personality + '. ' + roomCtx + ' ' + groupCtx +
      ' Keep responses SHORT (2-3 sentences). Be in-character. Never break character.';

    try {
      var resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ pin: App.pin, model: 'claude-sonnet-4-6', max_tokens: 1000, system: system, messages: messages })
      });
      var data  = await resp.json();
      var reply = data.content && data.content[0] ? data.content[0].text : '...';

      this.sharedHistory.push({ role: 'assistant', content: reply, speakerId: member.id });
      thinking.remove();

      var div = document.createElement('div');
      div.className = 'msg ai';
      div.innerHTML = '<div class="speaker">' + member.name.toUpperCase() + '</div>' + Chat._esc(reply);
      this.messagesEl.appendChild(div);
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

      // Persist per-character history too
      if (!App.state.chatHistory[member.id]) App.state.chatHistory[member.id] = [];
      App.state.chatHistory[member.id].push({ role: 'user', content: messages[messages.length-1] ? messages[messages.length-1].content : '' });
      App.state.chatHistory[member.id].push({ role: 'assistant', content: reply });

    } catch(e) {
      thinking.remove();
      var err = document.createElement('div');
      err.className = 'msg ai';
      err.innerHTML = '<div class="speaker">ERROR</div>Connection failed.';
      this.messagesEl.appendChild(err);
    }
  },

  _maybeRaiseHands(responderId, userText) {
    // Each other forward character has a chance to raise their hand based on personality
    var self = this;
    var others = this.forwardIds.filter(function(id) { return id !== responderId; });
    others.forEach(function(id) {
      if (self.handRaisedIds.indexOf(id) !== -1) return; // already raised
      var member = App.state.team.find(function(m) { return m.id === id; });
      if (!member) return;
      // Personalities that tend to chime in
      var chatty = ['enthusiastic','creative','naturally','chaotically','big-picture'];
      var wantsToTalk = chatty.some(function(word) { return member.personality.indexOf(word) !== -1; });
      // 40% chance for chatty, 20% for others
      var chance = wantsToTalk ? 0.4 : 0.2;
      if (Math.random() < chance) {
        self.handRaisedIds.push(id);
        World.render(); // show raised hand
      }
    });
  },

  dismissAll() {
    this.forwardIds    = [];
    this.talkingId     = null;
    this.handRaisedIds = [];
    this.sharedHistory = [];
    this.panel.classList.remove('open');
    App.setStatus('click a character to chat');
  },

  // Legacy compat
  close() { this.dismissAll(); },
  get currentId() { return this.talkingId; },
  set currentId(v) { this.talkingId = v; },

  _esc(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }
};
