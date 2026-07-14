<template>
  <div
    ref="rootEl"
    class="scramble-editor"
    :class="rootClasses"
    :style="rootStyle"
    @input="onRootInput"
    @click="onRootClick"
    @dragover="onRootDragOver"
    @drop="onRootDrop"
  >
    <button
      v-if="isEnabled('fullscreen')"
      class="sc-expand"
      :title="fullscreen ? 'Exit full screen (Esc)' : 'Full screen'"
      @mousedown.prevent="toggleFullscreen"
    >{{ fullscreen ? '✕' : '⛶' }}</button>
    <PageStyle v-if="showPageStyle" />
    <div v-if="presenceUsers.length" class="sc-presence">
      <span
        v-for="u in presenceUsers"
        :key="u.id"
        class="sc-presence__avatar"
        :style="{ background: u.color }"
        :title="u.name"
        >{{ initials(u.name) }}</span
      >
    </div>
    <BlockView v-for="block in visibleTop" :key="block.id" :block="block" />
    <SlashMenu />
    <InlineToolbar />
    <HandleMenu />
    <SelectionLayer />
    <CommentsLayer />
    <MentionMenu />
    <!-- Host-rendered footer (e.g. word count): <template #footer="{ words }">…</template> -->
    <slot name="footer" :words="wordCount" :chars="charCount" />
  </div>
</template>

<script setup>
import { reactive, ref, computed, provide, watch, onMounted, onBeforeUnmount } from 'vue';
import { EditorKey } from './composables/editor.js';
import { caretOffset } from './composables/useEditableText.js';
import BlockView from './components/BlockView.vue';
import SlashMenu from './components/SlashMenu.vue';
import InlineToolbar from './components/InlineToolbar.vue';
import HandleMenu from './components/HandleMenu.vue';
import PageStyle from './components/PageStyle.vue';
import SelectionLayer from './components/SelectionLayer.vue';
import CommentsLayer from './components/CommentsLayer.vue';
import MentionMenu from './components/MentionMenu.vue';
import { registerBuiltins } from './blocks/index.js';
import { getBlock } from './core/registry.js';
import { turnInto as coreTurnInto, turnIntoTargets } from './core/turn-into.js';
import { visibleAfterCollapse } from './core/collapse.js';
import { newId } from './core/id.js';
import * as model from './core/model.js';
import {
  splitSegmentsAt, sliceSegments, concatSegments, segmentsLength, isEmptySegments, normalizeSegments, segmentsText,
} from './core/segments.js';
import { toMarkdown, toHTML } from './core/exporter.js';
import { htmlToBlocks, textToBlocks } from './core/html-import.js';
import { markdownToBlocks } from './core/markdown-import.js';

registerBuiltins();

const props = defineProps({
  modelValue: { type: Object, default: null },
  config: { type: Object, default: () => ({}) },
  features: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
  adapters: { type: Object, default: () => ({}) }, // { upload, fetchContacts, fetchEmbedMeta, listDocuments }
  presence: { type: Array, default: () => [] },     // remote users: [{ id, name, color, blockId }]
  comments: { type: Array, default: () => [] },     // threads: [{ id, blockId, resolved, messages:[{author,text,at}] }]
  focusMode: { type: Boolean, default: false },     // dim inactive blocks
  theme: { type: String, default: 'auto' },         // 'auto' | 'light' | 'dark'
  width: { type: [String, Number], default: 'normal' }, // 'normal' | 'full' | 'half' | number(px) | CSS length
  fonts: { type: Array, default: () => [] },        // custom fonts: [{ id, label, family, url? }]
});
const emit = defineEmits([
  'update:modelValue', 'ready', 'change', 'event',
  'block-created', 'block-updated', 'block-deleted', 'block-moved', 'block-converted',
  'block-duplicated', 'block-link-copied', 'style-changed', 'block-collapsed',
  'slash-opened', 'slash-selected', 'shortcut-applied',
  'media-uploaded', 'media-resized', 'media-configured',
  'document-added', 'document-configured', 'content-loaded',
  'selection-blocks', 'page-link-open', 'cursor-changed',
  'comment-added', 'comment-resolved', 'mention-inserted', 'word-count', 'fullscreen-changed',
]);

const clone = (v) => JSON.parse(JSON.stringify(v));
function blankDoc() {
  return {
    id: newId('doc'),
    title: 'Untitled',
    style: { fullWidth: false, smallText: false, font: 'default' },
    blocks: [{ id: newId(), type: 'paragraph', data: { segments: [{ text: '', marks: [] }] }, props: {}, children: [] }],
  };
}

