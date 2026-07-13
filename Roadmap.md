# Roadmap

Byte-size implementation plan. Each phase is independently runnable and verifiable. Complete a phase, run the checklist, commit, then start the next. Do not mix phases.

## Phase 0: Scaffold

- [x] `npm init`, `"type": "module"`, add `express` and `ws`
- [x] `server/index.js`: Express serving `public/`, port 3000 (or `PORT`)
- [x] `public/index.html`: editor mount point, script tags
- [x] npm scripts: `dev` (node --watch), `start`, `test`
- [x] Verify: server starts, page loads

## Phase 1: Block Engine (read-only)

- [x] `core.js`: registry (`registerBlock`, `getBlock`, `listBlocks`), segment/mark render helper
- [x] Blocks: paragraph, heading (h1-h3), bulleted-list, numbered-list, checklist, quote, divider
- [x] Render a hardcoded document tree (including nested children) in view mode
- [ ] Verify: sample document renders, nesting works  <!-- needs a real-browser click-through -->

<!-- registry + segment helpers split into registry.js and segments.js; DOM in
render.js. Covered by test/registry, test/segments, test/blocks. -->

## Phase 2: Live Editing

- [x] contenteditable editing for text blocks, synced to segments
- [x] Enter splits, Backspace at start merges, ArrowUp/Down move focus, Tab/Shift+Tab nest and un-nest
- [x] Drag handle to reorder with drop guides
- [x] Client event bus: `block:created/updated/deleted/moved`, `selection:changed`
- [ ] Verify: type a full document, events log to console  <!-- needs a real-browser click-through -->

## Phase 3: Slash Menu, Markdown Shortcuts, Toolbar

- [x] `/` opens filterable block picker at caret; selecting inserts
- [x] Markdown shortcuts: `# `, `## `, `### `, `- `, `1. `, `[] `, `> `, ```` ``` ````, `---` (emit `shortcut:applied`)
- [x] Inline toolbar on selection: bold, italic, underline, strikethrough, inline code, link (stored as marks)
- [ ] Verify: insert every block via slash and shortcuts, apply all marks  <!-- needs a real-browser click-through -->

<!-- Caret/selection helpers extracted to caret.js; block create/convert to
block-ops.js. Pure mark-range ops (toggle/link) in segments.js, covered by
test/marks. The ``` shortcut maps to `code`, which registers in Phase 7. -->


## Phase 4: Turn Into and Handle Menu

- [x] `turnIntoGroup` on registry entries; conversion maps segments and children; emit `block:converted`
- [x] Handle menu on drag handle click: Turn Into submenu, Duplicate, Delete, Move up/down, Copy block link, Text color, Background color (`props.color`, `props.background`)
- [x] Emit `block:duplicated`
- [ ] Verify: paragraph -> heading -> toggle -> checklist round trip, colors persist  <!-- needs a real-browser click-through; toggle joins the text group in Phase 7 -->

<!-- Turn Into mapping in turn-into.js (pure, test/turn-into); moveUp/moveDown in
model.js and duplicate/cloneWithIds in block-ops.js (test/blockops). Color
tokens in colors.js, applied via props.color/props.background in render.js. -->


## Phase 5: Persistence and Server Events

- [x] `storage.js`: JSON store in `data/` (`path.join`, Windows safe)
- [x] `api/documents.js`: CRUD routes
- [x] `events.js`: EventEmitter hub; `document:loaded`, `document:saved`
- [x] Debounced autosave + manual save; client emits `document:saved`
- [x] Verify: reload, document persists  <!-- server round-trip verified end-to-end via HTTP (create/edit/GET/list/404/400); client boot+autosave wiring still needs a real-browser confirm -->

<!-- storage.js is id-validated (no path traversal) and data-dir overridable via
SCRAMBLE_DATA_DIR (test/storage). Client: api.js + persistence.js (debounced,
coalesced autosave + Ctrl/Cmd+S). Also: clicking blank space below the last
block adds a trailing paragraph unless that block is already empty. -->


## Phase 6: Configs, Page Style, Export

- [x] Configs: `default.json`, `notes.json`, `readonly.json`; `GET /api/configs/:name`
- [x] Editor filters slash menu, shortcuts, and toolbar by config; `locked` renders view-only and server rejects saves
- [x] Page style controls: full width, small text, font (default/serif/mono)
- [x] `export.js`: walk tree, call `toMarkdown`/`toHTML` with helpers; `GET /api/documents/:id/export`; emit `export:requested`
- [x] Verify: same doc exports valid Markdown and HTML per config; locked page cannot be edited  <!-- server verified end-to-end via curl (config route, md+html export per config output, locked PUT -> 403); client-side view-only render + page-style UI still need a real-browser confirm -->

