// js/animation.js — enhanced character animation layer
// v2.14 — smooth interpolated motion, breathing, blinking, squash/stretch, shadow
// Drop-in replacement for CharRenderer. Activated per-member via member.enhanced = true.
// Falls back gracefully if drawPixelChar is missing.

(function(global){
  'use strict';

  var CHAR_W = 48;
  var CHAR_H = 72;
  var ENHANCED_PAD = 10;  // padding for jump height, head tilt, squash

  // ── Easing functions ────────────────────────────────────────────────────────
  function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; }
  function easeOut(t)   { return 1 - (1-t) * (1-t); }
  function easeIn(t)    { return t * t; }

  // ── Animation profiles ──────────────────────────────────────────────────────
  // Each entry describes the overall motion shape for an animation.
  // We still render via the existing drawPixelChar using poses 0-4, but we
  // apply sub-pixel transforms, timing curves, and overlays on top.
  var PROFILES = {
    idle: {
      duration: 4000,          // full loop ms
      poseFor: function(t){
        // subtle shift to talk-lean occasionally? No — keep idle pure.
        return 0;
      },
      bobY: function(t){
        // gentle breathing — 4s cycle, ±0.6px
        return Math.sin(t * Math.PI * 2) * 0.6;
      },
      scaleY: function(t){
        // chest rise — tiny vertical expansion on inhale
        return 1 + Math.sin(t * Math.PI * 2) * 0.008;
      },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    walk: {
      duration: 600,            // full step cycle
      poseFor: function(t){
        // cycle through 1 → 0 → 2 → 0 (matches original walk keys)
        if (t < 0.25) return 1;
        if (t < 0.5)  return 0;
        if (t < 0.75) return 2;
        return 0;
      },
      bobY: function(t){
        // two footfalls per cycle — abs(sin) gives the characteristic walk-bob
        return -Math.abs(Math.sin(t * Math.PI * 2)) * 1.8;
      },
      scaleY: function(t){
        // slight squash on footfall
        var fall = Math.abs(Math.cos(t * Math.PI * 2));
        return 1 - (1 - fall) * 0.04;
      },
      scaleX: function(t){
        var fall = Math.abs(Math.cos(t * Math.PI * 2));
        return 1 + (1 - fall) * 0.03;
      },
      shadowScale: function(t){
        return 1 - Math.abs(Math.sin(t * Math.PI * 2)) * 0.15;
      },
    },
    talk: {
      duration: 2200,
      poseFor: function(t){
        // subtle lean in & out — pose 3 is the lean
        return (t < 0.55) ? 3 : 0;
      },
      bobY: function(t){
        return Math.sin(t * Math.PI * 2) * 0.8;
      },
      scaleY: function(t){
        return 1 + Math.sin(t * Math.PI * 4) * 0.012;
      },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    // Action profiles — short, punchy, with anticipation + follow-through
    jump: {
      duration: 900,
      oneshot: true,
      poseFor: function(t){
        if (t < 0.15) return 0;   // anticipation crouch (via scaleY)
        if (t < 0.75) return 4;   // airborne — arms up
        return 0;                 // land
      },
      bobY: function(t){
        if (t < 0.15) return 2 * easeOut(t/0.15);        // dip down
        if (t < 0.75) {
          // parabolic arc — peak at midpoint
          var p = (t - 0.15) / 0.6;
          return -18 * Math.sin(p * Math.PI);
        }
        return 1.5 * (1 - easeOut((t - 0.75)/0.25));      // land squash recovery
      },
      scaleY: function(t){
        if (t < 0.15) return 1 - easeOut(t/0.15) * 0.15;  // crouch squish
        if (t < 0.75) return 1 + 0.05;                    // stretched in air
        return 1 - 0.12 * (1 - easeOut((t - 0.75)/0.25)); // land squash
      },
      scaleX: function(t){
        if (t < 0.15) return 1 + easeOut(t/0.15) * 0.12;
        if (t < 0.75) return 1 - 0.04;
        return 1 + 0.1 * (1 - easeOut((t - 0.75)/0.25));
      },
      shadowScale: function(t){
        if (t < 0.75 && t > 0.15) {
          var p = (t - 0.15) / 0.6;
          return 1 - Math.sin(p * Math.PI) * 0.6;
        }
        return 1;
      },
    },
    nod: {
      duration: 700,
      oneshot: true,
      poseFor: function(){ return 0; },
      bobY: function(t){
        // two nods
        return Math.sin(t * Math.PI * 4) * 1.5;
      },
      headTilt: function(t){
        return Math.sin(t * Math.PI * 4) * 3;  // degrees — whole-body sway
      },
      scaleY: function(t){ return 1; },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    shake: {
      duration: 700,
      oneshot: true,
      poseFor: function(){ return 0; },
      bobY: function(){ return 0; },
      offsetX: function(t){
        return Math.sin(t * Math.PI * 6) * 2;
      },
      headTilt: function(t){
        return Math.sin(t * Math.PI * 6) * 2;
      },
      scaleY: function(t){ return 1; },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    wave: {
      duration: 1200,
      oneshot: true,
      poseFor: function(t){
        if (t < 0.1) return 0;
        return 4;
      },
      bobY: function(t){
        return Math.sin(t * Math.PI * 4) * 0.5;
      },
      scaleY: function(t){ return 1; },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    shrug: {
      duration: 900,
      oneshot: true,
      poseFor: function(t){
        return (t > 0.25 && t < 0.75) ? 4 : 0;
      },
      bobY: function(t){
        if (t > 0.25 && t < 0.75) return -1.5;
        return 0;
      },
      scaleY: function(t){ return 1; },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    spin: {
      duration: 900,
      oneshot: true,
      poseFor: function(){ return 0; },
      bobY: function(t){ return -Math.sin(t * Math.PI) * 3; },
      scaleX: function(t){
        // horizontal squash to fake rotation
        return Math.cos(t * Math.PI * 2);
      },
      scaleY: function(t){ return 1; },
      shadowScale: function(t){ return 1 - Math.sin(t * Math.PI) * 0.2; },
    },
    think: {
      duration: 1600,
      oneshot: true,
      poseFor: function(t){
        return (t > 0.15 && t < 0.85) ? 4 : 0;
      },
      bobY: function(t){ return 0; },
      headTilt: function(t){
        if (t > 0.15 && t < 0.85) return -3;
        return 0;
      },
      scaleY: function(t){ return 1; },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    facepalm: {
      duration: 1100,
      oneshot: true,
      poseFor: function(t){
        if (t < 0.2) return 0;
        if (t < 0.85) return 4;
        return 0;
      },
      bobY: function(t){
        if (t > 0.2 && t < 0.85) return 1;
        return 0;
      },
      headTilt: function(t){
        if (t > 0.2 && t < 0.85) return 4;
        return 0;
      },
      scaleY: function(t){ return 1; },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    point: {
      duration: 800,
      oneshot: true,
      poseFor: function(t){
        return (t > 0.15) ? 4 : 0;
      },
      bobY: function(){ return 0; },
      scaleY: function(t){ return 1; },
      scaleX: function(t){ return 1; },
      shadowScale: function(t){ return 1; },
    },
    bow: {
      duration: 1300,
      oneshot: true,
      pivotY: -30,  // rotate around waist — feet stay planted
      poseFor: function(){ return 0; },
      bobY: function(t){
        // bend forward & return
        if (t < 0.5) return easeInOut(t * 2) * 5;
        return 5 * easeInOut(1 - (t - 0.5) * 2);
      },
      scaleY: function(t){
        if (t < 0.5) return 1 - easeInOut(t * 2) * 0.06;
        return 1 - easeInOut(1 - (t - 0.5) * 2) * 0.06;
      },
      scaleX: function(t){ return 1; },
      headTilt: function(t){
        if (t < 0.5) return easeInOut(t * 2) * 12;
        return 12 * easeInOut(1 - (t - 0.5) * 2);
      },
      shadowScale: function(t){ return 1; },
    },
    dance: {
      duration: 1800,
      oneshot: true,
      poseFor: function(t){
        // alternate walk poses rapidly
        var phase = (t * 8) % 2;
        return phase < 1 ? 1 : 2;
      },
      bobY: function(t){
        return -Math.abs(Math.sin(t * Math.PI * 8)) * 2;
      },
      scaleX: function(t){
        return 1 + Math.sin(t * Math.PI * 4) * 0.04;
      },
      scaleY: function(t){
        return 1 - Math.abs(Math.cos(t * Math.PI * 8)) * 0.03;
      },
      offsetX: function(t){
        return Math.sin(t * Math.PI * 4) * 1.5;
      },
      shadowScale: function(t){ return 1; },
    },
    stomp: {
      duration: 800,
      oneshot: true,
      poseFor: function(t){
        if (t < 0.3) return 4;   // raise
        if (t < 0.45) return 1;  // stomp down
        return 0;
      },
      bobY: function(t){
        if (t < 0.3) return -3 * easeOut(t/0.3);
        if (t < 0.45) return -3 + 3 * easeIn((t - 0.3)/0.15) + 2;
        return 2 * (1 - easeOut((t - 0.45)/0.55));
      },
      scaleY: function(t){
        if (t > 0.45 && t < 0.55) return 0.9;
        return 1;
      },
      scaleX: function(t){
        if (t > 0.45 && t < 0.55) return 1.08;
        return 1;
      },
      shadowScale: function(t){ return 1; },
    },
  };

  // Map action names to profile names (fall back to 'jump' for unknowns)
  function profileForAction(actionName) {
    if (PROFILES[actionName]) return actionName;
    return 'jump';
  }

  // ── EnhancedCharRenderer ────────────────────────────────────────────────────
  function EnhancedCharRenderer(member, canvas) {
    this.member = member;
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._flip  = false;
    this._anim  = 'idle';
    this._rafId = null;
    this._startTs = performance.now();
    this._onDone  = null;
    this._oneshotProfile = null;

    // Palette setup (mirrors CharRenderer)
    this._roleType = (typeof detectRoleType === 'function') ? detectRoleType(member.role || '') : 'default';
    this._pal = (typeof getRoleColors === 'function')
      ? Object.assign(getRoleColors(this._roleType, member.colorIdx || 0), { roleType: this._roleType })
      : { roleType: this._roleType };

    // Blink state — random intervals
    this._nextBlinkAt = performance.now() + 2000 + Math.random() * 3000;
    this._blinkStart  = 0;
    this._blinking    = false;

    // Padding inside the canvas allows head-tilt, squash/stretch, and jump
    // height to render without clipping. The caller (world.js) is responsible
    // for creating a canvas sized to CHAR_W + PAD*2 × CHAR_H + PAD*2 when
    // using EnhancedCharRenderer (see EnhancedCharRenderer.PAD).
    this._pad = ENHANCED_PAD;
    // Defensive fallback: if caller gave us the default 48×72 canvas,
    // silently grow it and scale CSS to match visual size.
    if (canvas.width === CHAR_W && canvas.height === CHAR_H) {
      var cssW = canvas.style.width  ? parseFloat(canvas.style.width)  : 0;
      var cssH = canvas.style.height ? parseFloat(canvas.style.height) : 0;
      canvas.width  = CHAR_W + this._pad * 2;
      canvas.height = CHAR_H + this._pad * 2;
      if (cssW && cssH) {
        canvas.style.width  = (cssW * canvas.width  / CHAR_W) + 'px';
        canvas.style.height = (cssH * canvas.height / CHAR_H) + 'px';
      }
    }

    this._draw();
    this._start();
  }

  EnhancedCharRenderer.prototype._start = function() {
    if (this._rafId) return;
    var self = this;
    var tick = function(){
      self._draw();
      self._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  };

  EnhancedCharRenderer.prototype._stop = function() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  };

  EnhancedCharRenderer.prototype._currentProfile = function() {
    if (this._oneshotProfile) return PROFILES[this._oneshotProfile];
    return PROFILES[this._anim] || PROFILES.idle;
  };

  EnhancedCharRenderer.prototype._draw = function() {
    var ctx = this.ctx;
    var now = performance.now();
    var elapsed = now - this._startTs;
    var profile = this._currentProfile();
    var dur = profile.duration || 1000;

    // Progress through the animation (0..1 looping, or 0..1 oneshot)
    var t;
    if (profile.oneshot) {
      t = Math.min(1, elapsed / dur);
    } else {
      t = (elapsed % dur) / dur;
    }

    // Clear full canvas (including padding)
    var FW = this.canvas.width;
    var FH = this.canvas.height;
    ctx.clearRect(0, 0, FW, FH);

    // Compute transform values
    var pose    = profile.poseFor ? profile.poseFor(t) : 0;
    var bobY    = profile.bobY    ? profile.bobY(t)    : 0;
    var offsetX = profile.offsetX ? profile.offsetX(t) : 0;
    var scaleX  = profile.scaleX  ? profile.scaleX(t)  : 1;
    var scaleY  = profile.scaleY  ? profile.scaleY(t)  : 1;
    var tilt    = profile.headTilt ? profile.headTilt(t) : 0;
    var shadowScale = profile.shadowScale ? profile.shadowScale(t) : 1;

    // ── Draw shadow (reacts to bob for jumps) ──────────────────────────────
    var shadowY = this._pad + CHAR_H - 1;
    var shadowW = 24 * shadowScale;
    var shadowOpacity = 0.22 * shadowScale;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + shadowOpacity.toFixed(3) + ')';
    // Pixel-art ellipse — 3 stacked rects for a soft look
    var scx = this._pad + (CHAR_W / 2);
    ctx.fillRect(Math.round(scx - shadowW/2),     shadowY - 1, Math.round(shadowW),     1);
    ctx.fillRect(Math.round(scx - shadowW/2 + 2), shadowY,     Math.round(shadowW - 4), 1);
    ctx.restore();

    // ── Draw character with transforms ─────────────────────────────────────
    ctx.save();
    // Translate to character origin (include padding + bob + offsetX)
    var cx = this._pad + CHAR_W / 2;
    var cy = this._pad + CHAR_H;
    ctx.translate(cx + offsetX, cy + bobY);

    // Scale from feet (we already translated to foot center)
    ctx.scale(scaleX, scaleY);

    // Head tilt — we rotate around a point above feet. Default ≈ neck.
    // Some actions (bow) specify a lower pivot (waist) via profile.pivotY.
    if (tilt) {
      var pivotY = -52;  // default: neck height from feet
      if (profile.pivotY !== undefined) {
        pivotY = (typeof profile.pivotY === 'function') ? profile.pivotY(t) : profile.pivotY;
      }
      ctx.translate(0, pivotY);
      ctx.rotate(tilt * Math.PI / 180);
      ctx.translate(0, -pivotY);
    }

    // Translate so drawPixelChar draws character centered horizontally, feet at y=0
    ctx.translate(-CHAR_W / 2, -CHAR_H);

    // Use a scratch canvas to draw the base character, so we can overlay blink on top
    if (!this._scratch) {
      this._scratch = document.createElement('canvas');
      this._scratch.width = CHAR_W;
      this._scratch.height = CHAR_H;
    }
    var sctx = this._scratch.getContext('2d');
    sctx.clearRect(0, 0, CHAR_W, CHAR_H);

    if (typeof drawPixelChar === 'function') {
      drawPixelChar(sctx, this._pal, Math.round(pose), { flip: this._flip, roleType: this._roleType });
    }

    // Blinking overlay — paint a 2px dark line across eyes area
    this._updateBlink(now);
    if (this._blinking) {
      // Eyes on humans sit around y = 12-14 of the 72px char. For animals/robots we skip.
      if (!this._roleType.startsWith('animal_') && this._roleType !== 'robot') {
        var eyeY = 13;
        // Match the skin shadow tone if available, else dark grey
        sctx.fillStyle = this._pal.skinD || '#2a1808';
        // Left eye area
        sctx.fillRect(CHAR_W/2 - 8, eyeY, 5, 2);
        sctx.fillRect(CHAR_W/2 + 3, eyeY, 5, 2);
      }
    }

    ctx.drawImage(this._scratch, 0, 0);
    ctx.restore();

    // ── Oneshot completion ────────────────────────────────────────────────
    if (profile.oneshot && t >= 1) {
      var cb = this._onDone;
      this._onDone = null;
      this._oneshotProfile = null;
      this._anim = 'idle';
      this._startTs = now;
      if (cb) cb();
    }
  };

  EnhancedCharRenderer.prototype._updateBlink = function(now) {
    if (this._blinking) {
      if (now - this._blinkStart > 120) {
        this._blinking = false;
        this._nextBlinkAt = now + 2500 + Math.random() * 4000;
      }
    } else if (now >= this._nextBlinkAt) {
      this._blinking = true;
      this._blinkStart = now;
    }
  };

  // ── Public API (matches CharRenderer) ─────────────────────────────────────
  EnhancedCharRenderer.prototype.still = function() {
    this._anim = 'idle';
    this._oneshotProfile = null;
    this._onDone = null;
    this._startTs = performance.now();
  };

  EnhancedCharRenderer.prototype.switchAnim = function(animName, flip) {
    if (flip !== undefined) this._flip = !!flip;
    // Map legacy anim names
    if (animName === 'action') animName = 'jump';
    if (!PROFILES[animName]) animName = 'idle';
    this._anim = animName;
    this._oneshotProfile = null;
    this._startTs = performance.now();
  };

  EnhancedCharRenderer.prototype.playOnce = function(animOrAction, onDone) {
    var key = profileForAction(animOrAction);
    // Generic 'action' without specific name → jump
    if (animOrAction === 'action') key = 'jump';
    this._oneshotProfile = key;
    this._onDone = onDone || null;
    this._startTs = performance.now();
  };

  EnhancedCharRenderer.prototype.setFlip = function(flip) {
    this._flip = !!flip;
  };

  EnhancedCharRenderer.prototype.destroy = function() {
    this._stop();
  };

  // Expose
  EnhancedCharRenderer.PAD = 10;  // padding for jump height, head tilt, squash
  global.EnhancedCharRenderer = EnhancedCharRenderer;
  global.EnhancedCharProfiles = PROFILES;

})(typeof window !== 'undefined' ? window : this);