const rootEl = ref(null);
const doc = reactive(props.modelValue ? clone(props.modelValue) : blankDoc());
const focusRequest = ref(null);
const drag = reactive({ id: null });
const handle = reactive({ open: false, id: null, x: 0, y: 0 });
const selection = reactive({ ids: [], anchor: null });
const localFeatures = reactive({});
const localReadonly = ref(null);
let internalUpdate = false;

const config = computed(() => props.config || {});
const adapters = computed(() => props.adapters || {});
const readonly = computed(() =>
  localReadonly.value !== null ? localReadonly.value : Boolean(props.readonly || config.value.locked),
);
function isEnabled(feature) {
  const v = feature in localFeatures ? localFeatures[feature] : props.features[feature];
  return v !== false;
}

const activeBlockId = ref(null); // block with the caret (for focus mode)
const fullscreen = ref(false); // expand the editor to fill the viewport

// Page style (doc.style) applied as classes on the editor root.
const rootClasses = computed(() => {
  const s = doc.style || {};
  return {
    'sc-readonly': readonly.value,
    'sc-full-width': Boolean(s.fullWidth),
    'sc-small-text': Boolean(s.smallText),
    [`sc-font-${s.font || 'default'}`]: true,
    'sc-focus': Boolean(props.focusMode),
    'sc-dark': props.theme === 'dark',
    'sc-light': props.theme === 'light',
    'sc-fullscreen': fullscreen.value,
  };
});

// Full-screen expand (Notion/ClickUp style).
function setFullscreen(v) {
  const next = Boolean(v);
  if (next === fullscreen.value) return;
  fullscreen.value = next;
  emitEvent('fullscreen:changed', { fullscreen: next });
}
function toggleFullscreen() { setFullscreen(!fullscreen.value); }

// Named viewport presets for the `width` prop (max-width of the editor column).
const WIDTH_PRESETS = {
  full: '100%',
  'three-quarter': '75%', 75: '75%', '75%': '75%',
  half: '50%', 50: '50%', '50%': '50%',
};

// Programmable editor width (max-width) + custom font family.
const rootStyle = computed(() => {
  const s = {};
  if (!fullscreen.value) {
    const w = props.width;
    if (w != null && w !== 'normal') {
      const preset = WIDTH_PRESETS[w];
      s.maxWidth = preset || (typeof w === 'number' ? `${w}px` : String(w));
    }
  }
  const fontId = (doc.style && doc.style.font) || 'default';
  const custom = (props.fonts || []).find((f) => (f.id || f.value) === fontId);
  if (custom && custom.family) s.fontFamily = custom.family;
  return s;
});

