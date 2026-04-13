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
  },

  closePanel() {
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

    var briefingCtx = (App.state.briefing && App.state.briefing.trim())
      ? 'PROJECT CONTEXT: ' + App.state.briefing : '';

    var artifactCtx = (typeof WorldObjects !== 'undefined') ? WorldObjects.getContextString(World.currentRoom) : '';
    // If there are artifacts, make it clear characters should engage with them
    if (artifactCtx) {
      artifactCtx += '\n\nYou are AWARE of everything above. You can: talk about it, critique it, build on it, refer to it by name, ask questions about it, suggest improvements, or update it using [UPDATE_ARTIFACT:id|note|new content] or rebuild a widget using [WIDGET:title]...html...[/WIDGET].';
    }
    var artifactCreateCtx = 'You can create persistent artifacts using [ARTIFACT:type|title|content] — types: note, doc, plan, code, idea, list, decision. ' +
      'IMPORTANT — for anything interactive or visual, use the WIDGET format: [WIDGET:title]...complete HTML...[/WIDGET] ' +
      'A widget is a full self-contained HTML page with inline CSS+JS. No external dependencies. Dark background (#0a0820 or similar). ' +
      'If someone wants a clock — write a real ticking clock in HTML/JS with setInterval. A timer, calculator, colour picker, dice, game — build the actual thing that works. ' +
      'The HTML goes between [WIDGET:My Title] and [/WIDGET] — this format is safe and handles all HTML characters correctly. ' +
      'Make widgets compact, beautiful and functional. ' +
      'Update existing artifacts with [UPDATE_ARTIFACT:id|what changed|new full content].';

    var system = [
      'You are ' + member.name + ', a team member. Role: ' + (member.role || 'team member') + '.',
      'Personality: ' + member.personality + '.',
      charCtx,
      roomCtx,
      groupCtx,
      briefingCtx,
      memoryCtx,
      artifactCtx,
      summonCtx,
      artifactCreateCtx,
      actionCtx,
      'Keep responses SHORT (2-3 sentences unless creating an artifact). Stay in character. Never break character. Do not prefix your reply with your own name.',
    ].filter(Boolean).join(' ');

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
          body: JSON.stringify({ pin: App.pin, model: 'claude-sonnet-4-6', max_tokens: 1000, system: system, messages: messages })
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
        // Strip all tags from visible reply
        reply = reply
          .replace(/\[WIDGET:[^\]]+\][\s\S]*?\[\/WIDGET\]\s*/g, '')
          .replace(/\[ARTIFACT:\w+\|[^|]+\|[^\]]+\]\s*/g, '')
          .replace(/\[UPDATE_ARTIFACT:[^\]]+\]\s*/g, '')
          .trim();
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
          body: JSON.stringify({ pin: App.pin, model: 'claude-sonnet-4-6', max_tokens: 60, system: 'Reply with a single short sentence only.', messages: [{ role: 'user', content: prompt }] })
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
            body: JSON.stringify({ pin: App.pin, model: 'claude-sonnet-4-6', max_tokens: 300, system: summarySystem, messages: [{ role: 'user', content: transcript }] })
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

  _esc(t) {
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
};




