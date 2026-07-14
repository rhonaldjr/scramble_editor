<!--
  Example HOST application.

  This file is NOT part of the Scramble component — it is what a consumer writes.
  It shows the responsibilities the host owns, all through the component's public
  interface (v-model, events, adapters, template-ref methods):

    • Persistence  — load on mount + autosave to IndexedDB on @change
                     (IndexedDB, not localStorage: docs with embedded media blow
                     past localStorage's ~5 MB quota and would fail to save).
    • Uploads      — an `upload` adapter (here: data URLs so media survives a
                     refresh; use your storage/CDN in a real app).
    • Documents    — a `resolveDocumentUrl` adapter resolves how the Document
                     block previews pdf/docx/pptx/xlsx/odt (here: Google viewer
                     for public files; default is native PDF + Office viewer).
    • Contacts     — a `fetchContacts` adapter (here: a static list).
    • Events       — an audit log built from the catch-all @event.
    • Control      — enable/disable features, readonly, imperative get/set/export.

  Paste a rich web page into the editor and it becomes structured blocks
  (headings/lists/tables), and the "Web page" slash block previews any URL.
  The side panel's "Load content" box parses HTML/Markdown into the document or
  into a specific block (setContent / loadHTML / loadMarkdown).

  Swap localStorage / data URLs for your real backend and nothing about the
  component changes.
-->
<template>
  <div class="host">
    <header class="host__bar">
      <strong>Scramble host demo</strong>
      <span class="host__status">{{ savedAt ? `Saved ${savedAt}` : 'Editing…' }}</span>
      <span class="host__spacer" />
      <button @click="save()">Save now</button>
      <button @click="reload()">Reload from storage</button>
      <button @click="reset()">Reset</button>
    </header>

    <div class="host__body">
      <main class="host__editor">
        <ScrambleEditor
          ref="editor"
          v-model="doc"
          :config="config"
          :readonly="readonly"
          :features="features"
          :adapters="adapters"
          :presence="presence"
          :comments="comments"
          @ready="log('ready')"
          @change="onChange"
          @cursor-changed="onCursor"
          :focus-mode="focusMode"
          :theme="theme"
          :width="editorWidth"
          :fonts="fonts"
          :tokens="brand"
          @comment-added="onCommentAdded"
          @comment-resolved="onCommentResolved"
          @button-clicked="onButtonClicked"
          @event="onEvent"
        >
          <template #footer="{ words, chars }">
            <div class="sc-footer">{{ words }} words · {{ chars }} chars</div>
          </template>
        </ScrambleEditor>
      </main>

      <aside class="host__panel">
        <h3>Export (pull)</h3>
        <button @click="output = editor.getMarkdown()">Markdown</button>
        <button @click="output = editor.getHTML()">HTML</button>
        <button @click="output = editor.getExport()">Per config ({{ config.output }})</button>
        <button @click="output = json(editor.getDocument())">JSON</button>

        <h3>Set (push)</h3>
        <button @click="pushSample">Set via v-model</button>
        <button @click="editor.focus()">Focus</button>

        <h3>Load content (HTML / Markdown)</h3>
        <select v-model="loadFormat">
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
        </select>
        <textarea v-model="loadText" rows="5" placeholder="# Paste Markdown or HTML here"></textarea>
        <input v-model="loadBlockId" placeholder="target block id (optional)" />
        <select v-model="loadMode">
          <option value="replace">replace</option>
          <option value="append">append after</option>
          <option value="children">into (children)</option>
        </select>
        <button @click="doLoad">
          {{ loadBlockId ? `Load into #${loadBlockId}` : 'Load into document' }}
        </button>

        <h3>Features</h3>
        <label v-for="(on, name) in features" :key="name">
          <input type="checkbox" :checked="on" @change="features[name] = !features[name]" /> {{ name }}
        </label>
        <label><input type="checkbox" v-model="readonly" /> readonly</label>
        <label><input type="checkbox" v-model="focusMode" /> focus mode</label>
        <label>theme
          <select v-model="theme"><option>auto</option><option>light</option><option>dark</option></select>
        </label>
        <label>width
          <select v-model="editorWidth">
            <option value="normal">normal</option>
            <option value="full">full width</option>
            <option value="75%">75%</option>
            <option value="50%">50%</option>
          </select>
        </label>

        <h3>Brand (theme the UI)</h3>
        <div class="brand-row">
          <button v-for="p in brandPresets" :key="p.name" @click="brand = { ...p.tokens }">{{ p.name }}</button>
        </div>
        <label>accent <input type="color" v-model="brand['accent']" /></label>
        <label>toolbar bg <input type="color" v-model="brand['bar-bg']" /></label>
        <label>toolbar accent <input type="color" v-model="brand['bar-accent']" /></label>
        <button @click="brand = {}">Reset brand</button>

        <h3>History (host-stored)</h3>
        <div v-if="!history.length" class="hist-empty">Edit to create versions…</div>
        <div v-for="(h, i) in history" :key="i" class="hist-row">
          <button @click="restore(h)">Restore</button> <span>{{ h.at }}</span>
        </div>

        <h3>Output</h3>
        <pre class="box out">{{ output }}</pre>

        <h3>Event audit</h3>
        <pre class="box log">{{ events.join('\n') }}</pre>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ScrambleEditor, registerBlock } from '../src/index.js';
