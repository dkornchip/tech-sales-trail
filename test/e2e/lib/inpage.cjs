'use strict';
/*
 * The in-page half of the layout and keyboard tests: window.__e2e.
 *
 * Serialised with toString() and installed as an init script after the driver, so it must be self-contained.
 * It measures; it knows nothing about any build's markup. Everything that is "the log", "End Week" or "the open
 * dialog" comes from window.__drv, the driver's e2e surface (test/parity/drivers/interface.cjs). What is left in
 * here is the platform: boxes, text nodes, computed styles, focus, animations.
 */
module.exports = function e2eInPage() {
  const W = window, D = document;
  if (W.__e2e) return;
  const drv = () => { if (!W.__drv) throw new Error('e2e: no driver installed in this page'); return W.__drv; };
  const EPS = 1;                    // a pixel of slack for subpixel layout

  const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
  // A short, human name for an element in a report: tag, id, classes, a few words of its text.
  const desc = el => {
    if (!el || el === D.body) return el ? '<body>' : '(nothing)';
    if (el === D.documentElement) return '<html>';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const label = clean(el.getAttribute && (el.getAttribute('aria-label') || '')) || clean(el.textContent);
    return `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}>${label ? ' “' + label.slice(0, 32) + (label.length > 32 ? '…' : '') + '”' : ''}`;
  };
  const px = n => Math.round(n * 10) / 10;
  const vw = () => W.innerWidth, vh = () => W.innerHeight;
  const shown = el => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true, opacityProperty: true });
  // The same without opacity, for "could this take focus": a transparent control still can. (The keyboard test also
  // runs on the parity harness's page, which is deliberately not painted: html{opacity:0}.)
  const rendered = el => !!el && el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  const inAny = (el, boxes) => boxes.some(b => b === el || b.contains(el));
  const scrolls = v => v === 'auto' || v === 'scroll';
  const clips = v => v === 'hidden' || v === 'clip';
  // The box an element's own overflow is cut to: its padding box.
  const padBox = el => { const r = el.getBoundingClientRect(); const l = r.left + el.clientLeft, t = r.top + el.clientTop; return { left: l, top: t, right: l + el.clientWidth, bottom: t + el.clientHeight }; };
  const topLayer = el => { try { return el.matches('dialog:modal, :popover-open'); } catch (_) { return false; } };

  /*
   * Is the rectangle `r` (belonging to `el`, or to text inside it) cut off? Walks up from `from`:
   *   - a box that clips on an axis (overflow hidden / clip) must contain it on that axis
   *   - a box that scrolls on an axis ends the walk for that axis: what overflows there can be scrolled to
   *   - at the top, the viewport itself clips whatever cannot be scrolled to: anything fixed or in the top layer,
   *     and anything at all on an axis the page does not scroll on
   * Returns null, or { by, px } naming what cuts it and by how many pixels.
   */
  const cutOff = (r, from) => {
    let freeX = false, freeY = false, fixed = false;
    for (let a = from; a && a !== D.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed' || topLayer(a)) fixed = true;
      if (a === D.body) break;
      const ox = cs.overflowX, oy = cs.overflowY;
      if (ox === 'visible' && oy === 'visible') continue;
      const b = padBox(a);
      if (!freeX && clips(ox)) { const d = Math.max(b.left - r.left, r.right - b.right); if (d > EPS) return { by: desc(a), px: px(d) }; }
      if (!freeY && clips(oy)) { const d = Math.max(b.top - r.top, r.bottom - b.bottom); if (d > EPS) return { by: desc(a), px: px(d) }; }
      if (scrolls(ox)) freeX = true;
      if (scrolls(oy)) freeY = true;
      if (freeX && freeY && !fixed) return null;
    }
    const de = D.documentElement;
    const pageScrollsX = de.scrollWidth > vw() + EPS, pageScrollsY = de.scrollHeight > vh() + EPS;
    if (!freeX && (fixed || !pageScrollsX)) { const d = Math.max(-r.left, r.right - vw()); if (d > EPS) return { by: 'the viewport', px: px(d) }; }
    if (!freeY && (fixed || !pageScrollsY)) { const d = Math.max(-r.top, r.bottom - vh()); if (d > EPS) return { by: 'the viewport', px: px(d) }; }
    return null;
  };
  const inViewport = r => r.left >= -EPS && r.top >= -EPS && r.right <= vw() + EPS && r.bottom <= vh() + EPS;

  // Every piece of text a player can see: [{ node, el, rect, size }]. Screen-reader-only text (boxes of a pixel or
  // two) and anything hidden, transparent or unrendered is left out.
  const visibleText = () => {
    const out = [];
    const walker = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT);
    const range = D.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      const el = n.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName) || !shown(el)) continue;
      range.selectNodeContents(n);
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const q of range.getClientRects()) { if (q.width <= 0 || q.height <= 0) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
      if (!(r > l && b > t)) continue;
      let sr = false;
      for (let a = el; a && a !== D.body; a = a.parentElement) { const q = a.getBoundingClientRect(); if (q.width <= 2 && q.height <= 2) { sr = true; break; } }
      if (sr) continue;
      out.push({ node: n, el, rect: { left: l, top: t, right: r, bottom: b }, size: parseFloat(getComputedStyle(el).fontSize) });
    }
    return out;
  };

  const ACTIONS = ['prospect', 'cadence', 'discovery', 'demo', 'propose', 'close', 'network', 'conference', 'recharge', 'coffee', 'politics', 'crm'];
  const MAIN_CONTROLS = ACTIONS.map(a => 'act:' + a).concat('end');

  // Is every control in `moves` on the screen, whole?
  const controlsIn = moves => {
    const bad = [];
    for (const m of moves) {
      const el = drv().el(m);
      if (!el) { bad.push(`${m}: not on the page`); continue; }
      const r = el.getBoundingClientRect();
      if (!shown(el) || r.width < 1 || r.height < 1) { bad.push(`${m}: not visible`); continue; }
      if (!inViewport(r)) { bad.push(`${m}: outside the viewport (box ${px(r.left)},${px(r.top)} to ${px(r.right)},${px(r.bottom)}; viewport ${vw()}x${vh()})`); continue; }
      const c = cutOff(r, el.parentElement);
      if (c) bad.push(`${m}: cut off by ${c.by} (${c.px}px)`);
    }
    return bad;
  };

  // Does anything sit on top of a region? A 6 x 6 grid of points across the part of it that is on screen.
  const covered = name => {
    const boxes = drv().region(name);
    if (!boxes.length) return { missing: true, hits: [] };
    const hits = new Map();
    let points = 0;
    for (const box of boxes) {
      const r = box.getBoundingClientRect();
      const l = Math.max(r.left, 0) + 3, t = Math.max(r.top, 0) + 3, rt = Math.min(r.right, vw()) - 3, b = Math.min(r.bottom, vh()) - 3;
      if (!(rt > l && b > t)) { hits.set('(the region has no visible area)', 36); points += 36; continue; }
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        const x = l + (rt - l) * i / 5, y = t + (b - t) * j / 5;
        points++;
        const top = D.elementFromPoint(x, y);
        if (top && (top === box || box.contains(top))) continue;
        // a corner point that lands on the region's own container is the container's rounded corner clipping the
        // region, not something sitting on top of it
        if (top && (i === 0 || i === 5) && (j === 0 || j === 5) && top.contains(box)) continue;
        // name the thing on top by its outermost box that is not also an ancestor of the region
        let who = top;
        while (who && who.parentElement && !who.parentElement.contains(box)) who = who.parentElement;
        const k = desc(who);
        hits.set(k, (hits.get(k) || 0) + 1);
      }
    }
    return { missing: false, points, hits: Array.from(hits.entries()).sort((a, b) => b[1] - a[1]) };
  };

  /*
   * All the layout checks, for the page as it stands. opts: { minFont: number|null }
   * Returns { checks: { id: { status: 'ok'|'fail'|'na'|'info', detail: [..] } }, font: {...}, page: {...} }.
   */
  const layout = opts => {
    opts = opts || {};
    const out = {};
    const set = (id, bad, na) => { out[id] = na ? { status: 'na', detail: [na] } : { status: bad.length ? 'fail' : 'ok', detail: bad }; };
    const de = D.documentElement;
    const dialog = drv().observe().dialog;
    const dialogBoxes = drv().region('dialog');

    // 1. the page does not scroll: not the document, and not a box standing in for it. A page can pin <html> and
    //    <body> to the viewport and scroll (or clip) everything inside one full-height container; then the document
    //    never grows, and the page still does not fit. So <body> and every box End Week sits in are asked too.
    { const bad = [];
      if (de.scrollHeight !== vh()) bad.push(`the page is ${de.scrollHeight}px tall in a ${vh()}px viewport`);
      if (de.scrollWidth > vw()) bad.push(`the page is ${de.scrollWidth}px wide in a ${vw()}px viewport`);
      const end = drv().el('end');
      const boxes = [D.body];
      for (let a = end && end.parentElement; a && a !== D.body && a !== de; a = a.parentElement) boxes.push(a);
      for (const a of boxes) {
        const cs = getComputedStyle(a), isBody = a === D.body;
        if (a.scrollHeight - a.clientHeight > EPS && (isBody || scrolls(cs.overflowY))) bad.push(`the page scrolls inside ${desc(a).split(' “')[0]}: ${a.scrollHeight}px of content in a ${a.clientHeight}px box`);
        if (a.scrollWidth - a.clientWidth > EPS && (isBody || scrolls(cs.overflowX))) bad.push(`the page scrolls sideways inside ${desc(a).split(' “')[0]}: ${a.scrollWidth}px of content in a ${a.clientWidth}px box`);
      }
      set('page-no-scroll', bad); }

    // 2. every action and End Week is whole and inside the viewport
    set('controls-in-viewport', controlsIn(MAIN_CONTROLS));

    // 3. nothing sits on top of the activity log or the deal list (a modal dialog is supposed to: not checked then)
    for (const [id, name] of [['log-not-covered', 'log'], ['deals-not-covered', 'deals']]) {
      if (dialog) { set(id, [], 'a dialog is open'); continue; }
      const c = covered(name);
      set(id, c.missing ? [`the driver found no "${name}" region`] : c.hits.map(([who, n]) => `${n} of ${c.points} points are under ${who}`));
    }

    // 4. an open dialog is inside the viewport, and so are its buttons
    if (!dialog) set('dialog-in-viewport', [], 'no dialog is open');
    else {
      const bad = [];
      if (!dialogBoxes.length) bad.push('the driver reports a dialog but found no "dialog" region');
      for (const box of dialogBoxes) { const r = box.getBoundingClientRect(); if (!inViewport(r)) bad.push(`${desc(box)} is outside the viewport (box ${px(r.left)},${px(r.top)} to ${px(r.right)},${px(r.bottom)}; viewport ${vw()}x${vh()})`); }
      set('dialog-in-viewport', bad.concat(controlsIn(drv().observe().legal)));
    }

    // 5. no text is cut off inside a box that does not scroll. ASCII art is a picture made of characters: a scene
    //    pans a camera over it and crops it on purpose, so it is not text for this check or the next
    const texts = visibleText();
    const ascii = drv().region('ascii');
    { const seen = new Map();
      for (const t of texts) {
        if (inAny(t.el, ascii)) continue;
        const c = cutOff(t.rect, t.el);
        if (!c) continue;
        const k = desc(t.el) + ' by ' + c.by;
        if (!seen.has(k)) seen.set(k, `“${clean(t.node.nodeValue).slice(0, 40)}” in ${desc(t.el).split(' “')[0]} is cut off by ${c.by} (${c.px}px)`);
      }
      set('text-not-clipped', Array.from(seen.values())); }

    // 6. the smallest type on screen (ASCII art is drawn at a computed size and does not count)
    const sized = texts.filter(t => !inAny(t.el, ascii));
    let min = null;
    const bySize = new Map();
    for (const t of sized) {
      if (!min || t.size < min.size) min = t;
      if (opts.minFont && t.size < opts.minFont) { const k = px(t.size) + 'px ' + desc(t.el).split(' “')[0]; if (!bySize.has(k)) bySize.set(k, { size: t.size, n: 0, text: clean(t.node.nodeValue).slice(0, 30) }); bySize.get(k).n++; }
    }
    const font = min ? { size: px(min.size), where: desc(min.el).split(' “')[0], text: clean(min.node.nodeValue).slice(0, 30), nodes: sized.length } : null;
    if (!opts.minFont) out['min-font'] = { status: 'info', detail: [font ? `smallest type ${font.size}px` : 'no text'] };
    else {
      const rows = Array.from(bySize.entries()).sort((a, b) => a[1].size - b[1].size);
      set('min-font', rows.map(([k, v]) => `${k} “${v.text}” (${v.n} text node${v.n === 1 ? '' : 's'})`));
    }

    // 7. nothing on the main screen animates for ever (inside an open dialog it may)
    { const bad = new Map();
      for (const a of D.getAnimations()) {
        if (a.playState !== 'running' || !a.effect) continue;
        const timing = a.effect.getComputedTiming();
        if (timing.iterations !== Infinity) continue;
        const target = a.effect.target;
        if (!target || inAny(target, dialogBoxes) || !shown(target)) continue;
        const k = `${a.animationName || a.transitionProperty || a.id || 'a script animation'} on ${desc(target).split(' “')[0]}${a.effect.pseudoElement || ''}`;
        bad.set(k, (bad.get(k) || 0) + 1);
      }
      set('no-infinite-animation', Array.from(bad.entries()).map(([k, n]) => `${k}${n > 1 ? ' (x' + n + ')' : ''} never stops`)); }

    // 8. clAInk's ad shows all of itself: none of it is scrolled out of sight inside its dock, and its parts are
    //    stacked, each starting below the one before it. The logo and the announcement may share a row (they do
    //    where the ad is wide enough): then they sit beside each other, centred on each other.
    { const ad = D.querySelector('.claink-ad:not(.is-mini)');
      if (!ad || !shown(ad)) set('dock-whole', [], 'clAInk\'s ad is not open on this screen');
      else {
        const bad = [];
        if (ad.scrollHeight - ad.clientHeight > EPS) bad.push(`the ad is ${ad.scrollHeight}px tall in a ${ad.clientHeight}px dock: part of it is scrolled out of sight`);
        const parts = ['.claink-ad-top', '.claink-ad-ask', '.claink-announce', '.claink-logo', '.claink-headline', '.claink-sub', '.claink-chips', '.claink-proof', '.claink-price', '.claink-badges', '.claink-actions', '.claink-fine']
          .map(sel => ({ sel, el: ad.querySelector(sel) })).filter(p => p.el && shown(p.el)).map(p => ({ sel: p.sel, r: p.el.getBoundingClientRect() }));
        for (let i = 1; i < parts.length; i++) {
          const a = parts[i - 1], b = parts[i];
          if (b.r.top >= a.r.bottom - EPS) continue;                                   // stacked
          const row = a.sel === '.claink-announce' && b.sel === '.claink-logo';
          const apart = a.r.right <= b.r.left + EPS || b.r.right <= a.r.left + EPS;
          const level = Math.abs((a.r.top + a.r.bottom) / 2 - (b.r.top + b.r.bottom) / 2) <= 2;
          if (row && apart && level) continue;                                         // one row, on purpose
          bad.push(row ? `the logo and the announcement share a line but are ${apart ? 'not centred on each other' : 'on top of each other'}`
            : `${b.sel} starts ${px(a.r.bottom - b.r.top)}px above the end of ${a.sel}: one is on top of the other`);
        }
        set('dock-whole', bad);
      }
    }

    // 9. clAInk's window takes only the room nothing else needs. Beside the game it shares a column of fixed height
    //    with the deal list and the log, and they come first: the deal list its whole list (to its own limit, 40% of
    //    the column), the log its minimum (104px) beside the ad, and beside the workspace all it has (to its
    //    heading, the week and two lines: 150px). What is left, to at most 68% of the column, is the window's.
    //    The workspace always has its own share (46%), and more exactly as far as there is room to spare.
    //    The ad has exactly the room to spare, and more only for its plainest layout (every optional part left out),
    //    and then only what that layout needs. Either way, more squeezes the board and less scrolls a report or
    //    drops parts of the pitch with room to spare. And what that buys is looked at directly: beside a workspace
    //    taller than its share, or an ad that still has optional parts, the deal list and the log are not short.
    { const dock = D.querySelector('.right > .claink-ad:not(.is-mini), .right > .claink-console:not(.is-mini)');
      const limit = dock && shown(dock) ? getComputedStyle(dock).maxHeight : 'none';
      if (limit === 'none') set('dock-fair', [], 'clAInk has no open window with a share of a column on this screen');
      else {
        const col = dock.parentElement, H = col.clientHeight, deals = col.querySelector('.deals'), log = col.querySelector('.activity'), ad = dock.classList.contains('claink-ad');
        const whole = sec => sec ? [...sec.children].reduce((h, k) => h + (k.classList.contains('scroll') ? k.scrollHeight : k.offsetHeight), sec.offsetHeight - sec.clientHeight) : 0;
        const DEALS_MOST = H * 0.40, LOG_LEAST = 104, LOG_KEEP = ad ? LOG_LEAST : 150, share = H * 0.46;
        const dealsNeed = Math.min(whole(deals), DEALS_MOST), logNeed = Math.max(LOG_LEAST, Math.min(whole(log), LOG_KEEP));
        const spare = Math.min(H * 0.68, H - dealsNeed - logNeed), fair = ad ? spare : Math.max(share, spare);
        const allowed = /%$/.test(limit) ? H * parseFloat(limit) / 100 : parseFloat(limit);
        const needs = `the deal list needs ${px(dealsNeed)}px and the log ${px(logNeed)}px of this ${H}px column`;
        const extras = ad ? ['.claink-announce', '.claink-chips', '.claink-badges', '.claink-proof'].filter(sel => { const e = dock.querySelector(sel); return e && shown(e); }) : [];
        const plainest = ad && !extras.length, tall = dock.getBoundingClientRect().height;
        const bad = [];
        if (allowed < fair - 2) bad.push(`clAInk's window may be only ${px(allowed)}px tall, and there is ${px(fair)}px for it (${needs})`);
        if (allowed > fair + 2) {
          if (!plainest) bad.push(`clAInk's window may be ${px(allowed)}px tall, and ${px(fair)}px is all there is for it (${needs})${ad ? '; it still shows ' + extras.join(', ') : ''}`);
          else if (allowed > dock.scrollHeight + (dock.offsetHeight - dock.clientHeight) + 2) bad.push(`clAInk's ad may be ${px(allowed)}px tall; its plainest layout needs ${dock.scrollHeight + (dock.offsetHeight - dock.clientHeight)}px and there is ${px(fair)}px to spare (${needs})`);
        }
        const cut = sec => { const l = sec && sec.querySelector('.scroll'); return l && l.scrollHeight - l.clientHeight > EPS ? l.scrollHeight - l.clientHeight : 0; };
        if (ad ? !plainest : tall > share + 2) {
          const beside = ad ? `beside an ad that still shows ${extras.join(', ')}` : `beside a workspace ${px(tall - share)}px taller than its share`;
          if (cut(deals) && deals.offsetHeight < DEALS_MOST - 2) bad.push(`${px(cut(deals))}px of the deal list is out of sight in a ${deals.offsetHeight}px box, ${beside}`);
          if (cut(log) && log.offsetHeight < LOG_KEEP - 2) bad.push(`the log is down to ${log.offsetHeight}px with ${px(cut(log))}px of it out of sight, ${beside}`);
        }
        set('dock-fair', bad);
      }
    }

    // 10. a question clAInk's workspace has just asked is in sight. "Cancel seat" is at the foot of the workspace and
    //     its question opens there, which can be below the fold of the dock: the workspace must have scrolled itself
    //     to it, so the question and both of its buttons are inside the part of the window that shows.
    { const box = D.querySelector('.claink-console:not(.is-mini) .claink-cancel-box');
      if (!box || !shown(box)) set('dock-question-seen', [], 'clAInk\'s workspace is not asking anything on this screen');
      else {
        const dock = box.closest('.claink-console'), v = padBox(dock), bar = dock.querySelector('.claink-titlebar');
        const top = bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : v.top;
        const out = r => r.bottom > v.bottom + EPS ? `${px(r.bottom - v.bottom)}px below the fold of clAInk's window` : r.top < top - EPS ? `${px(top - r.top)}px above the top of clAInk's window` : null;
        const bad = [];
        const q = out(box.getBoundingClientRect());
        if (q) bad.push(`the cancel question runs ${q}`);
        for (const b of box.querySelectorAll('button')) { const o = out(b.getBoundingClientRect()); if (o) bad.push(`${desc(b)} is ${o}`); }
        set('dock-question-seen', bad);
      }
    }

    return { checks: out, font, page: { scrollHeight: de.scrollHeight, scrollWidth: de.scrollWidth, innerHeight: vh(), innerWidth: vw(), dialog: dialog ? dialog.id : null } };
  };

  // The phone checks: no sideways scroll, and End Week can be scrolled to and is not under anything there.
  const mobile = () => {
    const out = {};
    const de = D.documentElement;
    // The width a phone lays the page out at is clientWidth. innerWidth is no yardstick here: when content is wider
    // than that, a phone zooms out to show it and innerWidth grows with it.
    const wide = Math.max(de.scrollWidth, D.body ? D.body.scrollWidth : 0, vw());
    out['mobile-no-hscroll'] = wide > de.clientWidth + EPS ? { status: 'fail', detail: [`the page is ${wide}px wide on a ${de.clientWidth}px screen`] } : { status: 'ok', detail: [] };
    const el = drv().el('end');
    const tries = [];
    let ok = false;
    if (!el) tries.push('End Week is not on the page');
    else for (const block of ['center', 'end', 'start']) {
      el.scrollIntoView({ block, inline: 'nearest', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      if (!inViewport(r)) { tries.push(`scrolled to ${block}: its box (${px(r.left)},${px(r.top)} to ${px(r.right)},${px(r.bottom)}) is not inside the ${vw()}x${vh()} viewport`); continue; }
      const top = D.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      if (top && (top === el || el.contains(top))) { ok = true; break; }
      tries.push(`scrolled to ${block}: it is under ${desc(top)}`);
    }
    out['mobile-end-reachable'] = ok ? { status: 'ok', detail: [] } : { status: 'fail', detail: tries };
    W.scrollTo(0, 0);
    return { checks: out, page: { scrollHeight: de.scrollHeight, scrollWidth: wide, innerHeight: vh(), innerWidth: vw() } };
  };

  // CSS animations and transitions that will end by themselves and have not yet.
  const finiteAnimations = () => D.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity).length;

  /* ------------------------------------------------------------------ focus (the keyboard test) */
  // What can take focus, by the platform's rules (not by any build's class names).
  const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]';
  const styleSig = el => { const c = getComputedStyle(el); return [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopColor, c.borderRightColor, c.borderBottomColor, c.borderLeftColor,
    c.borderTopWidth, c.backgroundColor, c.backgroundImage, c.color, c.textDecorationLine, c.filter].join('|'); };
  // The controls Tab stops at, in order: everything focusable that is enabled, visible, not inert and, while a
  // modal dialog is open, inside it.
  const tabbable = () => {
    let modal = null;
    try { const all = D.querySelectorAll('dialog:modal'); modal = all.length ? all[all.length - 1] : null; } catch (_) {}
    return Array.from((modal || D).querySelectorAll(FOCUSABLE)).filter(el => el.tabIndex >= 0 && !el.disabled && rendered(el) && !el.closest('[inert]'));
  };
  // Is focus on the last stop (the first, going backwards)? From there a browser hands focus to its own toolbar
  // for one press, which a page sees as focus on <body>: the one time that is not the page losing it.
  const atEdge = back => {
    const a = D.activeElement, list = tabbable();
    if (!a || a === D.body || !list.length) return false;
    return a === (back ? list[0] : list[list.length - 1]);
  };
  let before = new WeakMap();
  // Called before every key press: how everything focusable looks while it does NOT have focus.
  const noteUnfocused = () => {
    before = new WeakMap();
    const active = D.activeElement;
    for (const el of D.querySelectorAll(FOCUSABLE)) if (el !== active) before.set(el, styleSig(el));
  };
  /*
   * Where focus is now, and whether a sighted keyboard user can tell.
   * indicator: 'outline'   the element has a visible outline (the browser's default ring counts)
   *            'style'     no outline, but it looks different from when it did not have focus (a ring drawn with
   *                        box-shadow, a border or background change)
   *            null        nothing shows
   */
  const focusInfo = () => {
    const a = D.activeElement;
    if (!a || a === D.body || a === D.documentElement) return { body: true, move: null, desc: '<body>', indicator: null };
    const c = getComputedStyle(a);
    const transparent = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$|^transparent$/.test(c.outlineColor);
    let indicator = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0 && !transparent ? 'outline' : null;
    if (!indicator && before.has(a) && before.get(a) !== styleSig(a)) indicator = 'style';
    // an element we never saw unfocused (it appeared with focus already on it) is given the benefit of the doubt
    // only if it has an outline; otherwise it is reported
    return { body: false, move: drv().focused(), desc: desc(a), indicator, visible: rendered(a) };
  };

  W.__e2e = { layout, mobile, finiteAnimations, noteUnfocused, focusInfo, atEdge, tabbable, desc, MAIN_CONTROLS };
};
