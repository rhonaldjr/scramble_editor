# Scramble

A Notion / ClickUp Docs–style **block editor delivered as one exclusive Vue 3
component**. Drop `<ScrambleEditor>` into any Vue 3 app, `v-model` the document,
listen to events, and wire your **own backend** through adapter functions.

> **Backend-agnostic by design.** Scramble ships no server. Persistence,
> uploads, contacts, embeds, collaboration, comments, and history are the host
> app's job — the component exposes an interface (`adapters` props + events) and
> the host implements the behavior. See [`examples/`](examples/).

- **Vue 3 + Vite**, single-file components. Only `src/core/*` is framework-free
  logic (segments, tree ops, export) — everything else is Vue.
- **`v-model`** the document (push and pull).
- **Typed events** for everything, plus a catch-all `@event`.
- **Imperative API** via template ref (`getMarkdown`, `setDocument`, `enable/disable`, …).
- **Extensible** — register a custom block as a Vue component.

## Requirements & scripts

Node 18+ (Vite 6).

```bash
npm install
npm run dev      # run the examples gallery (index.html → examples/)
npm run build    # build the library into dist/
npm test         # unit (Vitest) + component tests (jsdom)
```

> **Dependencies:** the published component has **no runtime dependencies** — Vue
> is a peer dependency. Everything in `devDependencies` (Vite, Vitest, jsdom) is
> build/test tooling only and is never shipped to consumers, so `npm audit`
> findings there do not affect apps that install this package.

## Usage

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
    @media-uploaded="(e) => console.log(e)"
    @event="({ type, detail }) => audit(type, detail)"
  />
</template>
```

### Props

| Prop | Type | Purpose |
| --- | --- | --- |
| `v-model` (`modelValue`) | Object | The document — two-way bound. |
| `config` | Object | `{ blocks?: string[], toolbar?: string[], output?: 'markdown'\|'html', locked?: boolean }`. |
| `features` | Object | Toggle functionality: `slashMenu`, `shortcuts`, `toolbar`, `dragAndDrop`, `handleMenu`, `multiSelect`, `upload`, `mediaControls`, `pageStyle`, `fullscreen`. |
| `readonly` | Boolean | Render view-only. |
| `adapters` | Object | Your backend: `upload(file)`, `fetchContacts(q)`, `fetchEmbedMeta(url)`, `listDocuments()`. All optional. |
| `presence` | Array | Remote users `[{ id, name, color, blockId }]` (collaboration). |
| `comments` | Array | Comment threads `[{ id, blockId, resolved, messages }]`. |
| `focusMode` | Boolean | Dim inactive blocks. |
| `theme` | String | `'auto'` (default) \| `'light'` \| `'dark'`. |
| `width` | String\|Number | `'normal'` (default) \| `'full'` \| `'half'` \| a number (px) \| any CSS length. Reactive. |
| `fonts` | Array | Custom fonts `[{ id, label, family, url? }]`. Entries with a `url` get a `<link>` injected automatically; selecting one in the page-style picker applies its `family`. |

Select any text and use the toolbar's **A▾** (text color) or **▮▾** (highlight)
buttons to color the foreground, background, or both for that range. Colors are
stored as palette tokens on the segment and exported as inline-style spans in
Markdown and HTML. Gate them with `config.toolbar` (`'color'`, `'background'`).

Pass custom fonts via the `fonts` prop; the host picks them from the page-style
(**Aa**) menu:

```vue
<ScrambleEditor
  :fonts="[
    { id: 'inter', label: 'Inter', family: '\"Inter\", sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap' },
  ]"
/>
```

Drop image/video/audio files anywhere on the editor and Scramble uploads them
(via `adapters.upload`, or an object-URL fallback) and inserts the matching
media block. Image/video/embed blocks resize by dragging the corner
(aspect-ratio preserved) or via the ⚙ gear's Width field.

A `#footer` slot receives `{ words, chars }` for a word-count footer.

### Events

`ready`, `change`, `update:modelValue`, `word-count`, and typed: `block-created`,
`block-updated`, `block-deleted`, `block-moved`, `block-converted`,
`block-duplicated`, `block-collapsed`, `slash-selected`, `shortcut-applied`,
`media-uploaded`, `media-resized`, `media-configured`, `selection-blocks`,
`page-link-open`, `cursor-changed`, `comment-added`, `comment-resolved`,
`mention-inserted`, `fullscreen-changed`, … plus a catch-all **`event`** with
`{ type, detail }`.

### Methods (template ref)

`getDocument()`, `setDocument(doc)`, `getMarkdown()`, `getHTML()`,
`getExport()` (per `config.output`), `getWordCount()`, `setStyle(patch)`,
`enable(feature)`, `disable(feature)`, `setReadonly(v)`,
`setFullscreen(v)` / `toggleFullscreen()` / `isFullscreen()`, `focus()`,
`registerBlock(def)`.

The built-in **⛶ expand button** (top-right) toggles a Notion-style full-screen
overlay; press **Esc** to exit. Disable it with `:features="{ fullscreen: false }"`
and drive it yourself via the methods above / the `fullscreen-changed` event.