import ContactBlock from './ContactBlock.vue';

const STORAGE_KEY = 'scramble:demo-doc';

// Register a CUSTOM block via the public API (proves extensibility). This is
// host code — not part of the component.
const escHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
registerBlock({
  type: 'contact',
  label: 'Contact',
  icon: '👤',
  component: ContactBlock,
  create: (d = {}) => ({ contact: d.contact || null }),
  toMarkdown: (b) => {
    const c = b.data.contact;
    return c ? `**${c.name}**${c.role ? ` — ${c.role}` : ''} <${c.email}>` : '';
  },
  toHTML: (b) => {
    const c = b.data.contact;
    if (!c) return '';
    return (
      `<div class="sc-contact"><span class="sc-contact__name">${escHtml(c.name)}</span>` +
      (c.role ? `<span class="sc-contact__role">${escHtml(c.role)}</span>` : '') +
      `<a class="sc-contact__email" href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a></div>`
    );
  },
});

const editor = ref(null);
const output = ref('');
const events = ref([]);
const savedAt = ref(null);
const readonly = ref(false);
const focusMode = ref(false);
const theme = ref('auto');
const editorWidth = ref('normal'); // 'normal' | 'full' | '75%' | '50%' — programmable width

// Brand: UI-theme overrides passed to :tokens (host restyles the editor chrome).
const brand = ref({});
const brandPresets = [
  { name: 'Default', tokens: {} },
  { name: 'Magenta', tokens: { accent: '#e0218a', 'bar-bg': '#2a0a24', 'bar-accent': '#ff7ac6', radius: '10px' } },
  { name: 'Emerald', tokens: { accent: '#0f9d58', 'bar-bg': '#08261b', 'bar-accent': '#4ade80', radius: '4px' } },
];
const features = reactive({ slashMenu: true, shortcuts: true, toolbar: true, dragAndDrop: true });
// Page config: gates blocks/toolbar and picks the default export format.
const config = reactive({ output: 'markdown' });