// Inject a <link> for any custom font that provides a url (host convenience).
function ensureFontLinks() {
  if (typeof document === 'undefined') return;
  (props.fonts || []).forEach((f) => {
    if (f.url && !document.querySelector(`link[data-scramble-font="${f.url}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = f.url;
      link.setAttribute('data-scramble-font', f.url);
      document.head.appendChild(link);
    }
  });
}
watch(() => props.fonts, ensureFontLinks, { immediate: true, deep: true });

// Word / character count (Phase V12).
function blockText(b) {
  if (!b.data) return '';
  if (b.data.segments) return segmentsText(b.data.segments);
  if (typeof b.data.code === 'string') return b.data.code;
  if (b.data.rows) return b.data.rows.flat().map((c) => segmentsText(c)).join(' ');
  return '';
}
const wordCount = computed(() => {
  const t = model.flattenBlocks(doc.blocks).map(blockText).join(' ').trim();
  return t ? t.split(/\s+/).length : 0;
});
const charCount = computed(() => model.flattenBlocks(doc.blocks).map(blockText).join('').length);
const showPageStyle = computed(() => isEnabled('pageStyle') && !readonly.value);
const visibleTop = computed(() => visibleAfterCollapse(doc.blocks));

// Collaboration (interface only): remote presence in, local cursor out.
const presenceMap = computed(() => {
  const map = {};
  (props.presence || []).forEach((u) => {
    if (u && u.blockId) (map[u.blockId] = map[u.blockId] || []).push(u);
  });
  return map;
});
function presenceFor(id) { return presenceMap.value[id] || []; }
const presenceUsers = computed(() => props.presence || []);
function initials(name) {
  return String(name || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
}

// Comments (interface only): host provides threads via `comments`, stores on events.
const commentUi = reactive({ open: false, blockId: null, x: 0, y: 0 });
function commentsFor(blockId) {
  return (props.comments || []).filter((t) => t.blockId === blockId && !t.resolved);
}
function openComments(blockId, x, y) { commentUi.open = true; commentUi.blockId = blockId; commentUi.x = x; commentUi.y = y; }
function closeComments() { commentUi.open = false; commentUi.blockId = null; }

// Mentions (interface only): insert a mention segment; host resolves the contact.
function insertMention(blockId, atOffset, contact) {
  const loc = model.findBlock(doc.blocks, blockId);
  if (!loc) return;
  const segs = loc.block.data.segments;
  const len = segmentsLength(segs);
  const el = document.activeElement;
  const caret = el ? caretOffset(el) : len;
  const before = sliceSegments(segs, 0, atOffset);
  const after = sliceSegments(segs, Math.min(caret, len), len);
  const mention = { text: `@${contact.name}`, marks: [], mention: { contactId: contact.id } };
  loc.block.data.segments = normalizeSegments([...before, mention, { text: ' ', marks: [] }, ...after]);
  requestFocus(blockId, segmentsLength(before) + mention.text.length + 1);
  emitEvent('mention:inserted', { id: blockId, contactId: contact.id });
  markChanged();
}

// --- events + change ---
function emitEvent(name, detail) {
  emit('event', { type: name, detail });
  if (name === 'editor:ready') emit('ready', detail);
  else emit(name.replace(/:/g, '-'), detail);
}
function markChanged() {
  internalUpdate = true;
  emit('update:modelValue', clone(doc));
  emit('change', clone(doc));
  emit('word-count', { words: wordCount.value, chars: charCount.value });
}

// --- mutations ---
function createBlock(type, data = {}) {
  const def = getBlock(type);
  return { id: newId(), type, data: def ? def.create(data) : data, props: {}, children: [] };
}
function requestFocus(id, offset = 0) { focusRequest.value = { id, offset }; }
function clearFocus() { focusRequest.value = null; }

function splitBlock(id, offset) {
  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return;
  const def = getBlock(loc.block.type);
  const [before, after] = splitSegmentsAt(loc.block.data.segments, offset);
  if (def.listMarker && segmentsLength(loc.block.data.segments) === 0) {
    loc.block.type = 'paragraph';
    loc.block.data = getBlock('paragraph').create({ segments: after });
    requestFocus(id, 0);
    emitEvent('block:converted', { id, to: 'paragraph' });
    markChanged();
    return;
  }
  loc.block.data.segments = before;
  const nb = createBlock(def.continuationType || loc.block.type, { segments: after });
  model.insertAfter(doc.blocks, id, nb);
  requestFocus(nb.id, 0);
  emitEvent('block:created', { id: nb.id, after: id });
  markChanged();
}

// Paste rich HTML (or plain text) as structured blocks at the caret. A single
// inline fragment is spliced into the current block; multi-block content splits
// the current block and inserts real blocks in between (preserving structure).
function pasteHTML(id, offset, html, plainText) {
  let descriptors = html ? htmlToBlocks(html) : [];
  if (!descriptors.length && plainText) descriptors = textToBlocks(plainText);
  descriptors = descriptors.filter(Boolean);
  if (!descriptors.length) return false;

  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return false;
  const def = getBlock(loc.block.type);
  const editable = def && def.editableText;

  // Fast path: a single paragraph pasted into editable text → splice segments.
  if (editable && descriptors.length === 1 && descriptors[0].type === 'paragraph') {
    const pasted = descriptors[0].data.segments;
    const [before, after] = splitSegmentsAt(loc.block.data.segments, offset);
    loc.block.data.segments = normalizeSegments([...before, ...pasted, ...after]);
    requestFocus(id, offset + segmentsLength(pasted));
    emitEvent('block:updated', { id });
    markChanged();
    return true;
  }

  const created = descriptors.map((d) => createBlock(d.type, d.data));
  let anchor = id;
  const insertAll = () => created.forEach((b) => { model.insertAfter(doc.blocks, anchor, b); anchor = b.id; });

  if (editable && segmentsLength(loc.block.data.segments) === 0) {
    // Empty target block → replace it with the pasted blocks.
    insertAll();
    model.removeBlock(doc.blocks, id);
  } else if (editable) {
    const [before, after] = splitSegmentsAt(loc.block.data.segments, offset);
    loc.block.data.segments = before.length ? before : [{ text: '', marks: [] }];
    insertAll();
    if (segmentsLength(after) > 0) {
      const tail = createBlock('paragraph', { segments: after });
      model.insertAfter(doc.blocks, anchor, tail);
      anchor = tail.id;
    }
  } else {
    insertAll();
  }
  requestFocus(anchor, 0);
  emitEvent('block:created', { ids: created.map((b) => b.id), after: id });
  markChanged();
  return true;
}

// Backspace at the start of a block. An empty *nested* block outdents one level
// per press (walking left toward its parent) before we ever merge/delete — so an
// indented empty list item climbs back out instead of jumping into a sibling.
// Once at the top level it merges into the previous item, or (if nothing to
// merge into) drops the list marker and becomes a plain paragraph.
function outdentOrMerge(id) {
  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return false;
  const def = getBlock(loc.block.type);
  const empty = def && def.editableText && segmentsLength(loc.block.data.segments) === 0;
  if (empty && loc.parent) { outdent(id); return true; }
  if (mergeWithPrevious(id)) return true;
  if (empty && def && def.listMarker) {
    loc.block.type = 'paragraph';
    loc.block.data = getBlock('paragraph').create({ segments: loc.block.data.segments });
    requestFocus(id, 0);
    emitEvent('block:converted', { id, to: 'paragraph' });
    markChanged();
    return true;
  }
  return false;
}

function mergeWithPrevious(id) {
  const prev = model.previousBlock(doc.blocks, id);
  if (!prev) return false;
  const prevDef = getBlock(prev.type);
  const loc = model.findBlock(doc.blocks, id);
  if (prevDef && prevDef.editableText) {
    const offset = model.mergeInto(prev, loc.block);
    model.removeBlock(doc.blocks, id);
    requestFocus(prev.id, offset);
    emitEvent('block:deleted', { id });
    markChanged();
    return true;
  }
  if (segmentsLength(loc.block.data.segments) === 0) {
    model.removeBlock(doc.blocks, prev.id);
    requestFocus(id, 0);
    emitEvent('block:deleted', { id: prev.id });
    markChanged();
    return true;
  }
  return false;
}

function editableNeighbor(id, dir) {
  const flat = model.flattenBlocks(doc.blocks);
  let i = flat.findIndex((b) => b.id === id);
  i += dir;
  while (i >= 0 && i < flat.length) {
    const def = getBlock(flat[i].type);
    if (def && def.editableText) return flat[i];
    i += dir;
  }
  return null;
}
function focusPrevious(id) {
  const b = editableNeighbor(id, -1);
  if (!b) return false;
  requestFocus(b.id, segmentsLength(b.data.segments));
  return true;
}
function focusNext(id) {
  const b = editableNeighbor(id, 1);
  if (!b) return false;
  requestFocus(b.id, 0);
  return true;
}

function indent(id) { if (model.indentBlock(doc.blocks, id)) { requestFocus(id, 0); emitEvent('block:moved', { id }); markChanged(); } }
function outdent(id) { if (model.outdentBlock(doc.blocks, id)) { requestFocus(id, 0); emitEvent('block:moved', { id }); markChanged(); } }
function moveBlock(id, targetId, position) {
  if (model.moveBlock(doc.blocks, id, targetId, position)) { emitEvent('block:moved', { id, targetId, position }); markChanged(); }
}
function removeBlock(id) { if (model.removeBlock(doc.blocks, id)) { emitEvent('block:deleted', { id }); markChanged(); } }

// --- Turn Into, handle-menu actions, colors (Phase V4) ---
function turnIntoBlock(id, type) {
  const loc = model.findBlock(doc.blocks, id);
  if (loc && coreTurnInto(loc.block, type)) {
    requestFocus(id, 0);
    emitEvent('block:converted', { id, to: type });
    markChanged();
  }
}
function duplicate(id) {
  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return;
  const copy = model.cloneWithIds(loc.block, () => newId());
  model.insertAfter(doc.blocks, id, copy);
  emitEvent('block:duplicated', { id: copy.id, from: id });
  markChanged();
}
function moveUpBlock(id) { if (model.moveUp(doc.blocks, id)) { emitEvent('block:moved', { id }); markChanged(); } }
function moveDownBlock(id) { if (model.moveDown(doc.blocks, id)) { emitEvent('block:moved', { id }); markChanged(); } }
function setColor(id, prop, token) {
  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return;
  loc.block.props = loc.block.props || {};
  loc.block.props[prop] = token === 'default' ? null : token;
  emitEvent('block:updated', { id });
  markChanged();
}
// Set a block's background — `{ color?, image? }` (raw CSS color / image URL).
// Pass null/'' to clear a field; omit a field to leave it unchanged.
function setBackground(id, patch = {}) {
  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return;
  loc.block.props = loc.block.props || {};
  if ('color' in patch) loc.block.props.backgroundColor = patch.color || null;
  if ('image' in patch) loc.block.props.backgroundImage = patch.image || null;
  emitEvent('block:updated', { id });
  markChanged();
}
function copyLink(id) {
  const base = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
  const url = `${base}#${id}`;
  if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
  emitEvent('block:link-copied', { id, url });
}
function openHandleMenu(id, x, y) { handle.open = true; handle.id = id; handle.x = x; handle.y = y; }
function closeHandleMenu() { handle.open = false; handle.id = null; }

// --- multi-block selection + columns (Phase V9) ---
function selectableOrder() {
  return model.flattenBlocks(doc.blocks).filter((b) => b.type !== 'columns' && b.type !== 'column');
}
function setSelection(ids, anchor) {
  selection.ids = [...new Set(ids)];
  if (anchor !== undefined) selection.anchor = anchor;
  emitEvent('selection:blocks', { ids: selection.ids });
}
function clearSelection() { if (selection.ids.length) setSelection([], null); }
function isSelected(id) { return selection.ids.includes(id); }
function toggleSelect(id) {
  const s = new Set(selection.ids);
  if (s.has(id)) s.delete(id); else s.add(id);
  setSelection([...s], id);
}
function selectRange(anchorId, toId) {
  const order = selectableOrder().map((b) => b.id);
  const i = order.indexOf(anchorId);
  const j = order.indexOf(toId);
  if (i < 0 || j < 0) { setSelection([toId], toId); return; }
  const [lo, hi] = i <= j ? [i, j] : [j, i];
  setSelection(order.slice(lo, hi + 1), anchorId);
}
function deleteSelected() {
  const ids = [...selection.ids];
  ids.forEach((id) => model.removeBlock(doc.blocks, id));
  clearSelection();
  ids.forEach((id) => emitEvent('block:deleted', { id }));
  markChanged();
}
function turnIntoSelected(type) {
  const ids = [...selection.ids];
  ids.forEach((id) => { const loc = model.findBlock(doc.blocks, id); if (loc) coreTurnInto(loc.block, type); });
  ids.forEach((id) => emitEvent('block:converted', { id, to: type }));
  markChanged();
}
function colorSelected(prop, token) {
  selection.ids.forEach((id) => {
    const loc = model.findBlock(doc.blocks, id);
    if (loc) { loc.block.props = loc.block.props || {}; loc.block.props[prop] = token === 'default' ? null : token; }
  });
  selection.ids.forEach((id) => emitEvent('block:updated', { id }));
  markChanged();
}
function moveSelectedAfter(targetId) {
  const ids = selectableOrder().map((b) => b.id).filter((id) => selection.ids.includes(id) && id !== targetId);
  let anchor = targetId;
  ids.forEach((id) => {
    const b = model.removeBlock(doc.blocks, id);
    if (b) { model.insertAfter(doc.blocks, anchor, b); anchor = id; }
  });
  ids.forEach((id) => emitEvent('block:moved', { id, targetId }));
  markChanged();
}
function selectionTargets() {
  const blocks = selection.ids.map((id) => { const l = model.findBlock(doc.blocks, id); return l && l.block; }).filter(Boolean);
  const groups = new Set(blocks.map((b) => { const d = getBlock(b.type); return d && d.group; }));
  const g = groups.size === 1 ? [...groups][0] : null;
  return g ? turnIntoTargets(blocks[0].type).filter((d) => d.group === g) : [];
}

/** Wrap a dropped block beside a target into a columns layout. side='left'|'right'. */
function createColumns(draggedId, targetId, side) {
  const dLoc = model.findBlock(doc.blocks, draggedId);
  if (!dLoc || draggedId === targetId) return false;
  if (model.findBlock(dLoc.block.children || [], targetId)) return false;
  const draggedBlock = model.removeBlock(doc.blocks, draggedId);
  const newCol = createBlock('column');
  newCol.children = [draggedBlock];

  const parent = model.findBlock(doc.blocks, targetId).parent;
  if (parent && parent.type === 'column') {
    const colLoc = model.findBlock(doc.blocks, parent.id);
    const columnsBlock = colLoc && colLoc.parent;
    if (columnsBlock && columnsBlock.type === 'columns') {
      const idx = columnsBlock.children.indexOf(parent);
      columnsBlock.children.splice(side === 'left' ? idx : idx + 1, 0, newCol);
      emitEvent('block:moved', { id: draggedId, targetId, position: side });
      markChanged();
      return true;
    }
  }
  const loc = model.findBlock(doc.blocks, targetId);
  const targetCol = createBlock('column');
  targetCol.children = [model.removeBlock(doc.blocks, targetId)];
  const columnsBlock = createBlock('columns');
  columnsBlock.children = side === 'left' ? [newCol, targetCol] : [targetCol, newCol];
  loc.siblings.splice(loc.index, 0, columnsBlock);
  emitEvent('block:moved', { id: draggedId, targetId, position: side });
  markChanged();
  return true;
}

// --- collapse (Phase V6) ---
function toggleCollapsed(id) {
  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return;
  loc.block.props = loc.block.props || {};
  loc.block.props.collapsed = !loc.block.props.collapsed;
  emitEvent('block:collapsed', { id, collapsed: loc.block.props.collapsed });
  markChanged();
}

// --- page style (Phase V5) ---
function setStyle(patch) {
  doc.style = { ...(doc.style || {}), ...patch };
  emitEvent('style:changed', { style: { ...doc.style } });
  markChanged();
}

function slashPick(id, slashOffset, type) {
  const loc = model.findBlock(doc.blocks, id);
  if (!loc) return;
  const segs = loc.block.data.segments;
  const len = segmentsLength(segs);
  const el = document.activeElement;
  const caret = el ? caretOffset(el) : len;
  const remaining = concatSegments(sliceSegments(segs, 0, slashOffset), sliceSegments(segs, Math.min(caret, len), len));
  loc.block.data.segments = remaining;
  const def = getBlock(type);
  if (isEmptySegments(remaining) && def.editableText) {
    loc.block.type = type;
    loc.block.data = def.create({ segments: remaining });
    requestFocus(id, 0);
    emitEvent('block:converted', { id, to: type });
  } else if (isEmptySegments(remaining)) {
    loc.block.type = type;
    loc.block.data = def.create({});
    if (def.initChildren) loc.block.children = def.initChildren(createBlock);
    const para = createBlock('paragraph');
    model.insertAfter(doc.blocks, id, para);
    requestFocus(firstEditableId(loc.block.children) || para.id, 0);
    emitEvent('block:converted', { id, to: type });
  } else {
    const nb = createBlock(type);
    if (def.initChildren) nb.children = def.initChildren(createBlock);
    model.insertAfter(doc.blocks, id, nb);
    if (def.editableText) requestFocus(nb.id, 0);
    else {
      const inner = firstEditableId(nb.children);
      if (inner) requestFocus(inner, 0);
      else { const para = createBlock('paragraph'); model.insertAfter(doc.blocks, nb.id, para); requestFocus(para.id, 0); }
    }
    emitEvent('block:created', { id: nb.id });
  }
  markChanged();
}

// First editable-text block id in a subtree (for focusing inside a container).
function firstEditableId(blocks = []) {
  for (const b of blocks) {
    const d = getBlock(b.type);
    if (d && d.editableText) return b.id;
    const inner = firstEditableId(b.children || []);
    if (inner) return inner;
  }
  return null;
}

// --- markdown shortcuts (typed at the start of a block) ---
const MARKERS = [
  { match: '# ', type: 'heading-1' }, { match: '## ', type: 'heading-2' }, { match: '### ', type: 'heading-3' },
  { match: '- ', type: 'bulleted-list' }, { match: '* ', type: 'bulleted-list' }, { match: '1. ', type: 'numbered-list' },
  { match: '[] ', type: 'checklist' }, { match: '[ ] ', type: 'checklist' }, { match: '> ', type: 'quote' },
  { match: '```', type: 'code' }, { match: '---', type: 'divider' },
];
function onRootInput() {
  if (!isEnabled('shortcuts')) return;
  const el = document.activeElement;
  if (!el || !el.closest || !el.closest('[data-role="content"]')) return;
  const wrapper = el.closest('.sc-block');
  if (!wrapper) return;
  const loc = model.findBlock(doc.blocks, wrapper.dataset.blockId);
  if (!loc || !loc.block.data.segments) return;
  const text = (el.textContent || '').replace(/ /g, ' ');
  const marker = MARKERS.find((m) => m.match === text);
  if (!marker) return;
  const def = getBlock(marker.type);
  if (!def || loc.block.type === marker.type) return;
  // Respect config gating: only markers for enabled blocks fire.
  if (config.value.blocks && !config.value.blocks.includes(marker.type)) return;
  const remaining = sliceSegments(loc.block.data.segments, marker.match.length, segmentsLength(loc.block.data.segments));
  if (def.void) {
    loc.block.type = marker.type;
    loc.block.data = def.create({});
    const para = createBlock('paragraph');
    model.insertAfter(doc.blocks, loc.block.id, para);
    requestFocus(para.id, 0);
  } else {
    loc.block.data.segments = remaining;
    loc.block.type = marker.type;
    loc.block.data = def.create({ segments: remaining });
    requestFocus(loc.block.id, 0);
  }
  emitEvent('shortcut:applied', { id: loc.block.id, to: marker.type });
  emitEvent('block:converted', { id: loc.block.id, to: marker.type });
  markChanged();
}

// Clicking the blank area below the last block adds a trailing paragraph (or
// focuses the last block if it is already an empty text block) — like Notion.
function onRootClick(e) {
  if (readonly.value) return;
  if (e.target !== rootEl.value) return; // only the editor's own blank area
  if (selection.ids.length) return; // let a stray click clear selection first
  const blocks = doc.blocks;
  const last = blocks[blocks.length - 1];
  if (last) {
    const wrapper = rootEl.value.querySelector(`.sc-block[data-block-id="${last.id}"]`);
    if (wrapper && e.clientY < wrapper.getBoundingClientRect().bottom) return; // clicked above content
    const def = getBlock(last.type);
    if (def && def.editableText && segmentsLength(last.data.segments) === 0) {
      requestFocus(last.id, 0);
      return;
    }
  }
  const para = createBlock('paragraph');
  blocks.push(para);
  requestFocus(para.id, 0);
  emitEvent('block:created', { id: para.id });
  markChanged();
}

// Drag & drop local files anywhere on the editor: recognize the type and insert
// the matching media block (uploaded via adapters.upload, or an object URL as a
// no-adapter fallback so it still renders).
function mediaKind(type) {
  if (/^image\//.test(type)) return 'image';
  if (/^video\//.test(type)) return 'video';
  if (/^audio\//.test(type)) return 'audio';
  return 'file';
}
function onRootDragOver(e) {
  if (readonly.value || !isEnabled('upload')) return;
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault();
}
async function onRootDrop(e) {
  if (readonly.value || !isEnabled('upload')) return;
  const files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return; // block-reorder drops carry no files
  e.preventDefault();
  const upload = adapters.value.upload;
  const wrapper = e.target.closest && e.target.closest('.sc-block');
  let anchorId = wrapper ? wrapper.dataset.blockId : (doc.blocks[doc.blocks.length - 1] || {}).id;
  for (const file of Array.from(files)) {
    const kind = mediaKind(file.type);
    try {
      let url;
      if (typeof upload === 'function') {
        const r = await upload(file);
        url = typeof r === 'string' ? r : r.url;
      } else {
        url = URL.createObjectURL(file); // fallback: render the local file
      }
      const block = createBlock(kind, { url });
      if (anchorId) model.insertAfter(doc.blocks, anchorId, block);
      else doc.blocks.push(block);
      anchorId = block.id;
      emitEvent('media:uploaded', { id: block.id, kind, url, name: file.name });
      emitEvent('block:created', { id: block.id });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Scramble] file drop failed', err);
    }
  }
  markChanged();
}

// --- context provided to blocks ---
const ctx = {
  doc, config, adapters, readonly, focusRequest, drag, handle, rootEl,
  isEnabled, emitEvent, markChanged, requestFocus, clearFocus,
  createBlock, splitBlock, mergeWithPrevious, outdentOrMerge, indent, outdent, moveBlock, removeBlock,
  focusPrevious, focusNext, slashPick, pasteHTML,
  // V4
  turnInto: turnIntoBlock, turnIntoTargets, duplicate, moveUp: moveUpBlock, moveDown: moveDownBlock,
  setColor, setBackground, copyLink, openHandleMenu, closeHandleMenu,
  // V5
  setStyle,
  // V6
  toggleCollapsed,
  // V9
  selection, isSelected, setSelection, clearSelection, toggleSelect, selectRange,
  deleteSelected, turnIntoSelected, colorSelected, moveSelectedAfter, selectionTargets,
  selectableOrder, createColumns,
  // V10
  presenceFor,
  // V11
  commentUi, commentsFor, openComments, closeComments, insertMention,
  // V12
  activeBlockId, focusMode: computed(() => props.focusMode),
  fonts: computed(() => props.fonts || []),
};
provide(EditorKey, ctx);

// --- v-model in ---
watch(
  () => props.modelValue,
  (val) => {
    if (internalUpdate) { internalUpdate = false; return; }
    if (val) setDocument(val);
  },
);
function setDocument(val) {
  const next = clone(val);
  doc.id = next.id;
  doc.title = next.title;
  doc.style = next.style || doc.style;
  doc.blocks = next.blocks || [];
}

// Parse content of a given format into block descriptors / blocks.
function parseContent(content, format) {
  if (format === 'markdown' || format === 'md') return markdownToBlocks(String(content));
  if (format === 'html') return htmlToBlocks(String(content));
  // json: a document object, an array of blocks, or a JSON string of either
  let value = content;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } }
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.blocks)) return value.blocks;
  return [];
}

// Turn descriptors ({type,data}) or full blocks (with id) into real blocks.
function materialize(items) {
  return (items || []).filter(Boolean).map((it) => {
    if (it && it.id && it.type) {
      const b = clone(it);
      if (b.children) b.children = materialize(b.children);
      return b;
    }
    const b = createBlock(it.type, it.data || {});
    if (it.children) b.children = materialize(it.children);
    return b;
  });
}

/**
 * Load content from JSON | HTML | Markdown, into the whole document or a
 * specific block. Options: { format='json', blockId?, mode='replace' }.
 * mode: 'replace' (whole doc, or replace the target block), 'append' (insert
 * after the target), 'children' (set the target container's children).
 */
function setContent(content, options = {}) {
  const format = options.format || 'json';
  const blocks = materialize(parseContent(content, format));

  if (!options.blockId) {
    // Whole-document load. A full JSON doc also carries title/style.
    if (format === 'json' && content && !Array.isArray(content) && typeof content !== 'string' && content.blocks) {
      setDocument(content);
    } else {
      doc.blocks = blocks.length ? blocks : blankDoc().blocks;
    }
    emitEvent('content:loaded', { format, count: blocks.length });
    markChanged();
    return true;
  }

  const loc = model.findBlock(doc.blocks, options.blockId);
  if (!loc) return false;
  const mode = options.mode || 'replace';
  if (mode === 'children') {
    loc.block.children = blocks;
  } else {
    let anchor = options.blockId;
    blocks.forEach((b) => { model.insertAfter(doc.blocks, anchor, b); anchor = b.id; });
    if (mode === 'replace') model.removeBlock(doc.blocks, options.blockId);
  }
  emitEvent('content:loaded', { format, blockId: options.blockId, mode, count: blocks.length });
  markChanged();
  return true;
}

// Emit the local caret position so a host can broadcast presence.
function onCursorMove() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const el = node.nodeType === 1 ? node : node.parentElement;
  const content = el && el.closest && el.closest('[data-role="content"]');
  if (!content || !rootEl.value || !rootEl.value.contains(content)) return;
  const wrapper = content.closest('.sc-block');
  const blockId = wrapper && wrapper.dataset.blockId;
  activeBlockId.value = blockId;
  const pre = range.cloneRange();
  pre.selectNodeContents(content);
  pre.setEnd(range.endContainer, range.endOffset);
  emitEvent('cursor:changed', { blockId, offset: pre.toString().length });
}

// Esc exits full screen — but only when not editing text and nothing is
// block-selected, so it doesn't steal Esc from those interactions.
function onGlobalKey(e) {
  if (e.key !== 'Escape' || !fullscreen.value) return;
  const editing = document.activeElement && document.activeElement.closest
    && document.activeElement.closest('[data-role="content"], [data-role="code"], [data-role="cell"], input, textarea, select');
  if (!editing && selection.ids.length === 0) {
    setFullscreen(false);
    e.preventDefault();
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', onCursorMove);
  document.addEventListener('keydown', onGlobalKey);
  emitEvent('editor:ready', { docId: doc.id });
  if (!props.modelValue) markChanged();
});
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onCursorMove);
  document.removeEventListener('keydown', onGlobalKey);
});

// --- imperative API (template ref) ---
defineExpose({
  getDocument: () => clone(doc),
  setDocument,
  setContent,
  loadHTML: (html, options = {}) => setContent(html, { ...options, format: 'html' }),
  loadMarkdown: (md, options = {}) => setContent(md, { ...options, format: 'markdown' }),
  getMarkdown: () => toMarkdown(doc),
  getHTML: () => toHTML(doc),
  getExport: () => (config.value.output === 'html' ? toHTML(doc) : toMarkdown(doc)),
  getWordCount: () => ({ words: wordCount.value, chars: charCount.value }),
  setStyle,
  enable: (f) => { localFeatures[f] = true; },
  disable: (f) => { localFeatures[f] = false; },
  setReadonly: (v) => { localReadonly.value = v; },
  setFullscreen,
  toggleFullscreen,
  isFullscreen: () => fullscreen.value,
  focus: () => { const first = doc.blocks[0]; if (first) requestFocus(first.id, 0); },
});
</script>
