(function() {
  'use strict';

  var _cursorX = 0, _cursorY = 0;
  var _persona = '__MP_PERSONA_NAME__';
  var _root, _cursor, _label;
  var _injected = false;
  var _thoughtTimerId = null;
  var _thoughtTimeout = null;
  var _glideTimerId = null;
  var _glideResolve = null;
  var _recording = null;   // array when active, null when idle
  var _recordingStart = 0; // performance.now() at startRecording
  var _humanPause = 0;     // ms to wait after each thought for human reading
  var _tp = (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy)
    ? trustedTypes.createPolicy('mp-overlay', { createHTML: function(s) { return s; } })
    : { createHTML: function(s) { return s; } };
  function _html(el, s) { el.innerHTML = _tp.createHTML(s); }

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

  function _waitForFeedback(sinceTs, waitMs) {
    return new Promise(function(resolve) {
      setTimeout(function() { resolve(_snapshotFeedback(sinceTs)); }, waitMs || 2000);
    });
  }

  function injectOverlay() {
    if (_injected) return;
    if (!document.body) return;

    var existingRoot = document.getElementById('mouse-overlay-root');
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
    _root.id = 'mouse-overlay-root';
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
    _html(_cursor, '<svg width="28" height="34" viewBox="0 0 28 34" fill="none"><g filter="url(#mp-shadow)"><path d="M4 2L4 26L9.5 20.5L14.5 30L18 28.5L13 19H20L4 2Z" fill="white" stroke="#1a1a2e" stroke-width="1.5" stroke-linejoin="round"/></g><defs><filter id="mp-shadow" x="0" y="0" width="28" height="34" filterUnits="userSpaceOnUse"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.3"/></filter></defs></svg>');
    _cursor.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:100001;will-change:transform;';
    _root.appendChild(_cursor);

    _label = document.createElement('div');
    _label.id = 'cursor-label';
    _label.textContent = _persona;
    _label.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:100000;will-change:transform;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.3px;padding:3px 10px;border-radius:10px;box-shadow:0 2px 8px rgba(99,102,241,0.4);white-space:nowrap;';
    _root.appendChild(_label);

    var css = document.createElement('style');
    css.textContent = [
      '* { cursor: none !important; }',
      '@keyframes mp-ripple { 0% { transform:scale(0);opacity:0.7 } 50% { transform:scale(1);opacity:0.3 } 100% { transform:scale(1.5);opacity:0 } }',
      '@keyframes mp-ripple-inner { 0% { transform:scale(0);opacity:1 } 100% { transform:scale(1);opacity:0 } }',
      '.mp-ripple { position:fixed;width:50px;height:50px;border-radius:50%;border:3px solid #ef4444;pointer-events:none;z-index:100002;animation:mp-ripple 0.7s ease-out forwards; }',
      '.mp-ripple-inner { position:fixed;width:16px;height:16px;border-radius:50%;background:#ef4444;pointer-events:none;z-index:100002;animation:mp-ripple-inner 0.5s ease-out forwards; }',
      '@keyframes mp-thought-in { 0% { transform:scale(0.95) translateY(6px);opacity:0 } 100% { transform:scale(1) translateY(0);opacity:1 } }',
      '.mp-thought { position:fixed;pointer-events:none;z-index:100003;background:rgba(15,15,25,0.72);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:12px 18px;box-shadow:0 12px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;font-size:13.5px;font-weight:400;font-style:normal;letter-spacing:0.15px;color:rgba(255,255,255,0.93);max-width:340px;line-height:1.55;opacity:0; }',
      '.mp-thought.visible { animation:mp-thought-in 0.3s ease-out forwards; }',
      '.mp-thought .mp-ptr { position:absolute;width:0;height:0;pointer-events:none; }',
      '.mp-thought .mp-ptr-down { border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid rgba(15,15,25,0.72); }',
      '.mp-thought .mp-ptr-up { border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:8px solid rgba(15,15,25,0.72); }',
      '.mp-narrate { position:fixed;bottom:0;left:0;right:0;pointer-events:none;z-index:100004;background:rgba(0,0,0,0.75);color:white;padding:16px 32px;font-family:-apple-system,sans-serif;font-size:16px;font-weight:500;text-align:center;letter-spacing:0.3px;transition:opacity 0.3s ease; }'
    ].join('\n');

    (document.head || document.documentElement).appendChild(css);

    document.addEventListener('click', function(e) {
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
        window.__mp.ripple(x, y);
        window.__mp.highlight(e.target);
      }
    }, true);

    _cursorX = window.innerWidth / 2;
    _cursorY = window.innerHeight / 2;
    window.__mp.moveCursor(_cursorX, _cursorY);
  }

  // Scroll element into the lower portion of the viewport so there is
  // always headroom above the cursor for the thought bubble.
  function _scrollForBubble(el) {
    var rect = el.getBoundingClientRect();
    var targetY = window.innerHeight * 0.65;
    var scrollDelta = rect.top - targetY;
    if (Math.abs(scrollDelta) > 10) {
      window.scrollBy({ top: scrollDelta, behavior: 'smooth' });
    }
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
    // opts can be: string (selector), {selector:...}, {text:...}, or {match:...}
    if (typeof opts === 'string') return document.querySelector(opts);
    if (opts.selector) return document.querySelector(opts.selector);
    var matchStr = opts.text || opts.match;
    if (matchStr) return _findByText(matchStr);
    return null;
  }

  window.__mp = {
    moveCursor: function(x, y) {
      _cursorX = x;
      _cursorY = y;
      if (_cursor) _cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (_label) _label.style.transform = 'translate(' + (x + 22) + 'px,' + (y + 18) + 'px)';
    },

    glideTo: function(x, y, duration) {
      duration = duration || 600;
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
      r.style.cssText = 'position:fixed;width:50px;height:50px;border-radius:50%;border:3px solid #ef4444;pointer-events:none;z-index:100002;left:' + (x - 25) + 'px;top:' + (y - 25) + 'px;';
      _root.appendChild(r);
      void r.offsetWidth;
      r.style.animation = 'mp-ripple 0.7s ease-out forwards';

      var inner = document.createElement('div');
      inner.style.cssText = 'position:fixed;width:16px;height:16px;border-radius:50%;background:#ef4444;pointer-events:none;z-index:100002;left:' + (x - 8) + 'px;top:' + (y - 8) + 'px;';
      _root.appendChild(inner);
      void inner.offsetWidth;
      inner.style.animation = 'mp-ripple-inner 0.5s ease-out forwards';

      setTimeout(function() { r.remove(); inner.remove(); }, 800);
    },

    highlight: function(el) {
      if (!el) return;
      el.style.outline = '3px solid #22c55e';
      el.style.outlineOffset = '3px';
      setTimeout(function() { el.style.outline = ''; el.style.outlineOffset = ''; }, 3000);
    },

    think: function(text, durationMs) {
      if (!_root) return;
      durationMs = durationMs || 3500;

      if (_thoughtTimerId) { clearTimeout(_thoughtTimerId); _thoughtTimerId = null; }
      if (_thoughtTimeout) { clearTimeout(_thoughtTimeout); _thoughtTimeout = null; }

      var existing = document.getElementById('mp-thought');
      if (existing) existing.remove();

      var t = document.createElement('div');
      t.id = 'mp-thought';
      t.className = 'mp-thought';
      var ptr = document.createElement('div');
      ptr.className = 'mp-ptr';
      var icon = document.createElement('span');
      icon.style.cssText = 'font-style:normal;margin-right:6px;';
      icon.textContent = '\u{1F4AD}';
      t.appendChild(icon);
      t.appendChild(document.createTextNode(text));
      t.appendChild(ptr);
      _root.appendChild(t);

      var cachedW = 0, cachedH = 0;

      function positionBubble() {
        var cx = _cursorX || window.innerWidth / 2;
        var cy = _cursorY || window.innerHeight / 2;
        if (!cachedW) { cachedW = t.offsetWidth || 300; cachedH = t.offsetHeight || 60; }

        var narratorBar = document.getElementById('mp-narrate');
        var bottomReserve = narratorBar ? 60 : 0;
        var maxTop = window.innerHeight - cachedH - 10 - bottomReserve;

        var left = cx - 20;
        if (left + cachedW > window.innerWidth - 10) left = cx - cachedW + 20;
        left = Math.max(10, Math.min(left, window.innerWidth - cachedW - 10));

        var bubbleAbove = cy > cachedH + 50;
        var top;
        if (bubbleAbove) {
          top = cy - cachedH - 18;
        } else {
          top = cy + 36;
        }
        top = Math.max(10, Math.min(top, maxTop));

        t.style.left = left + 'px';
        t.style.top = top + 'px';

        var ptrLeft = Math.max(12, Math.min(cx - left, cachedW - 20));
        ptr.style.left = ptrLeft + 'px';
        if (bubbleAbove) {
          ptr.className = 'mp-ptr mp-ptr-down';
          ptr.style.top = cachedH + 'px';
        } else {
          ptr.className = 'mp-ptr mp-ptr-up';
          ptr.style.top = '-7px';
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
      durationMs = durationMs || 4000;
      var readTime = _humanPause || 0;
      var totalTime = Math.max(durationMs, readTime);
      var el = _resolveTarget(selectorOrOpts);
      if (!el) return Promise.resolve({ ok: false, error: 'not found: ' + JSON.stringify(selectorOrOpts) });
      _scrollForBubble(el);
      var self = this;
      return new Promise(function(resolve) {
        setTimeout(function() {
          var r = el.getBoundingClientRect();
          var x = r.left + r.width / 2, y = r.top + r.height / 2;
          self.glideTo(x, y, 400).then(function() {
            self.ripple(x, y);
            self.highlight(el);
            self.think(thought, totalTime);
            if (readTime > 0) {
              var bubble = document.getElementById('mp-thought');
              if (bubble) {
                var countdown = document.createElement('span');
                countdown.style.cssText = 'display:block;margin-top:6px;font-size:11px;opacity:0.5;font-family:-apple-system,sans-serif;';
                bubble.appendChild(countdown);
                var secsLeft = Math.ceil(readTime / 1000);
                countdown.textContent = secsLeft + 's';
                var tick = setInterval(function() {
                  secsLeft--;
                  if (secsLeft <= 0) { clearInterval(tick); countdown.textContent = ''; }
                  else { countdown.textContent = secsLeft + 's'; }
                }, 1000);
              }
              setTimeout(function() {
                resolve({ ok: true, text: (el.textContent || '').trim().slice(0, 120) });
              }, readTime);
            } else {
              resolve({ ok: true, text: (el.textContent || '').trim().slice(0, 120) });
            }
          });
        }, 400);
      });
    },

    scene: function(steps) {
      var self = this;
      var results = [];
      var chain = Promise.resolve();
      steps.forEach(function(s, i) {
        chain = chain.then(function() {
          if (s.persona) self.setPersona(s.persona);
          if (s.narrate !== undefined) self.narrate(s.narrate);
          if (s.clearNarrate) self.clearNarrate();
          if (s.clear) self.clear();

          var _targetRef = s.match ? { match: s.match } : s.text ? { text: s.text } : s.selector || null;
          if (_targetRef && s.thought) {
            return self.commentOn(_targetRef, s.thought, s.duration || 4000).then(function(r) {
              results.push({ step: i, action: 'commentOn', result: r });
              if (s.pause !== undefined) return new Promise(function(res) { setTimeout(res, s.pause); });
            });
          }

          if (_targetRef && !s.thought) {
            var el = _resolveTarget(_targetRef);
            if (!el) { results.push({ step: i, action: 'focus', result: { ok: false, error: 'not found: ' + JSON.stringify(_targetRef) } }); return; }
            _scrollForBubble(el);
            return new Promise(function(resolve) {
              setTimeout(function() {
                var r = el.getBoundingClientRect();
                self.glideTo(r.left + r.width / 2, r.top + r.height / 2, 400).then(function() {
                  self.ripple();
                  self.highlight(el);
                  results.push({ step: i, action: 'focus', result: { ok: true } });
                  resolve();
                });
              }, 400);
            });
          }

          if (s.click) {
            var clickEl = _resolveTarget(s.click);
            if (!clickEl) { results.push({ step: i, action: 'click', result: { ok: false, error: 'not found' } }); return; }
            _scrollForBubble(clickEl);
            return new Promise(function(resolve) {
              setTimeout(function() {
                var cr = clickEl.getBoundingClientRect();
                self.glideTo(cr.left + cr.width / 2, cr.top + cr.height / 2, 400).then(function() {
                  self.ripple();
                  self.highlight(clickEl);
                  var beforeClick = performance.now();
                  clickEl.click();
                  var fbWait = s.feedbackMs !== undefined ? s.feedbackMs : 2000;
                  if (fbWait > 0) {
                    _waitForFeedback(beforeClick, fbWait).then(function(fb) {
                      results.push({ step: i, action: 'click', result: { ok: true }, feedback: fb });
                      resolve();
                    });
                  } else {
                    results.push({ step: i, action: 'click', result: { ok: true } });
                    resolve();
                  }
                });
              }, 400);
            });
          }

          if (s.fill) {
            var fillMatch = (typeof s.fill === 'string') ? s.fill : (s.fill.text || s.fill.match || null);
            var fillEl = (s.fill.selector) ? document.querySelector(s.fill.selector) : (_findInput(fillMatch) || _resolveTarget(s.fill));
            if (!fillEl) { results.push({ step: i, action: 'fill', result: { ok: false, error: 'not found: ' + JSON.stringify(s.fill) } }); return; }
            // If we landed on a non-fillable element (label, span, etc.), chase to its input
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
            _scrollForBubble(fillEl);
            return new Promise(function(resolve) {
              setTimeout(function() {
                var fr = fillEl.getBoundingClientRect();
                self.glideTo(fr.left + fr.width / 2, fr.top + fr.height / 2, 400).then(function() {
                  self.ripple();
                  self.highlight(fillEl);
                  fillEl.focus();
                  var chars = (s.value || '').split('');
                  var isSelect = fillEl instanceof HTMLSelectElement;
                  var proto = fillEl instanceof HTMLTextAreaElement
                    ? HTMLTextAreaElement.prototype
                    : HTMLInputElement.prototype;
                  var nativeSetter = isSelect ? null : Object.getOwnPropertyDescriptor(proto, 'value').set;
                  var charIdx = 0;
                  function typeChar() {
                    if (charIdx >= chars.length) {
                      fillEl.dispatchEvent(new Event('change', { bubbles: true }));
                      var beforeFill = performance.now();
                      var fbWaitFill = s.feedbackMs !== undefined ? s.feedbackMs : 500;
                      if (fbWaitFill > 0) {
                        _waitForFeedback(beforeFill, fbWaitFill).then(function(fb) {
                          results.push({ step: i, action: 'fill', result: { ok: true }, feedback: fb });
                          resolve();
                        });
                      } else {
                        results.push({ step: i, action: 'fill', result: { ok: true } });
                        resolve();
                      }
                      return;
                    }
                    charIdx++;
                    var partial = chars.slice(0, charIdx).join('');
                    if (isSelect) {
                      fillEl.value = partial;
                    } else {
                      nativeSetter.call(fillEl, partial);
                    }
                    fillEl.dispatchEvent(new Event('input', { bubbles: true }));
                    setTimeout(typeChar, 30 + Math.random() * 40);
                  }
                  typeChar();
                });
              }, 400);
            });
          }

          if (s.think) {
            self.think(s.think, s.duration || 4000);
            results.push({ step: i, action: 'think' });
          }

          if (s.wait) return new Promise(function(res) { setTimeout(res, s.wait); });
        });
      });
      return chain.then(function() { return { completed: results.length, results: results }; });
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
      _humanPause = opts.human === false ? 0 : (typeof opts.human === 'number' ? opts.human : 7000);
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
            steps.push({ match: currentTarget, thought: thought, duration: 30000 });
          } else {
            steps.push({ match: currentTarget });
          }
        }
        else if (op === '"') { steps.push({ match: currentTarget, thought: body, duration: 30000 }); }
        else if (op === '!') { steps.push({ click: { match: body } }); }
        else if (op === '=') {
          var parts = body.split('|');
          steps.push({ fill: { match: parts[0].trim() }, value: parts[1] ? parts[1].trim() : '' });
        }
        else if (op === '~') { steps.push({ wait: parseInt(body, 10) || 2000 }); }
        else if (op === '.') { steps.push({ clear: true, clearNarrate: true }); }
      }
      return self.scene(steps).then(function(r) {
        _humanPause = 0;
        var result = { ok: true, steps: r.completed };
        if (shouldRecord) {
          result.tape = self.stopRecording();
        }
        return result;
      });
    }
  };

  // Wrap every public method to record calls when recording is active.
  // Skip recording-control methods to avoid infinite loops.
  var _noRecord = { startRecording: 1, stopRecording: 1, replay: 1, run: 1, getRecording: 1, toScript: 1, moveCursor: 1, feedback: 1 };
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