// Custom fonts. The component injects a <link> for any entry with a `url`, and
// applies `family` when the page-style (Aa) font picker selects it by `id`.
const fonts = [
  { id: 'inter', label: 'Inter', family: '"Inter", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap' },
  { id: 'lora', label: 'Lora', family: '"Lora", Georgia, serif', url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap' },
  { id: 'jetbrains', label: 'JetBrains Mono', family: '"JetBrains Mono", monospace', url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap' },
];

const json = (v) => JSON.stringify(v, null, 2);
function defaultDoc() {
  return {
    id: 'host-demo',
    title: 'Host demo',
    style: { fullWidth: false, smallText: false, font: 'default' },
    blocks: [
      { id: 'h', type: 'heading-1', data: { segments: [{ text: 'Scramble in a host app', marks: [] }] }, props: {}, children: [] },
      { id: 'p', type: 'paragraph', data: { segments: [{ text: 'This app owns persistence + uploads. The component only exposes the interface.', marks: [] }] }, props: {}, children: [] },
      { id: 'l', type: 'checklist', data: { segments: [{ text: 'Autosaves to localStorage', marks: [] }], checked: true }, props: {}, children: [] },
      { id: 'tip', type: 'paragraph', data: { segments: [{ text: 'Try pasting a rich web page here — headings, lists and tables keep their structure.', marks: [] }] }, props: {}, children: [] },
      { id: 'btn-evt', type: 'button', data: { label: 'Run host action', action: 'event', variant: 'filled', bgColor: '#e0218a', textColor: '#ffffff' }, props: {}, children: [] },
      { id: 'btn-link', type: 'button', data: { label: 'Open docs ↗', action: 'link', url: 'https://vuejs.org', target: '_blank', variant: 'outline', bgColor: '#0f9d58' }, props: {}, children: [] },
      { id: 'acc', type: 'accordion', data: { segments: [{ text: 'What is Scramble?', marks: [] }] }, props: {}, children: [
        { id: 'acc-b', type: 'paragraph', data: { segments: [{ text: 'A block editor delivered as one Vue 3 component. Click the chevron to collapse.', marks: [] }] }, props: {}, children: [] },
      ] },
      { id: 'ct', type: 'contact', data: { contact: null }, props: {}, children: [] },
      { id: 'w', type: 'webpage', data: { url: 'https://example.com', width: null, height: 360 }, props: {}, children: [] },
      { id: 'deck', type: 'slides', data: {}, props: {}, children: [
        { id: 'sl1', type: 'slide', data: { aspect: '16x9' }, props: { backgroundColor: '#0b1e3b', color: null }, children: [
          { id: 'sl1h', type: 'heading-1', data: { segments: [{ text: 'A slide deck, in-document', marks: [], color: 'default' }] }, props: {}, children: [] },
          { id: 'sl1p', type: 'paragraph', data: { segments: [{ text: 'Drop images/video into slides, set a background, then press ▶ Present.', marks: [] }] }, props: {}, children: [] },
        ] },
      ] },
      { id: 'doc', type: 'document', data: { url: '', name: '', docType: '', width: null, height: 420 }, props: {}, children: [] },
      { id: 'i', type: 'image', data: { url: '', caption: '' }, props: {}, children: [] },
    ],
  };
}

// --- persistence (host responsibility) ---
// IMPORTANT: we persist to **IndexedDB**, not localStorage. A document that
// embeds media (data-URL images/video, or a docx preview) easily exceeds
// localStorage's ~5 MB quota — `setItem` then throws `QuotaExceededError`, the
// autosave silently fails, and a reload reverts to the last small save (so a
// freshly pasted/formatted block "loses its formatting"). IndexedDB has no such
// limit. A real backend (your API/DB) has the same requirement: store the whole
// document, media included.
const DB_NAME = 'scramble-demo';
const STORE = 'docs';
const DOC_KEY = 'host-demo';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.parse(JSON.stringify(value)), DOC_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(DOC_KEY);
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbDel() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(DOC_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const doc = ref(defaultDoc());
// One-time migration from the old localStorage store, then load from IndexedDB.
onMounted(async () => {
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) { await idbSet(JSON.parse(legacy)); localStorage.removeItem(STORAGE_KEY); }
    const stored = await idbGet();
    if (stored) { doc.value = stored; log('loaded ← IndexedDB'); }
  } catch (e) {
    log(`load failed: ${e.message}`);
  }
});

let saveTimer = null;
function onChange(next) {
  savedAt.value = null; // mark dirty
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(next), 600); // debounced autosave
}
async function save(next) {
  const d = next || (editor.value && editor.value.getDocument()) || doc.value;
  try {
    await idbSet(d);
    savedAt.value = new Date().toLocaleTimeString();
    log('persisted → IndexedDB');
  } catch (e) {
    savedAt.value = null;
    log(`save FAILED: ${e.message}`); // e.g. quota — surfaced instead of silently dropped
  }
  broadcastDoc(d); // share with other tabs (collab demo)
  snapshot(d); // keep a version for the history panel
}
async function reload() {
  try {
    const stored = await idbGet();
    if (stored) { doc.value = stored; log('loaded ← IndexedDB'); }
  } catch (e) {
    log(`load failed: ${e.message}`);
  }
}
async function reset() {
  await idbDel();
  doc.value = defaultDoc();
  savedAt.value = null;
  log('reset');
}

