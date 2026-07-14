# CLAUDE.md

Guidance for Claude Code when working on Scramble. Read this before making changes.

## What This Project Is

Scramble is a **Notion / ClickUp Docs–style block editor delivered as one
exclusive Vue 3 component** (`<ScrambleEditor>`), built with **Vite**. There is
**no backend in this repo** — the component is backend-agnostic. Persistence,
uploads, contacts, embeds, collaboration, comments, and history are the **host
application's** responsibility, wired through `adapters` props and events the
component exposes. `examples/` shows a host app implementing them.

- **Framework**: Vue 3 (`<script setup>`, Composition API), Vite, `.vue` SFCs.
- **Only** `src/core/*` is framework-free plain JS (pure logic: segments, tree
  ops, registry, exporter). Everything else is Vue.
- **Output**: documents export to Markdown or HTML via each block's exporters.

## Commands

```bash
npm install     # dev/build tooling (Vite 6, Vitest, jsdom) — Node 18+
npm run dev     # run the examples gallery (index.html → examples/)
npm run build   # build the library into dist/
npm test        # unit (Vitest, framework-free core) + component tests (jsdom)
```

The shipped package has **no runtime deps** (Vue is a peer). Everything in
`devDependencies` is tooling only. CI/publish live in `.github/workflows/`.

## Repository Layout

```
src/
  ScrambleEditor.vue        # the component: reactive doc, mutations, v-model, events, exposed API
  index.js                  # library entry (component + registerBlock + toMarkdown/HTML)
  styles.css
  core/                     # FRAMEWORK-FREE plain JS (unit-tested)
    segments.js             # rich-text segments + marks (pure)
    model.js                # block-tree operations (pure)
    registry.js             # block registry (type -> definition)
    exporter.js             # Markdown / HTML export (pure)
    id.js
  composables/
    editor.js               # provide/inject key + useEditor()
    useEditableText.js      # contenteditable <-> segments bridge
  components/
    BlockView.vue           # recursive block renderer + drag
    SlashMenu.vue
    InlineToolbar.vue
  blocks/
    index.js                # registers built-ins (type -> Vue component + exporters)
    TextBlock.vue ListItem.vue Divider.vue CodeBlock.vue ImageBlock.vue ...
examples/                   # host apps consuming the component (Gallery + Minimal/Persisted/Readonly/HostApp)
.github/workflows/          # CI (test + build) and publish (npm) automation
```

## Implementation Rules

1. **Everything is Vue 3 + Vite.** New UI is a `.vue` SFC. The only non-Vue code
   is `src/core/*` (pure functions). Never reintroduce a vanilla DOM editor
   engine, and never import another UI framework.
2. **No backend inside the component.** The component must never call a server.
   It exposes an interface — `adapters` props and events — and the host wires
   storage/upload/collab/etc. Anything I/O-shaped becomes an adapter function or
   an event, demonstrated in `examples/`.
3. **Blocks are pure data.** A document is a tree of block objects; inline
   formatting is **marks in `segments`**, never raw HTML. A block type = a Vue
   component **plus** a registry entry (`create`, `toMarkdown`, `toHTML`, meta).
4. **Reactivity-driven.** Mutate the reactive `doc` (via `src/core/model.js`
   ops) and Vue re-renders — no manual re-render passes. Editing bridges the
   contenteditable DOM to `segments` through `useEditableText`.
5. **Everything observable.** Every mutation calls `markChanged()` (drives
   `v-model`) and `emitEvent()` (typed Custom-style events). Features hook
   events; they do not bypass them.
6. **Config- and feature-driven.** `config` gates available blocks/toolbar;
   `features` (+ `enable/disable`) toggle functionality; `readonly` renders
   view-only. Never hardcode which blocks/tools exist. UI chrome is styled from
   `--sc-*` design tokens (content: `--sc-text/bg/faint/muted/accent`; chrome:
   `--sc-btn-*`, `--sc-popover-*`, `--sc-bar-*`, `--sc-radius/border/danger`) —
   the host overrides them via the `tokens` prop. Never hard-code chrome colors
   in component CSS; add/consume a token.
7. **Extensible.** `registerBlock()` is the public API. Custom blocks are Vue
   components authored by consumers.

## Core Data Model

```js
// Document
{ id, title, style: { fullWidth, smallText, font }, blocks: [ /* Block[] */ ] }

// Block
{
  id, type,                     // type must exist in the registry
  data: {                       // type-specific. Text blocks use segments:
    segments: [ { text, marks: ['bold'], link?, mention? } ]
  },
  props: { color, background, collapsed },
  children: []                  // nested blocks (toggle, lists, callout, accordion)
}
```

