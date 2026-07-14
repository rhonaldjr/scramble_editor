# Roadmap

Scramble is an **exclusive Vue 3 component** (Vite). It ships **no backend** —
the host application wires persistence, uploads, contacts, embeds, collaboration,
comments, and history through `adapters` props and events the component exposes
(see `examples/`). This roadmap tracks feature parity with the earlier reference
implementation, rebuilt strictly as Vue.

Legend: `[x]` done · `[ ]` not yet. "Done" means implemented in the Vue codebase;
items still need a real-browser pass on Node 18+ (this repo was scaffolded on a
Node 12 host without a browser — only `src/core/*` is machine-verified via Vitest).

## Phase V0 — Scaffold & Core (framework-free logic)

- [x] Vite + Vue 3 project, library build (`src/index.js`), demo (`src/demo`)
- [x] `src/core/segments.js`: segments + marks — split, slice, toggle, link, HTML/Markdown (Vitest)
- [x] `src/core/model.js`: tree ops — find, insert, remove, move, indent/outdent, merge (Vitest)
- [x] `src/core/registry.js` + `src/core/exporter.js`: registry + Markdown/HTML export (Vitest)
- [x] `useEditor()` context (provide/inject); `useEditableText` contenteditable ⟷ segments bridge

## Phase V1 — Text Engine & Editing

- [x] Blocks: paragraph, heading 1–3, quote, bulleted/numbered/checklist, divider
- [x] contenteditable editing synced to segments (reactive, caret-preserving)
- [x] Enter splits, Backspace-at-start merges, Tab/Shift+Tab indent, Arrow moves focus
- [x] Drag handle to reorder blocks
- [ ] Verify in a browser: type a full document, nesting + reorder work

## Phase V2 — Slash Menu, Markdown Shortcuts, Inline Toolbar