<!-- Block exporters (toMarkdown/toHTML) added to every block; driver in
server/export.js reuses the client block modules and segmentsToMarkdown/HTML
(test/export). Config filtering reads state.config in slash/shortcuts/toolbar.
export.js block exporters are what the ``` -> code block (Phase 7) will extend. -->


## Phase 7: Collapsible and Container Blocks

- [ ] Toggle block (collapsible, nested children)
- [ ] Collapsible headings: collapse hides content until next same-level heading (`block:collapsed`)
- [ ] Callout and banner blocks (icon + colored background + children)
- [ ] Code block syntax highlighting via highlight.js CDN (view mode)
- [ ] Verify: collapse states persist, exports handle children

## Phase 8: Media, Embeds, Table, TOC

- [ ] Image, video, audio, file blocks (URL-based)
- [ ] Embed block (YouTube iframe + generic URL) and bookmark block using `GET /api/embed-meta`
- [ ] Table block: add/remove rows and columns, cell editing
- [ ] Table of Contents block: auto-generated from headings, sticky option, click scrolls
- [ ] Verify: each block edits, views, and exports in both formats

## Phase 9: Extension API and Contact Block

- [ ] Freeze and document the public `Scramble.registerBlock()` contract
- [ ] `api/contacts.js`: seeded JSON contacts with `?filter=`
- [ ] `extensions/contact-block.js`: search input with filtered results in edit mode, saved contact card in view mode, both exporters
- [ ] Enable `contact` only in `default.json` to prove config gating
- [ ] Verify: insert, filter, pick, save, reload, export

## Phase 10: Multi-Block Selection and Layout

- [ ] Multi-block selection (click-drag, Shift+Arrow); group move, delete, convert, color
- [ ] Cross-block text selection for copy and delete
- [ ] Columns block: drag a block beside another to create columns; nested rendering and export
- [ ] Page-link block (sub-page as block)
- [ ] Verify: select five blocks and convert them all, two-column layout survives reload and export

## Phase 11: Live Collaboration

- [ ] `collab.js`: WebSocket rooms per document; presence with `user:joined`/`user:left`
- [ ] `collab-client.js`: avatars in header, colored outline on the block a remote user is editing (live cursors)
- [ ] Broadcast block ops (`create`, `update`, `delete`, `move`, `convert`), last-write-wins, emit `change:broadcast`
- [ ] Config flag `"collaboration": true|false`
- [ ] Verify: two windows sync presence, cursors, and edits

## Phase 12: Comments, Mentions, History

- [ ] `api/comments.js` + `comments.js` UI: threaded comments anchored to a block, resolve action (`comment:added`, `comment:resolved`)
- [ ] `@mention` in text and comments, autocompleted from the contacts API (`mention:inserted`)
- [ ] `history.js`: snapshot on every save (keep latest 50), list and restore endpoints, `history:restored` on client
- [ ] Verify: comment on a block, resolve it, restore an older version

## Phase 13: Advanced Blocks (optional)

- [ ] Synced block: `data.sourceBlockId`, editing the source updates all references across documents
- [ ] Inline math via KaTeX CDN (`$...$` shortcut)
- [ ] Button block: label + action (`emit-event` or `open-url`), fires `button:triggered`
- [ ] Optional local image upload endpoint (multipart, saved under `data/uploads/`)
- [ ] Verify: synced block updates in two documents

## Phase 14: Polish and Tests

- [ ] Unit tests: registry, Turn Into mapping, mark exporters, per-block exporters, config filtering, storage, history prune
- [ ] Focus mode (dim inactive blocks) and word count footer
- [ ] Styling pass in `styles.css`
- [ ] README accuracy pass: Linux, macOS, Windows instructions verified

## Manual Test Checklist (run after every phase)

1. `npm run dev` starts without errors
2. Page loads at http://localhost:3000, no console errors
3. Features from all earlier phases still work
4. Phase 5+: document survives reload
5. Phase 6+: export returns the configured format; locked page is read-only
6. Phase 11+: two windows sync presence and edits
7. Phase 12+: comments and history restore work

## Out of Scope

- Authentication and user accounts
- Databases
- CRDT/OT conflict resolution
- Notion-style inline databases with multiple views (Kanban, Calendar, Timeline)
- AI writing features
- Mobile-specific UI
