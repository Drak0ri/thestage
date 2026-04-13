// js/chat.js

const Chat = {
  panel:         null,
  messagesEl:    null,
  inputEl:       null,
  forwardIds:    [],
  talkingId:     null,   // legacy compat — first of talkingIds
  talkingIds:    [],     // multi-select active speakers
  handRaisedIds: [],
  handRaisedIntents: {},  // id → string of what they want to say
  sharedHistory: [],
  _agentRounds: 0,
  _agentMaxRounds: 3,
  _agentRunning: false,
  _restored: false,
  _saving: false,       // guard against concurrent cloudSaves
  _savePending: false,

  init() {
    this.panel      = document.getElementById('chat-panel');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl    = document.getElementById('chat-input');
    this._stateLabel = document.getElementById('conv-state-label');
    document.getElementById('chat-close').addEventListener('click', function() { Chat.closePanel(); });
    document.getElementById('chat-send').addEventListener('click', function() { Chat.send(); });
    this.inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') Chat.send(); });
  },

  // Set conversation state: 'idle' | 'thinking' | 'flowing' | 'your-turn'
  _setState(state) {
    this.panel.classList.remove('state-thinking', 'state-flowing', 'state-your-turn');
    var labels = { thinking: '...thinking', flowing: 'in flow — they have more to say', 'your-turn': 'your turn' };
    if (state === 'idle') {
      if (this._stateLabel) this._stateLabel.textContent = '';
    } else {
      this.panel.classList.add('state-' + state);
      if (this._stateLabel) this._stateLabel.textContent = labels[state] || '';
    }
    this.inputEl.disabled = (state === 'thinking' || state === 'flowing');
  },

  // Persist who is on stage so it survives refresh/reopen — debounced
  _saveStage() {
    if (!App || !App.state) return;
    App.state.stageIds        = this.forwardIds.slice();
    App.state.stageTalkingId  = this.talkingId;
    App.state.stageTalkingIds = this.talkingIds.slice();
    this._debouncedCloudSave();
  },

  // Debounced save — collapses rapid calls into one
  _debouncedCloudSave() {
    if (this._saving) { this._savePending = true; return; }
    this._saving = true;
    Storage.cloudSave(App.state).then(function() {
      Chat._saving = false;
      if (Chat._savePending) {
        Chat._savePending = false;
        Chat._debouncedCloudSave();
      }
    }).catch(function() {
      Chat._saving = false;
    });
  },

  // Restore stage selection from saved state
  _restoreStage() {
    if (!App || !App.state) return;
    var saved = App.state.stageIds;
    if (!saved || !saved.length) return;
    // Only restore ids that still exist in the team
    var team = App.state.team || [];
    var validIds = saved.filter(function(id) {
      return team.some(function(m) { return m.id === id; });
    });
    if (!validIds.length) return;
    this.forwardIds = validIds;
    // Restore talkingId if still valid
    if (App.state.stageTalkingId && validIds.indexOf(App.state.stageTalkingId) !== -1) {
      this.talkingId = App.state.stageTalkingId;
    } else {
      this.talkingId = validIds[0];
    }
    // Restore multi-select
    if (App.state.stageTalkingIds && App.state.stageTalkingIds.length) {
      this.talkingIds = App.state.stageTalkingIds.filter(function(id) { return validIds.indexOf(id) !== -1; });
    }
    if (!this.talkingIds.length && this.talkingId) this.talkingIds = [this.talkingId];
    // Restore shared history for the saved participants
    var self = this;
    validIds.forEach(function(id) { self._mergeHistory(id); });
    // Open the panel if someone is on stage
    this.panel.classList.add('open');
    this.renderPanel();
  },

  openPanel() {
    // Merge history for whoever is being brought forward
    var self = this;
    this.forwardIds.forEach(function(id) { self._mergeHistory(id); });
    // Ensure talkingIds is always in sync
    if (!this.talkingIds.length && this.talkingId) this.talkingIds = [this.talkingId];
    if (!this.talkingIds.length && this.forwardIds.length) {
      this.talkingIds = [this.forwardIds[0]];
      this.talkingId  = this.forwardIds[0];
    }
    this.panel.classList.add('open');
    this.renderPanel();
    this.inputEl.focus();
  },

  // Close the chat panel UI — does NOT remove anyone from stage
  closePanel() {
    this.panel.classList.remove('open');
    App.setStatus(this.forwardIds.length
      ? 'click a character to chat'
      : 'stage is empty — use TEAM to summon someone');
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
      var isActive = self.talkingIds.indexOf(id) !== -1;
      pill.style.borderColor = isActive ? '#ffcc44' : '#2d2b55';
      pill.style.background  = isActive ? 'rgba(255,204,68,0.12)' : 'rgba(45,43,85,0.5)';

      var av = document.createElement('canvas');
      av.width = 24; av.height = 36;
      av.style.cssText = 'image-rendering:pixelated;width:24px;height:36px;';
      var ctx = av.getContext('2d');
      ctx.save(); ctx.scale(0.5, 0.5);
      drawPixelChar(ctx, pal, 0);
      ctx.restore();
      pill.appendChild(av);

      var nameSpan = document.createElement('span');
      var isActiveSpan = self.talkingIds.indexOf(id) !== -1;
      nameSpan.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:7px;color:' +
        (isActiveSpan ? '#ffcc44' : '#88aaff') + ';';
      nameSpan.textContent = member.name.split(' ')[0].substring(0,10);
      pill.appendChild(nameSpan);

      pill.addEventListener('click', (function(pid) { return function() { Chat.toggleTalking(pid); }; })(id));
      avatarRow.appendChild(pill);
    });

    header.appendChild(avatarRow);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'px-btn danger';
    closeBtn.textContent = '✕';
    closeBtn.style.flexShrink = '0';
    closeBtn.addEventListener('click', function() { Chat.closePanel(); });
    header.appendChild(closeBtn);

    this.renderMessages();
  },

  // Toggle a pill in/out of the active speakers set
  toggleTalking(id) {
    if (this.forwardIds.indexOf(id) === -1) return;
    var idx = this.talkingIds.indexOf(id);
    if (idx !== -1) {
      // Deselect — but keep at least one active
      if (this.talkingIds.length > 1) {
        this.talkingIds.splice(idx, 1);
      }
    } else {
      this.talkingIds.push(id);
    }
    this.talkingId = this.talkingIds[0] || null;
    this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== id; });
    this._saveStage();
    this.renderPanel();
    World.refresh();
  },

  activateTalking(id) {
    if (this.forwardIds.indexOf(id) === -1) return;
    this.talkingIds = [id];
    this.talkingId = id;
    this.renderPanel();
    World.refresh();
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
        var speakerEl = document.createElement('div');
        speakerEl.className = 'speaker';
        speakerEl.textContent = member ? member.name.toUpperCase() : '';
        div.appendChild(speakerEl);
        var bodyEl = document.createElement('span');
        bodyEl.innerHTML = Chat._esc(m.content);
        div.appendChild(bodyEl);
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
    if (!text || !this.talkingIds.length) return;
    this.inputEl.value = '';
    this._agentRounds = 0;  // reset round counter on each user message
    this._setState('thinking');

    this.sharedHistory.push({ role: 'user', content: text, speakerId: null });

    var userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.textContent = text;
    this.messagesEl.appendChild(userDiv);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Get a response from each active speaker in turn
    var activeIds = this.talkingIds.slice();
    var lastResponderId = null;
    for (var i = 0; i < activeIds.length; i++) {
      var member = App.state.team.find(function(m) { return m.id === activeIds[i]; });
      if (!member) continue;
      await this._getResponse(member, text);
      lastResponderId = member.id;
      this._maybeRaiseHands(member.id);
    }
    // Run agent-to-agent conversation
    await this._runAgentRound(lastResponderId);
    this._debouncedCloudSave();
  },

  // ── Character .md file system ───────────────────────────────────────────
  _charFileCache: {},   // { "id:filename": { content, ts } }
  _CHAR_FILES: ['soul.md', 'st_mem.md', 'lt_mem.md', 'skills.md', 'goals.md', 'relationships.md'],
  _CHAR_FILE_TTL: 5 * 60 * 1000,  // cache for 5 minutes

  async _fetchCharFiles(member) {
    var slug = member.name.toLowerCase() + '-' + member.id;
    var results = {};
    var now = Date.now();
    for (var i = 0; i < this._CHAR_FILES.length; i++) {
      var fname = this._CHAR_FILES[i];
      var cacheKey = member.id + ':' + fname;
      var cached = this._charFileCache[cacheKey];
      if (cached && (now - cached.ts) < this._CHAR_FILE_TTL) {
        results[fname] = cached.content;
        continue;
      }
      try {
        var url = 'https://raw.githubusercontent.com/Drak0ri/thestage/main/characters/' + slug + '/' + fname;
        var resp = await fetch(url);
        if (resp.ok) {
          var text = await resp.text();
          results[fname] = text;
          this._charFileCache[cacheKey] = { content: text, ts: now };
        }
      } catch(e) { /* file missing or network issue — skip */ }
    }
    return results;
  },

  // Write a character file back to the repo via the Apps Script relay
  async _writeCharFile(member, filename, content) {
    var slug = member.name.toLowerCase() + '-' + member.id;
    var path = 'characters/' + slug + '/' + filename;
    try {
      await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'writeFile',
          pin: App.pin,
          path: path,
          content: content
        })
      });
      // Invalidate cache
      this._charFileCache[member.id + ':' + filename] = { content: content, ts: Date.now() };
    } catch(e) { console.warn('Failed to write ' + filename + ' for ' + member.name, e); }
  },

  async _getResponse(member, userText) {
    this._setState('thinking');
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
    // Fetch character .md files from repo
    var charFiles = await this._fetchCharFiles(member);
    var charCtx = '';
    if (charFiles['soul.md']) charCtx += '\n\nSOUL (your core identity):\n' + charFiles['soul.md'];
    if (charFiles['skills.md']) charCtx += '\n\nSKILLS & EXPERTISE:\n' + charFiles['skills.md'];
    if (charFiles['goals.md']) charCtx += '\n\nCURRENT GOALS:\n' + charFiles['goals.md'];
    if (charFiles['relationships.md']) charCtx += '\n\nRELATIONSHIPS:\n' + charFiles['relationships.md'];
    if (charFiles['lt_mem.md']) charCtx += '\n\nLONG-TERM MEMORY:\n' + charFiles['lt_mem.md'];
    if (charFiles['st_mem.md']) charCtx += '\n\nSHORT-TERM MEMORY (recent context):\n' + charFiles['st_mem.md'];

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
      charCtx,
      roomCtx,
      groupCtx,
      briefingCtx,
      memoryCtx,
      summonCtx,
      actionCtx,
      'Keep responses SHORT (2-3 sentences). Stay in character. Never break character.',
    ].filter(Boolean).join(' ');

    try {
      var resp;
      if (App.localMode || App.useLocal) {
        resp = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: App.localModel,
            messages: [{ role: 'system', content: system }].concat(messages),
            stream: false,
            think: false
          })
        });
        var ollamaData = await resp.json();
        var rawReply = ollamaData.message ? ollamaData.message.content : '...';
      } else {
        resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ pin: App.pin, model: 'claude-sonnet-4-6', max_tokens: 1000, system: system, messages: messages })
        });
        var data = await resp.json();
        var rawReply = data.content && data.content[0] ? data.content[0].text : '...';
      }

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
          this._saveStage();
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
            this._saveStage();
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
      var speakerEl = document.createElement('div');
      speakerEl.className = 'speaker';
      speakerEl.textContent = member.name.toUpperCase();
      div.appendChild(speakerEl);
      var bodyEl = document.createElement('span');
      bodyEl.innerHTML = Chat._esc(reply);
      div.appendChild(bodyEl);
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
      // Update conversation state
      if (this.handRaisedIds.length > 0 || this._agentRunning) {
        this._setState('flowing');
      } else {
        this._setState('your-turn');
      }

    } catch(e) {
      thinking.remove();
      this._setState('your-turn');
      var err = document.createElement('div');
      err.className = 'msg ai';
      var errSpeaker = document.createElement('div');
      errSpeaker.className = 'speaker';
      errSpeaker.textContent = 'ERROR';
      err.appendChild(errSpeaker);
      var errBody = document.createElement('span');
      errBody.textContent = 'Connection failed — check your PIN and connection.';
      err.appendChild(errBody);
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
      var chatty = ['enthusiastic','creative','chaotically','big-picture'];
      var wantsToTalk = chatty.some(function(word) { return member.personality.indexOf(word) !== -1; });
      if (Math.random() < (wantsToTalk ? 0.4 : 0.2)) {
        self.handRaisedIds.push(id);
        // Generate a brief intent for what they want to say (async, no await)
        self._generateHandIntent(member);
        World.refresh();
      }
    });
  },

  // Generate a short intent for a hand-raising character so clicking their hand is instant
  async _generateHandIntent(member) {
    var recentCtx = this.sharedHistory.slice(-6)
      .filter(function(m) { return m.role === 'user' || m.speakerId === member.id; })
      .map(function(m) { return (m.role === 'user' ? 'User' : member.name) + ': ' + m.content; })
      .join('\n');
    var prompt = 'Based on this conversation, write ONE short sentence (max 20 words) that ' + member.name + ' would say if called on. Personality: ' + member.personality + '. Conversation:\n' + recentCtx + '\nReply with just the sentence, nothing else.';
    try {
      var resp, text;
      if (App.localMode || App.useLocal) {
        resp = await fetch('http://localhost:11434/api/chat', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ model: App.localModel, messages: [{role:'user', content: prompt}], stream: false, think: false })
        });
        var d = await resp.json();
        text = d.message ? d.message.content : '';
      } else {
        resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
          method: 'POST', headers: {'Content-Type':'text/plain'},
          body: JSON.stringify({ pin: App.pin, model: 'claude-sonnet-4-6', max_tokens: 60, system: 'Reply with a single short sentence only.', messages: [{role:'user', content: prompt}] })
        });
        var d = await resp.json();
        text = d.content && d.content[0] ? d.content[0].text : '';
      }
      if (text) this.handRaisedIntents[member.id] = text.trim().replace(/^["']|["']$/g, '');
    } catch(e) { /* intent stays blank, full response will be generated on click */ }
  },

  // Called when user clicks the hand emoji over a character
  async speakHandRaised(id) {
    var member = App.state.team.find(function(m) { return m.id === id; });
    if (!member) return;
    // Remove hand
    this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== id; });
    var intent = this.handRaisedIntents[id] || null;
    delete this.handRaisedIntents[id];
    World.refresh();
    // If we have a pre-generated intent, post it as their message directly
    if (intent) {
      this.sharedHistory.push({ role: 'assistant', content: intent, speakerId: id });
      var div = document.createElement('div');
      div.className = 'msg ai';
      var speakerEl = document.createElement('div');
      speakerEl.className = 'speaker';
      speakerEl.textContent = member.name.toUpperCase();
      div.appendChild(speakerEl);
      var bodyEl = document.createElement('span');
      bodyEl.innerHTML = Chat._esc(intent);
      div.appendChild(bodyEl);
      this.messagesEl.appendChild(div);
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      Chat._appendToHistory(id, { role: 'assistant', content: intent, speakerId: id });
      // Let this kick off another round of agent chat
      this._maybeRaiseHands(id);
      this._debouncedCloudSave();
      // Run agent conversation from this response
      await this._runAgentRound(id);
    } else {
      // No intent yet — do a full response
      await this._getResponse(member, '');
      this._maybeRaiseHands(id);
      await this._runAgentRound(id);
      this._debouncedCloudSave();
    }
  },

  // Run agent-to-agent conversation for up to _agentMaxRounds rounds
  async _runAgentRound(lastResponderId) {
    if (this._agentRunning) return;
    // Find a character with a raised hand to respond
    var candidates = this.handRaisedIds.filter(function(id) { return id !== lastResponderId && Chat.forwardIds.indexOf(id) !== -1; });
    if (!candidates.length) return;
    this._agentRunning = true;
    try {
      while (candidates.length && this._agentRounds < this._agentMaxRounds) {
        var respondId = candidates[0];
        this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== respondId; });
        delete this.handRaisedIntents[respondId];
        World.refresh();
        var respondMember = App.state.team.find(function(m) { return m.id === respondId; });
        if (respondMember) {
          await this._getResponse(respondMember, '');
          this._agentRounds++;
          this._maybeRaiseHands(respondId);
          // Refresh candidates
          candidates = this.handRaisedIds.filter(function(id) { return id !== respondId && Chat.forwardIds.indexOf(id) !== -1; });
        } else {
          break;
        }
      }
      if (this._agentRounds >= this._agentMaxRounds && this.handRaisedIds.length > 0) {
        this._showContinuePrompt();
      }
    } finally {
      this._agentRunning = false;
      // After agent round ends, set final state
      if (this.handRaisedIds.length > 0) {
        this._setState('flowing');
      } else {
        this._setState('your-turn');
      }
    }
  },

  _showContinuePrompt() {
    var names = this.handRaisedIds.map(function(id) {
      var m = App.state.team.find(function(t) { return t.id === id; });
      return m ? m.name.split(' ')[0] : '?';
    }).join(', ');
    var div = document.createElement('div');
    div.className = 'msg continue-prompt';
    div.innerHTML = names + ' still want' + (this.handRaisedIds.length === 1 ? 's' : '') + ' to chime in.<br>';
    var yesBtn = document.createElement('button');
    yesBtn.textContent = 'CONTINUE (' + this._agentMaxRounds + ' more)';
    yesBtn.addEventListener('click', function() {
      div.remove();
      Chat._agentRounds = 0;
      var lastId = Chat.handRaisedIds[0];
      Chat._runAgentRound(null);
    });
    var noBtn = document.createElement('button');
    noBtn.textContent = 'STOP';
    noBtn.addEventListener('click', function() {
      div.remove();
      Chat.handRaisedIds = [];
      Chat.handRaisedIntents = {};
      World.refresh();
    });
    div.appendChild(yesBtn);
    div.appendChild(noBtn);
    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  },

  dismissAll() {
    // Fully clear stage — used when explicitly ending all conversations
    this.forwardIds    = [];
    this.talkingId     = null;
    this.talkingIds    = [];
    this.handRaisedIds = [];
    this.handRaisedIntents = {};
    this._agentRounds = 0;
    this._agentRunning = false;
    this.sharedHistory = [];
    this._restored     = false;
    this.panel.classList.remove('open');
    this._setState('idle');
    this._saveStage();
    App.setStatus('stage is empty — use TEAM to summon someone');
    // Run compaction silently in the background
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
      // Don't mutate h.recent yet — only do it after success
      var keptRecent = h.recent.slice(h.recent.length - BUFFER);

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
        var compactResp;
        if (App.localMode || App.useLocal) {
          compactResp = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: App.localModel,
              messages: [
                { role: 'system', content: 'You are a conversation memory assistant. Summarise the following chat exchanges into 3-5 concise sentences. Preserve: decisions made, key topics discussed, open questions, important context. Be factual and specific. Output only the summary, no preamble.' },
                { role: 'user', content: transcript }
              ],
              stream: false,
              think: false
            })
          });
          var compactData = await compactResp.json();
          if (compactData.message && compactData.message.content) {
            h.summary = compactData.message.content.trim();
            h.recent = keptRecent;
            didCompact = true;
          }
        } else {
          compactResp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
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
          var data = await compactResp.json();
          if (data.content && data.content[0]) {
            h.summary = data.content[0].text.trim();
            h.recent = keptRecent;
            didCompact = true;
          }
        }
      } catch(e) {
        // Summarisation failed — h.recent is untouched, nothing lost
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



