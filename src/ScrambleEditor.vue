<template>
  <div ref="rootEl" class="scramble-editor" :class="rootClasses" @input="onRootInput">
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
});
const emit = defineEmits([
  'update:modelValue', 'ready', 'change', 'event',
  'block-created', 'block-updated', 'block-deleted', 'block-moved', 'block-converted',
  'block-duplicated', 'block-link-copied', 'style-changed', 'block-collapsed',
  'slash-opened', 'slash-selected', 'shortcut-applied',
  'media-uploaded', 'media-resized', 'media-configured',
  'selection-blocks', 'page-link-open', 'cursor-changed',
  'comment-added', 'comment-resolved', 'mention-inserted', 'word-count',
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
  };
});

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
    const para = createBlock('paragraph');
    model.insertAfter(doc.blocks, id, para);
    requestFocus(para.id, 0);
    emitEvent('block:converted', { id, to: type });
  } else {
    const nb = createBlock(type);
    model.insertAfter(doc.blocks, id, nb);
    if (def.editableText) requestFocus(nb.id, 0);
    else { const para = createBlock('paragraph'); model.insertAfter(doc.blocks, nb.id, para); requestFocus(para.id, 0); }
    emitEvent('block:created', { id: nb.id });
  }
  markChanged();
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

// --- context provided to blocks ---
const ctx = {
  doc, config, adapters, readonly, focusRequest, drag, handle, rootEl,
  isEnabled, emitEvent, markChanged, requestFocus, clearFocus,
  createBlock, splitBlock, mergeWithPrevious, indent, outdent, moveBlock, removeBlock,
  focusPrevious, focusNext, slashPick,
  // V4
  turnInto: turnIntoBlock, turnIntoTargets, duplicate, moveUp: moveUpBlock, moveDown: moveDownBlock,
  setColor, copyLink, openHandleMenu, closeHandleMenu,
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

onMounted(() => {
  document.addEventListener('selectionchange', onCursorMove);
  emitEvent('editor:ready', { docId: doc.id });
  if (!props.modelValue) markChanged();
});
onBeforeUnmount(() => document.removeEventListener('selectionchange', onCursorMove));

// --- imperative API (template ref) ---
defineExpose({
  getDocument: () => clone(doc),
  setDocument,
  getMarkdown: () => toMarkdown(doc),
  getHTML: () => toHTML(doc),
  getExport: () => (config.value.output === 'html' ? toHTML(doc) : toMarkdown(doc)),
  getWordCount: () => ({ words: wordCount.value, chars: charCount.value }),
  setStyle,
  enable: (f) => { localFeatures[f] = true; },
  disable: (f) => { localFeatures[f] = false; },
  setReadonly: (v) => { localReadonly.value = v; },
  focus: () => { const first = doc.blocks[0]; if (first) requestFocus(first.id, 0); },
});
</script>
