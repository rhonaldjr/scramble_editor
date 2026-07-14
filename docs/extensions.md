# Extending Scramble

Scramble is a Vue 3 component; every block is a Vue component plus a registry
entry. This is the **stable public contract** (frozen within a major version —
see `version` from the package). Add a block without forking the editor.

## Public API (`scramble-editor-vue`)

```js
import {
  ScrambleEditor,          // the component
  registerBlock, getBlock, listBlocks, hasBlock,
  useEditor,               // editor context, for use inside custom block components
  toMarkdown, toHTML,      // export a document object
  htmlToBlocks, markdownToBlocks,  // parse HTML / Markdown → block descriptors
  createSegment, segmentsText, segmentsToHTML, segmentsToMarkdown, normalizeSegments,
  version,
} from 'scramble-editor-vue';
```

## Registering a block

```js
import { registerBlock } from 'scramble-editor-vue';
import MyBlock from './MyBlock.vue';

registerBlock({
  type: 'my-block',        // unique, kebab-case (required)
  label: 'My block',       // slash-menu label
  icon: '★',
  group: null,             // Turn Into group; blocks sharing a group are inter-convertible
  editableText: false,     // true if it hosts editable rich text (segments)
  component: MyBlock,       // Vue component; receives :block, uses useEditor()
  componentProps: {},       // optional extra props passed to the component
  create(data) { return { /* initial block.data */ }; },
  toMarkdown(block, helpers) { return '…'; },
  toHTML(block, helpers) { return '…'; },
});
```

`helpers` for exporters: `renderSegments(segments)`, `renderChildren(block)`
(indented), `renderChildrenRaw(block)`, and `doc` (for tree-aware blocks like a
table of contents).

## Block component + `useEditor()`

A block component receives `:block` and calls `useEditor()` for the shared
context. Mutate `block.data` directly — Vue reactivity re-renders — then call
`ctx.markChanged()` (drives `v-model`) and, optionally, `ctx.emitEvent(...)`.

```vue
<script setup>
import { useEditor } from 'scramble-editor-vue';
const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();

function set(value) {
  props.block.data.value = value;
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
</script>
```

The `ctx` from `useEditor()` provides:

| Field | Purpose |
| --- | --- |
| `ctx.doc` | The reactive document (read for tree-aware blocks). |
| `ctx.config` / `ctx.adapters` / `ctx.readonly` | `.value` computed refs of the props. |
| `ctx.rootEl` | Ref to the editor root element. |
| `ctx.markChanged()` | Notify a change (emits `update:modelValue` + `change`). |
| `ctx.emitEvent(name, detail)` | Dispatch a typed editor event. |
| `ctx.isEnabled(feature)` | Feature-flag check. |
| Mutations | `createBlock`, `splitBlock`, `mergeWithPrevious`, `indent`, `outdent`, `moveBlock`, `moveUp/moveDown`, `removeBlock`, `duplicate`, `turnInto`, `setColor`, `setBackground` (`{ color?, image? }`), `setProps` (`{ align?, wrap?, … }` merged into `block.props`), `setStyle`, `toggleCollapsed`, `slashPick`, `requestFocus`. |

## Host interface (adapters) — the backend is yours

The component never calls a server. It calls adapters you pass:

- `adapters.upload(file) => { url } | url` — store media.
- `adapters.fetchContacts(query) => contact[]` — mentions / contact block.
- `adapters.fetchEmbedMeta(url) => { title, image, … }` — bookmark previews.

Persistence is `v-model` + `@change`.

## Collaboration (interface only)

The component ships **no** transport. It gives you the signals to build presence
on your own channel (WebSocket, BroadcastChannel, WebRTC, …):

- **Out**: `@change` (broadcast the document) and `@cursor-changed`
  (`{ blockId, offset }` — broadcast the local caret).
- **In**: the `presence` prop — an array of remote users
  `[{ id, name, color, blockId }]`. The editor renders each remote user's avatar
  and a colored outline on the block they're editing. Apply remote document
  changes by updating `v-model` (last-write-wins is your call).

`examples/HostApp.vue` wires this over `BroadcastChannel` so two tabs sync.

## Events

`ready`, `change`, `update:modelValue`, and typed: `block-created`,
`block-updated`, `block-deleted`, `block-moved`, `block-converted`,
`block-duplicated`, `block-collapsed`, `block-link-copied`, `style-changed`,
`slash-opened`, `slash-selected`, `shortcut-applied`, `media-uploaded`,
`media-resized`, `media-configured`, `document-added`, `document-configured`,
`selection-blocks`, `page-link-open`, `cursor-changed`, `comment-added`
(`{ blockId, text }`), `comment-resolved` (`{ id }`), `mention-inserted`
(`{ id, contactId }`), `word-count`, `fullscreen-changed`. A catch-all `event`
carries `{ type, detail }`. Custom blocks may raise their own via
`ctx.emitEvent`.

## Comments, mentions, history (interface only)

- **Comments** — pass `comments` (`[{ id, blockId, resolved, messages:[{author,text,at}] }]`);
  the editor shows a badge + thread popover. Adding emits `comment-added`,
  resolving emits `comment-resolved` — the host persists and updates the prop.
- **Mentions** — typing `@` autocompletes from `adapters.fetchContacts`; picking
  inserts a mention segment and emits `mention-inserted`.
- **History** — the host snapshots on `@change` and restores by setting `v-model`
  (the component needs nothing extra). See `examples/HostApp.vue` for a
  localStorage version panel.

## Worked example — a Contact block

`examples/ContactBlock.vue` + its registration in `examples/HostApp.vue` show a
custom block that searches your data in edit mode (`ctx.adapters.fetchContacts`),
stores the pick in `block.data.contact`, renders a card in view mode, and
defines both exporters — all through this public contract.