// --- adapters (host provides the backend) ---
// Persistence gotcha: `URL.createObjectURL(file)` returns a `blob:` URL that is
// revoked on reload — media would break after a refresh. For a persistence demo
// we inline the file as a data URL so it round-trips through localStorage. A
// real app uploads to storage/CDN and stores the returned durable URL instead.
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
const adapters = {
  upload: async (file) => ({ url: await fileToDataURL(file), name: file.name }),
  // Per-document pull hook for the Document block. The component ships a default
  // (native PDF + Microsoft Office Online viewer); a host resolves/renders here
  // instead. Since our demo "uploads" are local data URLs (not public), the
  // Office Online / Google viewers can't fetch them — so we render docx/xlsx
  // *client-side* and hand back `{ html }`. Real apps can just return a signed
  // public URL from their storage. Return '' to fall back to the default.
  resolveDocumentUrl: async ({ url, type, file }) => {
    if (type === 'pdf') return url; // PDFs render natively (data/blob/http)
    const isPublic = /^https?:\/\//i.test(url);
    try {
      if (type === 'word') {
        const mammoth = await import('https://esm.sh/mammoth@1.8.0');
        const buf = file ? await file.arrayBuffer() : await (await fetch(url)).arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
        return { html: value };
      }
      if (type === 'excel') {
        const XLSX = await import('https://esm.sh/xlsx@0.18.5');
        const buf = file ? await file.arrayBuffer() : await (await fetch(url)).arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const html = wb.SheetNames
          .map((n) => `<h3>${n}</h3>${XLSX.utils.sheet_to_html(wb.Sheets[n])}`)
          .join('');
        return { html };
      }
    } catch (e) {
      log(`document render failed: ${e.message}`);
    }
    // pptx/odp have no lightweight client renderer — use a viewer if public.
    if (isPublic && type) return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    return '';
  },
  fetchContacts: async (q) => {
    const all = [
      { id: 'c1', name: 'Jane Cooper', email: 'jane@example.com' },
      { id: 'c2', name: 'Wade Warren', email: 'wade@example.com' },
    ];
    const s = (q || '').toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(s));
  },
  // Page-link picker: the host supplies its list of pages.
  listDocuments: async () => [
    { id: 'doc-getting-started', title: 'Getting started' },
    { id: 'doc-roadmap', title: 'Roadmap' },
  ],
};

// --- collaboration (host-owned transport) ---
// Naive demo: sync between browser tabs via BroadcastChannel, last-write-wins.
// The component only emits @cursor-changed + @change and accepts :presence — the
// transport and conflict resolution are the host's responsibility.
const COLORS = ['#e03e3e', '#0b6e99', '#6940a5', '#0f7b6c', '#d9730d', '#ad1a72'];
const me = { id: `u-${Math.random().toString(36).slice(2, 7)}` };
me.name = `User ${me.id.slice(-2)}`;
me.color = COLORS[Math.floor(Math.random() * COLORS.length)];
const presence = ref([]);
let channel = null;
try { channel = new BroadcastChannel('scramble-collab'); } catch { channel = null; }
if (channel) {
  channel.onmessage = (e) => {
    const m = e.data;
    if (!m || m.from === me.id) return;
    if (m.kind === 'doc') { doc.value = m.doc; log('remote doc applied'); }
    else if (m.kind === 'cursor') {
      presence.value = [...presence.value.filter((u) => u.id !== m.user.id), m.user];
    }
  };
}
function broadcastDoc(d) { if (channel) channel.postMessage({ kind: 'doc', from: me.id, doc: d }); }
function onCursor(detail) {
  if (channel) channel.postMessage({ kind: 'cursor', from: me.id, user: { id: me.id, name: me.name, color: me.color, blockId: detail.blockId } });
}

