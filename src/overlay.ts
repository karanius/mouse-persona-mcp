/**
 * The overlay JavaScript payload — injected into every page via CDP.
 *
 * Creates: SVG cursor, persona label, click ripples, green highlights,
 * thought bubbles with comic cloud tail. All purely visual — no DOM
 * interaction, no event blocking.
 */

export function getOverlayScript(persona: string = "Tester"): string {
  return `
(function() {
  if (document.getElementById('mouse-overlay-root')) return;

  const root = document.createElement('div');
  root.id = 'mouse-overlay-root';
  root.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
  document.body.appendChild(root);

  // ── Cursor ──
  const cursor = document.createElement('div');
  cursor.id = 'custom-cursor';
  cursor.innerHTML = '<svg width="28" height="34" viewBox="0 0 28 34" fill="none"><g filter="url(#mp-shadow)"><path d="M4 2L4 26L9.5 20.5L14.5 30L18 28.5L13 19H20L4 2Z" fill="white" stroke="#1a1a2e" stroke-width="1.5" stroke-linejoin="round"/></g><defs><filter id="mp-shadow" x="0" y="0" width="28" height="34" filterUnits="userSpaceOnUse"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.3"/></filter></defs></svg>';
  cursor.style.cssText = 'position:fixed;top:50%;left:50%;pointer-events:none;z-index:100001;';
  root.appendChild(cursor);

  // ── Persona Label ──
  const label = document.createElement('div');
  label.id = 'cursor-label';
  label.textContent = '${persona}';
  label.style.cssText = 'position:fixed;top:calc(50% + 18px);left:calc(50% + 22px);pointer-events:none;z-index:100000;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.3px;padding:3px 10px;border-radius:10px;box-shadow:0 2px 8px rgba(99,102,241,0.4);white-space:nowrap;';
  root.appendChild(label);

  // ── Styles ──
  const css = document.createElement('style');
  css.textContent = \`
    * { cursor: none !important; }
    @keyframes mp-ripple { 0% { transform:scale(0);opacity:0.7 } 50% { transform:scale(1);opacity:0.3 } 100% { transform:scale(1.5);opacity:0 } }
    @keyframes mp-ripple-inner { 0% { transform:scale(0);opacity:1 } 100% { transform:scale(1);opacity:0 } }
    .mp-ripple { position:fixed;width:50px;height:50px;border-radius:50%;border:3px solid #ef4444;pointer-events:none;z-index:100002;animation:mp-ripple 0.7s ease-out forwards; }
    .mp-ripple-inner { position:fixed;width:16px;height:16px;border-radius:50%;background:#ef4444;pointer-events:none;z-index:100002;animation:mp-ripple-inner 0.5s ease-out forwards; }
    @keyframes mp-thought-pop { 0% { transform:scale(0.3) translateY(10px);opacity:0 } 50% { transform:scale(1.05) translateY(-2px) } 100% { transform:scale(1) translateY(0);opacity:1 } }
    @keyframes mp-thought-float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-3px) } }
    .mp-thought {
      position:fixed;pointer-events:none;z-index:100003;
      background:linear-gradient(135deg,#fefefe,#f8f7ff);border:1.5px solid #c4b5fd;border-radius:20px;
      padding:10px 18px;box-shadow:0 6px 24px rgba(99,102,241,0.15);
      font-family:Georgia,serif;font-size:14px;font-style:italic;color:#4b5563;
      max-width:340px;line-height:1.4;opacity:0;
      animation:mp-thought-float 3s ease-in-out infinite;
    }
    .mp-thought.visible {
      animation:mp-thought-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards, mp-thought-float 3s ease-in-out 0.4s infinite;
    }
    .mp-thought::before { content:'';position:absolute;bottom:-12px;left:28px;width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#f8f7ff,#ede9fe);border:1.5px solid #c4b5fd; }
    .mp-thought::after { content:'';position:absolute;bottom:-20px;left:22px;width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#f8f7ff,#ede9fe);border:1.5px solid #c4b5fd; }
    .mp-narrate {
      position:fixed;bottom:0;left:0;right:0;pointer-events:none;z-index:100004;
      background:rgba(0,0,0,0.75);color:white;padding:16px 32px;
      font-family:-apple-system,sans-serif;font-size:16px;font-weight:500;
      text-align:center;letter-spacing:0.3px;
      transition:opacity 0.3s ease;
    }
  \`;
  document.head.appendChild(css);

  // ── API ──
  window.__mp = {
    moveCursor: (x, y) => {
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
      label.style.left = (x + 22) + 'px';
      label.style.top = (y + 18) + 'px';
    },

    glideTo: async (x, y, steps = 20, duration = 600) => {
      const sx = parseFloat(cursor.style.left) || 0;
      const sy = parseFloat(cursor.style.top) || 0;
      const stepMs = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const t = 1 - Math.pow(1 - i/steps, 3);
        window.__mp.moveCursor(sx + (x-sx)*t, sy + (y-sy)*t);
        await new Promise(r => setTimeout(r, stepMs));
      }
    },

    ripple: (x, y) => {
      if (x === undefined) x = parseFloat(cursor.style.left) || 0;
      if (y === undefined) y = parseFloat(cursor.style.top) || 0;
      const r = document.createElement('div');
      r.className = 'mp-ripple';
      r.style.left = (x-25)+'px'; r.style.top = (y-25)+'px';
      root.appendChild(r);
      const inner = document.createElement('div');
      inner.className = 'mp-ripple-inner';
      inner.style.left = (x-8)+'px'; inner.style.top = (y-8)+'px';
      root.appendChild(inner);
      setTimeout(() => { r.remove(); inner.remove(); }, 700);
    },

    highlight: (el) => {
      if (!el) return;
      el.style.outline = '3px solid #22c55e';
      el.style.outlineOffset = '3px';
      setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 3000);
    },

    think: (text) => {
      const existing = document.getElementById('mp-thought');
      if (existing) existing.remove();
      const t = document.createElement('div');
      t.id = 'mp-thought';
      t.className = 'mp-thought';
      t.innerHTML = '<span style="font-style:normal;margin-right:6px">\\u{1F4AD}</span>' + text;
      const cx = parseFloat(cursor.style.left) || window.innerWidth/2;
      const cy = parseFloat(cursor.style.top) || window.innerHeight/2;
      t.style.left = Math.max(10, Math.min(cx - 40, window.innerWidth - 360)) + 'px';
      t.style.top = Math.max(10, cy - 80) + 'px';
      root.appendChild(t);
      requestAnimationFrame(() => t.classList.add('visible'));
      setTimeout(() => {
        t.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        t.style.opacity = '0'; t.style.transform = 'translateY(-10px)';
        setTimeout(() => t.remove(), 600);
      }, 3500);
    },

    narrate: (text) => {
      let bar = document.getElementById('mp-narrate');
      if (!bar) { bar = document.createElement('div'); bar.id = 'mp-narrate'; bar.className = 'mp-narrate'; root.appendChild(bar); }
      bar.textContent = text;
      bar.style.opacity = '1';
    },

    clearNarrate: () => {
      const bar = document.getElementById('mp-narrate');
      if (bar) { bar.style.opacity = '0'; setTimeout(() => bar.remove(), 300); }
    },

    setPersona: (name) => {
      label.textContent = name;
    },

    clear: () => {
      const thought = document.getElementById('mp-thought');
      if (thought) thought.remove();
      const bar = document.getElementById('mp-narrate');
      if (bar) bar.remove();
    }
  };

  // Auto-track clicks and focus
  document.addEventListener('click', (e) => {
    if (e.target && e.target !== document && e.target !== document.body) {
      const r = e.target.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + r.height/2;
      window.__mp.moveCursor(x, y);
      window.__mp.ripple(x, y);
      window.__mp.highlight(e.target);
    }
  }, true);

  document.addEventListener('focusin', (e) => {
    if (e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
      const r = e.target.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + r.height/2;
      window.__mp.moveCursor(x, y);
      window.__mp.ripple(x, y);
      window.__mp.highlight(e.target);
    }
  }, true);

  window.__mp.moveCursor(window.innerWidth/2, window.innerHeight/2);
})();
`;
}
