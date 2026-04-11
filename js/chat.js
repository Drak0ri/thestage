// js/chat.js

const Chat = {
  panel:         null,
  messagesEl:    null,
  inputEl:       null,
  forwardIds:    [],
  talkingId:     null,
  handRaisedIds: [],
  sharedHistory: [],
  _restored: false,

  init() {
    this.panel      = document.getElementById('chat-panel');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl    = document.getElementById('chat-input');
    document.getElementById('chat-close').addEventListener('click', function() { Chat.dismissAll(); World.render(); });
    document.getElementById('chat-send').addEventListener('click', function() { Chat.send(); });
    this.inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') Chat.send(); });
  },

  openPanel() {
    // Merge history for whoever is being brought forward
    var self = this;
    this.forwardIds.forEach(function(id) { self._mergeHistory(id); });
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
    // Show a subtle divider if this is a restored conversation
    if (this._restored) {
      var divider = document.createElement('div');
      divider.className = 'msg system';
      divider.style.cssText = 'opacity:0.4;font-size:6px;text-align:center;border-top:1px solid var(--border);padding-top:6px;';
      divider.textContent = '— previous conversation —';
      this.messagesEl.appendChild(divider);
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

    // ── Two-layer memory: summary + recent 20 messages ──────────────────────
    var hist = App.state.chatHistory[member.id] || { summary: '', recent: [] };
    // Inject summary as a system context prefix if it exists
    var memoryCtx = hist.summary
      ? 'MEMORY OF PAST CONVERSATIONS WITH THIS PERSON: ' + hist.summary
      : '';
    // Build messages from sharedHistory (current session) limited to last 20
    var sessionMsgs = this.sharedHistory
      .filter(function(m) { return m.role === 'user' || m.speakerId === member.id; })
      .slice(-20)
      .map(function(m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: m.content }; });
    // Ensure first message is from user (API requirement)
    while (sessionMsgs.length && sessionMsgs[0].role !== 'user') sessionMsgs.shift();
    var messages = sessionMsgs;

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
      memoryCtx,
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
          // Merge this member's history so they have context of past convos
          this._mergeHistory(target.id);
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

      // ── Save to two-layer per-character history ──────────────────────────
      Chat._appendToHistory(member.id, { role: 'user',      content: userText, speakerId: null      });
      Chat._appendToHistory(member.id, { role: 'assistant', content: reply,    speakerId: member.id });
      // Fan user message out to all other forward members so they have context
      Chat.forwardIds.forEach(function(fid) {
        if (fid === member.id) return;
        Chat._appendToHistory(fid, { role: 'user', content: userText, speakerId: null });
      });

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
    // sharedHistory is already live-saved per character — just clear the view
    this.forwardIds    = [];
    this.talkingId     = null;
    this.handRaisedIds = [];
    this.sharedHistory = [];
    this._restored     = false;
    this.panel.classList.remove('open');
    App.setStatus('click a character to chat');
    // Run compaction silently in the background — no await, no blocking
    this._compactHistory();
  },

  // Merge a member's saved recent history into sharedHistory when they join.
  _mergeHistory(memberId) {
    if (!App || !App.state || !App.state.chatHistory) return;
    var hist = App.state.chatHistory[memberId];
    if (!hist || !hist.recent || !hist.recent.length) return;

    var existing = new Set(
      this.sharedHistory.map(function(m) { return m.role + '|' + m.content; })
    );
    var added = 0;
    // Only merge last 20 recent messages to keep the view manageable
    hist.recent.slice(-20).forEach(function(m) {
      var key = m.role + '|' + m.content;
      if (!existing.has(key)) {
        Chat.sharedHistory.push(m);
        existing.add(key);
        added++;
      }
    });
    if (added > 0) this._restored = true;
  },

  // Append a message to a member's recent buffer; migrate old flat array if needed
  _appendToHistory(memberId, msg) {
    if (!App || !App.state) return;
    if (!App.state.chatHistory) App.state.chatHistory = {};
    var h = App.state.chatHistory[memberId];
    // Migrate flat array from old format
    if (Array.isArray(h)) {
      App.state.chatHistory[memberId] = { summary: '', recent: h };
      h = App.state.chatHistory[memberId];
    }
    if (!h) { App.state.chatHistory[memberId] = { summary: '', recent: [] }; h = App.state.chatHistory[memberId]; }
    // Deduplicate: skip if last message is identical user message
    var last = h.recent[h.recent.length - 1];
    if (last && last.role === msg.role && last.content === msg.content) return;
    h.recent.push(msg);
  },

  // Background summarisation — called after dismissAll, no await needed in caller
  async _compactHistory() {
    if (!App || !App.state || !App.state.chatHistory) return;
    var BUFFER = 20;   // keep this many recent messages verbatim
    var TRIGGER = 30;  // summarise when recent exceeds this

    var ids = Object.keys(App.state.chatHistory);
    var didCompact = false;

    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var h = App.state.chatHistory[id];
      if (Array.isArray(h)) {
        // Migrate old flat format
        App.state.chatHistory[id] = { summary: '', recent: h };
        h = App.state.chatHistory[id];
        didCompact = true;
      }
      if (!h || !h.recent || h.recent.length <= TRIGGER) continue;

      // Take the oldest messages beyond the buffer for summarisation
      var toSummarise = h.recent.slice(0, h.recent.length - BUFFER);
      h.recent = h.recent.slice(h.recent.length - BUFFER);

      // Build a readable transcript of what to summarise
      var transcript = toSummarise.map(function(m) {
        var who = m.speakerId
          ? (App.state.team.find(function(t){ return t.id === m.speakerId; }) || {name:'AI'}).name
          : 'Baz';
        return who + ': ' + m.content;
      }).join('\n');

      // Prepend existing summary if there is one
      if (h.summary) transcript = 'PREVIOUS SUMMARY:\n' + h.summary + '\n\nNEWER EXCHANGES:\n' + transcript;

      try {
        var resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            pin: App.pin,
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            system: 'You are a conversation memory assistant. Summarise the following chat exchanges into 3-5 concise sentences. Preserve: decisions made, key topics discussed, open questions, important context. Be factual and specific. Output only the summary, no preamble.',
            messages: [{ role: 'user', content: transcript }]
          })
        });
        var data = await resp.json();
        if (data.content && data.content[0]) {
          h.summary = data.content[0].text.trim();
          didCompact = true;
        }
      } catch(e) {
        // Summarisation failed — put messages back so nothing is lost
        h.recent = toSummarise.concat(h.recent);
        console.warn('Compaction failed for', id, e);
      }
    }

    if (didCompact) Storage.cloudSave(App.state);
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