// --- comments (host stores threads; component provides the UI + events) ---
const comments = ref(loadComments());
function loadComments() { try { return JSON.parse(localStorage.getItem('scramble:comments')) || []; } catch { return []; } }
function persistComments() { localStorage.setItem('scramble:comments', JSON.stringify(comments.value)); }
function onCommentAdded({ blockId, text }) {
  const at = new Date().toISOString();
  const existing = comments.value.find((t) => t.blockId === blockId && !t.resolved);
  if (existing) {
    comments.value = comments.value.map((t) => (t === existing ? { ...t, messages: [...t.messages, { author: me.name, text, at }] } : t));
  } else {
    comments.value = [...comments.value, { id: `cmt-${Math.random().toString(36).slice(2, 7)}`, blockId, resolved: false, messages: [{ author: me.name, text, at }] }];
  }
  persistComments();
  log('comment added');
}
function onCommentResolved({ id }) {
  comments.value = comments.value.map((t) => (t.id === id ? { ...t, resolved: true } : t));
  persistComments();
  log('comment resolved');
}

// --- history (host stores snapshots; restores via v-model) ---
const history = ref([]);
function snapshot(d) {
  history.value = [{ at: new Date().toLocaleTimeString(), doc: JSON.parse(JSON.stringify(d)) }, ...history.value].slice(0, 20);
}
function restore(h) {
  doc.value = JSON.parse(JSON.stringify(h.doc)); // push into the editor via v-model
  log('history-restored');
}

// --- events (host observes) ---
function log(line) {
  events.value.unshift(`${new Date().toLocaleTimeString()}  ${line}`);
  events.value = events.value.slice(0, 80);
}
function onEvent({ type, detail }) {
  log(`${type} ${JSON.stringify(detail || {})}`);
}

// --- imperative push demo ---
// A `button` block with action 'event' calls this — the host decides what to do.
function onButtonClicked(e) {
  log(`button-clicked: ${JSON.stringify(e)}`);
  if (e.action === 'event') window.alert(`Button "${e.label}" clicked — host handles this action.`);
}

function pushSample() {
  doc.value = {
    id: 'host-demo',
    title: 'Set programmatically',
    style: {},
    blocks: [{ id: 'x', type: 'heading-2', data: { segments: [{ text: 'Pushed via v-model ✅', marks: [] }] }, props: {}, children: [] }],
  };
  log('host set document');
}

// Load HTML/Markdown — into the whole document, or a specific block by id.
const loadFormat = ref('markdown');
const loadText = ref('## Loaded from Markdown\n\n- point one\n- point two\n\n> Parsed into real blocks.');
const loadBlockId = ref('');
const loadMode = ref('replace');
function doLoad() {
  if (!editor.value) return;
  const opts = { format: loadFormat.value };
  if (loadBlockId.value.trim()) { opts.blockId = loadBlockId.value.trim(); opts.mode = loadMode.value; }
  const ok = editor.value.setContent(loadText.value, opts);
  log(ok ? `loaded ${loadFormat.value}${opts.blockId ? ` → #${opts.blockId} (${opts.mode})` : ''}` : 'load failed (block not found)');
}
</script>

<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.host { display: flex; flex-direction: column; height: 100vh; }
.host__bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid #e9e9e7; }
.host__status { color: #787774; font-size: 12px; }
.host__spacer { flex: 1; }
.host__bar button, .host__panel button { padding: 5px 9px; margin: 2px; border: 1px solid #ddd; border-radius: 5px; background: #fff; cursor: pointer; font-size: 12px; }
.host__body { display: grid; grid-template-columns: 1fr 320px; flex: 1; min-height: 0; }
.host__editor { overflow-y: auto; }
.host__panel { border-left: 1px solid #e9e9e7; padding: 14px; overflow-y: auto; background: #fafafa; font-size: 13px; }
.host__panel h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #787774; margin: 16px 0 6px; }
.host__panel label { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.brand-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.hist-row { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 1px 0; }
.hist-row span { color: #787774; }
.hist-empty { color: #9b9a97; font-style: italic; font-size: 12px; }
.sc-footer { position: fixed; bottom: 8px; left: 12px; color: #9b9a97; font-size: 12px; }
.box { border-radius: 6px; padding: 8px; font-family: ui-monospace, Menlo, monospace; font-size: 11px; white-space: pre-wrap; overflow: auto; }
.out { background: #fff; border: 1px solid #e9e9e7; max-height: 160px; }
.log { background: #1f1f1f; color: #d6d6d6; height: 200px; }
</style>
