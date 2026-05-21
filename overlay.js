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
  var _tp = (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy)
    ? trustedTypes.createPolicy('mp-overlay', { createHTML: function(s) { return s; } })
    : { createHTML: function(s) { return s; } };
  function _html(el, s) { el.innerHTML = _tp.createHTML(s); }

  function injectOverlay() {
    if (_injected) return;
    if (!document.body) return;
    if (document.getElementById('mouse-overlay-root')) return;
    _injected = true;

    _root = document.createElement('div');
    _root.id = 'mouse-overlay-root';
    _root.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(_root);

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
      var r = document.createElement('div');
      r.className = 'mp-ripple';
      r.style.left = (x - 25) + 'px';
      r.style.top = (y - 25) + 'px';
      _root.appendChild(r);
      var inner = document.createElement('div');
      inner.className = 'mp-ripple-inner';
      inner.style.left = (x - 8) + 'px';
      inner.style.top = (y - 8) + 'px';
      _root.appendChild(inner);
      setTimeout(function() { r.remove(); inner.remove(); }, 700);
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
        top = Math.max(10, Math.min(top, window.innerHeight - cachedH - 10));

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
      var el = _resolveTarget(selectorOrOpts);
      if (!el) return Promise.resolve({ ok: false, error: 'not found: ' + JSON.stringify(selectorOrOpts) });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var self = this;
      return new Promise(function(resolve) {
        setTimeout(function() {
          var r = el.getBoundingClientRect();
          var x = r.left + r.width / 2, y = r.top + r.height / 2;
          self.glideTo(x, y, 400).then(function() {
            self.ripple(x, y);
            self.highlight(el);
            self.think(thought, durationMs);
            resolve({ ok: true, text: (el.textContent || '').trim().slice(0, 120) });
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
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

          if (s.think) {
            self.think(s.think, s.duration || 4000);
            results.push({ step: i, action: 'think' });
          }

          if (s.wait) return new Promise(function(res) { setTimeout(res, s.wait); });
        });
      });
      return chain.then(function() { return { completed: results.length, results: results }; });
    }
  };

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
