<template>
  <div v-if="visible" class="sc-toolbar" :style="pos">
    <button
      v-for="t in tools"
      :key="t.mark"
      class="sc-toolbar__btn"
      :class="[t.cls, { active: activeMarks[t.mark] }]"
      @mousedown.prevent="apply(t.mark)"
    >
      {{ t.label }}
    </button>
    <button v-if="showColor" class="sc-toolbar__btn" title="Text color" @mousedown.prevent="togglePalette('color')">A▾</button>
    <button v-if="showBg" class="sc-toolbar__btn" title="Highlight" @mousedown.prevent="togglePalette('background')">▮▾</button>

    <div v-if="palette" class="sc-toolbar__palette" @mousedown.stop>
      <button
        v-for="tok in COLOR_TOKENS"
        :key="tok"
        class="sc-swatch2"
        :class="{ 'sc-swatch2--default': tok === 'default' }"
        :style="swatchStyle(tok)"
        :title="tok"
        @mousedown.prevent="applyColor(tok)"
      >{{ palette === 'color' && tok !== 'default' ? 'A' : '' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { findBlock } from '../core/model.js';
import { toggleMark, setLinkOnRange, rangeHasMark, setSegmentColor } from '../core/segments.js';
import { COLOR_TOKENS, TEXT_COLORS, BG_COLORS } from '../core/colors.js';

const ctx = useEditor();
const palette = ref(null); // null | 'color' | 'background'
const ALL = [
  { mark: 'bold', label: 'B', cls: 'is-bold' },
  { mark: 'italic', label: 'i', cls: 'is-italic' },
  { mark: 'underline', label: 'U', cls: 'is-underline' },
  { mark: 'strikethrough', label: 'S', cls: 'is-strike' },
  { mark: 'code', label: '</>', cls: 'is-code' },
  { mark: 'link', label: '🔗', cls: '' },
];

const visible = ref(false);
const pos = ref({});
const sel = ref(null);
const activeMarks = ref({});

const tools = computed(() => {
  const allowed = ctx.config.value && ctx.config.value.toolbar ? new Set(ctx.config.value.toolbar) : null;
  return allowed ? ALL.filter((t) => allowed.has(t.mark)) : ALL;
});
const showColor = computed(() => {
  const t = ctx.config.value && ctx.config.value.toolbar;
  return !t || t.includes('color');
});
const showBg = computed(() => {
  const t = ctx.config.value && ctx.config.value.toolbar;
  return !t || t.includes('background');
});

function togglePalette(kind) { palette.value = palette.value === kind ? null : kind; }
function swatchStyle(tok) {
  if (palette.value === 'color') return { color: TEXT_COLORS[tok] || 'inherit' };
  return { background: BG_COLORS[tok] || 'transparent' };
}
function applyColor(tok) {
  const range = sel.value;
  if (!range) return;
  const loc = findBlock(ctx.doc.blocks, range.id);
  if (loc) {
    loc.block.data.segments = setSegmentColor(loc.block.data.segments, range.start, range.end, palette.value, tok);
    ctx.emitEvent('block:updated', { id: range.id });
    ctx.markChanged();
  }
  palette.value = null;
}

function contentOf(node) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  return el && el.closest ? el.closest('[data-role="content"]') : null;
}

function currentRange() {
  const s = window.getSelection();
  if (!s || s.rangeCount === 0 || s.isCollapsed) return null;
  const r = s.getRangeAt(0);
  const content = contentOf(r.startContainer);
  if (!content || content !== contentOf(r.endContainer)) return null;
  if (!ctx.rootEl.value || !ctx.rootEl.value.contains(content)) return null;
  const id = content.closest('.sc-block') && content.closest('.sc-block').dataset.blockId;
  const pre = r.cloneRange();
  pre.selectNodeContents(content);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  return { id, content, start, end: start + r.toString().length };
}

function onSelChange() {
  if (!ctx.isEnabled('toolbar')) { visible.value = false; palette.value = null; return; }
  const range = currentRange();
  if (!range) { visible.value = false; palette.value = null; return; }
  sel.value = range;
  const loc = findBlock(ctx.doc.blocks, range.id);
  activeMarks.value = {};
  if (loc) tools.value.forEach((t) => (activeMarks.value[t.mark] = rangeHasMark(loc.block.data.segments, range.start, range.end, t.mark)));
  const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
  pos.value = { position: 'fixed', left: `${Math.round(r.left)}px`, top: `${Math.round(r.top - 40)}px` };
  visible.value = true;
}

function apply(mark) {
  const range = sel.value;
  if (!range) return;
  const loc = findBlock(ctx.doc.blocks, range.id);
  if (!loc) return;
  if (mark === 'link') {
    const has = rangeHasMark(loc.block.data.segments, range.start, range.end, 'link');
    const href = has ? '' : window.prompt('Link URL');
    if (href === null) return;
    loc.block.data.segments = setLinkOnRange(loc.block.data.segments, range.start, range.end, href);
  } else {
    loc.block.data.segments = toggleMark(loc.block.data.segments, range.start, range.end, mark);
  }
  ctx.emitEvent('block:updated', { id: range.id });
  ctx.markChanged();
}

onMounted(() => document.addEventListener('selectionchange', onSelChange));
onBeforeUnmount(() => document.removeEventListener('selectionchange', onSelChange));
</script>