Special blocks: `slides` (a deck whose
children are `slide` container blocks — background via `props.backgroundColor` /
`props.backgroundImage`, Present mode overlay), `table`
(`data.rows` = 2D grid of cell objects `{ segments, colSpan?, rowSpan?, covered? }`
via `core/table.js`; `data.colWidths` = per-column px; resize + merge/split;
legacy segment-array cells auto-upgrade), `toc` (renders from headings),
`page-link` (`data.docId`), media/embed (`data.url` + host-provided metadata),
`webpage` (`data.url` + `width`/`height` — live iframe preview), `document`
(`data.url`/`name`/`docType`/`width`/`height` — pdf/office/odf viewer resolved
via `adapters.resolveDocumentUrl` or a built-in default; see `core/documents.js`).
Rich-HTML paste is imported to structured blocks via `core/html-import.js`.
`button` (`data.label`/`url`/`target`/`action`/`variant`/`textColor`/`bgColor`;
`action: 'link'` navigates, `'event'` emits `button-clicked` for the host),
`accordion` (container of `accordion-item` blocks; each item = `data.segments`
title + collapsible children + `props.collapsed`; `accordion-item` is
`slashHidden`). Block layout is `props.align` ('left'|'center'|'right', applied
content-aware in BlockView) and `props.wrap` ('left'|'right' → float); set via
`ctx.setProps(id, patch)` from the handle menu or a block's gear.

## Block Registry Contract

```js
registerBlock({
  type, label, icon, group,        // group = Turn Into group ('text' | null)
  component,                       // Vue component (receives :block)
  componentProps?,                 // extra props (e.g. tag/marker)
  editableText?, listMarker?, continuationType?, void?, container?,
  initChildren?(make),             // container blocks: seed children on slash-insert (make = createBlock)
  create(data) => blockData,
  toMarkdown(block, helpers) => string,   // helpers: renderSegments, renderChildren(Raw), doc
  toHTML(block, helpers) => string,
});
```

## Editor Context (provide/inject)

`useEditor()` returns the shared context: `doc`, `config`, `adapters`,
`readonly`, `focusRequest`, `rootEl`, `isEnabled(feature)`, `emitEvent`,
`markChanged`, and mutations (`splitBlock`, `mergeWithPrevious`, `indent`,
`outdent`, `moveBlock`, `removeBlock`, `slashPick`, `focusPrevious/Next`,
`createBlock`, `requestFocus`). Block components call these instead of touching
internals.

## Host Interface (what the consumer wires — NOT in the component)

- **Persistence**: `v-model` + `@change` — the host saves/loads however it wants.
- **`adapters.upload(file) => { url } | url`** — store dropped/selected media.
- **`adapters.fetchContacts(query) => contact[]`** — mentions / contact block.
- **`adapters.fetchEmbedMeta(url) => meta`** — bookmark previews.
- **`adapters.resolveDocumentUrl({url,type,name,blockId,file}) => url | {url} | {html}`** — resolve the Document block's preview: a viewer URL, or client-side-rendered `{html}` (shown in a sandboxed iframe). Optional; falls back to native PDF + Office Online viewer.
- **Collaboration / comments / history**: consumed via events + adapters; the
  component provides hooks, the host provides transport/storage.

## Events Catalog

Typed events (also surfaced via a catch-all `@event` `{ type, detail }`):
`ready`, `change`, `update:modelValue`, `block-created`, `block-updated`,
`block-deleted`, `block-moved`, `block-converted`, `block-duplicated`,
`block-collapsed`, `selection-blocks`, `slash-opened`, `slash-selected`,
`shortcut-applied`, `media-uploaded`, `media-resized`, `media-configured`,
`document-added`, `document-configured`, `content-loaded`, `button-clicked`, `page-link-open`, `block-custom`. Add
new events here and document the payload where emitted.

## Testing Expectations

- **Vitest** for `src/core/*` (pure, no DOM) — the primary guaranteed coverage.
- Component behavior may be tested with `@vue/test-utils` + `jsdom` (add as a
  devDependency when writing those). Verify the demo in a browser after changes.

## Style

- Vue 3 `<script setup>`, Composition API. 2-space indent, semicolons, single quotes.
- Small SFCs; share logic via composables in `src/composables/`.
- Keep `src/core/*` free of any Vue import.

## Do Not

- No backend, server, or direct network calls inside the component (use adapters/events).
- No vanilla DOM editor engine; no non-Vue UI framework.
- No storing rendered HTML as the document source of truth (marks in segments).
- No hardcoding which blocks/tools are available (read config).
- No external contribution tooling (no CONTRIBUTING.md, no PR templates).
```