## Bring your own backend

The component calls the adapters you pass and emits events; it never talks to a
server itself.

- **Persistence** — `v-model` + `@change`. Save/load however your app does (REST, GraphQL, localStorage…). The example uses `localStorage`.
- **`adapters.upload(file) → { url } | url`** — store dropped/selected media anywhere (S3, your API, an object URL). Without it, media blocks fall back to a URL field.
- **`adapters.fetchContacts(query) → contact[]`** — power mentions / a contact block.
- **`adapters.fetchEmbedMeta(url) → { title, image, … }`** — power bookmark previews.
- **Collaboration / comments / history** — consumed via events + adapters; the component provides hooks, the host provides transport/storage.

See [`examples/HostApp.vue`](examples/HostApp.vue) for a working host app that
implements persistence, autosave, an event log, and a mock upload adapter.

## Add your own block (Vue component)

```js
import { registerBlock } from 'scramble-editor-vue';
import MyBlock from './MyBlock.vue';

registerBlock({
  type: 'my-block',
  label: 'My block',
  icon: '★',
  component: MyBlock,                 // a .vue component; receives :block
  create: (data) => ({ ...data }),
  toMarkdown: (block, h) => '…',
  toHTML: (block, h) => '…',
});
```

Inside the component, call `useEditor()` for the shared context and mutate
`block.data` directly — Vue reactivity re-renders. See `src/blocks/*.vue`.

The full, stable extension contract (public API, `useEditor` context, adapters,
events) is documented in **[docs/extensions.md](docs/extensions.md)**. A worked
custom-block example is [`examples/ContactBlock.vue`](examples/ContactBlock.vue),
registered by the host in [`examples/HostApp.vue`](examples/HostApp.vue).

## Blocks

paragraph, heading 1–3, quote, bulleted/numbered/checklist, toggle, callout,
banner, divider, code (highlight.js), image/video/audio/file (upload + resize +
gear), embed, bookmark, table, table-of-contents, columns, page-link — plus your
own via `registerBlock`.

## Status

Feature-complete against the reference implementation: blocks above, Turn Into +
handle menu + colors, config gating + page style + per-config export, collapsible
blocks, media, multi-block selection + cross-block copy/delete + columns, the
extension API, and interfaces for collaboration / comments / mentions / history
(host-wired — see [examples/HostApp.vue](examples/HostApp.vue)). All core logic
is unit-tested (Vitest); component tests use `@vue/test-utils` + jsdom. See
[Roadmap.md](Roadmap.md) for per-phase detail. Remaining work is browser-pass
verification (this repo was authored without a browser).

## Examples

`npm run dev` opens a gallery ([examples/Gallery.vue](examples/Gallery.vue)) with:

- **Full host app** ([HostApp.vue](examples/HostApp.vue)) — persistence
  (localStorage autosave), event audit log, uploads, mentions, comments, version
  history, presence over `BroadcastChannel`, focus mode, theme.
- **Minimal** ([MinimalEditor.vue](examples/MinimalEditor.vue)) — just `v-model`.
- **Persistence** ([PersistedEditor.vue](examples/PersistedEditor.vue)) — the
  load / debounced-autosave / manual-save pattern in isolation.
- **Read-only viewer** ([ReadonlyViewer.vue](examples/ReadonlyViewer.vue)) — a
  published-page view + export.
- Custom block ([ContactBlock.vue](examples/ContactBlock.vue)) registered from
  the host app.

## Build & consume

Build the library:

```bash
npm run build     # → dist/scramble-editor.js (ESM), .umd.cjs (UMD), .css
```

Vite outputs an ESM + UMD bundle with Vue marked **external** (peer). Consume the
built package from another app:

```js
// package.json depends on "scramble-editor-vue" and "vue"
import { ScrambleEditor } from 'scramble-editor-vue';
import 'scramble-editor-vue/style.css';
```

Or globally register it as a plugin:

```js
import Scramble from 'scramble-editor-vue';
import 'scramble-editor-vue/style.css';
app.use(Scramble); // <ScrambleEditor> available everywhere
```

Local link before publishing: `npm run build && npm pack` produces a tarball you
can `npm install ./scramble-editor-vue-0.1.0.tgz` in a test app.

## Publishing

```bash
npm version patch      # bump version
npm run build
npm publish --access public
```

## Continuous integration (GitHub Actions)

Two workflows are included:

- **[.github/workflows/ci.yml](.github/workflows/ci.yml)** — on every push / PR:
  installs, runs `npm test`, runs `npm run build` on Node 18 + 20, and uploads
  the `dist/` artifact. (After you commit `package-lock.json`, switch the install
  step to `npm ci` for reproducible, cached installs.)
- **[.github/workflows/publish.yml](.github/workflows/publish.yml)** — on a
  published GitHub Release: builds, tests, and `npm publish` (with provenance).
  Add an `NPM_TOKEN` repository secret (an npm **Automation** token) to enable it.

## License

MIT.
