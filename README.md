# Scramble

A lightweight, extensible block-based text editor inspired by Notion and ClickUp Docs. Built with Node.js and vanilla JavaScript, designed to be embedded in your own apps and extended with custom blocks.

## Background: What Notion and ClickUp Get Right

**Notion** is fully block-native. Everything (text, media, embeds, layouts, even sub-pages) is an independent, movable, convertible block. Its standout features: Turn Into conversion between block types, a block handle menu (duplicate, delete, copy block link, comment, color), slash commands, Markdown shortcuts, toggles and callouts, columns and nesting, synced blocks, auto Table of Contents, 500+ embeds, inline math, threaded comments on blocks, version history, and page styling (full width, typography).

**ClickUp Docs** is a strong block-aware editor optimized for work tied to app data. Its standout features: banners, collapsible headings, block color, sticky Table of Contents, tables, multi-block selection with drag guides, a full rich-text toolbar (underline, strikethrough, highlight, alignment), resolvable inline comment threads, nested subpages, page protection, templates, focus mode, word count, and export options.

Scramble adopts the best of both, scaled to a local, framework-free project: a block engine where blocks are pure data, Turn Into conversion, a handle menu, slash commands plus Markdown shortcuts, collapsible blocks, app-aware extension blocks (like a Contact block fed by your own data), per-page tool configuration, comments, version history, presence-based collaboration, and configurable Markdown or HTML output.

## Features

### Blocks

- **Structural**: paragraph, heading (h1-h3, collapsible), quote, callout, banner, divider, code (syntax highlighted)
- **Lists**: bulleted, numbered, checklist, toggle (collapsible, nestable)
- **Media**: image, video, audio, file (URL-based, optional local upload)
- **Embeds**: YouTube, generic iframe embed, web bookmark with preview
- **Data**: table (rows and columns), Table of Contents (auto-generated from headings, sticky)
- **Layout**: columns (side-by-side blocks), nested children on any container block, page-link block (sub-pages as blocks)
- **Advanced (optional phases)**: synced block (same content across pages), inline math (KaTeX), button block (triggers configurable actions)
- **Extension sample**: Contact block that pulls filtered contacts from your app API

### Editing and Interaction

- **Slash menu**: type `/` for every enabled block, plus colors and actions
- **Turn Into**: convert almost any block into any compatible type (text to heading to toggle to checklist, and so on)
- **Block handle menu (drag handle)**: duplicate, delete, turn into, move up/down, copy block link, comment, text color, background color
- **Markdown shortcuts**: `# `, `## `, `- `, `1. `, `[] `, `> `, ``` ``` ```, `---` auto-convert as you type
- **Inline formatting toolbar** on selection: bold, italic, underline, strikethrough, inline code, link, text color, highlight
- **Keyboard behavior**: Enter splits, Backspace merges, Tab/Shift+Tab nests and un-nests, arrows move focus
- **Multi-block selection**: click-drag or Shift+Arrow to select several blocks, then move, delete, or convert together
- **Collapsible headings and toggles**: hide content until the next same-level heading
- **Cross-block text selection** for copy and delete

### Collaboration and History

- **Presence**: see avatars and live cursors of other users on the page (WebSocket)
- **Block comments**: threaded, resolvable comments anchored to a block; `@mention` a contact inside comments and text
- **Version history**: automatic snapshots on save, list and restore previous versions

### Events

- Client side: DOM CustomEvents for every mutation (`block:created`, `block:updated`, `block:deleted`, `block:moved`, `block:converted`, `block:duplicated`, `selection:changed`, `comment:added`, `comment:resolved`, `mention:inserted`, `document:saved`, and more)
- Server side: Node EventEmitter hooks (`document:loaded`, `document:saved`, `block:validated`, `export:requested`, `history:snapshot`, `user:joined`, `user:left`, `comment:added`)

### Extensibility and Configuration

- **Extension API**: register custom blocks with `Scramble.registerBlock()`, including edit/view renderers, exporters, and Turn Into compatibility
- **Per-page configuration**: JSON config per page declares enabled blocks, toolbar tools, collaboration, comments, history, page style, and output format
- **Page styling**: full-width toggle, small text, font choice (default, serif, mono)
- **Configurable output**: export as Markdown or HTML per page config
- **Page lock**: mark a page read-only in its config

### Extras

- Focus mode (dim everything except the active block)
- Word count in the footer

## Project Structure

```
scramble/
├── server/
│   ├── index.js            # Express app + WebSocket server
│   ├── events.js           # Server-side EventEmitter hub
│   ├── storage.js          # JSON file storage for documents
│   ├── history.js          # Version snapshots and restore
│   ├── export.js           # Markdown / HTML exporters
│   ├── collab.js           # Presence + change broadcasting
│   └── api/
│       ├── documents.js    # CRUD + export routes
│       ├── comments.js     # Block comment threads
│       └── contacts.js     # Sample data API for Contact block and mentions
├── public/
│   ├── index.html          # Sample page hosting the editor
│   ├── editor/
│   │   ├── core.js         # Block engine, registry, event bus
│   │   ├── blocks/         # Built-in block definitions
│   │   ├── slash-menu.js
│   │   ├── handle-menu.js  # Drag handle + block actions
│   │   ├── toolbar.js      # Inline formatting toolbar
│   │   ├── shortcuts.js    # Markdown + keyboard shortcuts
│   │   ├── selection.js    # Multi-block selection
│   │   ├── comments.js     # Comment UI
│   │   └── collab-client.js
│   ├── extensions/
│   │   └── contact-block.js
│   └── styles.css
├── configs/
│   ├── default.json        # All blocks, HTML output, collab on
│   ├── notes.json          # Minimal blocks, Markdown output
│   └── readonly.json       # Locked page example
├── CLAUDE.md
├── README.md
└── Roadmap.md
```

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- A modern browser (Chrome, Firefox, Edge, Safari)

No database required. Documents, comments, and history are JSON files on disk. Syntax highlighting (highlight.js) and optional math (KaTeX) load from CDN in the browser, so no build step is needed.

## Running Locally

### Linux (Pop!_OS 22.04 LTS and similar)

```bash
# Install Node.js 18+ if needed
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