- [x] `/` opens a filterable block picker at the caret; selecting inserts/converts
- [x] Markdown shortcuts (`# `, `- `, `1. `, `[] `, `> `, ```` ``` ````, `---`, …)
- [x] Inline toolbar on selection: bold, italic, underline, strikethrough, code, link (marks)
- [ ] Verify in a browser: insert every block via slash + shortcuts, apply all marks

## Phase V3 — Persistence & Events Interface + Example Client

The component owns none of this — it exposes `v-model`, `@change`, typed events,
and adapter props. The host implements the behavior.

- [x] `v-model` (push/pull the document); `@change`; typed events + catch-all `@event`
- [x] `adapters` prop (`upload`, `fetchContacts`, `fetchEmbedMeta`) with graceful fallback
- [x] Imperative API via template ref: `getDocument/setDocument/getMarkdown/getHTML/enable/disable/setReadonly/focus`
- [ ] Example client (`examples/`) implementing localStorage persistence + autosave + event log + mock upload
- [ ] Verify: edits persist across reload in the example (host-side)

## Phase V4 — Turn Into, Handle Menu, Colors

- [x] Turn Into: convert within a `group`, mapping segments + children (`block-converted`)
- [x] Block handle menu: Turn Into, Duplicate, Delete, Move up/down, Copy link, Text/Bg color
- [x] `props.color` / `props.background` applied in render
- [ ] Verify (browser): paragraph → heading → checklist round-trip; colors persist  <!-- core logic (turn-into/clone/colors) Vitest-verified; toggle joins the round-trip in V6 -->

<!-- Core: src/core/turn-into.js (canTurnInto/turnIntoTargets/turnInto), colors.js,
cloneWithIds in model.js. UI: components/HandleMenu.vue (panels: main/turn/text/bg),
BlockView handle click + rowStyle from props.color/background. ctx gains
turnInto/duplicate/moveUp/moveDown/setColor/copyLink + handle-menu state. -->


## Phase V5 — Config, Page Style, Export per Config

- [x] Block registry drives Markdown + HTML export; `getExport()` honors `config.output`
- [x] Config gating of slash menu / shortcuts / toolbar (`config.blocks` / `config.toolbar`)
- [x] `readonly` / `config.locked` view-only pass (contenteditable off; handle/slash/toolbar/shortcuts inert)
- [x] Page style controls: full width, small text, font (default/serif/mono) — `PageStyle.vue`, `doc.style`, `setStyle`, `style-changed`
- [ ] Verify (browser): same doc exports valid Markdown + HTML; locked doc is read-only; style toggles apply

<!-- Config gating added to markdown shortcuts (slash/toolbar already gated).
doc.style applied via rootClasses; components/PageStyle.vue control; ctx.setStyle +
`style-changed`; getExport()/setStyle exposed. Example passes :config + a
"Per config" export button. -->


## Phase V6 — Collapsible & Container Blocks

- [x] Code block with syntax highlighting (view mode, host-provided highlight.js)
- [x] Toggle block (collapsible, nested children) — completes the V4 Turn Into round-trip (group `text`)
- [x] Collapsible headings (hide following siblings until next same-level heading; `block-collapsed`)
- [x] Callout and banner blocks (icon + colored background + children)
- [ ] Verify (browser): collapse states persist; exports handle children  <!-- collapse rule + toggle/callout exports Vitest-verified -->

<!-- Core: src/core/collapse.js (headingLevel, visibleAfterCollapse). Toggle reuses
TextBlock (collapsibleChildren); Callout.vue serves callout + banner. BlockView
gains the collapse caret + visibleChildren; ScrambleEditor filters top-level via
visibleTop and adds ctx.toggleCollapsed + `block-collapsed`. -->


## Phase V7 — Media, Embeds, Table, TOC

- [x] Image/video/audio/file blocks (URL + drop upload via `adapters.upload`, caption) — one `MediaBlock.vue`
- [x] Media resize (drag) + gear config (align, video options); `media-resized`/`media-configured`
- [x] Embed (YouTube iframe + generic) and bookmark (via `adapters.fetchEmbedMeta`)
- [x] Table block: add/remove rows + columns, cell editing
- [x] Table of Contents block: auto from headings, sticky, click-scroll
- [ ] Verify (browser): each block edits, views, and exports in both formats  <!-- exporters (media/embed/bookmark/table/toc) + youtubeId Vitest-verified -->

<!-- Core: src/core/embed.js (youtubeId), src/core/block-exporters.js (framework-free
media/embed/bookmark/table/toc export). Components: MediaBlock (kind prop, resize +
gear), EmbedBlock, BookmarkBlock, TableBlock + TableCell, TocBlock. blocks/index.js
registers all; ScrambleEditor emits media-resized/media-configured. -->


## Phase V8 — Extension API & Contact Block

- [x] `registerBlock()` public API (custom block = Vue component + registry entry)
- [x] Document + freeze the public extension contract (`docs/extensions.md`; `useEditor` + `version` + helpers exported from `src/index.js`)
- [x] Contact block sample fed by `adapters.fetchContacts` (edit search, view card, exporters)
- [ ] Verify (browser): register a custom Vue block from the example; insert, edit, export  <!-- registration + custom-block export path Vitest-verified -->

<!-- src/index.js now exports useEditor + version + segment helpers (the stable
contract). docs/extensions.md documents it. examples/ContactBlock.vue is a sample
custom block registered in HostApp.vue (search via adapters.fetchContacts, card
view, md/html exporters); added to the starter doc. -->


## Phase V9 — Multi-Block Selection & Layout

- [x] Multi-block selection (rubber-band / Esc-select / Arrow / Shift+Arrow / Cmd-click); group move, delete, convert, color
- [x] Cross-block text selection for copy + delete
- [x] Columns + column blocks (side-drop to create; nested render + export)
- [x] Page-link block (host provides doc list via `adapters.listDocuments`; `page-link-open` event)
- [ ] Verify (browser): select five blocks and convert; two-column layout survives reload + export  <!-- columns/page-link export Vitest-verified; interactive selection needs a browser -->

<!-- ScrambleEditor: selection state + group ops (delete/convert/color/move) +
createColumns. components/SelectionLayer.vue (toolbar, keyboard, cmd/shift-click,
rubber-band, cross-block copy+delete). blocks: Columns.vue/Column.vue (container:
true → BlockView skips default children + side-drop), PageLinkBlock.vue.
block-exporters gains pageLink*. Example provides adapters.listDocuments. -->


## Phase V10 — Collaboration (interface only)

- [x] Presence + change-broadcast **interface**: `@change` + `@cursor-changed` out, `presence` prop in (host owns transport)
- [x] Remote cursor / selection rendering driven by host-supplied presence data (avatars + colored block outline + name tags)
- [ ] Verify (browser): two tabs sync via the example's BroadcastChannel

<!-- ScrambleEditor: `presence` prop + presenceMap/presenceFor, `cursor-changed`
emit on selectionchange, presence avatar bar. BlockView: remote outline
(--sc-remote-color) + name tags. Example: BroadcastChannel broadcasts doc +
cursor and feeds :presence (naive last-write-wins, documented). -->


## Phase V11 — Comments, Mentions, History (interface only)

- [x] Comment threads anchored to a block; `comments` prop in + `comment-added`/`comment-resolved` out (host stores)
- [x] `@mention` autocompleted from `adapters.fetchContacts`; inserts a mention segment; `mention-inserted`
- [x] History: host snapshots on `@change`, restores via `v-model` (example version panel)
- [ ] Verify (browser): example implements comments + version restore host-side

<!-- ScrambleEditor: `comments` prop + commentsFor/openComments + insertMention;
components/CommentsLayer.vue (thread popover), MentionMenu.vue (@ via fetchContacts).
HandleMenu gains "Comment"; BlockView shows a comment badge. Example wires comments
to localStorage, a history version panel (snapshot on save + restore via v-model),
and mentions through fetchContacts. History needs no component code — host owns it. -->


## Phase V12 — Polish & Tests

- [x] Focus mode (`focusMode` prop, dims inactive blocks) + word count (`#footer` slot, `word-count` event, `getWordCount()`)
- [x] Styling pass; light/dark tokens (`theme` prop + `prefers-color-scheme`)
- [x] Component tests with `@vue/test-utils` + `jsdom` (`src/ScrambleEditor.test.js`); expanded Vitest core coverage
- [x] README accuracy pass (props/events/methods/blocks/status); lib build config verified
- [ ] Verify (browser + Node 18): `npm test` (Vitest incl. jsdom component tests) + `npm run build` produce `dist/`

<!-- ScrambleEditor: focusMode + theme props, activeBlockId tracking, wordCount/
charCount + `word-count` emit + `#footer` slot + getWordCount(). BlockView dims via
`.sc-dim`. styles.css: `.sc-dark`/prefers-color-scheme tokens + focus dim.
package.json: @vue/test-utils + jsdom. Component tests use `// @vitest-environment
jsdom`. -->


## Phase V13 — Rich Paste, Inline Color, Fonts, Web Page Block

Post-V12 enhancements. Import fidelity + inline styling + a live-URL block.

- [x] Inline text color / highlight / **badge** on a selection — ClickUp-style panel with a vibrant palette + "Remove color" (palette tokens; HTML+Markdown export; badge = solid/soft pill) — `setSegmentColor`/`clearSegmentColors`/`rangeField`, `colors.js` palettes, InlineToolbar color panel
- [x] Custom fonts interface (`fonts` prop: `{ id, label, family, url? }` → auto `<link>` + page-style picker) + example
- [x] Web page block: live iframe preview of a URL, free width/height resize, URL via ⚙ gear (`webpage` type)
- [x] Structured HTML paste: rich web-page HTML → real blocks (headings/lists/quotes/code/tables/images), not one flat paragraph — `core/html-import.js`
- [x] Backspace in an empty nested block outdents toward the parent before merging/removing
- [x] Paste from Word / Office / Google Docs, retaining format (mostly): strip Word `mso-`/conditional-comment cruft, map heading styles, reconstruct `mso-list` paragraphs into list blocks, read bold/italic/underline/strike from inline styles
- [x] Named viewport widths (`full` / `75%` / `50%`) on the `width` prop + example selector
- [ ] Verify (browser): copy a formatted Word doc and paste — headings, lists, bold/italic survive

<!-- Core: src/core/html-import.js (htmlToBlocks/nodeToBlocks/textToBlocks, Office
normalization). ScrambleEditor.pasteHTML mutation + useEditableText onPaste.
Blocks: WebPageBlock.vue + webpage registry entry + block-exporters webpage*.
segments.js setSegmentColor + colorStyle. Fonts wired via ScrambleEditor `fonts`
prop + ctx.fonts + PageStyle options. WIDTH_PRESETS in rootStyle. Example:
data-URL upload (survives reload), custom fonts, webpage block, width selector. -->


## Phase V14 — Document Viewer Block

Slash-inserted viewer for uploaded / linked office & PDF documents.

- [x] `document` block: insert via slash; empty state offers **upload** (`adapters.upload`) or **paste a link** (also settable programmatically via `v-model`)
- [x] Auto-detect type from extension/name/mime: pdf, doc/docx/odt/rtf, ppt/pptx/odp, xls/xlsx/ods/csv → render appropriately (native PDF iframe; Office/ODF through a viewer URL) with a graceful fallback + download link when no inline preview is possible
- [x] Free width/height resize (same as the web page block) + ⚙ gear (URL, type override, width, height)
- [x] Per-block pull interface: `adapters.resolveDocumentUrl({ url, type, name, blockId, file }) → url | { url } | { html }` (host resolves/proxies/signs, or renders client-side and returns HTML shown in a sandboxed iframe), with a built-in default (native PDF + Office Online viewer) the consumer can override; example renders docx/xlsx locally since local uploads aren't public
- [x] Events: `document-added`, `document-configured` (+ reuse `media-uploaded` / `media-resized`); example implements the resolver + logs the events
- [ ] Verify (browser): insert, upload each type + paste a link, resize, confirm resolver + events fire

<!-- Core: src/core/documents.js (detectDocType, docTypeLabel/Icon,
defaultViewerUrl — pure, Vitest). Block: DocumentBlock.vue + `document` registry
entry + block-exporters document*. ScrambleEditor emits document-added/configured.
Example: adapters.resolveDocumentUrl + event log. -->


## Phase V15 — Presentation / Slides & Block Backgrounds

Build slide-deck documents with multimedia, and give any block a background.

- [x] Block backgrounds: `props.backgroundColor` (any CSS color) + `props.backgroundImage` (URL) applied in render; set via the block handle menu; `ctx.setBackground(id, patch)`
- [x] Gear color selector (`GearColor.vue`): a visual swatch/native-picker + text + clear used wherever a gear offers a color (slide gear); default state is transparent (inherits the content background)
- [x] `slide` block (container): a framed slide (16:9 / 4:3 / auto) with a background color/image, holding any blocks — text, images, video, embeds, etc.; ⚙ gear for background + aspect ratio
- [x] `slides` deck (container): holds `slide` children; **▶ Present** enters a full-screen slideshow (←/→ to navigate, Esc to exit); **+ Add slide**
- [x] `initChildren` registry hook so a slash-inserted container seeds its initial children (deck → one slide → a paragraph); focus the first editable descendant
- [x] Exporters: slides/slide → HTML sections (backgrounds inline) and Markdown (`---`-separated); registered in the slash menu
- [x] Media in a slide auto-fits it (image/video/document/web page/embed contained, aspect ratio kept via container-query units) until explicitly resized; ⚙ "Fit to slide" reverts — `useSlideFit` + `scInSlide` provide
- [x] Slide sizing: the slide is a canvas whose aspect ratio is a *minimum* — in the editor it grows with content (no squished/overlapping text) and you can scroll; in Present it's a fixed box that clips overflow. Slide width is set only via the ⚙ gear (not draggable)
- [ ] Verify (browser): build a deck, drop media into slides, set backgrounds, present full-screen, export

<!-- BlockView rowStyle reads props.backgroundColor/backgroundImage. HandleMenu
gains a Background image item + custom color. ctx.setBackground. Blocks:
SlideBlock.vue + SlidesBlock.vue (Present overlay). registry initChildren hook +
slashPick seeding + focusFirstEditable. block-exporters slide*/slides*. Example
gains a starter deck. -->


## Phase V16 — Content Input Formats (HTML / Markdown, targeted load)

Load documents from **HTML** and **Markdown** in addition to JSON, and optionally
load parsed content into a specific block (replace / append / as children).

- [x] `markdownToBlocks(md)` — pure Markdown → block descriptors (headings, lists incl. to-do, quote, fenced code, hr, images, inline **bold**/*italic*/`code`/~~strike~~/links); mirrors `htmlToBlocks`
- [x] Export `htmlToBlocks` + `markdownToBlocks` from the public API
- [x] Imperative `setContent(content, { format: 'json'|'html'|'markdown', blockId?, mode? })` + `loadHTML()` / `loadMarkdown()` convenience methods; `mode` = `replace` (default, whole doc or target block) | `append` (after target) | `children` (into a container)
- [x] `content-loaded` event `{ format, blockId?, mode?, count }`
- [x] Example app: a "Load HTML / Markdown" panel demonstrating whole-doc load and load-into-a-block
- [ ] Verify (browser): paste Markdown/HTML into the loader → structured blocks; target a block and confirm replace/append/children

<!-- Core: src/core/markdown-import.js (markdownToBlocks/parseInline — pure,
Vitest). index.js exports htmlToBlocks + markdownToBlocks. ScrambleEditor:
setContent/loadHTML/loadMarkdown (materialize via createBlock, model.insertAfter/
removeBlock), content-loaded event. Reuses core/html-import.js. -->


## Phase V17 — Client-Themable UI (buttons, controls, chrome)

Let the host app restyle the editor's own UI (toolbar, menus, gear, slide/deck
buttons, present controls) — colors, text/label colors, borders, radius — without
forking CSS.

