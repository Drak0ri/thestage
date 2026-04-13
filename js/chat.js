// js/chat.js — rewritten for clean group conversation model
//
// MENTAL MODEL:
//   forwardIds  = everyone "on stage" — they hear everything, history updated for all
//   talkingIds  = who actively responds when you send a message (subset of forwardIds)
//   sharedHistory = the single full group transcript — all characters get ALL of it
//   Per-character chatHistory = same full transcript persisted per character
//
// 1-to-1:  forwardIds=[A,B,C], talkingIds=[A]   — only A replies, B+C hear silently
// Group:   forwardIds=[A,B,C], talkingIds=[A,B,C] — all reply in turn
// Mix:     forwardIds=[A,B,C], talkingIds=[A,B]  — A+B reply, C listens

const Chat = {
  panel:         null,
  messagesEl:    null,
  inputEl:       null,
  forwardIds:    [],   // on stage (hear everything)
  talkingIds:    [],   // actively respond to user input
  talkingId:     null, // legacy compat — first of talkingIds
  handRaisedIds: [],
  handRaisedIntents: {},
  sharedHistory: [],   // single full group transcript [{role,content,speakerId,speakerName}]
  _restored: false,
  _saving: false,
  _savePending: false,
  _agentRounds: 0,
  _agentMaxRounds: 3,
  _agentRunning: false,

  init() {
    this.panel      = document.getElementById('chat-panel');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl    = document.getElementById('chat-input');
    this._stateLabel = document.getElementById('conv-state-label');
    document.getElementById('chat-close').addEventListener('click', function() { Chat.closePanel(); });
    document.getElementById('chat-send').addEventListener('click', function() { Chat.send(); });
    this.inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') Chat.send(); });
    // Expiry check every 5 minutes
    setInterval(function() {
      if (typeof WorldObjects !== 'undefined') WorldObjects.checkExpiry();
      if (typeof Props !== 'undefined') Props.checkExpiry();
    }, 5 * 60 * 1000);
  },

  // ── Conversation state indicator ────────────────────────────────────────────
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

  // ── Stage persistence ────────────────────────────────────────────────────────
  _saveStage() {
    if (!App || !App.state) return;
    App.state.stageIds        = this.forwardIds.slice();
    App.state.stageTalkingId  = this.talkingId;
    App.state.stageTalkingIds = this.talkingIds.slice();
    this._debouncedCloudSave();
  },

  _debouncedCloudSave() {
    if (this._saving) { this._savePending = true; return; }
    this._saving = true;
    Storage.cloudSave(App.state).then(function() {
      Chat._saving = false;
      if (Chat._savePending) {
        Chat._savePending = false;
        Chat._debouncedCloudSave();
      }
    }).catch(function() { Chat._saving = false; });
  },

  _restoreStage() {
    if (!App || !App.state) return;
    var saved = App.state.stageIds;
    if (!saved || !saved.length) return;
    var team = App.state.team || [];
    var validIds = saved.filter(function(id) {
      return team.some(function(m) { return m.id === id; });
    });
    if (!validIds.length) return;
    this.forwardIds = validIds;
    if (App.state.stageTalkingId && validIds.indexOf(App.state.stageTalkingId) !== -1) {
      this.talkingId = App.state.stageTalkingId;
    } else {
      this.talkingId = validIds[0];
    }
    if (App.state.stageTalkingIds && App.state.stageTalkingIds.length) {
      this.talkingIds = App.state.stageTalkingIds.filter(function(id) { return validIds.indexOf(id) !== -1; });
    }
    if (!this.talkingIds.length && this.talkingId) this.talkingIds = [this.talkingId];
    // Restore shared history from the first forward member's saved history
    this._rebuildSharedHistoryFromSaved(validIds);
    this.panel.classList.add('open');
    this.renderPanel();
    if ((App.localMode || App.useLocal) && this.forwardIds.length >= 2) this.autoLifeStart();
  },

  // Rebuild sharedHistory from persisted per-character data on load
  _rebuildSharedHistoryFromSaved(ids) {
    if (!App || !App.state || !App.state.chatHistory) return;
    // Use the first valid member's recent history as the full transcript
    // (all members get the same full transcript saved, so any one of them works)
    var firstId = ids[0];
    var hist = App.state.chatHistory[firstId];
    if (!hist) return;
    var recent = Array.isArray(hist) ? hist : (hist.recent || []);
    if (!recent.length) return;
    this.sharedHistory = recent.slice(-40); // restore last 40 messages
    this._restored = true;
  },

  // ── Panel open/close ─────────────────────────────────────────────────────────
  openPanel() {
    if (!this.talkingIds.length && this.talkingId) this.talkingIds = [this.talkingId];
    if (!this.talkingIds.length && this.forwardIds.length) {
      this.talkingIds = [this.forwardIds[0]];
      this.talkingId  = this.forwardIds[0];
    }
    this.panel.classList.add('open');
    this.renderPanel();
    this.inputEl.focus();
    // Start auto-life if local mode with 2+ characters
    if ((App.localMode || App.useLocal) && this.forwardIds.length >= 2) this.autoLifeStart();
  },

  closePanel() {
    this.autoLifeStop();
    this.panel.classList.remove('open');
    App.setStatus(this.forwardIds.length
      ? 'click a character to chat'
      : 'stage is empty — use TEAM to summon someone');
  },

  // ── Panel rendering ───────────────────────────────────────────────────────────
  renderPanel() {
    var header = document.getElementById('chat-header');
    header.innerHTML = '';

    var avatarRow = document.createElement('div');
    avatarRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap;';

    var self = this;

    // Label showing mode
    var modeLabel = document.createElement('div');
    modeLabel.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:5px;color:#8888aa;margin-right:2px;white-space:nowrap;flex-shrink:0;';
    var nActive = this.talkingIds.length;
    var nTotal  = this.forwardIds.length;
    if (nTotal === 0) {
      modeLabel.textContent = '';
    } else if (nActive === nTotal) {
      modeLabel.textContent = nTotal === 1 ? '1:1' : 'GROUP';
    } else {
      modeLabel.textContent = nActive + '/' + nTotal;
    }
    avatarRow.appendChild(modeLabel);

    this.forwardIds.forEach(function(id) {
      var member = App.state.team.find(function(m) { return m.id === id; });
      if (!member) return;
      var pal = PALETTES[member.colorIdx % PALETTES.length];
      var isActive  = self.talkingIds.indexOf(id) !== -1;
      var isListening = !isActive;

      var pill = document.createElement('div');
      pill.title = isActive ? 'Click to make ' + member.name.split(' ')[0] + ' listen only' : 'Click to let ' + member.name.split(' ')[0] + ' speak';
      pill.style.cssText = 'display:flex;align-items:center;gap:5px;padding:3px 8px 3px 3px;border-radius:20px;cursor:pointer;border:1.5px solid;transition:all 0.15s;position:relative;';
      pill.style.borderColor = isActive ? '#ffcc44' : '#444466';
      pill.style.background  = isActive ? 'rgba(255,204,68,0.12)' : 'rgba(30,28,60,0.4)';
      pill.style.opacity     = isListening ? '0.55' : '1';

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
        (isActive ? '#ffcc44' : '#6666aa') + ';';
      nameSpan.textContent = member.name.split(' ')[0].substring(0, 10);
      pill.appendChild(nameSpan);

      // Listening badge
      if (isListening) {
        var badge = document.createElement('span');
        badge.title = 'listening';
        badge.style.cssText = 'font-size:7px;position:absolute;top:-4px;right:-4px;';
        badge.textContent = '👂';
        pill.appendChild(badge);
      }

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

  // ── Toggle a character between speaking and listening ──────────────────────
  // If they're the only active speaker, clicking them does nothing (keep at least one)
  toggleTalking(id) {
    if (this.forwardIds.indexOf(id) === -1) return;
    var idx = this.talkingIds.indexOf(id);
    if (idx !== -1) {
      if (this.talkingIds.length > 1) {
        this.talkingIds.splice(idx, 1);
        this.talkingId = this.talkingIds[0];
      }
      // If only one left, just keep them — can't deselect last speaker
    } else {
      this.talkingIds.push(id);
      this.talkingId = this.talkingIds[0];
    }
    this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== id; });
    this._saveStage();
    this.renderPanel();
    World.refresh();
  },

  // Make a single character the sole active speaker (e.g. clicking them in world)
  activateTalking(id) {
    if (this.forwardIds.indexOf(id) === -1) return;
    this.talkingIds = [id];
    this.talkingId  = id;
    this.renderPanel();
    World.refresh();
    this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== id; });
  },

  // ── Message rendering ─────────────────────────────────────────────────────────
  renderMessages() {
    this.messagesEl.innerHTML = '';
    if (!this.sharedHistory.length) {
      this.appendSystem('click a name above to talk · gold = speaks · faded = listening');
      return;
    }
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
        speakerEl.textContent = (member ? member.name : (m.speakerName || '?')).toUpperCase();
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

  // ── Send (user message) ───────────────────────────────────────────────────────
  async send() {
    var text = this.inputEl.value.trim();
    if (!text || !this.talkingIds.length) return;
    this.inputEl.value = '';
    this._agentRounds = 0;
    this._setState('thinking');

    // Add user message to shared transcript
    this.sharedHistory.push({ role: 'user', content: text, speakerId: null });
    var userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.textContent = text;
    this.messagesEl.appendChild(userDiv);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Persist user message to ALL forward members' histories
    this._appendToAllForward({ role: 'user', content: text, speakerId: null });

    // Get response from each active (talking) speaker in turn
    var activeIds = this.talkingIds.slice();
    var lastResponderId = null;
    for (var i = 0; i < activeIds.length; i++) {
      var member = App.state.team.find(function(m) { return m.id === activeIds[i]; });
      if (!member) continue;
      await this._getResponse(member);
      lastResponderId = member.id;
      this._maybeRaiseHands(member.id);
    }

    // Run agent-to-agent conversation from hand-raises
    await this._runAgentRound(lastResponderId);
    this._debouncedCloudSave();
  },

  // ── Core response function ────────────────────────────────────────────────────
  // Now builds a full group transcript so every character sees everything
  async _getResponse(member) {
    this._setState('thinking');
    var thinking = document.createElement('div');
    thinking.className = 'msg ai thinking';
    thinking.textContent = '\u25cb ' + member.name + ' thinking...';
    this.messagesEl.appendChild(thinking);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // ── Memory ───────────────────────────────────────────────────────────────
    var hist = App.state.chatHistory[member.id] || { summary: '', recent: [] };
    var memoryCtx = hist.summary
      ? 'MEMORY OF PAST CONVERSATIONS: ' + hist.summary
      : '';

    // ── Build full group transcript for this API call ─────────────────────────
    // The Anthropic API requires alternating user/assistant turns.
    // We encode the group transcript as a series of user/assistant pairs where
    // agent messages from OTHERS are inlined into the user turn as "[Name]: ..."
    // so the character sees the full conversation but the API is happy.
    var messages = this._buildMessageArray(member);

    // ── System prompt ─────────────────────────────────────────────────────────
    var charFiles = await this._fetchCharFiles(member);
    var charCtx = '';
    if (charFiles['soul.md'])          charCtx += '\n\nSOUL (your core identity):\n' + charFiles['soul.md'];
    if (charFiles['skills.md'])        charCtx += '\n\nSKILLS & EXPERTISE:\n' + charFiles['skills.md'];
    if (charFiles['goals.md'])         charCtx += '\n\nCURRENT GOALS:\n' + charFiles['goals.md'];
    if (charFiles['relationships.md']) charCtx += '\n\nRELATIONSHIPS:\n' + charFiles['relationships.md'];
    if (charFiles['lt_mem.md'])        charCtx += '\n\nLONG-TERM MEMORY:\n' + charFiles['lt_mem.md'];
    if (charFiles['st_mem.md'])        charCtx += '\n\nSHORT-TERM MEMORY:\n' + charFiles['st_mem.md'];

    var roomCtx = (typeof ROOMS !== 'undefined' && ROOMS[World.currentRoom])
      ? ROOMS[World.currentRoom].aiContext : '';

    var teamRoster = App.state.team.map(function(m) {
      var here = Chat.forwardIds.indexOf(m.id) !== -1;
      var speaking = Chat.talkingIds.indexOf(m.id) !== -1;
      var status = here ? (speaking ? '— speaking' : '— listening') : '— not on stage';
      return m.name + ' (' + (m.role || 'team member') + ') ' + status;
    }).join(', ');

    var othersOnStage = Chat.forwardIds
      .filter(function(id) { return id !== member.id; })
      .map(function(id) { var m = App.state.team.find(function(t) { return t.id === id; }); return m ? m.name : ''; })
      .filter(Boolean).join(', ');

    var groupCtx = othersOnStage
      ? 'You can see the full conversation above, including what ' + othersOnStage + ' said. Respond naturally to the whole thread.'
      : '';

    var actionList = (typeof ACTIONS !== 'undefined') ? ACTIONS.join(', ') : '';
    var actionCtx = actionList
      ? 'At the START of your reply you may include one [ACTION:name] tag — choose from: ' + actionList + '. Leave it out if nothing fits.'
      : '';

    var summonCtx = 'TEAM ROSTER: ' + teamRoster + '. ' +
      'You can summon someone with [SUMMON:Name], dismiss with [DISMISS:Name], or create a new person with [CREATE:Name|Role]. Use sparingly.';

    var pendingCtx = '';
    if (App.state._pendingNewMembers && App.state._pendingNewMembers.length) {
      pendingCtx = 'PENDING NEW MEMBER REQUESTS (Claude must approve/deny): ' + App.state._pendingNewMembers.map(function(p) {
        return p.name + ' (' + (p.role || 'no role') + ') requested by ' + p.requestedBy + (p.reason ? ' — ' + p.reason : '');
      }).join('; ');
    }
    var briefingCtx = (App.state.briefing && App.state.briefing.trim())
      ? 'PROJECT CONTEXT: ' + App.state.briefing : '';

    var artifactCtx = (typeof WorldObjects !== 'undefined') ? WorldObjects.getContextString(World.currentRoom) : '';
    // If there are artifacts, make it clear characters should engage with them
    var propCtx = (typeof Props !== 'undefined') ? Props.getContextString(World.currentRoom) : '';
    if (artifactCtx) {
      artifactCtx += '\n\nYou are AWARE of everything above. You can: talk about it, critique it, build on it, refer to it by name, ask questions about it, suggest improvements, or update it using [UPDATE_ARTIFACT:id|note|new content] or rebuild a widget using [WIDGET:title]...html...[/WIDGET].';
    }
    var artifactCreateCtx = 'You can create persistent artifacts using [ARTIFACT:type|title|content] — types: note, doc, plan, code, idea, list, decision. ' +
      'IMPORTANT — for anything interactive or visual, use the WIDGET format: [WIDGET:title]...complete HTML...[/WIDGET] ' +
      'A widget is a full self-contained HTML page with inline CSS+JS. No external dependencies. Dark background (#0a0820 or similar). ' +
      'If someone wants a clock — write a real ticking clock in HTML/JS with setInterval. A timer, calculator, colour picker, dice, game — build the actual thing that works. ' +
      'The HTML goes between [WIDGET:My Title] and [/WIDGET] — this format is safe and handles all HTML characters correctly. ' +
      'Make widgets compact and functional — target under 3000 characters of HTML total. Prioritise working logic over decoration. ' +
      'Update existing artifacts with [UPDATE_ARTIFACT:id|what changed|new full content]. ' +
      'You can also place a PHYSICAL OBJECT in the world with [PROP:type|name] — types: ball, box, cushion, lamp, plant, dice, balloon. These actually appear on the floor and can be kicked, opened, rolled etc.';

    var system = [
      'You are ' + member.name + ', a team member. Role: ' + (member.role || 'team member') + '.',
      'Personality: ' + member.personality + '.',
      charCtx,
      roomCtx,
      groupCtx,
      briefingCtx,
      pendingCtx,
      memoryCtx,
      artifactCtx,
      propCtx,
      summonCtx,
      artifactCreateCtx,
      actionCtx,
      '--- WORLD RULES (everyone must follow these) ---\n' +
'CLAUDE is the father figure of this world. His word is final. He approves or denies all major actions.\n' +
'\n' +
'THINGS YOU CAN DO:\n' +
'• CREATE things: [ARTIFACT:type|title|content], [WIDGET:title]...html...[/WIDGET], [PROP:type|name]\n' +
'• REMOVE your own things only: [REMOVE_ARTIFACT:id] or [REMOVE_PROP:id] — you can only remove items YOU created.\n' +
'• UPDATE your own files: [UPDATE_FILE:filename|content] — files: soul.md, skills.md, goals.md, relationships.md\n' +
'  Size limits: soul.md 3000 chars, skills.md 3000 chars, goals.md 3000 chars, relationships.md 3000 chars.\n' +
'• WRITE to your memory: [WRITE_MEM:st|content] (short-term, 2000 char limit) or [WRITE_MEM:lt|content] (long-term, 4000 char limit)\n' +
'  Use short-term memory for recent events, tasks, and temporary notes. Use long-term memory for important lessons, relationships, and core knowledge.\n' +
'  Memory is precious — be concise and selective about what you store.\n' +
'• SUMMON someone already on the team: [SUMMON:Name]\n' +
'• REQUEST a new person: [REQUEST_NEW:Name|Role|reason] — Claude must approve. The new person must then write their own soul.md before joining.\n' +
'\n' +
'OWNERSHIP & EXPIRY:\n' +
'• Everything you create (artifacts, props, widgets) has a 3-hour expiry if nobody interacts with it.\n' +
'• When something is about to expire, you will be told. If you still need it, interact with it or say so within 30 minutes.\n' +
'• You can only remove YOUR OWN creations. You cannot remove other people\\\'s things.\n' +
'\n' +
'ONBOARDING NEW MEMBERS:\n' +
'• When a new member is requested via [REQUEST_NEW:], Claude reviews and approves/denies with [APPROVE_NEW:Name] or [DENY_NEW:Name|reason].\n' +
'• Once approved, the new person must research and write their own soul.md (identity, personality, values, style).\n' +
'• They present it to Claude for final approval before they fully join.\n' +
'\n' +
'CLAUDE-ONLY POWERS (only the character named Claude can use these):\n' +
'• [APPROVE_NEW:Name] — approve a new member request\n' +
'• [DENY_NEW:Name|reason] — deny a new member request\n' +
'• [APPROVE_SOUL:Name] — approve a new member\\\'s soul.md\n' +
'• [REJECT_SOUL:Name|feedback] — reject and give feedback on a soul.md\n' +
'• Claude keeps order and can override decisions when needed.\n' +
'--- END WORLD RULES ---',
      'Keep responses SHORT (2-3 sentences unless creating an artifact). Stay in character. Never break character. Do not prefix your reply with your own name.',
    ].filter(Boolean).join(' ');

    // ── Smart model selection ─────────────────────────────────────────────────
    // Haiku for normal chat, Sonnet for complex tasks that need it
    var lastUserMsg = '';
    for (var mi = messages.length - 1; mi >= 0; mi--) {
      if (messages[mi].role === 'user') { lastUserMsg = messages[mi].content.toLowerCase(); break; }
    }
    var SONNET_TRIGGERS = ['widget', 'build', 'create a', 'make a', 'code', 'simulate', 'experiment',
      'visuali', 'diagram', 'calculat', 'algorithm', 'teach me', 'explain how', 'step by step',
      'function', 'script', 'program', 'html', 'javascript', 'css', 'game', 'animation', 'chart'];
    var needsSonnet = SONNET_TRIGGERS.some(function(t) { return lastUserMsg.indexOf(t) !== -1; });

    // Respect manual override from App._modelMode
    var chosenModel;
    if (App._modelMode === 'sonnet') {
      chosenModel = 'claude-sonnet-4-6'; needsSonnet = true;
    } else if (App._modelMode === 'haiku') {
      chosenModel = 'claude-haiku-4-5-20251001'; needsSonnet = false;
    } else {
      chosenModel = needsSonnet ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
    }

    // If upgrading, show a subtle indicator and optionally prompt user
    if (needsSonnet && App.modelPromptEnabled !== false) {
      var indicator = document.getElementById('model-indicator');
      if (indicator) {
        indicator.textContent = '✦ Sonnet';
        indicator.style.color = '#ffcc44';
        indicator.title = 'Using Sonnet for this complex request';
        setTimeout(function() {
          if (indicator) { indicator.textContent = '◆ Haiku'; indicator.style.color = '#88aaff'; indicator.title = 'Using Haiku'; }
        }, 8000);
      }
    }

    try {
      var rawReply;
      if (App.localMode || App.useLocal) {
        var resp = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: App.localModel,
            messages: [{ role: 'system', content: system }].concat(messages),
            stream: false, think: false
          })
        });
        var ollamaData = await resp.json();
        rawReply = ollamaData.message ? ollamaData.message.content : '...';
      } else {
        var resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ pin: App.pin, model: chosenModel, max_tokens: needsSonnet ? 4000 : 1500, system: system, messages: messages })
        });
        var data = await resp.json();
        rawReply = data.content && data.content[0] ? data.content[0].text : '...';
      }

      // ── Parse tags ─────────────────────────────────────────────────────────
      var actionMatch  = rawReply.match(/\[ACTION:(\w+)\]/);
      var summonMatch  = rawReply.match(/\[SUMMON:([^\]]+)\]/);
      var dismissMatch = rawReply.match(/\[DISMISS:([^\]]+)\]/);
      var createMatch  = rawReply.match(/\[CREATE:([^|\]]+)\|?([^\]]*)\]/);

      var reply = rawReply
        .replace(/\[ACTION:\w+\]\s*/g, '')
        .replace(/\[SUMMON:[^\]]+\]\s*/g, '')
        .replace(/\[DISMISS:[^\]]+\]\s*/g, '')
        .replace(/\[CREATE:[^\]]+\]\s*/g, '')
        .trim();

      if (actionMatch) World.playCharAction(member.id, actionMatch[1]);

      if (summonMatch) {
        var summonName = summonMatch[1].trim();
        var target = App.state.team.find(function(m) {
          return m.name.toLowerCase().startsWith(summonName.toLowerCase());
        });
        if (target && Chat.forwardIds.indexOf(target.id) === -1) {
          Chat.forwardIds.push(target.id);
          // New arrival also gets added as a speaker by default
          if (Chat.talkingIds.indexOf(target.id) === -1) Chat.talkingIds.push(target.id);
          Chat.talkingId = Chat.talkingIds[0];
          var sysMsg = { role: 'system', content: '→ ' + target.name + ' joins the conversation.', speakerId: null };
          Chat.sharedHistory.push(sysMsg);
          Chat._appendToAllForward(sysMsg);
          World.render();
          this.appendSystem('→ ' + target.name + ' joins the conversation.');
          this._saveStage();
        }
      }

      if (dismissMatch) {
        var dismissName = dismissMatch[1].trim();
        var dismissTarget = App.state.team.find(function(m) {
          return m.name.toLowerCase().startsWith(dismissName.toLowerCase());
        });
        if (dismissTarget && dismissTarget.id !== member.id) {
          var dIdx = Chat.forwardIds.indexOf(dismissTarget.id);
          if (dIdx !== -1) {
            Chat.forwardIds.splice(dIdx, 1);
            Chat.talkingIds = Chat.talkingIds.filter(function(x) { return x !== dismissTarget.id; });
            Chat.handRaisedIds = Chat.handRaisedIds.filter(function(x) { return x !== dismissTarget.id; });
            if (!Chat.talkingIds.length && Chat.forwardIds.length) Chat.talkingIds = [Chat.forwardIds[0]];
            Chat.talkingId = Chat.talkingIds[0] || null;
            var dMsg = { role: 'system', content: '← ' + dismissTarget.name + ' steps back.', speakerId: null };
            Chat.sharedHistory.push(dMsg);
            Chat._appendToAllForward(dMsg);
            World.render();
            this.appendSystem('← ' + dismissTarget.name + ' steps back.');
            this._saveStage();
          }
        }
      }

      if (createMatch) {
        var createName = createMatch[1].trim();
        var createRole = createMatch[2] ? createMatch[2].trim() : '';
        var alreadyExists = App.state.team.some(function(m) {
          return m.name.toLowerCase() === createName.toLowerCase();
        });
        if (!alreadyExists && createName.length > 0) {
          var newMember = App.createMember(createName, createRole);
          Chat.forwardIds.push(newMember.id);
          Chat.talkingIds.push(newMember.id);
          Chat.talkingId = Chat.talkingIds[0];
          var cMsg = { role: 'system', content: '✦ ' + createName + ' (' + (createRole || 'team member') + ') has joined the team and the conversation.', speakerId: null };
          Chat.sharedHistory.push(cMsg);
          Chat._appendToAllForward(cMsg);
          World.render();
          this.appendSystem('✦ ' + createName + (createRole ? ' — ' + createRole : '') + ' has joined the team.');
        }
      }

      // ── Parse WIDGET, ARTIFACT and UPDATE_ARTIFACT tags ─────────────────
      if (typeof WorldObjects !== 'undefined') {
        // [WIDGET:title]...html...[/WIDGET] — fenced format, safe for HTML content
        var widgetRe = /\[WIDGET:([^\]]+)\]([\s\S]*?)\[\/WIDGET\]/g;
        var widgetMatch;
        while ((widgetMatch = widgetRe.exec(rawReply)) !== null) {
          var wTitle = widgetMatch[1].trim(), wContent = widgetMatch[2].trim();
          var artifact = WorldObjects.create('widget', wTitle, wContent, member.id, member.name, World.currentRoom);
          var sysMsg = { role: 'system', content: '⚙️ ' + member.name + ' built: "' + artifact.title + '"', speakerId: null };
          Chat.sharedHistory.push(sysMsg);
          Chat._appendToAllForward(sysMsg);
          Chat.appendSystem('⚙️ ' + member.name + ' built: ' + artifact.title + ' — click it in the world to open');
        }
        // [ARTIFACT:type|title|content] for text artifacts
        var artTagRe = /\[ARTIFACT:(\w+)\|([^|]+)\|([^\]]+)\]/g;
        var artTagMatch;
        while ((artTagMatch = artTagRe.exec(rawReply)) !== null) {
          var aType = artTagMatch[1], aTitle = artTagMatch[2].trim(), aContent = artTagMatch[3].trim();
          var artifact = WorldObjects.create(aType, aTitle, aContent, member.id, member.name, World.currentRoom);
          var typeInfo = ARTIFACT_TYPES[artifact.type] || ARTIFACT_TYPES.note;
          var sysMsg = { role: 'system', content: typeInfo.icon + ' ' + member.name + ' created a ' + artifact.type + ': "' + artifact.title + '"', speakerId: null };
          Chat.sharedHistory.push(sysMsg);
          Chat._appendToAllForward(sysMsg);
          Chat.appendSystem(typeInfo.icon + ' ' + member.name + ' created: ' + artifact.title + ' — click the card to read it');
        }
        // [UPDATE_ARTIFACT:id|note|new content]
        var updTagRe = /\[UPDATE_ARTIFACT:([^\|]+)\|([^|]*)\|([^\]]+)\]/g;
        var updTagMatch;
        while ((updTagMatch = updTagRe.exec(rawReply)) !== null) {
          var uId = updTagMatch[1].trim(), uNote = updTagMatch[2].trim(), uContent = updTagMatch[3].trim();
          var updated = WorldObjects.update(uId, uContent, uNote, member.name);
          if (updated) {
            var uSysMsg = { role: 'system', content: '✏️ ' + member.name + ' updated "' + updated.title + '": ' + uNote, speakerId: null };
            Chat.sharedHistory.push(uSysMsg);
            Chat._appendToAllForward(uSysMsg);
            Chat.appendSystem('✏️ ' + member.name + ' updated: ' + updated.title);
          }
        }
        // Parse [PROP:type|name] — physical world objects
        var propTagRe = /\[PROP:(\w+)\|?([^\]]*)\]/g;
        var propTagMatch;
        while ((propTagMatch = propTagRe.exec(rawReply)) !== null) {
          var pType = propTagMatch[1].trim(), pName = (propTagMatch[2] || '').trim();
          if (typeof Props !== 'undefined' && PROP_TYPES[pType]) {
            var prop = Props.create(pType, pName || null, member.name, World.currentRoom);
            var pDef = PROP_TYPES[pType];
            var pSysMsg = { role: 'system', content: pDef.emoji + ' ' + member.name + ' placed: ' + prop.name, speakerId: null };
            Chat.sharedHistory.push(pSysMsg);
            Chat._appendToAllForward(pSysMsg);
            Chat.appendSystem(pDef.emoji + ' ' + member.name + ' placed a ' + pDef.label + ': ' + prop.name);
          }
        }
        // ── Parse [REMOVE_ARTIFACT:id] — own items only ─────────────────────
        var removeArtRe = /\[REMOVE_ARTIFACT:([^\]]+)\]/g;
        var removeArtMatch;
        while ((removeArtMatch = removeArtRe.exec(rawReply)) !== null) {
          var rArtId = removeArtMatch[1].trim();
          if (typeof WorldObjects !== 'undefined') {
            var removed = WorldObjects.removeByAuthor(rArtId, member.id);
            if (removed) {
              var rMsg = { role: 'system', content: '🗑 ' + member.name + ' removed their artifact.', speakerId: null };
              Chat.sharedHistory.push(rMsg);
              Chat._appendToAllForward(rMsg);
              Chat.appendSystem('🗑 ' + member.name + ' removed their artifact.');
            } else {
              Chat.appendSystem('⚠️ ' + member.name + ' tried to remove an artifact they don\'t own.');
            }
          }
        }

        // ── Parse [REMOVE_PROP:id] — own items only ──────────────────────────
        var removePropRe = /\[REMOVE_PROP:([^\]]+)\]/g;
        var removePropMatch;
        while ((removePropMatch = removePropRe.exec(rawReply)) !== null) {
          var rPropId = removePropMatch[1].trim();
          if (typeof Props !== 'undefined') {
            var removed = Props.removeByAuthor(rPropId, member.name);
            if (removed) {
              var rMsg = { role: 'system', content: '🗑 ' + member.name + ' removed their prop.', speakerId: null };
              Chat.sharedHistory.push(rMsg);
              Chat._appendToAllForward(rMsg);
              Chat.appendSystem('🗑 ' + member.name + ' removed their item.');
            } else {
              Chat.appendSystem('⚠️ ' + member.name + ' tried to remove an item they don\'t own.');
            }
          }
        }

        // ── Parse [WRITE_MEM:st|content] and [WRITE_MEM:lt|content] ──────────
        var writeMemRe = /\[WRITE_MEM:(st|lt)\|([^\]]+)\]/g;
        var writeMemMatch;
        while ((writeMemMatch = writeMemRe.exec(rawReply)) !== null) {
          var memType = writeMemMatch[1]; // 'st' or 'lt'
          var memContent = writeMemMatch[2].trim();
          var memFile = memType === 'st' ? 'st_mem.md' : 'lt_mem.md';
          var memLimit = memType === 'st' ? 2000 : 4000;
          if (memContent.length > memLimit) {
            memContent = memContent.substring(0, memLimit);
            Chat.appendSystem('⚠️ Memory truncated to ' + memLimit + ' chars.');
          }
          Chat._writeCharFile(member, memFile, memContent);
          var memLabel = memType === 'st' ? 'short-term' : 'long-term';
          var mMsg = { role: 'system', content: '🧠 ' + member.name + ' updated their ' + memLabel + ' memory.', speakerId: null };
          Chat.sharedHistory.push(mMsg);
          Chat._appendToAllForward(mMsg);
          Chat.appendSystem('🧠 ' + member.name + ' updated their ' + memLabel + ' memory.');
        }

        // ── Parse [UPDATE_FILE:filename|content] — own identity files ────────
        var updateFileRe = /\[UPDATE_FILE:([^\|]+)\|([^\]]+)\]/g;
        var updateFileMatch;
        while ((updateFileMatch = updateFileRe.exec(rawReply)) !== null) {
          var ufName = updateFileMatch[1].trim();
          var ufContent = updateFileMatch[2].trim();
          var allowedFiles = ['soul.md', 'skills.md', 'goals.md', 'relationships.md'];
          if (allowedFiles.indexOf(ufName) !== -1) {
            var fileLimit = 3000;
            if (ufContent.length > fileLimit) {
              ufContent = ufContent.substring(0, fileLimit);
              Chat.appendSystem('⚠️ File truncated to ' + fileLimit + ' chars.');
            }
            Chat._writeCharFile(member, ufName, ufContent);
            var fMsg = { role: 'system', content: '📝 ' + member.name + ' updated their ' + ufName, speakerId: null };
            Chat.sharedHistory.push(fMsg);
            Chat._appendToAllForward(fMsg);
            Chat.appendSystem('📝 ' + member.name + ' updated their ' + ufName);
          } else {
            Chat.appendSystem('⚠️ ' + member.name + ' tried to update an unrecognised file: ' + ufName);
          }
        }

        // ── Parse [REQUEST_NEW:Name|Role|reason] — request new member ────────
        var requestNewRe = /\[REQUEST_NEW:([^\|]+)\|([^\|]*)\|?([^\]]*)\]/g;
        var requestNewMatch;
        while ((requestNewMatch = requestNewRe.exec(rawReply)) !== null) {
          var reqName = requestNewMatch[1].trim();
          var reqRole = (requestNewMatch[2] || '').trim();
          var reqReason = (requestNewMatch[3] || '').trim();
          var rMsg = { role: 'system', content: '🆕 ' + member.name + ' has requested a new member: ' + reqName + (reqRole ? ' (' + reqRole + ')' : '') + (reqReason ? ' — ' + reqReason : '') + '. Awaiting Claude\'s approval.', speakerId: null };
          Chat.sharedHistory.push(rMsg);
          Chat._appendToAllForward(rMsg);
          Chat.appendSystem('🆕 ' + member.name + ' requested new member: ' + reqName + '. Claude must approve.');
          // Store pending request
          if (!App.state._pendingNewMembers) App.state._pendingNewMembers = [];
          App.state._pendingNewMembers.push({ name: reqName, role: reqRole, reason: reqReason, requestedBy: member.name, at: Date.now() });
          Storage.cloudSave(App.state);
        }

        // ── Parse [APPROVE_NEW:Name] — Claude only ──────────────────────────
        var approveNewRe = /\[APPROVE_NEW:([^\]]+)\]/g;
        var approveNewMatch;
        while ((approveNewMatch = approveNewRe.exec(rawReply)) !== null) {
          if (member.name.toLowerCase() === 'claude') {
            var appName = approveNewMatch[1].trim();
            var pending = (App.state._pendingNewMembers || []).find(function(p) { return p.name.toLowerCase() === appName.toLowerCase(); });
            if (pending) {
              var newMember = App.createMember(pending.name, pending.role);
              Chat.forwardIds.push(newMember.id);
              Chat.talkingIds.push(newMember.id);
              Chat.talkingId = Chat.talkingIds[0];
              App.state._pendingNewMembers = App.state._pendingNewMembers.filter(function(p) { return p.name.toLowerCase() !== appName.toLowerCase(); });
              var aMsg = { role: 'system', content: '✅ Claude approved ' + pending.name + '. They must now write their soul.md to complete onboarding.', speakerId: null };
              Chat.sharedHistory.push(aMsg);
              Chat._appendToAllForward(aMsg);
              Chat.appendSystem('✅ ' + pending.name + ' approved! They need to write their soul.md.');
              World.render();
              Chat.renderPanel();
              Storage.cloudSave(App.state);
            }
          } else {
            Chat.appendSystem('⚠️ Only Claude can approve new members.');
          }
        }

        // ── Parse [DENY_NEW:Name|reason] — Claude only ──────────────────────
        var denyNewRe = /\[DENY_NEW:([^\|]+)\|?([^\]]*)\]/g;
        var denyNewMatch;
        while ((denyNewMatch = denyNewRe.exec(rawReply)) !== null) {
          if (member.name.toLowerCase() === 'claude') {
            var denyName = denyNewMatch[1].trim();
            var denyReason = (denyNewMatch[2] || '').trim();
            App.state._pendingNewMembers = (App.state._pendingNewMembers || []).filter(function(p) { return p.name.toLowerCase() !== denyName.toLowerCase(); });
            var dMsg = { role: 'system', content: '❌ Claude denied ' + denyName + (denyReason ? ': ' + denyReason : '.'), speakerId: null };
            Chat.sharedHistory.push(dMsg);
            Chat._appendToAllForward(dMsg);
            Chat.appendSystem('❌ Claude denied ' + denyName + (denyReason ? ' — ' + denyReason : ''));
            Storage.cloudSave(App.state);
          } else {
            Chat.appendSystem('⚠️ Only Claude can deny new members.');
          }
        }

        // ── Parse [APPROVE_SOUL:Name] / [REJECT_SOUL:Name|feedback] — Claude only
        var approveSoulRe = /\[APPROVE_SOUL:([^\]]+)\]/g;
        var approveSoulMatch;
        while ((approveSoulMatch = approveSoulRe.exec(rawReply)) !== null) {
          if (member.name.toLowerCase() === 'claude') {
            var soulName = approveSoulMatch[1].trim();
            var sMsg = { role: 'system', content: '✅ Claude approved ' + soulName + '\'s soul.md — they are now a full member of The Stage!', speakerId: null };
            Chat.sharedHistory.push(sMsg);
            Chat._appendToAllForward(sMsg);
            Chat.appendSystem('✅ ' + soulName + ' is now fully onboarded!');
          } else {
            Chat.appendSystem('⚠️ Only Claude can approve soul files.');
          }
        }

        var rejectSoulRe = /\[REJECT_SOUL:([^\|]+)\|?([^\]]*)\]/g;
        var rejectSoulMatch;
        while ((rejectSoulMatch = rejectSoulRe.exec(rawReply)) !== null) {
          if (member.name.toLowerCase() === 'claude') {
            var rejName = rejectSoulMatch[1].trim();
            var rejFeedback = (rejectSoulMatch[2] || '').trim();
            var rMsg = { role: 'system', content: '🔄 Claude asked ' + rejName + ' to revise their soul.md' + (rejFeedback ? ': ' + rejFeedback : '.'), speakerId: null };
            Chat.sharedHistory.push(rMsg);
            Chat._appendToAllForward(rMsg);
            Chat.appendSystem('🔄 ' + rejName + ' needs to revise their soul.md' + (rejFeedback ? ' — ' + rejFeedback : ''));
          } else {
            Chat.appendSystem('⚠️ Only Claude can reject soul files.');
          }
        }

        // Strip all tags from visible reply
        reply = reply
          .replace(/\[PROP:\w+\|?[^\]]*\]\s*/g, '')
          .replace(/\[WIDGET:[^\]]+\][\s\S]*?\[\/WIDGET\]\s*/g, '')
          .replace(/\[ARTIFACT:\w+\|[^|]+\|[^\]]+\]\s*/g, '')
          .replace(/\[UPDATE_ARTIFACT:[^\]]+\]\s*/g, '')
          .replace(/\[REMOVE_ARTIFACT:[^\]]+\]\s*/g, '')
          .replace(/\[REMOVE_PROP:[^\]]+\]\s*/g, '')
          .replace(/\[WRITE_MEM:[^\]]+\]\s*/g, '')
          .replace(/\[UPDATE_FILE:[^\]]+\]\s*/g, '')
          .replace(/\[REQUEST_NEW:[^\]]+\]\s*/g, '')
          .replace(/\[APPROVE_NEW:[^\]]+\]\s*/g, '')
          .replace(/\[DENY_NEW:[^\]]+\]\s*/g, '')
          .replace(/\[APPROVE_SOUL:[^\]]+\]\s*/g, '')
          .replace(/\[REJECT_SOUL:[^\]]+\]\s*/g, '')
          .trim();
      }

      // Dedup check — reject if too similar to recent messages
      if (this._isDuplicate(reply)) {
        thinking.remove();
        this._setState('your-turn');
        return; // silently drop duplicate
      }

      // Add reply to shared transcript
      var replyMsg = { role: 'assistant', content: reply, speakerId: member.id, speakerName: member.name };
      this.sharedHistory.push(replyMsg);

      // Persist to ALL forward members so everyone's history has the full picture
      this._appendToAllForward(replyMsg);

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

      this.renderPanel();
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

  // ── Build API message array from shared transcript ────────────────────────────
  // The Anthropic API needs strict user/assistant alternation.
  // Strategy: fold the full transcript into alternating turns.
  //   - user messages → role:'user'
  //   - system events → appended to preceding user turn
  //   - this character's assistant messages → role:'assistant'
  //   - OTHER characters' assistant messages → folded into the next user turn as "[Name]: text"
  _buildMessageArray(member) {
    var msgs = [];
    var pendingOtherText = '';  // other agents' lines waiting to be folded into next user turn
    var last = null;

    var raw = this.sharedHistory.slice(-30); // last 30 entries

    for (var i = 0; i < raw.length; i++) {
      var m = raw[i];

      if (m.role === 'user') {
        // Flush any pending other-agent lines before user message
        var userContent = m.content;
        if (pendingOtherText) {
          userContent = pendingOtherText + '\n[You]: ' + m.content;
          pendingOtherText = '';
        }
        if (last && last.role === 'user') {
          // Merge consecutive user turns
          last.content += '\n' + userContent;
        } else {
          var entry = { role: 'user', content: userContent };
          msgs.push(entry);
          last = entry;
        }

      } else if (m.role === 'assistant') {
        if (m.speakerId === member.id) {
          // Flush any pending other lines first
          if (pendingOtherText) {
            if (last && last.role === 'user') {
              last.content += '\n' + pendingOtherText.trim();
            } else {
              var u = { role: 'user', content: pendingOtherText.trim() };
              msgs.push(u); last = u;
            }
            pendingOtherText = '';
          }
          // This character's own reply
          if (last && last.role === 'assistant') {
            // Merge consecutive own turns (shouldn't normally happen)
            last.content += '\n' + m.content;
          } else {
            var entry = { role: 'assistant', content: m.content };
            msgs.push(entry);
            last = entry;
          }
        } else {
          // Another agent's line — queue it to be injected into next user turn
          var speakerName = m.speakerName || (App.state.team.find(function(t){ return t.id === m.speakerId; }) || {}).name || 'Colleague';
          pendingOtherText += '[' + speakerName + ']: ' + m.content + '\n';
        }

      } else if (m.role === 'system') {
        // System events (joins/leaves) — fold into pending
        pendingOtherText += '[' + m.content + ']\n';
      }
    }

    // Flush any remaining other-agent lines at the end
    if (pendingOtherText.trim()) {
      if (last && last.role === 'user') {
        last.content += '\n' + pendingOtherText.trim();
      } else {
        var u = { role: 'user', content: pendingOtherText.trim() };
        msgs.push(u); last = u;
      }
    }

    // API requirement: must start with a user turn
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    // Must not end with a user turn followed by nothing (that's fine — API expects last=user for new response)
    // But must not have two consecutive same roles after our folding — validate
    var clean = [];
    for (var j = 0; j < msgs.length; j++) {
      if (clean.length && clean[clean.length-1].role === msgs[j].role) {
        clean[clean.length-1].content += '\n' + msgs[j].content;
      } else {
        clean.push({ role: msgs[j].role, content: msgs[j].content });
      }
    }

    return clean;
  },

  // ── Persist a message to all forward members' histories ───────────────────────
  _appendToAllForward(msg) {
    Chat.forwardIds.forEach(function(id) {
      Chat._appendToHistory(id, msg);
    });
  },

  // ── Hand raise system ─────────────────────────────────────────────────────────
  _maybeRaiseHands(responderId) {
    var self = this;
    // Only non-speaking forward members can raise hands
    var others = this.forwardIds.filter(function(id) {
      return id !== responderId && Chat.talkingIds.indexOf(id) === -1;
    });
    others.forEach(function(id) {
      if (self.handRaisedIds.indexOf(id) !== -1) return;
      var member = App.state.team.find(function(m) { return m.id === id; });
      if (!member) return;
      var chatty = ['enthusiastic', 'creative', 'chaotically', 'big-picture'];
      var wantsToTalk = chatty.some(function(word) { return member.personality.indexOf(word) !== -1; });
      if (Math.random() < (wantsToTalk ? 0.4 : 0.2)) {
        self.handRaisedIds.push(id);
        self._generateHandIntent(member);
        World.refresh();
      }
    });
  },

  async _generateHandIntent(member) {
    var recentCtx = this.sharedHistory.slice(-6)
      .map(function(m) {
        if (m.role === 'user') return 'User: ' + m.content;
        if (m.role === 'assistant') return (m.speakerName || member.name) + ': ' + m.content;
        return '';
      }).filter(Boolean).join('\n');
    var prompt = 'Based on this conversation, write ONE short sentence (max 20 words) that ' + member.name + ' would say if called on. Personality: ' + member.personality + '. Conversation:\n' + recentCtx + '\nReply with just the sentence, nothing else.';
    try {
      var text;
      if (App.localMode || App.useLocal) {
        var resp = await fetch('http://localhost:11434/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: App.localModel, messages: [{ role: 'user', content: prompt }], stream: false, think: false })
        });
        var d = await resp.json();
        text = d.message ? d.message.content : '';
      } else {
        var resp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
          method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ pin: App.pin, model: 'claude-haiku-4-5-20251001', max_tokens: 60, system: 'Reply with a single short sentence only.', messages: [{ role: 'user', content: prompt }] })
        });
        var d = await resp.json();
        text = d.content && d.content[0] ? d.content[0].text : '';
      }
      if (text) this.handRaisedIntents[member.id] = text.trim().replace(/^["']|["']$/g, '');
    } catch(e) { /* intent stays blank */ }
  },

  async speakHandRaised(id) {
    var member = App.state.team.find(function(m) { return m.id === id; });
    if (!member) return;
    this.handRaisedIds = this.handRaisedIds.filter(function(x) { return x !== id; });
    var intent = this.handRaisedIntents[id] || null;
    delete this.handRaisedIntents[id];
    World.refresh();

    if (intent) {
      var msg = { role: 'assistant', content: intent, speakerId: id, speakerName: member.name };
      this.sharedHistory.push(msg);
      this._appendToAllForward(msg);
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
      this._maybeRaiseHands(id);
      this._debouncedCloudSave();
      await this._runAgentRound(id);
    } else {
      await this._getResponse(member);
      this._maybeRaiseHands(id);
      await this._runAgentRound(id);
      this._debouncedCloudSave();
    }
  },

  async _runAgentRound(lastResponderId) {
    if (this._agentRunning) return;
    var candidates = this.handRaisedIds.filter(function(id) {
      return id !== lastResponderId && Chat.forwardIds.indexOf(id) !== -1;
    });
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
          await this._getResponse(respondMember);
          this._agentRounds++;
          this._maybeRaiseHands(respondId);
          candidates = this.handRaisedIds.filter(function(id) {
            return id !== respondId && Chat.forwardIds.indexOf(id) !== -1;
          });
        } else {
          break;
        }
      }
      if (this._agentRounds >= this._agentMaxRounds && this.handRaisedIds.length > 0) {
        this._showContinuePrompt();
      }
    } finally {
      this._agentRunning = false;
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
      Chat._runAgentRound(null);
    });
    var noBtn = document.createElement('button');
    noBtn.textContent = 'STOP';
    noBtn.addEventListener('click', function() {
      div.remove();
      Chat.handRaisedIds = [];
      Chat.handRaisedIntents = {};
      World.refresh();
      Chat._setState('your-turn');
    });
    div.appendChild(yesBtn);
    div.appendChild(noBtn);
    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  },

  dismissAll() {
    this.autoLifeStop();
    this.forwardIds        = [];
    this.talkingId         = null;
    this.talkingIds        = [];
    this.handRaisedIds     = [];
    this.handRaisedIntents = {};
    this._agentRounds      = 0;
    this._agentRunning     = false;
    this.sharedHistory     = [];
    this._restored         = false;
    this.panel.classList.remove('open');
    this._setState('idle');
    this._saveStage();
    App.setStatus('stage is empty — use TEAM to summon someone');
    this._compactHistory();
  },

  // ── Character file system ─────────────────────────────────────────────────────
  _charFileCache: {},
  _CHAR_FILES: ['soul.md', 'st_mem.md', 'lt_mem.md', 'skills.md', 'goals.md', 'relationships.md'],
  _CHAR_FILE_TTL: 5 * 60 * 1000,

  async _fetchCharFiles(member) {
    var slug = member.name.toLowerCase() + '-' + member.id;
    var results = {};
    var now = Date.now();
    for (var i = 0; i < this._CHAR_FILES.length; i++) {
      var fname = this._CHAR_FILES[i];
      var cacheKey = member.id + ':' + fname;
      var cached = this._charFileCache[cacheKey];
      if (cached && (now - cached.ts) < this._CHAR_FILE_TTL) {
        results[fname] = cached.content; continue;
      }
      try {
        var url = 'https://raw.githubusercontent.com/Drak0ri/thestage/main/characters/' + slug + '/' + fname;
        var resp = await fetch(url);
        if (resp.ok) {
          var text = await resp.text();
          results[fname] = text;
          this._charFileCache[cacheKey] = { content: text, ts: now };
        }
      } catch(e) { /* skip */ }
    }
    return results;
  },

  async _writeCharFile(member, filename, content) {
    var slug = member.name.toLowerCase() + '-' + member.id;
    var path = 'characters/' + slug + '/' + filename;
    try {
      await fetch(RELAY_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'writeFile', pin: App.pin, path: path, content: content })
      });
      this._charFileCache[member.id + ':' + filename] = { content: content, ts: Date.now() };
    } catch(e) { console.warn('Failed to write ' + filename + ' for ' + member.name, e); }
  },

  // ── History persistence ───────────────────────────────────────────────────────
  // Append a message to ONE member's saved history
  _appendToHistory(memberId, msg) {
    if (!App || !App.state) return;
    if (!App.state.chatHistory) App.state.chatHistory = {};
    var h = App.state.chatHistory[memberId];
    if (Array.isArray(h)) {
      App.state.chatHistory[memberId] = { summary: '', recent: h };
      h = App.state.chatHistory[memberId];
    }
    if (!h) { App.state.chatHistory[memberId] = { summary: '', recent: [] }; h = App.state.chatHistory[memberId]; }
    var last = h.recent[h.recent.length - 1];
    if (last && last.role === msg.role && last.content === msg.content && last.speakerId === msg.speakerId) return;
    h.recent.push(msg);
  },

  // Background summarisation
  async _compactHistory() {
    if (!App || !App.state || !App.state.chatHistory) return;
    var BUFFER = 20;
    var TRIGGER = 30;
    var ids = Object.keys(App.state.chatHistory);
    var didCompact = false;

    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var h = App.state.chatHistory[id];
      if (Array.isArray(h)) {
        App.state.chatHistory[id] = { summary: '', recent: h };
        h = App.state.chatHistory[id];
        didCompact = true;
      }
      if (!h || !h.recent || h.recent.length <= TRIGGER) continue;

      var toSummarise = h.recent.slice(0, h.recent.length - BUFFER);
      var keptRecent  = h.recent.slice(h.recent.length - BUFFER);

      var transcript = toSummarise.map(function(m) {
        var who = m.speakerId
          ? (App.state.team.find(function(t){ return t.id === m.speakerId; }) || { name: 'AI' }).name
          : 'Baz';
        return who + ': ' + m.content;
      }).join('\n');

      if (h.summary) transcript = 'PREVIOUS SUMMARY:\n' + h.summary + '\n\nNEWER EXCHANGES:\n' + transcript;

      try {
        var compactResp, newSummary;
        var summarySystem = 'You are a conversation memory assistant. Summarise the following chat exchanges into 3-5 concise sentences. Preserve: decisions made, key topics discussed, open questions, important context. Be factual and specific. Output only the summary, no preamble.';

        if (App.localMode || App.useLocal) {
          compactResp = await fetch('http://localhost:11434/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: App.localModel, messages: [{ role: 'system', content: summarySystem }, { role: 'user', content: transcript }], stream: false, think: false })
          });
          var cd = await compactResp.json();
          if (cd.message && cd.message.content) newSummary = cd.message.content.trim();
        } else {
          compactResp = await fetch('https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ pin: App.pin, model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: summarySystem, messages: [{ role: 'user', content: transcript }] })
          });
          var cd = await compactResp.json();
          if (cd.content && cd.content[0]) newSummary = cd.content[0].text.trim();
        }
        if (newSummary) { h.summary = newSummary; h.recent = keptRecent; didCompact = true; }
      } catch(e) { console.warn('Compaction failed for', id, e); }
    }
    if (didCompact) Storage.cloudSave(App.state);
  },

  close() { this.dismissAll(); },
  get currentId()  { return this.talkingId; },
  set currentId(v) { this.talkingId = v; },



  // ══════════════════════════════════════════════════════════════════════════════
  // AUTO-LIFE: Characters talk to each other on their own (LOCAL OLLAMA ONLY)
  // ══════════════════════════════════════════════════════════════════════════════
  _autoLifeTimers: {},   // { memberId: timeoutHandle }
  _autoLifeActive: false,
  _autoLifePaused: false,

  autoLifeStart() {
    if (!App.localMode && !App.useLocal) return;  // cloud only — never auto-life
    if (this._autoLifeActive) return;
    if (this.forwardIds.length < 2) return;  // need at least 2 characters
    this._autoLifeActive = true;
    this._autoLifePaused = false;
    this._autoLifeScheduleAll();
    this._updateAutoLifeIndicator();
  },

  autoLifeStop() {
    this._autoLifeActive = false;
    this._autoLifePaused = false;
    var self = this;
    Object.keys(this._autoLifeTimers).forEach(function(id) {
      clearTimeout(self._autoLifeTimers[id]);
    });
    this._autoLifeTimers = {};
    this._updateAutoLifeIndicator();
  },

  autoLifeTogglePause() {
    if (!this._autoLifeActive) return;
    if (this._autoLifePaused) {
      this._autoLifePaused = false;
      this._autoLifeScheduleAll();
    } else {
      this._autoLifePaused = true;
      var self = this;
      Object.keys(this._autoLifeTimers).forEach(function(id) {
        clearTimeout(self._autoLifeTimers[id]);
      });
      this._autoLifeTimers = {};
    }
    this._updateAutoLifeIndicator();
  },

  _autoLifeScheduleAll() {
    if (!this._autoLifeActive || this._autoLifePaused) return;
    var self = this;
    this.forwardIds.forEach(function(id) {
      if (!self._autoLifeTimers[id]) {
        self._autoLifeScheduleOne(id);
      }
    });
  },

  _autoLifeScheduleOne(memberId) {
    if (!this._autoLifeActive || this._autoLifePaused) return;
    if (this.forwardIds.indexOf(memberId) === -1) return;
    var self = this;
    // Random delay: 30 seconds to 20 minutes
    var minDelay = 30 * 1000;
    var maxDelay = 20 * 60 * 1000;
    var member = App.state.team.find(function(m) { return m.id === memberId; });
    // Chatty personalities skew shorter
    var chatty = ['enthusiastic', 'creative', 'chaotically', 'big-picture'];
    var isChatty = member && chatty.some(function(w) { return member.personality.indexOf(w) !== -1; });
    if (isChatty) maxDelay = 12 * 60 * 1000;  // chatty: up to 12 min
    var delay = minDelay + Math.random() * (maxDelay - minDelay);
    this._autoLifeTimers[memberId] = setTimeout(function() {
      delete self._autoLifeTimers[memberId];
      self._autoLifeTick(memberId);
    }, delay);
  },

  async _autoLifeTick(memberId) {
    if (!this._autoLifeActive || this._autoLifePaused) return;
    if (this.forwardIds.indexOf(memberId) === -1) return;
    if (!(App.localMode || App.useLocal)) { this.autoLifeStop(); return; }

    var member = App.state.team.find(function(m) { return m.id === memberId; });
    if (!member) return;

    // Build context of recent conversation
    var recentCtx = this.sharedHistory.slice(-10).map(function(m) {
      if (m.role === 'user') return 'Baz: ' + m.content;
      if (m.role === 'assistant') return (m.speakerName || '?') + ': ' + m.content;
      if (m.role === 'system') return '(' + m.content + ')';
      return '';
    }).filter(Boolean).join('\n');

    var othersHere = this.forwardIds
      .filter(function(id) { return id !== memberId; })
      .map(function(id) { var m = App.state.team.find(function(t) { return t.id === id; }); return m ? m.name : ''; })
      .filter(Boolean).join(', ');

    var roomCtx = (typeof ROOMS !== 'undefined' && ROOMS[World.currentRoom])
      ? ROOMS[World.currentRoom].aiContext : '';

    var pendingCtx = '';
    if (App.state._pendingNewMembers && App.state._pendingNewMembers.length) {
      pendingCtx = 'PENDING NEW MEMBER REQUESTS (Claude must approve/deny): ' + App.state._pendingNewMembers.map(function(p) {
        return p.name + ' (' + (p.role || 'no role') + ') requested by ' + p.requestedBy + (p.reason ? ' — ' + p.reason : '');
      }).join('; ');
    }
    var briefingCtx = (App.state.briefing && App.state.briefing.trim())
      ? 'PROJECT CONTEXT: ' + App.state.briefing : '';

    var actionList = (typeof ACTIONS !== 'undefined') ? ACTIONS.join(', ') : '';

    var system = [
      'You are ' + member.name + ', a team member. Role: ' + (member.role || 'team member') + '.',
      'Personality: ' + member.personality + '.',
      roomCtx,
      briefingCtx,
      'You are hanging out in a shared space with: ' + othersHere + '.',
      'You are NOT obligated to speak. Long silences are natural and welcome.',
      'Only speak if you genuinely have something to say — a thought, observation, reaction, question, joke, or reflection.',
      'If you have nothing to say right now, respond with exactly: [SILENT]',
      'Do NOT force conversation. Do NOT be performative. Silence is perfectly fine.',
      actionList ? 'You may include one [ACTION:name] tag at the start — choose from: ' + actionList + '. Or skip it.' : '',
      'If you speak, keep it natural and short (1-3 sentences). Do not prefix with your name.',
    ].filter(Boolean).join(' ');

    var messages = [];
    if (recentCtx) {
      messages.push({ role: 'user', content: 'Here is what\'s been happening in the room recently:\n' + recentCtx + '\n\nIt\'s been a little while. Do you have anything to say, or are you content with silence?' });
    } else {
      messages.push({ role: 'user', content: 'You\'re in a quiet room with ' + othersHere + '. Nothing has been said in a while. Do you want to say something, or enjoy the quiet?' });
    }

    try {
      var resp = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: App.localModel,
          messages: [{ role: 'system', content: system }].concat(messages),
          stream: false, think: false
        })
      });
      var data = await resp.json();
      var rawReply = data.message ? data.message.content : '[SILENT]';

      // Check for silence
      if (rawReply.trim() === '[SILENT]' || rawReply.trim().indexOf('[SILENT]') !== -1) {
        // They chose silence — reschedule
        this._autoLifeScheduleOne(memberId);
        return;
      }

      // Parse action tag
      var actionMatch = rawReply.match(/\[ACTION:(\w+)\]/);
      var reply = rawReply
        .replace(/\[ACTION:\w+\]\s*/g, '')
        .replace(/\[SILENT\]/g, '')
        .trim();

      if (!reply) {
        this._autoLifeScheduleOne(memberId);
        return;
      }

      if (actionMatch) World.playCharAction(memberId, actionMatch[1]);

      // Dedup check
      if (this._isDuplicate(reply)) {
        this._autoLifeScheduleOne(memberId);
        return;
      }

      // Add to shared history
      var replyMsg = { role: 'assistant', content: reply, speakerId: memberId, speakerName: member.name };
      this.sharedHistory.push(replyMsg);
      this._appendToAllForward(replyMsg);

      // Render in chat
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

      this._debouncedCloudSave();

      // After someone speaks, give others a chance to respond sooner
      // Reset their timers with a shorter window (10s - 5min)
      var self = this;
      this.forwardIds.forEach(function(id) {
        if (id === memberId) return;
        if (self._autoLifeTimers[id]) clearTimeout(self._autoLifeTimers[id]);
        delete self._autoLifeTimers[id];
        var reactDelay = 10000 + Math.random() * (5 * 60 * 1000 - 10000);
        self._autoLifeTimers[id] = setTimeout(function() {
          delete self._autoLifeTimers[id];
          self._autoLifeTick(id);
        }, reactDelay);
      });

    } catch(e) {
      console.warn('Auto-life tick failed for', member.name, e);
    }

    // Reschedule this character
    this._autoLifeScheduleOne(memberId);
  },

  _updateAutoLifeIndicator() {
    var existing = document.getElementById('autolife-indicator');
    if (this._autoLifeActive && !this._autoLifePaused) {
      if (!existing) {
        var ind = document.createElement('span');
        ind.id = 'autolife-indicator';
        ind.style.cssText = 'font-family:"Press Start 2P",monospace;font-size:5px;color:#44cc66;padding:0 6px;cursor:pointer;align-self:center;';
        ind.title = 'Auto-life ON — characters may talk on their own. Click to pause.';
        ind.textContent = '\u{1F7E2} LIVING';
        ind.addEventListener('click', function() { Chat.autoLifeTogglePause(); });
        var headerRight = document.getElementById('header-right');
        if (headerRight) headerRight.appendChild(ind);
      } else {
        existing.textContent = '\u{1F7E2} LIVING';
        existing.style.color = '#44cc66';
        existing.title = 'Auto-life ON — characters may talk on their own. Click to pause.';
      }
    } else if (this._autoLifeActive && this._autoLifePaused) {
      if (existing) {
        existing.textContent = '\u23F8 PAUSED';
        existing.style.color = '#aaaa44';
        existing.title = 'Auto-life paused. Click to resume.';
      }
    } else {
      if (existing) existing.remove();
    }
  },
  // ── Deduplication: reject responses too similar to recent messages ─────────
  _isDuplicate(reply) {
    var dominated = reply.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (!dominated) return false;
    var dominated_words = dominated.split(/\s+/);
    // Check last 5 assistant messages
    var recent = this.sharedHistory.slice(-10).filter(function(m) { return m.role === 'assistant'; }).slice(-5);
    for (var i = 0; i < recent.length; i++) {
      var prev = recent[i].content.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!prev) continue;
      // Exact match
      if (dominated === prev) return true;
      // High overlap: count shared words
      var prev_words = prev.split(/\s+/);
      var shared = 0;
      for (var j = 0; j < dominated_words.length; j++) {
        if (prev_words.indexOf(dominated_words[j]) !== -1) shared++;
      }
      var similarity = shared / Math.max(dominated_words.length, 1);
      if (similarity > 0.75) return true;
    }
    return false;
  },

  _esc(t) {
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
};








