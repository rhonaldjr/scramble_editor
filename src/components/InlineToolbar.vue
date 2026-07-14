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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { findBlock } from '../core/model.js';
import { toggleMark, setLinkOnRange, rangeHasMark } from '../core/segments.js';

const ctx = useEditor();
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
  if (!ctx.isEnabled('toolbar')) { visible.value = false; return; }
  const range = currentRange();
  if (!range) { visible.value = false; return; }
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