- [ ] Expose a documented set of CSS custom properties (design tokens) for the editor chrome: button background/hover/active, button text, accent, border, radius, popover background/foreground, etc.
- [ ] Refactor component styles to consume those tokens (buttons, toolbar, slash/handle/color panels, gear, slides/deck + present controls) instead of hard-coded colors
- [ ] Optional `theme` prop object (or `--sc-*` overrides) the host can pass; document precedence (host tokens > built-in light/dark)
- [ ] Example app: a small "Brand" control that live-restyles the editor's buttons/accent to show it working
- [ ] Verify (browser): host overrides recolor all controls in light + dark without touching content styling


## Manual Test Checklist (after each phase, on Node 18+)

1. `npm install` then `npm run dev` starts with no console errors
2. Type/edit a document; slash menu, shortcuts, toolbar work
3. `v-model` reflects edits; `@change`/typed events fire (see example event log)
4. The example client persists across reload (localStorage)
5. `getMarkdown()` / `getHTML()` return valid output
6. `npm test` (Vitest core) passes; `npm run build` produces `dist/`

## Out of Scope (belongs to the host, not the component)

- A concrete backend / database (the component is backend-agnostic)
- Auth, real-time transport, file storage (provided via adapters)
- Nuxt / SSR-specific concerns (component is client-side Vue 3)
