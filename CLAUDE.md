# CLAUDE.md

Guidance for Claude Code when working on Scramble. Read this before making changes.

## What This Project Is

Scramble is a block-based full-page editor (Notion / ClickUp Docs style) built with:

- **Server**: Node.js 18+, Express, `ws` for WebSockets, JSON file storage (no database)
- **Client**: Vanilla JavaScript (ES modules), no framework, no build step. highlight.js and KaTeX may load from CDN in the browser only
- **Output**: Documents export to Markdown or HTML based on per-page config

Primary test environment is Pop!_OS 22.04 LTS. Everything must also work on Windows and macOS. Never hardcode POSIX-only paths; always use `path.join()`.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start with auto-reload (node --watch server/index.js)
npm start          # production start
npm test           # run node:test unit tests
```

Server runs on http://localhost:3000. Port configurable via `PORT` env var.

## Implementation Rules

1. **Work in byte-size steps.** Follow Roadmap.md phase by phase. Complete one task, verify it runs in the browser, commit, then continue. Never implement multiple phases in one pass.
2. **No frameworks on the client.** Vanilla JS with ES modules. No React, no bundler, no TypeScript.
3. **Minimal dependencies.** Allowed server deps: `express`, `ws`, `marked` (optional). Browser CDN scripts allowed: highlight.js, KaTeX. Ask before adding anything else.
4. **Blocks are pure data.** A document is a tree of block objects. Rendering, editing, converting, and exporting are functions over that data. Never store rendered HTML as the source of truth. Inline formatting is stored as marks in block data, not raw HTML.
5. **Everything goes through the event bus.** Client mutations emit CustomEvents; server mutations emit EventEmitter events. New features hook into events, never bypass them.
6. **Config-driven.** Never hardcode which blocks, tools, or features are available. Read the page config and filter the registry and UI.
7. **Cross-platform.** `path.join`, no shell-specific npm scripts, LF line endings.

## Core Data Model

```js
// Document
{
  id: "doc-abc123",
  title: "My Page",
  config: "default",            // name of config in /configs
  style: { fullWidth: false, smallText: false, font: "default" },
  blocks: [ /* Block[] */ ],
  updatedAt: "ISO string"
}

// Block
{
  id: "blk-xyz789",
  type: "paragraph",            // must exist in the registry
  data: {
    // type-specific. Text blocks use rich segments:
    segments: [
      { text: "Hello ", marks: [] },
      { text: "world", marks: ["bold", "italic"] },
      { text: "@Jane", marks: [], mention: { contactId: "c1" } }
    ]
  },
  props: {                      // presentation, any block type
    color: null,                // text color token
    background: null,           // background color token
    collapsed: false            // toggles, collapsible headings
  },
  children: []                  // nested blocks (toggle, columns, lists, callout)
}

// Comment thread (stored per document in data/comments/)
{
  id: "cmt-1", blockId: "blk-xyz789", resolved: false,
  messages: [{ author: "user-1", text: "...", mentions: [], at: "ISO" }]
}

// History snapshot (data/history/<docId>/<timestamp>.json)
// Full document copy, written on save, pruned to the latest 50
```

Special block notes:
- **columns**: `children` is an array of column blocks; each column's `children` are its content
- **table**: `data.rows` is a 2D array of cell segment arrays
- **toc**: no data; renders from current headings at render time
- **synced**: `data.sourceBlockId`; render resolves the source block. Editing the source updates all references
- **page-link**: `data.docId`; renders the linked document title
- **embed / bookmark**: `data.url` plus cached metadata
- **button**: `data.label`, `data.action` (`emit-event`, `open-url`); actions run through the event bus

## Block Registry Contract

```js
{
  type: string,                 // unique, kebab-case
  label: string,                // slash menu label
  icon: string,
  turnIntoGroup: string|null,   // blocks sharing a group are inter-convertible
                                // built-in groups: "text" (paragraph, headings,
                                // lists, quote, callout, toggle), null = not convertible
  create(data?) => blockData,
  renderEdit(block, ctx) => HTMLElement,
  renderView(block) => HTMLElement,
  toMarkdown(block, helpers) => string,
  toHTML(block, helpers) => string,
  validate?(block) => boolean   // optional server-side validation
}
```

`ctx` provides `{ emit, update, api, config }`. `helpers` in exporters provides `renderChildren(block)` and `renderSegments(segments)` so blocks do not reimplement inline mark export.

Turn Into: converting within a group maps `segments` and `children` across types and emits `block:converted`. Converting a heading to a toggle keeps children; converting a list to paragraphs flattens items.

## Event Catalog

Client (CustomEvents on the editor root):
- Blocks: `editor:ready`, `block:created`, `block:updated`, `block:deleted`, `block:moved`, `block:converted`, `block:duplicated`, `block:collapsed`
- Input/UI: `selection:changed`, `slash:opened`, `slash:selected`, `shortcut:applied`, `mention:inserted`, `button:triggered`
- Comments: `comment:added`, `comment:resolved`
- Document: `document:saved`, `history:restored`

Server (EventEmitter in `server/events.js`):
- `document:loaded`, `document:saved`, `block:validated`, `export:requested`, `history:snapshot`, `comment:added`, `comment:resolved`, `user:joined`, `user:left`, `change:broadcast`

When adding a feature, add its events here and document the payload shape in a comment where the event is emitted.

## Collaboration Design

Keep it simple. No CRDTs, no Yjs, no operational transforms.
- WebSocket per open document: `ws://host/collab/:docId`
- Presence: server tracks connected clients per doc, broadcasts join/leave and cursor block position; client renders avatars and a colored outline on the block a remote user is editing
- Changes: client sends block-level ops (`create`, `update`, `delete`, `move`, `convert`); server applies last-write-wins and rebroadcasts
- Good enough for local testing; document conflicts as a known limitation

## API Endpoints

```
GET    /api/documents                  list
POST   /api/documents                  create
GET    /api/documents/:id              load
PUT    /api/documents/:id              save (writes history snapshot)
GET    /api/documents/:id/export       md or html per config
GET    /api/documents/:id/history      list snapshots
POST   /api/documents/:id/restore      restore a snapshot
GET    /api/documents/:id/comments     list threads
POST   /api/documents/:id/comments     add message / thread
PUT    /api/comments/:id/resolve       resolve thread
GET    /api/configs/:name              load page config
GET    /api/contacts?filter=q          contacts for Contact block and mentions
GET    /api/embed-meta?url=...         title/thumbnail for bookmark blocks
```

Respect `config.locked`: the server rejects saves to locked pages; the client renders view mode only.

## Testing Expectations

- Built-in `node:test` runner only
- Unit test: registry, Turn Into mapping, segment/mark exporters, both exporters per block, config filtering, storage, history prune
- Manual checklist at the end of Roadmap.md; run it after each phase
- Verify in the browser before declaring a phase done

## Style

- ES modules (`"type": "module"`)
- 2-space indent, semicolons, single quotes
- Small files: split past ~250 lines
- JSDoc on exported functions only

## Do Not

- No build step, bundler, or transpiler
- No authentication (single local user identity per browser tab is fine for presence)
- No databases
- No CRDT/OT
- No storing rendered HTML in documents
- No external contribution tooling (no CONTRIBUTING.md, no PR templates)
