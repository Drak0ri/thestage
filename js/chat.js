// js/chat.js

const Chat = {
  panel:         null,
  messagesEl:    null,
  inputEl:       null,
  forwardIds:    [],
  talkingId:     null,
  handRaisedIds: [],
  sharedHistory: [],

  init() {
    this.panel      = document.getElementById('chat-panel');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl    = document.getElementById('chat-input');
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
      nameSpan.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:7px;color:' +
        (id === self.talkingId ? '#ffcc44' : '#88aaff') + ';';
      nameSpan.textContent = member.name.split(' ')[0].substring(0,10);
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
    this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== id; });
  },

  renderMessages() {
    this.messagesEl.innerHTML = '';
    if (!this.sharedHistory.length) {
      this.appendSystem('click a name above to talk to them');
      return;
    }
    this.sharedHistory.forEach(function(m) {
      var div = document.createElement('div');
      if (m.role === 'user') {
        div.className = 'msg user';
        div.textContent = m.content;
      } else if (m.role === 'system') {
        div.className = 'msg system';
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
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  },

  async send() {
    var text = this.inputEl.value.trim();
    if (!text || !this.talkingId) return;
    this.inputEl.value = '';

    var member = App.state.team.find(function(m) { return m.id === Chat.talkingId; });
    if (!member) return;

    this.sharedHistory.push({ role: 'user', content: text, speakerId: null });

    var userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.textContent = text;
    this.messagesEl.appendChild(userDiv);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    await this._getResponse(member, text);
    this._maybeRaiseHands(member.id);
    Storage.cloudSave(App.state);
  },

  async _getResponse(member, userText) {
    var thinking = document.createElement('div');
    thinking.className = 'msg ai thinking';
    thinking.textContent = '\u25cb ' + member.name + ' thinking...';
    this.messagesEl.appendChild(thinking);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    var messages = this.sharedHistory
      .filter(function(m) { return m.role === 'user' || m.speakerId === member.id; })
      .map(function(m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: m.content }; });

    // ── System prompt ────────────────────────────────────────────────────────
    var roomCtx = (typeof ROOMS !== 'undefined' && ROOMS[World.currentRoom])
      ? ROOMS[World.currentRoom].aiContext : '';

    // Full team roster so Claude can summon/dismiss by name
    var teamRoster = App.state.team.map(function(m) {
      var here = Chat.forwardIds.indexOf(m.id) !== -1;
      return m.name + ' (' + (m.role||'team member') + ')' + (here ? ' — in conversation' : ' — not yet here');
    }).join(', ');

    var othersForward = Chat.forwardIds
      .filter(function(id) { return id !== member.id; })
      .map(function(id) { var m = App.state.team.find(function(t) { return t.id === id; }); return m ? m.name : ''; })
      .filter(Boolean).join(', ');
    var groupCtx = othersForward ? 'Others currently in the conversation: ' + othersForward + '.' : '';

    var actionList = (typeof ACTIONS !== 'undefined') ? ACTIONS.join(', ') : '';
    var actionCtx = actionList
      ? 'At the START of your reply you may include one [ACTION:name] tag — choose from: ' + actionList + '. Leave it out if nothing fits.'
      : '';

    // Summon/dismiss instructions
    var summonCtx = 'TEAM ROSTER: ' + teamRoster + '. ' +
      'You can summon an existing team member into the conversation with [SUMMON:Name] when their expertise is relevant. ' +
      'You can dismiss someone with [DISMISS:Name] when they are done. ' +
      'You can CREATE a brand new team member with [CREATE:Name|Role] — use this when a skill or perspective is genuinely missing from the team and would help. The new person will immediately join the team and this conversation. ' +
      'Use all of these sparingly and only when it truly makes sense.';

    // Project briefing context
    var briefingCtx = '';
    if (App.state.briefing && App.state.briefing.trim()) {
      briefingCtx = 'PROJECT CONTEXT (shared background for all team members): ' + App.state.briefing;
    }

    var system = [
      'You are ' + member.name + ', a team member. Role: ' + (member.role || 'team member') + '.',
      'Personality: ' + member.personality + '.',
      roomCtx,
      groupCtx,
      briefingCtx,
      summonCtx,
      actionCtx,
      'Keep responses SHORT (2-3 sentences). Stay in character. Never break character.',
    ].filter(Boolean).join(' ');

    try {
      var resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ pin: App.pin, model: 'claude-sonnet-4-6', max_tokens: 1000, system: system, messages: messages })
      });
      var data = await resp.json();
      var rawReply = data.content && data.content[0] ? data.content[0].text : '...';

      // ── Parse all tags from reply ──────────────────────────────────────────
      var actionMatch  = rawReply.match(/\[ACTION:(\w+)\]/);
      var summonMatch  = rawReply.match(/\[SUMMON:([^\]]+)\]/);
      var dismissMatch = rawReply.match(/\[DISMISS:([^\]]+)\]/);
      var createMatch  = rawReply.match(/\[CREATE:([^|\]]+)\|?([^\]]*)\]/);

      // Strip all tags from visible reply
      var reply = rawReply
        .replace(/\[ACTION:\w+\]\s*/g, '')
        .replace(/\[SUMMON:[^\]]+\]\s*/g, '')
        .replace(/\[DISMISS:[^\]]+\]\s*/g, '')
        .replace(/\[CREATE:[^\]]+\]\s*/g, '')
        .trim();

      // Execute action
      if (actionMatch) World.playCharAction(member.id, actionMatch[1]);

      // Execute summon
      if (summonMatch) {
        var summonName = summonMatch[1].trim();
        var target = App.state.team.find(function(m) {
          return m.name.toLowerCase().startsWith(summonName.toLowerCase());
        });
        if (target && Chat.forwardIds.indexOf(target.id) === -1) {
          Chat.forwardIds.push(target.id);
          this.sharedHistory.push({ role: 'system', content: '→ ' + target.name + ' joins the conversation.', speakerId: null });
          World.render();
          this.appendSystem('→ ' + target.name + ' joins the conversation.');
        }
      }

      // Execute dismiss
      if (dismissMatch) {
        var dismissName = dismissMatch[1].trim();
        var dismissTarget = App.state.team.find(function(m) {
          return m.name.toLowerCase().startsWith(dismissName.toLowerCase());
        });
        if (dismissTarget && dismissTarget.id !== member.id) {
          var idx = Chat.forwardIds.indexOf(dismissTarget.id);
          if (idx !== -1) {
            Chat.forwardIds.splice(idx, 1);
            Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x) { return x !== dismissTarget.id; });
            if (Chat.talkingId === dismissTarget.id) Chat.talkingId = Chat.forwardIds.length ? Chat.forwardIds[0] : member.id;
            this.sharedHistory.push({ role: 'system', content: '← ' + dismissTarget.name + ' steps back.', speakerId: null });
            World.render();
            this.appendSystem('← ' + dismissTarget.name + ' steps back.');
          }
        }
      }

      // Execute create — add a brand new team member
      if (createMatch) {
        var createName = createMatch[1].trim();
        var createRole = createMatch[2] ? createMatch[2].trim() : '';
        // Only create if name doesn't already exist
        var alreadyExists = App.state.team.some(function(m) {
          return m.name.toLowerCase() === createName.toLowerCase();
        });
        if (!alreadyExists && createName.length > 0) {
          var newMember = App.createMember(createName, createRole);
          // Auto-summon them into the conversation
          Chat.forwardIds.push(newMember.id);
          this.sharedHistory.push({ role: 'system', content: '✦ ' + createName + ' (' + (createRole||'team member') + ') has joined the team and the conversation.', speakerId: null });
          World.render();
          this.appendSystem('✦ ' + createName + (createRole ? ' — ' + createRole : '') + ' has joined the team.');
        }
      }

      this.sharedHistory.push({ role: 'assistant', content: reply, speakerId: member.id });
      thinking.remove();

      var div = document.createElement('div');
      div.className = 'msg ai';
      div.innerHTML = '<div class="speaker">' + member.name.toUpperCase() + '</div>' + Chat._esc(reply);
      this.messagesEl.appendChild(div);
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

      if (!App.state.chatHistory[member.id]) App.state.chatHistory[member.id] = [];
      App.state.chatHistory[member.id].push({ role: 'user',      content: userText });
      App.state.chatHistory[member.id].push({ role: 'assistant', content: reply    });

      // Re-render header in case forwardIds changed
      this.renderPanel();

    } catch(e) {
      thinking.remove();
      var err = document.createElement('div');
      err.className = 'msg ai';
      err.innerHTML = '<div class="speaker">ERROR</div>Connection failed — check your PIN and connection.';
      this.messagesEl.appendChild(err);
    }
  },

  _maybeRaiseHands(responderId) {
    var self = this;
    var others = this.forwardIds.filter(function(id) { return id !== responderId; });
    others.forEach(function(id) {
      if (self.handRaisedIds.indexOf(id) !== -1) return;
      var member = App.state.team.find(function(m) { return m.id === id; });
      if (!member) return;
      var chatty = ['enthusiastic','creative','naturally','chaotically','big-picture'];
      var wantsToTalk = chatty.some(function(word) { return member.personality.indexOf(word) !== -1; });
      if (Math.random() < (wantsToTalk ? 0.4 : 0.2)) {
        self.handRaisedIds.push(id);
        World.render();
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

  close() { this.dismissAll(); },
  get currentId()  { return this.talkingId; },
  set currentId(v) { this.talkingId = v; },

  _esc(t) {
    return String(t)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\n/g,'<br>');
  }
};
