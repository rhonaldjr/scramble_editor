# Scramble

A Notion / ClickUp Docs–style **block editor delivered as one exclusive Vue 3
component**. Drop `<ScrambleEditor>` into any Vue 3 app, `v-model` the document,
listen to typed events, and wire your **own backend** through adapter functions.

> **Backend-agnostic by design.** Scramble ships no server. Persistence,
> uploads, contacts, embeds, collaboration, comments, and history are the host
> app's job — the component exposes an interface (`adapters` props + events) and
> the host implements the behavior. See [`examples/`](examples/).

- **Vue 3 + Vite**, single-file components. Only `src/core/*` is framework-free
  logic (segments, tree ops, export, import) — everything else is Vue.
- **`v-model`** the document (push and pull), typed events for everything, plus a
  catch-all `@event`.
- **Imperative API** via template ref (`getMarkdown`, `setDocument`, `enable/disable`, …).
- **Extensible** — register a custom block as a Vue component, including blocks
  that render live/dynamic data.
- **No runtime dependencies** — Vue is a peer dependency.

---

## Table of contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
  - [The document model](#the-document-model)
  - [Blocks](#blocks)
  - [Segments & marks](#segments--marks)
- [API reference](#api-reference)
  - [Props](#props)
  - [Events](#events)
  - [Methods (template ref)](#methods-template-ref)
  - [Adapters](#adapters)
- [Usage scenarios](#usage-scenarios)
  - [1. Send & receive data (persistence)](#1-send--receive-data-persistence)
  - [2. Read-only / published view](#2-read-only--published-view)
  - [3. Export to Markdown / HTML](#3-export-to-markdown--html)
  - [4. Gate features & blocks by config](#4-gate-features--blocks-by-config)
  - [5. Page style, width, fonts, theme](#5-page-style-width-fonts-theme)
  - [6. Uploads & media](#6-uploads--media)
  - [7. Documents (PDF / Word / Excel / PowerPoint / ODF)](#7-documents-pdf--word--excel--powerpoint--odf)
  - [8. Pasting from the web & Word](#8-pasting-from-the-web--word)
  - [9. Mentions & contacts](#9-mentions--contacts)
  - [10. Comments](#10-comments)
  - [11. History / version restore](#11-history--version-restore)
  - [12. Live collaboration (presence + sync)](#12-live-collaboration-presence--sync)
  - [13. Presentations & block backgrounds](#13-presentations--block-backgrounds)
- [Building extensions (custom blocks)](#building-extensions-custom-blocks)
  - [Anatomy of a block](#anatomy-of-a-block)
  - [A block that renders dynamic data](#a-block-that-renders-dynamic-data)
- [Build & consume](#build--consume)
- [Publishing & CI](#publishing--ci)
- [Project layout](#project-layout)
- [License & contributions](#license--contributions)

---

## Features

**Editing**

- Rich block editing: paragraph, heading 1–3, quote, bulleted / numbered /
  to-do lists, toggle, callout, banner, divider, code (host-provided
  highlight.js).
- Inline marks: **bold**, *italic*, underline, strikethrough, `code`, links,
  plus a ClickUp-style **text color / highlight / badge** picker (vibrant palette).
- Slash menu (`/`), Markdown shortcuts (`# `, `- `, `1. `, `[] `, `> `,
  ` ``` `, `---`, …), and a selection toolbar.
- Turn Into (convert between compatible blocks), a block handle menu
  (duplicate / delete / move / color / copy link / comment), drag-to-reorder,
  and side-drop to create columns.
- Enter/Backspace/Tab semantics that match Notion (split, merge, indent;
  Backspace in an empty nested block outdents toward its parent first).
- Multi-block selection (rubber-band / keyboard / cmd-click) with group move,
  delete, convert, color; cross-block copy.

**Media & embeds**

- Image / video / audio / file blocks — drag-drop or pick, resize by corner
  (aspect-ratio preserved) or via a ⚙ gear.
- Embed (YouTube + generic iframe) and bookmark (link preview via adapter).
- **Web page** block — live iframe preview of any URL, free width/height resize.
- **Document** block — upload or link a PDF / Word / PowerPoint / Excel / ODF
  file; type is auto-detected and previewed inline (native PDF, or a
  host-resolved viewer / client-rendered HTML), resizable.
- Table (add/remove rows & columns, cell editing) and an auto Table of Contents.

**Structure & layout**

- Nested blocks (toggle, lists, callout, columns), collapsible headings,
  columns / column layout, and page-link blocks.
- Programmable editor width (`normal` / `full` / `75%` / `50%` / px / CSS),
  full-screen expand, focus mode, small-text and custom-font page styles,
  light/dark/auto theme.

**Import / export**

- Paste rich HTML → structured blocks (not one flat paragraph).
- Paste from **Word / Google Docs / Office** with format retained (mostly).
- Export any document to Markdown or HTML (pure functions, usable server-side).

**Host integration**

- `v-model` + typed events + a catch-all `@event`.
- Adapters for upload, contacts, embed metadata, document resolution, and a doc
  list for page links.
- Interfaces (no transport bundled) for **collaboration**, **comments**,
  **mentions**, and **history**.
- Public extension API to register custom Vue blocks.

---

## Install

```bash
npm install scramble-editor-vue vue
```

Requires **Vue 3.4+** (peer) and, for local development of this repo, **Node 18+**.

Repo scripts:

```bash
npm install
npm run dev      # run the examples gallery (index.html → examples/)
npm run build    # build the library into dist/
npm test         # unit (Vitest) + component tests (jsdom)
```

> **Dependencies:** the published component has **no runtime dependencies** — Vue
> is a peer. Everything in `devDependencies` (Vite, Vitest, jsdom) is build/test
> tooling only and is never shipped, so `npm audit` findings there don't affect
> apps that install this package.

---

## Quick start

```vue
<script setup>
import { ref } from 'vue';
import { ScrambleEditor } from 'scramble-editor-vue';
import 'scramble-editor-vue/style.css';

const doc = ref(loadFromMyBackend());   // v-model — the host owns the document
const editor = ref(null);               // template ref — imperative API

// The host owns storage. Return a URL (or { url }).
const adapters = {
  upload: async (file) => ({ url: await myStorage.put(file) }),
  fetchContacts: async (q) => myApi.contacts(q),
  fetchEmbedMeta: async (url) => myApi.embedMeta(url),
};
</script>

<template>
  <ScrambleEditor
    ref="editor"
    v-model="doc"
    :readonly="false"
    :features="{ slashMenu: true, toolbar: true, dragAndDrop: true, shortcuts: true }"
    :adapters="adapters"
    @ready="onReady"
    @change="(d) => saveToMyBackend(d)"
    @event="({ type, detail }) => audit(type, detail)"
  />
</template>
```

Or register globally as a plugin:

```js
import Scramble from 'scramble-editor-vue';
import 'scramble-editor-vue/style.css';
app.use(Scramble); // <ScrambleEditor> available everywhere
```

---

## Core concepts

### The document model

A document is plain, serializable data — a tree of blocks. `v-model` owns it; the
host persists it however it likes.

```js
// Document
{
  id: 'doc-1',
  title: 'My page',
  style: { fullWidth: false, smallText: false, font: 'default' },
  blocks: [ /* Block[] */ ],
}

// Block
{
  id: 'b1',
  type: 'paragraph',            // must exist in the registry
  data: {                       // type-specific; text blocks use segments
    segments: [{ text: 'Hello ', marks: [] }, { text: 'world', marks: ['bold'] }],
  },
  props: { color, background, collapsed },  // optional
  children: [],                 // nested blocks (toggle, columns, lists, callout)
}
```

Everything is data — no HTML is stored as the source of truth. That's what makes
persistence, collaboration, and export trivial.

### Blocks

A block **type** is a Vue component **plus** a registry entry (`create`,
`toMarkdown`, `toHTML`, metadata). Built-ins:

> paragraph, heading 1–3, quote, bulleted/numbered/checklist, toggle, callout,
> banner, divider, code, image/video/audio/file, embed, bookmark, **web page**,
> **document**, table, table-of-contents, columns, page-link, **slide** /
> **slides (presentation)** — plus your own via
> [`registerBlock`](#building-extensions-custom-blocks).

### Segments & marks

Inline formatting is stored as **marks on segments**, never raw HTML. A segment is
`{ text, marks: string[], link?, mention?, color?, background? }`. Helper functions
(`segmentsToHTML`, `segmentsToMarkdown`, `normalizeSegments`, …) are exported for
authoring block data and exporters.

---

## API reference

### Props

| Prop | Type | Purpose |
| --- | --- | --- |
| `v-model` (`modelValue`) | Object | The document — two-way bound. |
| `config` | Object | `{ blocks?: string[], toolbar?: string[], output?: 'markdown'\|'html', locked?: boolean }`. |
| `features` | Object | Toggle functionality: `slashMenu`, `shortcuts`, `toolbar`, `dragAndDrop`, `handleMenu`, `multiSelect`, `upload`, `mediaControls`, `pageStyle`, `fullscreen`. |
| `readonly` | Boolean | Render view-only. |
| `adapters` | Object | Your backend (all optional) — see [Adapters](#adapters). |
| `presence` | Array | Remote users `[{ id, name, color, blockId }]` (collaboration). |
| `comments` | Array | Comment threads `[{ id, blockId, resolved, messages }]`. |
| `focusMode` | Boolean | Dim inactive blocks. |
| `theme` | String | `'auto'` (default) \| `'light'` \| `'dark'`. |
| `width` | String\|Number | `'normal'` \| `'full'` \| `'75%'` \| `'50%'` (aliases `'three-quarter'`, `'half'`) \| a number (px) \| any CSS length. Reactive. |
| `fonts` | Array | Custom fonts `[{ id, label, family, url? }]`. Entries with `url` inject a `<link>`; picked from the page-style (**Aa**) menu. |

A `#footer` slot receives `{ words, chars }` for a word-count footer.

### Events

Every mutation emits a typed event **and** a catch-all `@event` with
`{ type, detail }` (ideal for an audit log / analytics):

`ready`, `change`, `update:modelValue`, `word-count`, `block-created`,
`block-updated`, `block-deleted`, `block-moved`, `block-converted`,
`block-duplicated`, `block-collapsed`, `block-link-copied`, `style-changed`,
`slash-opened`, `slash-selected`, `shortcut-applied`, `media-uploaded`,
`media-resized`, `media-configured`, `document-added`, `document-configured`,
`selection-blocks`, `page-link-open`, `cursor-changed`, `comment-added`,
`comment-resolved`, `mention-inserted`, `fullscreen-changed`.

```vue
<ScrambleEditor
  v-model="doc"
  @change="(d) => save(d)"
  @block-created="(e) => console.log('created', e.id)"
  @event="({ type, detail }) => log(type, detail)"
/>
```

### Methods (template ref)

```js
const editor = ref(null);
// editor.value.getMarkdown(), etc.
```

`getDocument()`, `setDocument(doc)`, `getMarkdown()`, `getHTML()`,
`getExport()` (per `config.output`), `getWordCount()`, `setStyle(patch)`,
`enable(feature)`, `disable(feature)`, `setReadonly(v)`,
`setFullscreen(v)` / `toggleFullscreen()` / `isFullscreen()`, `focus()`.

### Adapters

The component never calls a server; it calls the adapters you pass:

| Adapter | Signature | Powers |
| --- | --- | --- |
| `upload` | `(file) => { url } \| url` | Dropped/selected media & documents. |
| `fetchContacts` | `(query) => contact[]` | Mentions + the contact block. |
| `fetchEmbedMeta` | `(url) => { title, image, … }` | Bookmark previews. |
| `resolveDocumentUrl` | `({ url, type, name, blockId, file }) => url \| { url } \| { html }` | How the Document block previews a file (see [scenario 7](#7-documents-pdf--word--excel--powerpoint--odf)). |
| `listDocuments` | `() => [{ id, title }]` | The page-link picker. |

---

## Usage scenarios

### 1. Send & receive data (persistence)

The host owns the document. Load it into `v-model`, and save on `@change`
(debounced). "Send" = set `v-model` or call `setDocument`; "receive" = read
`@change` / `getDocument()`.

```vue
<script setup>
import { ref } from 'vue';
import { ScrambleEditor } from 'scramble-editor-vue';
import 'scramble-editor-vue/style.css';

const editor = ref(null);
const doc = ref(JSON.parse(localStorage.getItem('doc')) || undefined);

let t;
function onChange(next) {                 // receive edits
  clearTimeout(t);
  t = setTimeout(() => localStorage.setItem('doc', JSON.stringify(next)), 500);
}

function loadFromServer(serverDoc) {      // send a document in
  doc.value = serverDoc;                  // via v-model …
  // …or imperatively: editor.value.setDocument(serverDoc)
}
</script>

<template>
  <ScrambleEditor ref="editor" v-model="doc" @change="onChange" />
</template>
```

Swap `localStorage` for REST / GraphQL / WebSocket — nothing about the component
changes. See [`examples/PersistedEditor.vue`](examples/PersistedEditor.vue).

### 2. Read-only / published view

```vue
<ScrambleEditor :model-value="publishedDoc" readonly theme="light" />
```

`readonly` (or `config.locked`) turns off contenteditable and makes the handle
menu / slash / toolbar / shortcuts inert. See
[`examples/ReadonlyViewer.vue`](examples/ReadonlyViewer.vue).

### 3. Export to Markdown / HTML

Via the template ref, or the pure exporters (no component needed — e.g. on a
server or in a build step):

```js
// From a mounted editor:
editor.value.getMarkdown();
editor.value.getHTML();
editor.value.getExport();        // honors config.output

// Standalone, from a document object:
import { toMarkdown, toHTML } from 'scramble-editor-vue';
toMarkdown(myDoc);
toHTML(myDoc);
```

### 4. Gate features & blocks by config

```vue
<ScrambleEditor
  v-model="doc"
  :features="{ slashMenu: true, toolbar: true, dragAndDrop: false }"
  :config="{
    blocks: ['paragraph', 'heading-1', 'heading-2', 'bulleted-list', 'code'],
    toolbar: ['bold', 'italic', 'link', 'color'],
    output: 'html',
  }"
/>
```

`config.blocks` limits the slash menu / shortcuts, `config.toolbar` limits inline
tools, `config.output` picks the default export format. Toggle features at runtime
with `editor.value.enable('dragAndDrop')` / `disable(...)`.

### 5. Page style, width, fonts, theme

```vue
<ScrambleEditor
  v-model="doc"
  width="75%"
  theme="auto"
  :focus-mode="zenMode"
  :fonts="[
    { id: 'inter', label: 'Inter', family: '\"Inter\", sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap' },
  ]"
/>
```

- **Width** presets: `full`, `75%`, `50%` (or a px number / CSS length).
- **Fonts**: entries with a `url` inject a `<link>` automatically; the user picks
  them from the page-style **Aa** menu (alongside default/serif/mono).
- **Text color, highlight & badge**: select text → the toolbar's **A▾** opens a
  ClickUp-style panel with a vibrant palette: **Text color** (foreground),
  **Text highlight** (soft background wash), and **Badge** (a solid/soft pill),
  plus **Remove color**. Stored as palette tokens on the segment and exported as
  inline-style spans (`sc-badge` pill for badges). Gate with
  `config.toolbar: ['color', 'background', 'badge']`.
- **Full screen**: a built-in ⛶ button (Esc to exit), or drive it via
  `toggleFullscreen()` / the `fullscreen-changed` event; disable with
  `:features="{ fullscreen: false }"`.

### 6. Uploads & media

Drop image/video/audio files anywhere on the editor (or use a media block's
picker). The component calls `adapters.upload` and inserts the right block;
without an uploader it falls back to an object URL / URL field.

```js
const adapters = {
  upload: async (file) => {
    const url = await myStorage.put(file);   // S3, your API, …
    return { url, name: file.name };
  },
};
```

Image / video / embed / web-page / document blocks resize by dragging the corner
or via the ⚙ gear. Uploads emit `media-uploaded`; resizes emit `media-resized`.

> **Tip (persistence):** object URLs (`URL.createObjectURL`) don't survive a
> reload. Return a durable URL from your storage, or (in a demo) a data URL — see
> [`examples/HostApp.vue`](examples/HostApp.vue).

### 7. Documents (PDF / Word / Excel / PowerPoint / ODF)

Insert a **Document** block (`/document`), then upload or paste a link (or set
`data.url` programmatically). The type is auto-detected. PDFs preview natively.
For Office/ODF you supply how to preview via `resolveDocumentUrl`, which can return:

- a **URL** (`string` or `{ url }`) to embed in an iframe (e.g. a signed public
  URL your backend serves, or a viewer like Office Online / Google Viewer), or
- **`{ html }`** to render client-side output in an isolated, sandboxed iframe
  (e.g. convert a dropped `.docx`/`.xlsx` with `mammoth` / SheetJS).

```js
const adapters = {
  upload: async (file) => ({ url: await myStorage.put(file), name: file.name }),

  resolveDocumentUrl: async ({ url, type, file }) => {
    if (type === 'pdf') return url;                 // native
    if (/^https?:/.test(url)) return url;           // public → component uses a viewer
    // Local file → render client-side and hand back HTML:
    if (type === 'word') {
      const mammoth = await import('mammoth');
      const buf = file ? await file.arrayBuffer() : await (await fetch(url)).arrayBuffer();
      return { html: (await mammoth.convertToHtml({ arrayBuffer: buf })).value };
    }
    return '';                                      // '' → default viewer / download fallback
  },
};
```

Without an adapter, the component defaults to native PDF + the Microsoft Office
Online viewer (which needs a **public** URL), with a download fallback otherwise.
Emits `document-added` / `document-configured`. The example renders docx/xlsx
locally this way, since local uploads aren't public URLs.

### 8. Pasting from the web & Word

Pasting rich HTML becomes **structured blocks** — headings, paragraphs, lists,
quotes, code, tables and images each become their own block instead of one
flattened paragraph. Structural marks and links are kept; stray inline colors are
dropped. Pasting from **Word / Google Docs / Office** additionally strips MSO
cruft, maps heading styles, and rebuilds `mso-list` paragraphs into lists. No
configuration needed. See [`src/core/html-import.js`](src/core/html-import.js).

### 9. Mentions & contacts

Typing `@` autocompletes from `adapters.fetchContacts` and inserts a mention
segment (`mention-inserted`).

```js
const adapters = {
  fetchContacts: async (query) =>
    (await myApi.users(query)).map((u) => ({ id: u.id, name: u.name, email: u.email })),
};
```

The same adapter powers the sample **contact block**
([`examples/ContactBlock.vue`](examples/ContactBlock.vue)).

### 10. Comments

Pass `comments` in; the editor shows a badge + thread popover. Adding emits
`comment-added`, resolving emits `comment-resolved` — you persist and update the
prop.

```vue
<script setup>
const comments = ref(loadComments()); // [{ id, blockId, resolved, messages:[{author,text,at}] }]
function onAdded(e)   { comments.value.push(newThread(e)); persist(); }
function onResolved(e){ mark(e.id, true); persist(); }
</script>

<template>
  <ScrambleEditor v-model="doc" :comments="comments"
                  @comment-added="onAdded" @comment-resolved="onResolved" />
</template>
```

### 11. History / version restore

The component needs nothing special: snapshot on `@change`, restore by setting
`v-model` (or `setDocument`).

```js
const versions = ref([]);
function onChange(doc) {
  versions.value.unshift({ at: Date.now(), doc: structuredClone(doc) });
  versions.value = versions.value.slice(0, 50);
}
function restore(v) { doc.value = structuredClone(v.doc); }
```

### 12. Live collaboration (presence + sync)

Scramble ships **no transport** — it gives you the signals to build presence on
any channel (WebSocket, WebRTC, `BroadcastChannel`, Yjs, …):

- **Out**: `@change` (broadcast the document) and `@cursor-changed`
  (`{ blockId, offset }` — broadcast the local caret).
- **In**: the `presence` prop — `[{ id, name, color, blockId }]`. The editor draws
  each remote user's avatar and a colored outline on the block they're editing.
  Apply remote document changes by updating `v-model`.

```vue
<script setup>
import { ref } from 'vue';

const doc = ref(loadDoc());
const presence = ref([]);
const me = { id: myId, name: myName, color: myColor };
const channel = new BroadcastChannel('scramble-room-42'); // swap for a WebSocket

// Receive remote doc + cursors
channel.onmessage = ({ data }) => {
  if (data.type === 'doc') doc.value = data.doc;                       // last-write-wins (your policy)
  if (data.type === 'cursor') presence.value = upsert(presence.value, data.user);
};

function onChange(next)  { channel.postMessage({ type: 'doc', doc: next }); }
function onCursor(pos)   { channel.postMessage({ type: 'cursor', user: { ...me, blockId: pos.blockId } }); }
</script>

<template>
  <ScrambleEditor
    v-model="doc"
    :presence="presence"
    @change="onChange"
    @cursor-changed="onCursor"
  />
</template>
```

For conflict-free multi-writer editing, feed a CRDT (e.g. Yjs) from `@change` and
push merged state back through `v-model`. A working two-tab
`BroadcastChannel` demo lives in
[`examples/HostApp.vue`](examples/HostApp.vue).

### 13. Presentations & block backgrounds

Insert a **Slides (presentation)** block (`/slides`) to build a slide deck inside
a document. Each **slide** is a container that holds any blocks (text, images,
video, embeds…), has a background **color or image** and an aspect ratio (16:9 /
4:3 / auto), and the deck's **▶ Present** button opens a full-screen slideshow
(← / → to navigate, **Esc** to exit); **+ Add slide** appends one.

Media added to a slide (image / video / document / web page / embed) **auto-fits
the slide**, scaled to contain while keeping its aspect ratio — so nothing
overflows. Drag the corner (or set a width in the ⚙ gear) to resize it
explicitly; the gear's **Fit to slide** button reverts to auto-fit.

Any block can have a background too — via the block handle menu (**Background
color** / **Background image…**) or programmatically:

```js
// inside a custom block, or via the exposed context
ctx.setBackground(blockId, { color: '#0b1e3b' });        // any CSS color
ctx.setBackground(blockId, { image: 'https://…/bg.jpg' }); // cover image
ctx.setBackground(blockId, { color: '', image: '' });     // clear
```

Backgrounds live on `block.props` (`backgroundColor` / `backgroundImage`), so
they're plain data — they persist and export (slides become `<section>`s with
inline backgrounds; Markdown separates slides with `---`).

---

## Building extensions (custom blocks)

`registerBlock()` is the public, stable API (frozen within a major version — see
`version`). A custom block is a Vue component **plus** a registry entry. Full
contract: [`docs/extensions.md`](docs/extensions.md).

### Anatomy of a block

```js
import { registerBlock } from 'scramble-editor-vue';
import MyBlock from './MyBlock.vue';

registerBlock({
  type: 'my-block',          // unique kebab-case id (required)
  label: 'My block',         // slash-menu label
  icon: '★',
  group: null,               // Turn Into group; same-group blocks are inter-convertible
  editableText: false,       // true if it hosts editable rich text (segments)
  component: MyBlock,        // Vue component; receives :block, calls useEditor()
  create: (data) => ({ ...data }),        // initial block.data
  toMarkdown: (block, h) => '…',          // h: renderSegments, renderChildren(Raw), doc
  toHTML: (block, h) => '…',
});
```

Inside the component, call `useEditor()` for the shared context, mutate
`block.data` directly (Vue re-renders), then call `ctx.markChanged()` (drives
`v-model`) and optionally `ctx.emitEvent(name, detail)`.

### A block that renders dynamic data

Custom blocks can fetch and render live data in their own way. The block stores
only the *inputs* (serializable), and pulls the *data* at render time through an
adapter you provide — so the document stays portable and the host owns the API.

**1) A `quote-ticker` block** — stores a stock symbol, renders a live price:

```vue
<!-- StockBlock.vue -->
<template>
  <div class="stock" :style="{ borderColor: up ? 'green' : 'crimson' }">
    <template v-if="block.data.symbol">
      <strong>{{ block.data.symbol }}</strong>
      <span v-if="quote">{{ quote.price }} ({{ quote.changePct }}%)</span>
      <span v-else>loading…</span>
      <button v-if="!readonly" @mousedown.prevent="refresh">↻</button>
    </template>
    <input
      v-else-if="!readonly"
      placeholder="Ticker, e.g. AAPL"
      @change="setSymbol($event.target.value)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useEditor } from 'scramble-editor-vue';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const quote = ref(null);
const up = computed(() => quote.value && quote.value.changePct >= 0);

async function refresh() {
  const sym = props.block.data.symbol;
  // The host supplies the API through an adapter — the component stays backend-free.
  const fetchQuote = ctx.adapters.value.fetchQuote;
  if (sym && fetchQuote) quote.value = await fetchQuote(sym);
}
function setSymbol(v) {
  props.block.data.symbol = String(v).trim().toUpperCase(); // store the input only
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();                                        // persists via v-model
  refresh();
}

onMounted(refresh);
watch(() => props.block.data.symbol, refresh);
</script>
```

**2) Register it and provide the data adapter:**

```js
import { registerBlock } from 'scramble-editor-vue';
import StockBlock from './StockBlock.vue';

registerBlock({
  type: 'quote-ticker',
  label: 'Stock quote',
  icon: '📈',
  component: StockBlock,
  create: (d = {}) => ({ symbol: d.symbol || '' }),
  // Export the *input*; live data isn't part of the document.
  toMarkdown: (b) => (b.data.symbol ? `**${b.data.symbol}** (live quote)` : ''),
  toHTML: (b) => (b.data.symbol ? `<b>${b.data.symbol}</b> (live quote)` : ''),
});
```

```vue
<ScrambleEditor
  v-model="doc"
  :adapters="{ fetchQuote: (sym) => myApi.quote(sym) }"
/>
```

Now `/Stock quote` inserts the block, the user types a ticker, and it renders the
live price — refreshing on change, persisting only the symbol. The same pattern
(store inputs → pull via adapter/prop → render your way) covers charts, database
rows, embeds, live dashboards, and more. A complete worked example is
[`examples/ContactBlock.vue`](examples/ContactBlock.vue) (searches your data,
stores the pick, renders a card, defines both exporters).

---

## Build & consume

```bash
npm run build     # → dist/scramble-editor.js (ESM), .umd.cjs (UMD), .css
```

Vite outputs an ESM + UMD bundle with Vue marked **external** (peer). Consume it:

```js
import { ScrambleEditor } from 'scramble-editor-vue';
import 'scramble-editor-vue/style.css';
```

Local link before publishing: `npm run build && npm pack` produces a tarball you
can `npm install ./scramble-editor-vue-0.1.0.tgz` in a test app.

## Publishing & CI

```bash
npm version patch      # bump version
npm run build
npm publish --access public
```

Two GitHub Actions workflows are included:

- **[.github/workflows/ci.yml](.github/workflows/ci.yml)** — on push / PR:
  installs, runs `npm test`, and `npm run build` on Node 18 + 20, uploading the
  `dist/` artifact.
- **[.github/workflows/publish.yml](.github/workflows/publish.yml)** — on a
  published GitHub Release: builds, tests, and `npm publish` (with provenance).
  Add an `NPM_TOKEN` repository secret to enable it.

## Project layout

```
src/
  ScrambleEditor.vue     # the component: reactive doc, mutations, v-model, events, exposed API
  index.js               # public entry (component + registerBlock + toMarkdown/HTML + helpers)
  core/                  # framework-free plain JS (Vitest-covered)
    segments.js  model.js  registry.js  exporter.js
    html-import.js  documents.js  block-exporters.js  ...
  composables/           # useEditor(), useEditableText, useMediaResize
  components/            # BlockView, SlashMenu, InlineToolbar, ...
  blocks/                # built-in blocks (Text, ListItem, Media, WebPage, Document, ...)
examples/                # host apps consuming the component (Gallery + Minimal/Persisted/Readonly/HostApp)
docs/extensions.md       # the stable extension contract
```

All `src/core/*` logic is unit-tested with Vitest; component behavior is tested
with `@vue/test-utils` + jsdom. See [Roadmap.md](Roadmap.md) for per-phase detail.

## License & contributions

**MIT** — see [LICENSE](LICENSE). You're welcome to **use it, fork it, and modify
it** freely, in personal or commercial projects.

This is a personally maintained project and is **not open for collaboration** —
there's no contribution tooling and external pull requests / issues aren't being
accepted. If you want changes, please **fork** and take it in your own direction.
