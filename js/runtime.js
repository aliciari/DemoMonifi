/*
 * Monifi demo runtime
 * ---------------------------------------------------------------------------
 * A small, dependency-light replacement for the original "support.js" so the
 * demo runs on any static host (GitHub Pages). It provides:
 *
 *   - DCLogic      base class: this.props, this.state, this.setState(patch | fn)
 *   - DC.mount()   loads templates/app.html, compiles it, renders it into a
 *                  root element and keeps the DOM in sync using morphdom.
 *
 * Template language (unchanged from the original demo):
 *   {{path.to.value}}                 text / attribute binding
 *   <sc-if value="{{flag}}">…</sc-if>        conditional block
 *   <sc-for list="{{items}}" as="x">…</sc-for>  loop (inside the loop `x`,
 *                                              plus `x$index`, are in scope)
 *   onClick / onChange / onKeyDown="{{fn}}"  event handlers (receive the event)
 *   <!--@include pages/foo.html-->    include another template file
 *
 * You normally never need to edit this file. Page markup lives in
 * templates/, all behaviour and data in js/app.js.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------ DCLogic -- */
  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
      this._dirty = false;
    }
    setState(patch, cb) {
      // State is updated synchronously (so functional updates see each other);
      // the DOM is re-rendered once per tick, batching rapid changes.
      const next = typeof patch === 'function' ? patch(this.state) : patch;
      if (next) this.state = Object.assign({}, this.state, next);
      if (typeof cb === 'function') (this._cbs = this._cbs || []).push(cb);
      this._schedule();
    }
    _schedule() {
      if (this._dirty || !this._rt) return;
      this._dirty = true;
      Promise.resolve().then(() => {
        this._dirty = false;
        this._rt.render();
        const cbs = this._cbs; this._cbs = null;
        if (cbs) cbs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
      });
    }
  }

  /* ------------------------------------------------------- tiny helpers -- */
  const BOOL_ATTRS = new Set(['disabled', 'checked', 'selected', 'readonly', 'hidden', 'required', 'open', 'multiple', 'autofocus']);
  const EXPR_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;
  const WHOLE_RE = /^\s*\{\{\s*([^{}]*?)\s*\}\}\s*$/;

  function compileExpr(src) {
    src = src.trim();
    if (src === 'true') return () => true;
    if (src === 'false') return () => false;
    if (src === 'null') return () => null;
    if (/^-?\d+(\.\d+)?$/.test(src)) { const n = parseFloat(src); return () => n; }
    const m = src.match(/^!\s*(.+)$/);
    if (m) { const inner = compileExpr(m[1]); return (s) => !inner(s); }
    const parts = src.split('.');
    return (scope) => {
      let v = scope;
      for (let i = 0; i < parts.length; i++) {
        if (v == null) return undefined;
        v = v[parts[i]];
      }
      return v;
    };
  }

  // Compile a string that may contain {{…}} into { whole, fn } or null if static.
  function compileInterp(str) {
    if (str.indexOf('{{') < 0) return null;
    const w = str.match(WHOLE_RE);
    if (w) { const f = compileExpr(w[1]); return { whole: true, fn: f }; }
    const segs = []; let last = 0, m;
    EXPR_RE.lastIndex = 0;
    while ((m = EXPR_RE.exec(str))) {
      if (m.index > last) segs.push(str.slice(last, m.index));
      segs.push(compileExpr(m[1]));
      last = m.index + m[0].length;
    }
    if (last < str.length) segs.push(str.slice(last));
    return {
      whole: false,
      fn: (scope) => segs.map((s) => (typeof s === 'string' ? s : str1(s(scope)))).join('')
    };
  }
  const str1 = (v) => (v == null || v === false ? '' : String(v));

  /* ------------------------------------------------- template -> markup -- */
  // sc-if / sc-for are left as custom elements, except inside <select> where
  // the HTML parser would drop them: there they become <template> elements.
  function prepareMarkup(html) {
    const stack = []; // open svg / select contexts
    let selectDepth = 0;
    const tagRe = /<(\/?)(svg|select|sc-for|sc-if)\b/g;
    let out = '', last = 0, m;
    while ((m = tagRe.exec(html))) {
      const closing = !!m[1], tag = m[2];
      out += html.slice(last, m.index);
      last = m.index + m[0].length;
      if (tag === 'select') {
        selectDepth += closing ? -1 : 1;
        out += m[0];
      } else if (tag === 'svg') {
        out += m[0];
      } else if (selectDepth > 0) {
        out += '<' + (closing ? '/' : '') + 'template' + (closing ? '' : ' data-sc="' + tag + '"');
      } else {
        out += m[0];
      }
    }
    out += html.slice(last);
    return out;
  }

  function kids(node) {
    return node.content ? node.content.childNodes : node.childNodes;
  }

  /* ----------------------------------------------------------- compiler -- */
  function compileNodes(list) {
    const fns = [];
    for (let i = 0; i < list.length; i++) {
      const f = compileNode(list[i]);
      if (f) fns.push(f);
    }
    return (scope, parent) => { for (let i = 0; i < fns.length; i++) fns[i](scope, parent); };
  }

  function compileNode(node) {
    if (node.nodeType === 3) { // text
      const txt = node.nodeValue, it = compileInterp(txt);
      if (!it) return (s, p) => p.appendChild(document.createTextNode(txt));
      return (s, p) => p.appendChild(document.createTextNode(str1(it.fn(s))));
    }
    if (node.nodeType !== 1) return null; // drop comments etc.

    const name = node.localName;
    const scTag = name === 'sc-if' || name === 'sc-for' ? name : (node.getAttribute && node.getAttribute('data-sc'));

    if (scTag === 'sc-if') {
      const v = compileInterp(node.getAttribute('value') || '{{false}}');
      const body = compileNodes(kids(node));
      return (s, p) => { if ((v ? v.fn(s) : node.getAttribute('value')) ) body(s, p); };
    }
    if (scTag === 'sc-for') {
      const l = compileInterp(node.getAttribute('list') || '');
      const as = node.getAttribute('as') || 'item';
      const body = compileNodes(kids(node));
      return (s, p) => {
        const arr = l ? l.fn(s) : null;
        if (!arr || !arr.length) return;
        for (let i = 0; i < arr.length; i++) {
          const inner = Object.create(s);
          inner[as] = arr[i]; inner[as + '$index'] = i;
          body(inner, p);
        }
      };
    }

    // ordinary element -------------------------------------------------
    const ns = node.namespaceURI, tag = node.localName;
    const statics = [], dynamics = [], events = [];
    let valueBinding = null;
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes[i];
      if (a.name.indexOf('hint-') === 0) continue;
      if (/^on[a-z]+$/i.test(a.name)) {
        const w = a.value.match(WHOLE_RE);
        if (w) { events.push([a.name.slice(2).toLowerCase(), compileExpr(w[1])]); continue; }
      }
      const it = compileInterp(a.value);
      if (a.name === 'value' && it) { valueBinding = it; }
      if (it) dynamics.push([a, it]); else statics.push(a);
    }
    const body = compileNodes(kids(node));

    return (scope, parent) => {
      const el = ns && ns !== 'http://www.w3.org/1999/xhtml' ? document.createElementNS(ns, tag) : document.createElement(tag);
      for (let i = 0; i < statics.length; i++) setAttr(el, statics[i], statics[i].value);
      for (let i = 0; i < dynamics.length; i++) {
        const a = dynamics[i][0], it = dynamics[i][1];
        const v = it.fn(scope);
        if (BOOL_ATTRS.has(a.name) && it.whole) {
          if (v && v !== 'false') el.setAttribute(a.name, '');
        } else {
          setAttr(el, a, it.whole ? str1(v) : v);
        }
      }
      for (let i = 0; i < events.length; i++) {
        const h = events[i][1](scope);
        if (typeof h === 'function') (el.__h || (el.__h = {}))[events[i][0]] = h;
      }
      body(scope, el);
      // form controls: apply value/checked as properties after children exist
      if (tag === 'select' && valueBinding) {
        const want = str1(valueBinding.fn(scope));
        const opts = el.querySelectorAll('option');
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].value === want) { opts[i].setAttribute('selected', ''); opts[i].selected = true; }
        }
      } else if (tag === 'textarea' && valueBinding) {
        el.value = str1(valueBinding.fn(scope));
      } else if (tag === 'input' && valueBinding) {
        el.value = str1(valueBinding.fn(scope));
      }
      if (tag === 'input' && el.hasAttribute('checked')) el.checked = true;
      parent.appendChild(el);
    };
  }

  function setAttr(el, attr, value) {
    try {
      if (attr.namespaceURI) el.setAttributeNS(attr.namespaceURI, attr.name, value);
      else el.setAttribute(attr.name, value);
    } catch (e) { /* ignore invalid attribute names */ }
  }

  /* ----------------------------------------------------- template loader -- */
  async function loadTemplate(url) {
    const base = url.replace(/[^/]*$/, '');
    async function get(u) {
      const r = await fetch(u, { cache: 'no-cache' });
      if (!r.ok) throw new Error('Could not load ' + u + ' (' + r.status + ')');
      return r.text();
    }
    async function expand(text, dir) {
      const re = /<!--@include\s+(\S+?)\s*-->/g;
      let out = '', last = 0, m;
      while ((m = re.exec(text))) {
        out += text.slice(last, m.index);
        const path = dir + m[1];
        out += await expand(await get(path), path.replace(/[^/]*$/, ''));
        last = m.index + m[0].length;
      }
      return out + text.slice(last);
    }
    return expand(await get(url), base);
  }

  /* ------------------------------------------------------------- mount -- */
  const DC = {
    onRender: null,
    async mount(opts) {
      const root = typeof opts.root === 'string' ? document.querySelector(opts.root) : opts.root;
      const html = await loadTemplate(opts.template);
      const tpl = document.createElement('template');
      tpl.innerHTML = prepareMarkup(html);
      const body = compileNodes(tpl.content.childNodes);

      const logic = new opts.component(opts.props || {});
      const rt = { logic, root };
      logic._rt = rt;
      if (opts.beforeMount) opts.beforeMount(logic);   // e.g. restore a saved session before the first render

      const types = ['click', 'input', 'change', 'keydown', 'keyup', 'submit', 'focusout'];
      const TEXTISH = /^(text|search|number|email|tel|url|password|date|time|datetime-local|month|week|)$/i;
      types.forEach((type) => root.addEventListener(type, (e) => {
        for (let n = e.target; n && n !== root.parentNode; n = n.parentNode) {
          const h = n.__h; if (!h) continue;
          let fn = h[type];
          if (!fn && h.change) {
            // React-style onChange: fires while typing for text fields, on commit otherwise
            const t = e.target, tn = t.tagName;
            const textish = tn === 'TEXTAREA' || (tn === 'INPUT' && TEXTISH.test(t.getAttribute('type') || ''));
            if ((type === 'input' && textish) || (type === 'change' && !textish && n === t)) fn = h.change;
          }
          if (fn) { try { fn.call(logic, e); } catch (err) { console.error(err); } }
          if (e.cancelBubble) break;
        }
      }));

      rt.render = function () {
        const t0 = performance.now();
        const vals = logic.renderVals();
        const next = document.createElement(root.tagName);
        body(vals, next);
        global.morphdom(root, next, {
          childrenOnly: true,
          onBeforeElUpdated(from, to) {
            from.__h = to.__h;                       // always refresh handlers
            if (from.tagName === 'DETAILS') {        // keep user's open/closed choice
              if (from.open) to.setAttribute('open', ''); else if (!to.hasAttribute('open')) to.removeAttribute('open');
            }
            return true;
          }
        });
        rt.lastMs = performance.now() - t0;
        if (DC.onRender) DC.onRender(logic);
      };

      if (logic.componentDidMount) logic.componentDidMount();
      rt.render();
      root.removeAttribute('data-loading');
      return rt;
    }
  };

  global.DCLogic = DCLogic;
  global.DC = DC;
})(window);