git clone <your-fork-url> scramble
cd scramble
npm install
npm run dev
```

Open http://localhost:3000.

### macOS

```bash
brew install node

git clone <your-fork-url> scramble
cd scramble
npm install
npm run dev
```

Open http://localhost:3000.

### Windows

1. Install Node.js 18+ LTS from https://nodejs.org
2. In PowerShell or Command Prompt:

```powershell
git clone <your-fork-url> scramble
cd scramble
npm install
npm run dev
```

Open http://localhost:3000.

### Testing collaboration

Open the same document URL in two browser windows (one normal, one private). You should see presence avatars, live cursors, and edits syncing.

## Configuration

Each page references a config file. Example (`configs/notes.json`):

```json
{
  "name": "notes",
  "output": "markdown",
  "blocks": ["paragraph", "heading", "bulleted-list", "checklist", "toggle", "code"],
  "toolbar": ["bold", "italic", "code", "link"],
  "collaboration": false,
  "comments": false,
  "history": true,
  "locked": false,
  "style": { "fullWidth": false, "smallText": false, "font": "default" }
}
```

Set `"output": "html"` for HTML export. Add `"contact"` to `blocks` to enable the Contact block on that page. Set `"locked": true` for a read-only page.

## Extending the Editor

```js
Scramble.registerBlock({
  type: "contact",
  label: "Contact",
  icon: "person",
  turnIntoGroup: null,          // null = not convertible; "text" joins text conversions
  create(data) { /* initial block data */ },
  renderEdit(block, ctx) { /* element for edit mode */ },
  renderView(block) { /* element for view mode */ },
  toMarkdown(block) { /* markdown string */ },
  toHTML(block) { /* HTML string */ }
});
```

The sample Contact block calls `GET /api/contacts?filter=<query>` and lets the author search and pick a contact while designing the page. In view mode it renders the saved contact as a card. The same contacts API powers `@mentions` in text and comments.

## Scripts

| Command        | Purpose                          |
|----------------|----------------------------------|
| `npm run dev`  | Start server with auto-reload    |
| `npm start`    | Start server (production mode)   |
| `npm test`     | Run unit tests                   |

## Contributing

This project does not accept external contributions. Pull requests and issues from outside collaborators will be closed. You are welcome to fork the repository and make any changes in your fork, subject to the license.

## License

MIT. Forks and modifications are permitted. See LICENSE for details.