'use strict';
// Reusable fake-browser environment for running ddocraft.js against the real
// ddocraft.html element ids (and, optionally, real live server data) without a
// real browser. Built 2026-07-30 to replace the one-off /tmp harness scripts
// every prior feature in this project was verified with.
//
// Usage (see example.js):
//   const { loadPage } = require('./dom-stub');
//   const page = loadPage({ exposeSrc: 'global.__c = charData;' });
//   page.document.getElementById('characterName').value;
//
// How it works: ddocraft.js is executed via indirect eval, which runs it in the
// real Node global scope. Top-level `function` declarations in ddocraft.js become
// callable globals after eval (e.g. call `initialize()` via page.run('initialize()')).
// Top-level `let`/`const` (e.g. charData) do NOT become global properties - if a
// test needs to read or call one, pass `exposeSrc` with a line appended before the
// eval, e.g. 'global.__c = charData;' or 'global.__getClasses = function () { return allCharacterClasses; };'
//
// IMPORTANT: call loadPage() at most once per Node process. ddocraft.js's top-level
// `let`/`const` declarations join the real global lexical scope and persist across
// indirect-eval calls in the same process, so a second loadPage() call in the same
// process throws "Identifier has already been declared". Run each test as its own
// `node test/harness/your-test.js` invocation.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function extractRealIds(html) {
  const ids = new Set();
  const re = /\bid=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    toggle: (c, force) => {
      if (force === undefined) { set.has(c) ? set.delete(c) : set.add(c); }
      else if (force) set.add(c); else set.delete(c);
      return set.has(c);
    },
    contains: (c) => set.has(c),
    get _set() { return set; },
  };
}

function makeFakeElement(id, tag) {
  const el = {
    id: id || '',
    tagName: (tag || 'div').toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    disabled: false,
    checked: false,
    children: [],
    attributes: {},
    _listeners: {},
    addEventListener(evt, fn) { (this._listeners[evt] = this._listeners[evt] || []).push(fn); },
    removeEventListener(evt, fn) {
      if (this._listeners[evt]) this._listeners[evt] = this._listeners[evt].filter((f) => f !== fn);
    },
    dispatchEvent(evt) {
      (this._listeners[evt.type] || []).forEach((fn) => fn(evt));
      return true;
    },
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter((c) => c !== child); return child; },
    insertBefore(child) { this.children.push(child); return child; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    click() { this.dispatchEvent({ type: 'click', preventDefault() {}, button: 0 }); },
  };
  el.classList = makeClassList();
  return el;
}

// Synchronous "network" for the project's synchronous-XHR pattern (loadEnchantmentOptions()
// etc. use async=false XHR by design). `routes` maps a URL (or '*' for any) to a function
// returning responseText. Absolute http(s) URLs with no matching route are fetched for real
// via curl (useful for end-to-end verification against a live server); relative URLs with no
// matching route are read as local files under the repo root.
function makeXHR(routes) {
  return class FakeXMLHttpRequest {
    open(method, url) { this._method = method; this._url = url; }
    setRequestHeader() {}
    send(body) {
      const handler = routes && (routes[this._url] || routes['*']);
      let responseText = '';
      let status = 200;
      try {
        if (handler) {
          responseText = handler(this._url, body);
        } else if (/^https?:\/\//.test(this._url)) {
          responseText = execSync(`curl -s -f "${this._url}"`, { maxBuffer: 1024 * 1024 * 64 }).toString();
        } else {
          responseText = fs.readFileSync(path.join(REPO_ROOT, this._url.replace(/^\//, '')), 'utf8');
        }
      } catch (err) {
        status = 500;
        responseText = String(err);
      }
      this.status = status;
      this.responseText = responseText;
      this.readyState = 4;
      // ddocraft.js's XHR calls use onreadystatechange (not onload) - fire whichever the
      // caller wired up so this stub works either way.
      if (this.onreadystatechange) this.onreadystatechange();
      if (this.onload) this.onload();
    }
  };
}

function loadPage(opts) {
  opts = opts || {};
  const htmlPath = opts.htmlPath || path.join(REPO_ROOT, 'ddocraft.html');
  const scriptPath = opts.scriptPath || path.join(REPO_ROOT, 'ddocraft.js');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const realIds = extractRealIds(html);
  const elements = new Map();

  const document = {
    getElementById(id) {
      if (!realIds.has(id)) return null;
      if (!elements.has(id)) elements.set(id, makeFakeElement(id));
      return elements.get(id);
    },
    createElement(tag) { return makeFakeElement(null, tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    body: makeFakeElement('body', 'body'),
  };

  const windowListeners = {};
  const fakeWindow = {
    location: { href: opts.url || 'http://localhost/ddocraft.html', search: opts.search || '' },
    addEventListener(evt, fn) { (windowListeners[evt] = windowListeners[evt] || []).push(fn); },
    _listeners: windowListeners,
  };

  const calls = { alert: [], confirm: [] };

  global.document = document;
  global.window = fakeWindow;
  global.alert = (msg) => { calls.alert.push(msg); };
  global.confirm = (msg) => {
    calls.confirm.push(msg);
    // confirmReturns can be a plain boolean (every confirm() answers the same way) or a function
    // (msg, callIndex) => boolean for tests that need a sequence of different answers - e.g.
    // simulating "Save" (first confirm) then "Discard" (second) in a chained-confirm() 3-way choice.
    if (typeof opts.confirmReturns === 'function') { return opts.confirmReturns(msg, calls.confirm.length - 1); }
    return opts.confirmReturns !== undefined ? opts.confirmReturns : true;
  };
  global.XMLHttpRequest = makeXHR(opts.routes);
  global.fetch = opts.fetch || (() => Promise.reject(new Error('fetch not stubbed in this harness run')));
  global.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} };
  global.Blob = function Blob(parts, options) { this.parts = parts; this.options = options; };
  global.localStorage = (() => {
    const store = new Map();
    return {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  })();

  let src = fs.readFileSync(scriptPath, 'utf8');
  if (opts.exposeSrc) src += '\n' + opts.exposeSrc + '\n';

  // Indirect eval: runs in the real global scope, matching how this project's earlier
  // /tmp harnesses worked (see comment at top of file for why that matters).
  (0, eval)(src);

  return {
    document,
    window: fakeWindow,
    realIds,
    calls,
    global,
    run(expr) { return (0, eval)(expr); },
  };
}

module.exports = { loadPage, extractRealIds, makeFakeElement };
