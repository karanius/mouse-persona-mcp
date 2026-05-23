(function() {
  'use strict';

  // ── Config (injected as __MP_CONFIG__ by overlay.ts, fallback to defaults) ──
  var _cfg = (typeof __MP_CONFIG__ !== 'undefined') ? __MP_CONFIG__ : {};
  var _t = _cfg.timing || {};
  var _s = _cfg.style || {};
  var _sc = _cfg.scroll || {};
  var _fb = _t.feedbackWait || {};
  var _ts = _t.typingSpeed || {};
  var _badge = _s.badge || {};
  var _bubble = _s.bubble || {};
  var _narr = _s.narrator || {};

  var CFG_GLIDE_MS = _t.glideDurationMs || 600;
  var CFG_COMMENT_GLIDE_MS = _t.commentGlideMs || 400;
  var CFG_THOUGHT_MS = _t.thoughtDurationMs || 4000;
  var CFG_HUMAN_MS = _t.humanPauseMs || 5000;
  var CFG_FEEDBACK_CLICK_MS = _fb.clickMs || 2000;
  var CFG_FEEDBACK_FILL_MS = _fb.fillMs || 500;
  var CFG_TYPE_MIN = _ts.minMs || 30;
  var CFG_TYPE_MAX = _ts.maxMs || 70;
  var CFG_ACTION_TIMEOUT = _t.actionTimeoutMs || 15000;
  var CFG_SCENE_TIMEOUT = _t.sceneTimeoutMs || 90000;
  var CFG_SAFE_TOP = _sc.safeZoneTop || 0.30;
  var CFG_SAFE_BOT = _sc.safeZoneBottom || 0.60;
  var CFG_RIPPLE_COLOR = _s.rippleColor || '#ef4444';
  var CFG_HIGHLIGHT_COLOR = _s.highlightColor || '#22c55e';
  var CFG_HIGHLIGHT_MS = _s.highlightDurationMs || 3000;
  var CFG_BADGE_FROM = _badge.gradientFrom || '#6366f1';
  var CFG_BADGE_TO = _badge.gradientTo || '#8b5cf6';
  var CFG_BUBBLE_BG = _bubble.background || 'rgba(15,15,25,0.72)';
  var CFG_BUBBLE_BORDER = _bubble.borderColor || 'rgba(255,255,255,0.12)';
  var CFG_BUBBLE_TEXT = _bubble.textColor || 'rgba(255,255,255,0.93)';
  var CFG_BUBBLE_MAX_W = _bubble.maxWidth || 340;
  var CFG_BUBBLE_RADIUS = _bubble.borderRadius || 14;
  var CFG_BUBBLE_FONT = _bubble.fontSize || '13.5px';
  var CFG_BUBBLE_BLUR = _bubble.blurPx || 20;
  var CFG_NARR_BG = _narr.background || 'rgba(0,0,0,0.75)';
  var CFG_NARR_FONT = _narr.fontSize || '16px';

  var _cursorX = 0, _cursorY = 0;
  var _persona = '__MP_PERSONA_NAME__';
  var _root, _cursor, _label;
  var _injected = false;
  var _thoughtTimerId = null;
  var _thoughtTimeout = null;
  var _glideTimerId = null;
  var _glideResolve = null;
  var _recording = null;
  var _recordingStart = 0;
  var _humanPause = 0;
  var _mpClickInProgress = false;
  var _sessionTapes = [];
  var _tp = (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy)
    ? trustedTypes.createPolicy('mp-overlay', { createHTML: function(s) { return s; } })
    : { createHTML: function(s) { return s; } };
  function _html(el, s) { el.innerHTML = _tp.createHTML(s); }

  // ── Timeout helpers ──
  var _sceneProgress = { results: [], currentStep: -1, totalSteps: 0, currentLabel: '' };

  function _raceTimeout(promise, ms, label) {
    return new Promise(function(resolve, reject) {
      var done = false;
      var timer = setTimeout(function() {
        if (!done) { done = true; resolve({ __timeout: true, ms: ms, label: label }); }
      }, ms);
      promise.then(function(v) {
        if (!done) { done = true; clearTimeout(timer); resolve(v); }
      }, function(e) {
        if (!done) { done = true; clearTimeout(timer); reject(e); }
      });
    });
  }

  function _stepLabel(s) {
    if (s.click) return '! ' + (s.click.match || s.click.text || JSON.stringify(s.click));
    if (s.fill) return '= ' + ((typeof s.fill === 'string' ? s.fill : s.fill.match || s.fill.text || '') + ' | ' + (s.value || '')).substring(0, 60);
    if (s.thought) return '" ' + s.thought.substring(0, 50);
    if (s.match) return '@ ' + s.match;
    if (s.narrate !== undefined) return '> ' + (s.narrate || '').substring(0, 50);
    if (s.wait) return '~ ' + s.wait;
    if (s.clear) return '.';
    return '?';
  }

  // ── Observability collectors ──
  var _netLog = [], _toastLog = [], _urlLog = [], _errorLog = [];
  var _lastUrl = (typeof location !== 'undefined') ? location.href : '';

  // Network interceptor (fetch)
  var _origFetch = window.fetch;
  if (_origFetch) {
    window.fetch = function() {
      var args = arguments;
      var method = 'GET', url = '';
      if (typeof args[0] === 'string') { url = args[0]; }
      else if (args[0] && args[0].url) { url = args[0].url; }
      if (args[1] && args[1].method) method = args[1].method;
      return _origFetch.apply(this, args).then(function(response) {
        var entry = { method: method, url: url, status: response.status, body: '', ts: performance.now() };
        try {
          response.clone().text().then(function(t) { entry.body = t.slice(0, 500); });
        } catch(e) { entry.body = '(unreadable)'; }
        _netLog.push(entry);
        if (_netLog.length > 100) _netLog.shift();
        return response;
      });
    };
  }

  // Network interceptor (XHR)
  var _origXHROpen = XMLHttpRequest.prototype.open;
  var _origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._mpMethod = method;
    this._mpUrl = url;
    return _origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    var xhr = this;
    xhr.addEventListener('load', function() {
      var ct = (xhr.getResponseHeader('content-type') || '');
      var body = (ct.indexOf('text') !== -1 || ct.indexOf('json') !== -1) ? (xhr.responseText || '').slice(0, 500) : '(binary)';
      _netLog.push({ method: xhr._mpMethod || '?', url: xhr._mpUrl || '?', status: xhr.status, body: body, ts: performance.now() });
      if (_netLog.length > 100) _netLog.shift();
    });
    return _origXHRSend.apply(this, arguments);
  };

  // Console error capture
  var _origConsoleError = console.error;
  console.error = function() {
    _errorLog.push({ msg: Array.prototype.slice.call(arguments).join(' ').slice(0, 500), ts: performance.now() });
    if (_errorLog.length > 100) _errorLog.shift();
    return _origConsoleError.apply(console, arguments);
  };
  window.addEventListener('error', function(e) {
    _errorLog.push({ msg: (e.message || '') + ' at ' + (e.filename || '') + ':' + (e.lineno || ''), ts: performance.now() });
  });
  window.addEventListener('unhandledrejection', function(e) {
    _errorLog.push({ msg: 'Unhandled rejection: ' + ((e.reason && e.reason.message) || String(e.reason)).slice(0, 500), ts: performance.now() });
  });

  // URL change tracker
  var _origPushState = history.pushState;
  var _origReplaceState = history.replaceState;
  function _logUrlChange() {
    var cur = location.href;
    if (cur !== _lastUrl) {
      _urlLog.push({ from: _lastUrl, to: cur, ts: performance.now() });
      if (_urlLog.length > 50) _urlLog.shift();
      _lastUrl = cur;
    }
  }
  history.pushState = function() { var r = _origPushState.apply(this, arguments); _logUrlChange(); return r; };
  history.replaceState = function() { var r = _origReplaceState.apply(this, arguments); _logUrlChange(); return r; };
  window.addEventListener('popstate', _logUrlChange);
  window.addEventListener('hashchange', _logUrlChange);

  // Feedback helpers
  function _snapshotFeedback(sinceTs) {
    var cutoff = performance.now() - 30000;
    _netLog = _netLog.filter(function(e) { return e.ts > cutoff; });
    _toastLog = _toastLog.filter(function(e) { return e.ts > cutoff; });
    _errorLog = _errorLog.filter(function(e) { return e.ts > cutoff; });
    _urlLog = _urlLog.filter(function(e) { return e.ts > cutoff; });

    var urlChange = null;
    for (var i = _urlLog.length - 1; i >= 0; i--) {
      if (_urlLog[i].ts >= sinceTs) { urlChange = _urlLog[i]; break; }
    }
    return {
      network: _netLog.filter(function(e) { return e.ts >= sinceTs; }),
      toasts: _toastLog.filter(function(e) { return e.ts >= sinceTs; }),
      url: urlChange,
      errors: _errorLog.filter(function(e) { return e.ts >= sinceTs; })
    };
  }

  function _verifyFill(el, expected) {
    var actual = el.value;
    var validationError = null;
    if (el.getAttribute('aria-invalid') === 'true') validationError = 'aria-invalid';
    if (!validationError) {
      var cls = (el.className || '').toString();
      var m = cls.match(/\b\S*(error|invalid)\S*\b/i);
      if (m) validationError = m[0];
    }
    return { value: actual, expected: expected, match: actual === expected, validationError: validationError };
  }

  function _verifyClick(el, urlBefore, headingBefore) {
    var wasDisabled = !!(el.disabled || el.getAttribute('aria-disabled') === 'true');
    var urlChanged = location.href !== urlBefore;
    var h = document.querySelector('h1,h2');
    var newHeading = null;
    if (h) {
      var cur = h.textContent.trim();
      if (cur !== headingBefore) newHeading = cur;
    }
    return { wasDisabled: wasDisabled, urlChanged: urlChanged, newHeading: newHeading };
  }

  function _waitForFeedback(sinceTs, waitMs) {
    return new Promise(function(resolve) {
      setTimeout(function() { resolve(_snapshotFeedback(sinceTs)); }, waitMs || 2000);
    });
  }

  function injectOverlay() {
    if (_injected) return;
    if (!document.body) return;

    var existingRoot = document.getElementById('cursor-overlay-root');
    if (existingRoot) {
      // Re-adopt existing DOM created by a prior injection (e.g. CDP double-eval).
      // Without this, _root stays undefined and think() silently no-ops.
      _root = existingRoot;
      _cursor = document.getElementById('custom-cursor');
      _label = document.getElementById('cursor-label');
      _injected = true;
      return;
    }
    _injected = true;

    _root = document.createElement('div');
    _root.id = 'cursor-overlay-root';
    _root.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(_root);

    // Toast/notification detector
    if (typeof MutationObserver !== 'undefined') {
      var toastObs = new MutationObserver(function(mutations) {
        for (var m = 0; m < mutations.length; m++) {
          for (var n = 0; n < mutations[m].addedNodes.length; n++) {
            var node = mutations[m].addedNodes[n];
            if (!node.getAttribute || !node.textContent) continue;
            if (_root && _root.contains(node)) continue;
            var role = node.getAttribute('role') || '';
            var ariaLive = node.getAttribute('aria-live') || '';
            var cls = (node.className || '').toString().toLowerCase();
            if (role === 'alert' || ariaLive === 'assertive' || ariaLive === 'polite' ||
                /toast|notification|snackbar|alert|error|message/i.test(cls)) {
              var txt = node.textContent.trim().slice(0, 300);
              if (txt.length > 2) {
                var type = 'unknown';
                var combined = (cls + ' ' + txt).toLowerCase();
                if (combined.indexOf('error') !== -1 || combined.indexOf('fail') !== -1 || combined.indexOf('invalid') !== -1) type = 'error';
                else if (combined.indexOf('success') !== -1 || combined.indexOf('created') !== -1) type = 'success';
                else if (combined.indexOf('warn') !== -1) type = 'warning';
                else if (combined.indexOf('info') !== -1) type = 'info';
                _toastLog.push({ text: txt, type: type, ts: performance.now() });
                if (_toastLog.length > 50) _toastLog.shift();
              }
            }
          }
        }
      });
      toastObs.observe(document.body, { childList: true, subtree: true });
    }

    _cursor = document.createElement('div');
    _cursor.id = 'custom-cursor';
    _html(_cursor, '<svg width="28" height="34" viewBox="0 0 28 34" fill="none"><g filter="url(#mp-shadow)"><path d="M4 2L4 26L9.5 20.5L14.5 30L18 28.5L13 19H20L4 2Z" fill="white" stroke="rgba(0,0,0,0.15)" stroke-width="1.2" stroke-linejoin="round"/></g><defs><filter id="mp-shadow" x="-4" y="-2" width="36" height="42" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.15"/></filter></defs></svg>');
    _cursor.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:100001;will-change:transform;';
    _root.appendChild(_cursor);

    _label = document.createElement('div');
    _label.id = 'cursor-label';
    _label.textContent = _persona;
    _label.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:100000;will-change:transform;background:rgba(245,245,248,0.92);backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);border:1px solid rgba(99,102,241,0.15);color:#6366f1;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:11px;font-weight:600;letter-spacing:0.3px;padding:3px 10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);white-space:nowrap;';
    _root.appendChild(_label);

    var css = document.createElement('style');
    css.textContent = [
      '* { cursor: none !important; }',
      '@keyframes mp-ripple { 0% { transform:scale(0);opacity:0.6 } 50% { transform:scale(1);opacity:0.25 } 100% { transform:scale(1.5);opacity:0 } }',
      '@keyframes mp-ripple-inner { 0% { transform:scale(0);opacity:0.8 } 100% { transform:scale(1);opacity:0 } }',
      '.mp-ripple { position:fixed;width:50px;height:50px;border-radius:50%;border:2px solid rgba(99,102,241,0.5);pointer-events:none;z-index:100002;animation:mp-ripple 0.7s ease-out forwards; }',
      '.mp-ripple-inner { position:fixed;width:14px;height:14px;border-radius:50%;background:rgba(99,102,241,0.6);pointer-events:none;z-index:100002;animation:mp-ripple-inner 0.5s ease-out forwards; }',
      '@keyframes mp-thought-in { 0% { transform:scale(0.97) translateY(4px);opacity:0 } 100% { transform:scale(1) translateY(0);opacity:1 } }',
      '.mp-thought { position:fixed;pointer-events:none;z-index:100003;background:rgba(245,245,248,0.92);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:14px 18px;box-shadow:0 4px 24px rgba(0,0,0,0.1),0 1px 3px rgba(0,0,0,0.06);font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",sans-serif;font-size:13.5px;font-weight:400;font-style:normal;letter-spacing:0.1px;color:#2c2c2e;max-width:360px;line-height:1.55;opacity:0;overflow:visible; }',
      '.mp-thought.visible { animation:mp-thought-in 0.25s cubic-bezier(0.2,0,0,1) forwards; }',
      '.mp-thought .mp-ptr { position:absolute;pointer-events:none;z-index:-1;width:14px;height:14px;background:rgba(245,245,248,0.92);border:1px solid rgba(0,0,0,0.06);border-top:none;border-left:none;transform:rotate(45deg);box-shadow:2px 2px 4px rgba(0,0,0,0.04); }',
      '.mp-thought .mp-ptr-down { }',
      '.mp-thought .mp-ptr-up { transform:rotate(-135deg); }',
      '.mp-narrate { position:fixed;bottom:0;left:0;right:0;pointer-events:none;z-index:100004;background:rgba(245,245,248,0.92);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);border-top:1px solid rgba(0,0,0,0.06);color:#2c2c2e;padding:12px 32px;font-family:-apple-system,\"SF Pro Text\",sans-serif;font-size:14px;font-weight:500;text-align:center;letter-spacing:0.2px;box-shadow:0 -4px 20px rgba(0,0,0,0.06);transition:opacity 0.3s ease; }'
    ].join('\n');

    (document.head || document.documentElement).appendChild(css);

    document.addEventListener('click', function(e) {
      if (_mpClickInProgress) return;
      if (e.target && e.target !== document && e.target !== document.body) {
        var r = e.target.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        window.__mp.moveCursor(x, y);
        window.__mp.ripple(x, y);
        window.__mp.highlight(e.target);
      }
    }, true);

    document.addEventListener('focusin', function(e) {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) !== -1) {
        var r = e.target.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        window.__mp.moveCursor(x, y);
      }
    }, true);

    _cursorX = window.innerWidth / 2;
    _cursorY = window.innerHeight / 2;
    window.__mp.moveCursor(_cursorX, _cursorY);
  }

  // Scroll element into the safe zone (30%-60% of viewport) so the thought
  // bubble always fits above or below the cursor. Returns a Promise that
  // resolves only after scroll settles AND element is verified inside the
  // safe zone (with one corrective retry if smooth scroll over/undershot).
  var _SAFE_TOP = CFG_SAFE_TOP, _SAFE_BOT = CFG_SAFE_BOT;

  function _inSafeZone(el) {
    var vh = window.innerHeight;
    var r = el.getBoundingClientRect();
    var mid = r.top + r.height / 2;
    return mid >= vh * _SAFE_TOP && mid <= vh * _SAFE_BOT;
  }

  function _waitScrollStable(el) {
    return new Promise(function(resolve) {
      var lastTop = el.getBoundingClientRect().top;
      var same = 0, polls = 0;
      function check() {
        polls++;
        var cur = el.getBoundingClientRect().top;
        if (Math.abs(cur - lastTop) < 1) same++; else same = 0;
        lastTop = cur;
        if (same >= 3 || polls >= 60) resolve();
        else setTimeout(check, 16);
      }
      setTimeout(check, 16);
    });
  }

  function _scrollForBubble(el) {
    if (_inSafeZone(el)) return Promise.resolve();
    var vh = window.innerHeight;
    var targetY = vh * 0.40;
    var r = el.getBoundingClientRect();
    var delta = (r.top + r.height / 2) - targetY;
    if (Math.abs(delta) > 5) window.scrollBy({ top: delta, behavior: 'smooth' });
    return _waitScrollStable(el).then(function() {
      if (!_inSafeZone(el)) {
        var r2 = el.getBoundingClientRect();
        var d2 = (r2.top + r2.height / 2) - targetY;
        if (Math.abs(d2) > 5) window.scrollBy({ top: d2, behavior: 'smooth' });
        return _waitScrollStable(el);
      }
    });
  }

  var _MATCH_TAGS = 'a,h1,h2,h3,h4,h5,h6,button,li,td,th,p,span,label,[role="link"],[role="button"]';

  function _findByText(match) {
    if (!match) return null;
    var needle = match.toLowerCase().replace(/\s+/g, ' ').trim();
    var els = document.querySelectorAll(_MATCH_TAGS);
    var exact = null, partial = null;
    for (var i = 0; i < els.length; i++) {
      var txt = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
      var low = txt.toLowerCase();
      if (low === needle) {
        if (!exact || txt.length < exact.textContent.replace(/\s+/g, ' ').trim().length) exact = els[i];
      } else if (low.indexOf(needle) !== -1) {
        if (!partial || txt.length < partial.textContent.replace(/\s+/g, ' ').trim().length) partial = els[i];
      }
    }
    return exact || partial || null;
  }

  function _findInput(match) {
    if (!match) return null;
    var needle = match.toLowerCase().replace(/\s+/g, ' ').trim();
    // 1. Search inputs/textareas/selects by placeholder, aria-label, name
    var inputs = document.querySelectorAll('input,textarea,select');
    for (var i = 0; i < inputs.length; i++) {
      var ph = (inputs[i].placeholder || '').toLowerCase().trim();
      var al = (inputs[i].getAttribute('aria-label') || '').toLowerCase().trim();
      var nm = (inputs[i].name || '').toLowerCase().trim();
      if (ph === needle || al === needle || nm === needle) return inputs[i];
      if (ph.indexOf(needle) !== -1 || al.indexOf(needle) !== -1) return inputs[i];
    }
    // 2. Find a label with that text, follow its `for` or find child/sibling input
    var labels = document.querySelectorAll('label');
    for (var j = 0; j < labels.length; j++) {
      var ltxt = (labels[j].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (ltxt === needle || ltxt.indexOf(needle) !== -1) {
        var forId = labels[j].getAttribute('for');
        if (forId) { var byId = document.getElementById(forId); if (byId) return byId; }
        var child = labels[j].querySelector('input,textarea,select');
        if (child) return child;
        var sib = labels[j].nextElementSibling;
        if (sib && /^(INPUT|TEXTAREA|SELECT)$/.test(sib.tagName)) return sib;
      }
    }
    // 3. Search by aria-labelledby
    for (var k = 0; k < inputs.length; k++) {
      var labelledBy = inputs[k].getAttribute('aria-labelledby');
      if (labelledBy) {
        var refEl = document.getElementById(labelledBy);
        if (refEl) {
          var refTxt = (refEl.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (refTxt === needle || refTxt.indexOf(needle) !== -1) return inputs[k];
        }
      }
    }
    return null;
  }

  function _resolveTarget(opts) {
    if (typeof opts === 'string') return document.querySelector(opts);
    if (opts.selector) return document.querySelector(opts.selector);
    var matchStr = opts.text || opts.match;
    if (matchStr) return _findByText(matchStr);
    return null;
  }

  function _cursorClick(x, y) {
    var target = document.elementFromPoint(x, y);
    if (!target) target = document.body;
    var opts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0 };
    target.dispatchEvent(new MouseEvent('mousemove', opts));
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.dispatchEvent(new MouseEvent('click', opts));
  }

  function _cursorType(el, text) {
    var chars = text.split('');
    var isSelect = el instanceof HTMLSelectElement;
    var proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var nativeSetter = isSelect ? null : Object.getOwnPropertyDescriptor(proto, 'value').set;
    var charIdx = 0;
    return new Promise(function(resolve) {
      function typeChar() {
        if (charIdx >= chars.length) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          resolve();
          return;
        }
        var ch = chars[charIdx];
        charIdx++;
        var partial = chars.slice(0, charIdx).join('');
        var kOpts = { bubbles: true, cancelable: true, key: ch, code: 'Key' + ch.toUpperCase(), charCode: ch.charCodeAt(0), keyCode: ch.charCodeAt(0) };
        el.dispatchEvent(new KeyboardEvent('keydown', kOpts));
        el.dispatchEvent(new KeyboardEvent('keypress', kOpts));
        if (isSelect) {
          el.value = partial;
        } else {
          var instDesc = Object.getOwnPropertyDescriptor(el, 'value');
          if (instDesc) delete el.value;
          nativeSetter.call(el, partial);
          if (instDesc) Object.defineProperty(el, 'value', instDesc);
        }
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
        el.dispatchEvent(new KeyboardEvent('keyup', kOpts));
        if (el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
        var typeDelay = _humanPause > 0 ? CFG_TYPE_MIN + Math.random() * (CFG_TYPE_MAX - CFG_TYPE_MIN) : 0;
        setTimeout(typeChar, typeDelay);
      }
      typeChar();
    });
  }

  window.__mp = {
    moveCursor: function(x, y) {
      _cursorX = x;
      _cursorY = y;
      if (_cursor) _cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (_label) _label.style.transform = 'translate(' + (x + 22) + 'px,' + (y + 18) + 'px)';
    },

    glideTo: function(x, y, duration) {
      duration = duration || CFG_GLIDE_MS;
      if (_glideTimerId) { clearTimeout(_glideTimerId); _glideTimerId = null; }
      if (_glideResolve) { _glideResolve(); _glideResolve = null; }
      var sx = _cursorX;
      var sy = _cursorY;
      var start = performance.now();
      return new Promise(function(resolve) {
        _glideResolve = resolve;
        function tick() {
          var now = performance.now();
          var elapsed = now - start;
          var t = Math.min(elapsed / duration, 1);
          t = 1 - Math.pow(1 - t, 3);
          window.__mp.moveCursor(sx + (x - sx) * t, sy + (y - sy) * t);
          if (t < 1) {
            _glideTimerId = setTimeout(tick, 16);
          } else {
            _glideTimerId = null;
            _glideResolve = null;
            resolve();
          }
        }
        _glideTimerId = setTimeout(tick, 16);
      });
    },

    ripple: function(x, y) {
      if (!_root) return;
      if (x === undefined) x = _cursorX;
      if (y === undefined) y = _cursorY;
      // Ripple elements use fully-inline styles (no dependency on the
      // <style> tag which may be blocked by CSP).  Animation is applied
      // AFTER append + forced reflow so Chromium sees a pre-animation
      // state and actually starts the keyframes.
      var r = document.createElement('div');
      r.style.cssText = 'position:fixed;width:50px;height:50px;border-radius:50%;border:2px solid rgba(99,102,241,0.5);pointer-events:none;z-index:100002;left:' + (x - 25) + 'px;top:' + (y - 25) + 'px;';
      _root.appendChild(r);
      void r.offsetWidth;
      r.style.animation = 'mp-ripple 0.7s ease-out forwards';

      var inner = document.createElement('div');
      inner.style.cssText = 'position:fixed;width:14px;height:14px;border-radius:50%;background:rgba(99,102,241,0.6);pointer-events:none;z-index:100002;left:' + (x - 7) + 'px;top:' + (y - 7) + 'px;';
      _root.appendChild(inner);
      void inner.offsetWidth;
      inner.style.animation = 'mp-ripple-inner 0.5s ease-out forwards';

      setTimeout(function() { r.remove(); inner.remove(); }, 800);
    },

    highlight: function(el) {
      if (!el) return;
      el.style.outline = '2px solid rgba(99,102,241,0.4)';
      el.style.outlineOffset = '3px';
      setTimeout(function() { el.style.outline = ''; el.style.outlineOffset = ''; }, CFG_HIGHLIGHT_MS);
    },

    think: function(text, durationMs) {
      if (!_root) return;
      durationMs = durationMs || CFG_THOUGHT_MS;

      if (_thoughtTimerId) { clearTimeout(_thoughtTimerId); _thoughtTimerId = null; }
      if (_thoughtTimeout) { clearTimeout(_thoughtTimeout); _thoughtTimeout = null; }

      var existing = document.getElementById('mp-thought');
      if (existing) existing.remove();

      var t = document.createElement('div');
      t.id = 'mp-thought';
      t.className = 'mp-thought';
      var ptr = document.createElement('div');
      ptr.className = 'mp-ptr';
      var iconOpen = document.createElement('span');
      iconOpen.style.cssText = 'font-style:normal;margin-right:4px;color:#6366f1;font-weight:600;opacity:0.6;';
      iconOpen.textContent = '“';
      var iconClose = document.createElement('span');
      iconClose.style.cssText = 'font-style:normal;margin-left:4px;color:#6366f1;font-weight:600;opacity:0.6;';
      iconClose.textContent = '”';
      t.appendChild(iconOpen);
      t.appendChild(document.createTextNode(text));
      t.appendChild(iconClose);
      t.appendChild(ptr);
      _root.appendChild(t);

      function positionBubble() {
        var cx = _cursorX || window.innerWidth / 2;
        var cy = _cursorY || window.innerHeight / 2;
        var cachedW = t.offsetWidth || 300;
        var cachedH = t.offsetHeight || 60;

        var narratorBar = document.getElementById('mp-narrate');
        var bottomReserve = narratorBar ? 60 : 0;
        var maxTop = window.innerHeight - cachedH - 10 - bottomReserve;

        var left = cx - 20;
        if (left + cachedW > window.innerWidth - 10) left = cx - cachedW + 20;
        left = Math.max(10, Math.min(left, window.innerWidth - cachedW - 10));

        var bubbleAbove = cy > cachedH + 50;
        var top;
        if (bubbleAbove) {
          top = cy - cachedH - 12;
        } else {
          top = cy + 30;
        }
        top = Math.max(10, Math.min(top, maxTop));

        t.style.left = left + 'px';
        t.style.top = top + 'px';

        var ptrLeft = Math.max(12, Math.min(cx - left, cachedW - 20));
        ptr.style.left = ptrLeft + 'px';
        if (bubbleAbove) {
          ptr.className = 'mp-ptr mp-ptr-down';
          ptr.style.top = (cachedH - 10) + 'px';
        } else {
          ptr.className = 'mp-ptr mp-ptr-up';
          ptr.style.top = '-8px';
        }
        _thoughtTimerId = setTimeout(positionBubble, 100);
      }

      setTimeout(function() { positionBubble(); t.classList.add('visible'); }, 16);

      _thoughtTimeout = setTimeout(function() {
        if (_thoughtTimerId) { clearTimeout(_thoughtTimerId); _thoughtTimerId = null; }
        t.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        t.style.opacity = '0';
        t.style.transform = 'translateY(-10px)';
        setTimeout(function() { t.remove(); }, 600);
      }, durationMs);
    },

    narrate: function(text) {
      if (!_root) return;
      var bar = document.getElementById('mp-narrate');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'mp-narrate';
        bar.className = 'mp-narrate';
        _root.appendChild(bar);
      }
      bar.textContent = text;
      bar.style.opacity = '1';
    },

    clearNarrate: function() {
      var bar = document.getElementById('mp-narrate');
      if (bar) { bar.style.opacity = '0'; setTimeout(function() { bar.remove(); }, 300); }
    },

    setPersona: function(name) {
      _persona = name;
      if (_label) _label.textContent = name;
    },

    setHuman: function(ms) {
      _humanPause = (ms === false || ms === 0) ? 0 : (typeof ms === 'number' ? ms : CFG_HUMAN_MS);
    },

    clear: function() {
      if (_thoughtTimerId) { clearTimeout(_thoughtTimerId); _thoughtTimerId = null; }
      if (_thoughtTimeout) { clearTimeout(_thoughtTimeout); _thoughtTimeout = null; }
      var thought = document.getElementById('mp-thought');
      if (thought) thought.remove();
      var bar = document.getElementById('mp-narrate');
      if (bar) bar.remove();
    },

    discover: function(n, selector) {
      selector = selector || _MATCH_TAGS;
      var els = document.querySelectorAll(selector);
      var results = [];
      var seen = {};
      for (var i = 0; i < els.length && results.length < (n || 5); i++) {
        var el = els[i];
        var r = el.getBoundingClientRect();
        if (r.width < 80 || r.height === 0 || r.top < 0) continue;
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length < 15 || text.length > 300 || seen[text]) continue;
        seen[text] = true;
        var id = 'mp-d-' + results.length;
        el.setAttribute('data-mp', id);
        results.push({ sel: '[data-mp="' + id + '"]', text: text });
      }
      return results;
    },

    commentOn: function(selectorOrOpts, thought, durationMs) {
      durationMs = durationMs || CFG_THOUGHT_MS;
      var readTime = _humanPause || 0;
      var totalTime = Math.max(durationMs, readTime);
      var el = _resolveTarget(selectorOrOpts);
      if (!el) return Promise.resolve({ ok: false, error: 'not found: ' + JSON.stringify(selectorOrOpts) });
      var self = this;
      return _scrollForBubble(el).then(function() {
        var r = el.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        return self.glideTo(x, y, CFG_COMMENT_GLIDE_MS);
      }).then(function() {
        var r = el.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        self.ripple(x, y);
        self.highlight(el);
        self.think(thought, totalTime);
        if (readTime > 0) {
          var bubble = document.getElementById('mp-thought');
          if (bubble) {
            var countdown = document.createElement('span');
            countdown.style.cssText = 'display:block;margin-top:6px;font-size:11px;color:rgba(0,0,0,0.35);font-family:-apple-system,sans-serif;';
            bubble.appendChild(countdown);
            var secsLeft = Math.ceil(readTime / 1000);
            countdown.textContent = secsLeft + 's';
            var tick = setInterval(function() {
              secsLeft--;
              if (secsLeft <= 0) { clearInterval(tick); countdown.textContent = ''; }
              else { countdown.textContent = secsLeft + 's'; }
            }, 1000);
          }
          return new Promise(function(resolve) {
            setTimeout(function() {
              resolve({ ok: true, text: (el.textContent || '').trim().slice(0, 120) });
            }, readTime);
          });
        }
        return { ok: true, text: (el.textContent || '').trim().slice(0, 120) };
      });
    },

    scene: function(steps) {
      var self = this;
      var results = [];
      var consecutiveTimeouts = 0;
      var aborted = false;
      _sceneProgress = { results: results, currentStep: -1, totalSteps: steps.length, currentLabel: '' };
      var chain = Promise.resolve();
      steps.forEach(function(s, i) {
        chain = chain.then(function() {
          if (aborted) return;
          _sceneProgress.currentStep = i;
          _sceneProgress.currentLabel = _stepLabel(s);

          if (s.persona) self.setPersona(s.persona);
          if (s.narrate !== undefined) self.narrate(s.narrate);
          if (s.clearNarrate) self.clearNarrate();
          if (s.clear) self.clear();

          var stepExpired = false;

          var stepPromise = (function() {
            var _targetRef = s.match ? { match: s.match } : s.text ? { text: s.text } : s.selector || null;
            if (_targetRef && s.thought) {
              return self.commentOn(_targetRef, s.thought, s.duration || CFG_THOUGHT_MS).then(function(r) {
                if (!stepExpired) results.push({ step: i, action: 'commentOn', result: r });
                if (s.pause !== undefined) return new Promise(function(res) { setTimeout(res, s.pause); });
              });
            }

            if (_targetRef && !s.thought) {
              var el = _resolveTarget(_targetRef);
              if (!el) { if (!stepExpired) results.push({ step: i, action: 'focus', result: { ok: false, error: 'not found: ' + JSON.stringify(_targetRef) } }); return; }
              return _scrollForBubble(el).then(function() {
                var r = el.getBoundingClientRect();
                return self.glideTo(r.left + r.width / 2, r.top + r.height / 2, CFG_COMMENT_GLIDE_MS);
              }).then(function() {
                self.highlight(el);
                if (!stepExpired) results.push({ step: i, action: 'focus', result: { ok: true } });
              });
            }

            if (s.click) {
              var clickEl = _resolveTarget(s.click);
              if (!clickEl) { if (!stepExpired) results.push({ step: i, action: 'click', result: { ok: false, error: 'not found' } }); return; }
              return _scrollForBubble(clickEl).then(function() {
                var cr = clickEl.getBoundingClientRect();
                return self.glideTo(cr.left + cr.width / 2, cr.top + cr.height / 2, CFG_COMMENT_GLIDE_MS);
              }).then(function() {
                var cr = clickEl.getBoundingClientRect();
                var cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
                self.ripple(cx, cy);
                self.highlight(clickEl);
                var urlBefore = location.href;
                var hBefore = document.querySelector('h1,h2');
                var headingBefore = hBefore ? hBefore.textContent.trim() : null;
                var beforeClick = performance.now();
                _mpClickInProgress = true;
                _cursorClick(_cursorX, _cursorY);
                _mpClickInProgress = false;
                var fbWait = s.feedbackMs !== undefined ? s.feedbackMs : CFG_FEEDBACK_CLICK_MS;
                if (fbWait > 0) {
                  return _waitForFeedback(beforeClick, fbWait).then(function(fb) {
                    var verify = _verifyClick(clickEl, urlBefore, headingBefore);
                    if (!stepExpired) results.push({ step: i, action: 'click', result: { ok: !verify.wasDisabled }, feedback: fb, verify: verify });
                  });
                } else {
                  var verify = _verifyClick(clickEl, urlBefore, headingBefore);
                  if (!stepExpired) results.push({ step: i, action: 'click', result: { ok: !verify.wasDisabled }, verify: verify });
                }
              });
            }

            if (s.fill) {
              var fillMatch = (typeof s.fill === 'string') ? s.fill : (s.fill.text || s.fill.match || null);
              var fillEl = (s.fill.selector) ? document.querySelector(s.fill.selector) : (_findInput(fillMatch) || _resolveTarget(s.fill));
              if (!fillEl) { if (!stepExpired) results.push({ step: i, action: 'fill', result: { ok: false, error: 'not found: ' + JSON.stringify(s.fill) } }); return; }
              if (!/^(INPUT|TEXTAREA|SELECT)$/.test(fillEl.tagName)) {
                var _f = null;
                if (fillEl.tagName === 'LABEL') {
                  var _fid = fillEl.getAttribute('for');
                  if (_fid) _f = document.getElementById(_fid);
                  if (!_f) _f = fillEl.querySelector('input,textarea,select');
                }
                if (!_f) { var _ns = fillEl.nextElementSibling; if (_ns && /^(INPUT|TEXTAREA|SELECT)$/.test(_ns.tagName)) _f = _ns; }
                if (!_f) _f = fillEl.closest('label,fieldset,[role="group"]');
                if (_f && !/^(INPUT|TEXTAREA|SELECT)$/.test(_f.tagName)) _f = _f.querySelector('input,textarea,select');
                if (_f) fillEl = _f;
              }
              return _scrollForBubble(fillEl).then(function() {
                var fr = fillEl.getBoundingClientRect();
                return self.glideTo(fr.left + fr.width / 2, fr.top + fr.height / 2, CFG_COMMENT_GLIDE_MS);
              }).then(function() {
                self.highlight(fillEl);
                _cursorClick(_cursorX, _cursorY);
                fillEl.focus();
                return _cursorType(fillEl, s.value || '');
              }).then(function() {
                var beforeFill = performance.now();
                var fbWaitFill = s.feedbackMs !== undefined ? s.feedbackMs : CFG_FEEDBACK_FILL_MS;
                var fillVerify = _verifyFill(fillEl, s.value || '');
                if (fbWaitFill > 0) {
                  return _waitForFeedback(beforeFill, fbWaitFill).then(function(fb) {
                    if (!stepExpired) results.push({ step: i, action: 'fill', result: { ok: fillVerify.match }, feedback: fb, verify: fillVerify });
                  });
                } else {
                  if (!stepExpired) results.push({ step: i, action: 'fill', result: { ok: fillVerify.match }, verify: fillVerify });
                }
              });
            }

            if (s.think) {
              self.think(s.think, s.duration || CFG_THOUGHT_MS);
              if (!stepExpired) results.push({ step: i, action: 'think' });
            }

            if (s.wait) return new Promise(function(res) { setTimeout(res, s.wait); });
          })();

          var stepTimeout = s.wait ? Math.max(CFG_ACTION_TIMEOUT, s.wait + 1000) : CFG_ACTION_TIMEOUT;
          return _raceTimeout(stepPromise || Promise.resolve(), stepTimeout, _stepLabel(s)).then(function(r) {
            var isTrivialStep = (!s.click && !s.fill && !s.match && !s.think && !s.wait);
            if (r && r.__timeout) {
              stepExpired = true;
              consecutiveTimeouts++;
              results.push({ step: i, action: 'timeout', error: 'action exceeded ' + r.ms + 'ms', target: r.label });
              if (consecutiveTimeouts >= 3) aborted = true;
            } else if (!isTrivialStep) {
              consecutiveTimeouts = 0;
            }
          });
        });
      });
      return chain.then(function() {
        var drifts = [];
        for (var d = 0; d < results.length; d++) {
          var v = results[d].verify;
          if (!v) continue;
          if (v.match === false || v.wasDisabled === true) {
            drifts.push({ step: results[d].step, action: results[d].action, verify: v });
          }
        }
        return { completed: results.length, results: results, drifts: drifts, aborted: aborted };
      });
    },

    startRecording: function() {
      _recording = [];
      _recordingStart = performance.now();
      return 'recording';
    },

    stopRecording: function() {
      var tape = _recording || [];
      _recording = null;
      _recordingStart = 0;
      return tape;
    },

    getRecording: function() {
      return _recording ? _recording.slice() : [];
    },

    replay: function(tape, speed) {
      speed = speed || 1;
      var self = this;
      var chain = Promise.resolve();
      var prevT = 0;
      tape.forEach(function(entry) {
        chain = chain.then(function() {
          var delay = (entry.t - prevT) / speed;
          prevT = entry.t;
          return new Promise(function(resolve) {
            setTimeout(function() {
              var result = self[entry.fn].apply(self, entry.args);
              if (result && typeof result.then === 'function') {
                result.then(resolve);
              } else {
                resolve();
              }
            }, Math.max(0, delay));
          });
        });
      });
      return chain;
    },

    toScript: function(tape, url) {
      // Client-side script generation (no overlay bundling — use server-side
      // persona_record_save for self-contained scripts with bundled overlay).
      tape = tape || _recording || [];
      return JSON.stringify({ tape: tape, url: url || location.href, ts: new Date().toISOString() });
    },

    feedback: function() {
      return _snapshotFeedback(0);
    },

    run: function(script, opts) {
      opts = opts || {};
      var self = this;
      var shouldRecord = opts.record !== false;
      var startUrl = location.href;
      if (opts.human === false) _humanPause = 0;
      else if (typeof opts.human === 'number') _humanPause = opts.human;
      else _humanPause = CFG_HUMAN_MS;
      if (opts.persona) self.setPersona(opts.persona);
      if (shouldRecord) self.startRecording();
      var lines = script.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
      var steps = [];
      var currentTarget = null;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        var op = ln[0], body = ln.slice(1).trim();
        if (op === '>') { steps.push({ narrate: body }); }
        else if (op === '@') {
          currentTarget = body;
          if (i + 1 < lines.length && lines[i + 1].trim()[0] === '"') {
            var thought = lines[++i].trim().slice(1).trim();
            var tMatch = thought.match(/^(\d+)\s+(.+)$/);
            if (tMatch) {
              steps.push({ match: currentTarget, thought: tMatch[2], duration: parseInt(tMatch[1], 10) * 1000 });
            } else {
              steps.push({ match: currentTarget, thought: thought });
            }
          } else {
            steps.push({ match: currentTarget });
          }
        }
        else if (op === '"') {
          var tMatch2 = body.match(/^(\d+)\s+(.+)$/);
          if (tMatch2) {
            steps.push({ match: currentTarget, thought: tMatch2[2], duration: parseInt(tMatch2[1], 10) * 1000 });
          } else {
            steps.push({ match: currentTarget, thought: body });
          }
        }
        else if (op === '!') { steps.push({ click: { match: body } }); }
        else if (op === '=') {
          var parts = body.split('|');
          steps.push({ fill: { match: parts[0].trim() }, value: parts[1] ? parts[1].trim() : '' });
        }
        else if (op === '~') { steps.push({ wait: parseInt(body, 10) || 2000 }); }
        else if (op === '.') { steps.push({ clear: true, clearNarrate: true }); }
      }
      var sceneStart = performance.now();
      return _raceTimeout(self.scene(steps), CFG_SCENE_TIMEOUT, 'scene').then(function(r) {
        _humanPause = 0;
        if (r && r.__timeout) {
          var result = {
            ok: false,
            status: 'timeout',
            completedActions: _sceneProgress.results.length,
            totalActions: steps.length,
            failedAt: _sceneProgress.currentLabel,
            elapsed: Math.round(performance.now() - sceneStart)
          };
          if (shouldRecord) result.tape = self.stopRecording();
          result.drifts = [];
          for (var d = 0; d < _sceneProgress.results.length; d++) {
            var v = _sceneProgress.results[d].verify;
            if (v && (v.match === false || v.wasDisabled === true)) {
              result.drifts.push({ step: _sceneProgress.results[d].step, action: _sceneProgress.results[d].action, verify: v });
            }
          }
          _sessionTapes.push({ ts: new Date().toISOString(), url: startUrl, dsl: script, tape: result.tape || [], status: 'timeout' });
          return result;
        }
        var result = { ok: !r.aborted, steps: r.completed, drifts: r.drifts || [] };
        if (r.aborted) result.status = 'aborted';
        if (shouldRecord) result.tape = self.stopRecording();
        _sessionTapes.push({ ts: new Date().toISOString(), url: startUrl, dsl: script, tape: result.tape || [] });
        return result;
      });
    },

    who: function() {
      var p = _cfg.persona || {};
      var n = _cfg.narrator || {};
      return {
        name: _persona,
        role: p.role || '',
        experience: p.experience || '',
        voice: p.voice || '',
        priorities: p.priorities || [],
        narrator: {
          audience: n.audience || 'stakeholders',
          voice: n.voice || '',
          format: n.format || ''
        }
      };
    },

    loadPersona: function(profile) {
      if (profile.persona) {
        if (profile.persona.name) this.setPersona(profile.persona.name);
        _cfg.persona = profile.persona;
      }
      if (profile.narrator) _cfg.narrator = profile.narrator;
      if (profile.style && profile.style.badge && _label) {
        var from = profile.style.badge.gradientFrom || CFG_BADGE_FROM;
        var to = profile.style.badge.gradientTo || CFG_BADGE_TO;
        _label.style.background = 'linear-gradient(135deg,' + from + ',' + to + ')';
      }
      return this.who();
    },

    x: function(dslOrPersona, maybeDsl, opts) {
      if (typeof maybeDsl === 'string') return this.run(maybeDsl, Object.assign({ persona: dslOrPersona }, opts || {}));
      if (typeof maybeDsl === 'object' && maybeDsl !== null) return this.run(dslOrPersona, maybeDsl);
      return this.run(dslOrPersona, opts || {});
    },

    d: function(n) {
      return this.discover(n || 3);
    },

    session: function() {
      return {
        persona: _cfg.persona || {},
        narrator: _cfg.narrator || {},
        scenes: _sessionTapes,
        startedAt: _sessionTapes.length ? _sessionTapes[0].ts : null
      };
    },

    exportReplay: function() {
      var p = (_cfg.persona && _cfg.persona.name) || _persona || 'Tester';
      var scenes = _sessionTapes.map(function(s, i) {
        return '  {\n    name: "Scene ' + (i + 1) + '",\n    dsl: ' + JSON.stringify(s.dsl) + '\n  }';
      });
      var startUrl = _sessionTapes.length ? _sessionTapes[0].url : 'http://localhost:3000';
      return [
        '#!/usr/bin/env node',
        '// Cursor Persona Recording — ' + p,
        '// Generated: ' + new Date().toISOString(),
        '// Replay: node this-file.js',
        '',
        'const fs = require("fs");',
        'const path = require("path");',
        'let chromium;',
        'try { chromium = require("playwright").chromium; }',
        'catch { console.error("npm i playwright"); process.exit(1); }',
        '',
        'const HUMAN = process.argv.includes("--no-human") ? 0 : ' + CFG_HUMAN_MS + ';',
        'const OVERLAY = path.resolve(__dirname, "..", "overlay.js");',
        'const PERSONA = ' + JSON.stringify(p) + ';',
        '',
        'const SCENES = [',
        scenes.join(',\n'),
        '];',
        '',
        '(async () => {',
        '  const browser = await chromium.launch({',
        '    headless: false,',
        '    args: ["--disable-infobars"],',
        '    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]',
        '  });',
        '  const context = await browser.newContext({',
        '    viewport: { width: 1280, height: 900 },',
        '    storageState: { cookies: [], origins: [] }',
        '  });',
        '  const page = await context.newPage();',
        '  const overlay = fs.readFileSync(OVERLAY, "utf-8").replace("__MP_PERSONA_NAME__", PERSONA);',
        '  await page.addInitScript(overlay);',
        '  await page.goto(' + JSON.stringify(startUrl) + ');',
        '  await page.waitForLoadState("networkidle");',
        '  await page.evaluate(([p,h]) => { window.__mp.setPersona(p); window.__mp.setHuman(h); }, [PERSONA, HUMAN]);',
        '',
        '  for (let i = 0; i < SCENES.length; i++) {',
        '    console.log("  " + SCENES[i].name);',
        '    await page.evaluate(([h,s]) => { window.__mp.setHuman(h); return window.__mp.x(s); }, [HUMAN, SCENES[i].dsl]);',
        '    await new Promise(r => setTimeout(r, 500));',
        '  }',
        '',
        '  console.log("Done.");',
        '  await new Promise(r => setTimeout(r, 3000));',
        '  await browser.close();',
        '})();'
      ].join('\n');
    }
  };

  // Wrap every public method to record calls when recording is active.
  // Skip recording-control methods to avoid infinite loops.
  var _noRecord = { startRecording: 1, stopRecording: 1, replay: 1, run: 1, x: 1, who: 1, loadPersona: 1, getRecording: 1, toScript: 1, moveCursor: 1, feedback: 1, session: 1, exportReplay: 1 };
  var _recordDepth = 0;
  Object.keys(window.__mp).forEach(function(key) {
    if (_noRecord[key] || typeof window.__mp[key] !== 'function') return;
    var original = window.__mp[key];
    window.__mp[key] = function() {
      if (_recording && _recordDepth === 0) {
        _recording.push({
          t: Math.round(performance.now() - _recordingStart),
          fn: key,
          args: Array.prototype.slice.call(arguments)
        });
      }
      _recordDepth++;
      var result = original.apply(this, arguments);
      if (result && typeof result.then === 'function') {
        return result.then(function(v) { _recordDepth--; return v; }, function(e) { _recordDepth--; throw e; });
      }
      _recordDepth--;
      return result;
    };
  });

  if (document.body) {
    injectOverlay();
  }

  if (!_injected) {
    document.addEventListener('DOMContentLoaded', injectOverlay);
  }

  if (!_injected && typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function() {
      if (document.body && !_injected) {
        injectOverlay();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement || document, { childList: true, subtree: true });
    if (_injected) observer.disconnect();
  }
})();
