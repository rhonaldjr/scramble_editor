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
    <button
      v-if="showColorPanel"
      class="sc-toolbar__btn sc-toolbar__color"
      :class="{ active: panelOpen }"
      title="Text color, highlight & badge"
      @mousedown.prevent="togglePanel"
    ><span class="sc-toolbar__colorA" :style="activeAStyle">A</span><span class="sc-toolbar__caret">▾</span></button>

    <div v-if="panelOpen" class="sc-colorpanel" @mousedown.stop>
      <div class="sc-colorpanel__label">Text color</div>
      <div class="sc-colorpanel__row">
        <button
          v-for="tok in TEXT_TOKENS"
          :key="tok"
          class="sc-cp-a"
          :class="{ 'is-active': active.color === tok }"
          :style="{ color: TEXT_COLORS[tok] }"
          :title="tok"
          @mousedown.prevent="applyField('color', tok)"
        >A</button>
      </div>

      <div class="sc-colorpanel__label">Text highlight</div>
      <div class="sc-colorpanel__row">
        <button
          v-for="tok in HIGHLIGHT_TOKENS"
          :key="tok"
          class="sc-cp-dot"
          :class="{ 'is-active': active.background === tok }"
          :style="{ background: BG_COLORS[tok] }"
          :title="tok"
          @mousedown.prevent="applyField('background', tok)"
        />
        <button class="sc-cp-dot sc-cp-none" title="No highlight" @mousedown.prevent="applyField('background', 'default')">⊘</button>
      </div>

      <div class="sc-colorpanel__label">Badge</div>
      <div class="sc-colorpanel__row">
        <button
          v-for="tok in BADGE_TOKENS"
          :key="tok"
          class="sc-cp-badge"
          :class="{ 'is-active': active.badge === tok }"
          :style="{ background: BADGE_COLORS[tok].bg }"
          :title="tok"
          @mousedown.prevent="applyField('badge', tok)"
        />
        <button class="sc-cp-dot sc-cp-none" title="No badge" @mousedown.prevent="applyField('badge', 'default')">⊘</button>
      </div>
      <div class="sc-colorpanel__row">
        <button
          v-for="tok in BADGE_SOFT_TOKENS"
          :key="tok"
          class="sc-cp-badge"
          :class="{ 'is-active': active.badge === tok }"
          :style="{ background: BADGE_COLORS[tok].bg }"
          :title="tok"
          @mousedown.prevent="applyField('badge', tok)"
        />
      </div>

      <button class="sc-colorpanel__remove" @mousedown.prevent="removeAll">⊘ Remove color</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { findBlock } from '../core/model.js';
import { toggleMark, setLinkOnRange, rangeHasMark, setSegmentColor, clearSegmentColors, rangeField } from '../core/segments.js';
import {
  TEXT_COLORS, BG_COLORS, BADGE_COLORS,
  TEXT_TOKENS, HIGHLIGHT_TOKENS, BADGE_TOKENS, BADGE_SOFT_TOKENS,
} from '../core/colors.js';

const ctx = useEditor();
const panelOpen = ref(false);
const active = ref({ color: 'default', background: 'default', badge: 'default' });
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
const showColorPanel = computed(() => {
  const t = ctx.config.value && ctx.config.value.toolbar;
  return !t || t.includes('color') || t.includes('background') || t.includes('badge');
});
const activeAStyle = computed(() => ({ color: TEXT_COLORS[active.value.color] || 'inherit' }));

function togglePanel() { panelOpen.value = !panelOpen.value; }

function withRange(fn) {
  const range = sel.value;
  if (!range) return;
  const loc = findBlock(ctx.doc.blocks, range.id);
  if (!loc) return;
  loc.block.data.segments = fn(loc.block.data.segments, range.start, range.end);
  ctx.emitEvent('block:updated', { id: range.id });
  ctx.markChanged();
  refreshActive(range);
}

// Apply a token to one color field. A badge overrides color/highlight, so
// setting a badge clears them (and vice-versa) to match ClickUp's behavior.
function applyField(field, tok) {
  withRange((segs, s, e) => {
    let next = setSegmentColor(segs, s, e, field, tok);
    if (field === 'badge' && tok !== 'default') {
      next = setSegmentColor(next, s, e, 'color', 'default');
      next = setSegmentColor(next, s, e, 'background', 'default');
    } else if ((field === 'color' || field === 'background') && tok !== 'default') {
      next = setSegmentColor(next, s, e, 'badge', 'default');
    }
    return next;
  });
}
function removeAll() {
  withRange((segs, s, e) => clearSegmentColors(segs, s, e));
}
function refreshActive(range) {
  const loc = findBlock(ctx.doc.blocks, range.id);
  if (!loc) return;
  const segs = loc.block.data.segments;
  active.value = {
    color: rangeField(segs, range.start, range.end, 'color'),
    background: rangeField(segs, range.start, range.end, 'background'),
    badge: rangeField(segs, range.start, range.end, 'badge'),
  };
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
  if (!ctx.isEnabled('toolbar')) { visible.value = false; panelOpen.value = false; return; }
  const range = currentRange();
  if (!range) { visible.value = false; panelOpen.value = false; return; }
  sel.value = range;
  const loc = findBlock(ctx.doc.blocks, range.id);
  activeMarks.value = {};
  if (loc) {
    tools.value.forEach((t) => (activeMarks.value[t.mark] = rangeHasMark(loc.block.data.segments, range.start, range.end, t.mark)));
    refreshActive(range);
  }
  panelOpen.value = false;
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
