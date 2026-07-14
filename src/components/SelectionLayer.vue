<template>
  <div v-if="ids.length" class="sc-sel-toolbar" :style="pos" @mousedown.stop>
    <select v-if="targets.length > 1" class="sc-sel-toolbar__sel" @change="onTurn">
      <option value="">Turn into…</option>
      <option v-for="t in targets" :key="t.type" :value="t.type">{{ t.label }}</option>
    </select>
    <select class="sc-sel-toolbar__sel" @change="onColor('color', $event)">
      <option value="">Color</option>
      <option v-for="tok in COLOR_TOKENS" :key="tok" :value="tok">{{ tok }}</option>
    </select>
    <select class="sc-sel-toolbar__sel" @change="onColor('background', $event)">
      <option value="">Bg</option>
      <option v-for="tok in COLOR_TOKENS" :key="tok" :value="tok">{{ tok }}</option>
    </select>
    <button class="sc-sel-toolbar__sel sc-sel-toolbar__danger" @mousedown.prevent="ctx.deleteSelected()">Delete</button>
  </div>

  <div v-if="band" class="sc-band" :style="bandStyle" />
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { COLOR_TOKENS } from '../core/colors.js';
import { flattenBlocks, findBlock, removeBlock } from '../core/model.js';
import { sliceSegments, concatSegments, segmentsLength, segmentsText, segmentsToHTML } from '../core/segments.js';

const ctx = useEditor();
const ids = computed(() => ctx.selection.ids);
const targets = computed(() => ctx.selectionTargets());
const pos = ref({});

const CHROME = '[data-role="content"], input, button, select, a, [data-role="code"], [data-role="cell"], .sc-block__handle, .sc-collapse';

// --- toolbar ---
watch(ids, (v) => {
  if (!v.length) return;
  nextTick(() => {
    const root = ctx.rootEl.value;
    const el = root && root.querySelector(`.sc-block[data-block-id="${v[0]}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    pos.value = { position: 'fixed', left: `${Math.round(r.left)}px`, top: `${Math.round(r.top - 42)}px` };
  });
});
function onTurn(e) { if (e.target.value) { ctx.turnIntoSelected(e.target.value); e.target.value = ''; } }
function onColor(prop, e) { if (e.target.value) { ctx.colorSelected(prop, e.target.value === 'default' ? null : e.target.value); e.target.value = ''; } }

// --- keyboard ---
function contentOf(node) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  return el && el.closest ? el.closest('[data-role="content"]') : null;
}
function blockIdOf(el) { const w = el && el.closest('.sc-block'); return w && w.dataset.blockId; }

function moveSel(dir, extend) {
  const order = ctx.selectableOrder().map((b) => b.id);
  const edge = dir > 0 ? ids.value[ids.value.length - 1] : ids.value[0];
  const i = order.indexOf(edge);
  const next = order[i + dir];
  if (!next) return;
  if (extend) ctx.selectRange(ctx.selection.anchor || edge, next);
  else ctx.setSelection([next], next);
}

function onKeydown(e) {
  if (!ctx.isEnabled('multiSelect')) return;
  if (e.key === 'Escape') {
    const content = contentOf(document.activeElement);
    if (content && !ids.value.length) {
      const id = blockIdOf(content);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      ctx.setSelection([id], id);
      e.preventDefault();
      return;
    }
    if (ids.value.length) { ctx.clearSelection(); return; }
  }
  if ((e.key === 'Backspace' || e.key === 'Delete') && !ids.value.length) {
    if (deleteAcrossBlocks()) e.preventDefault();
    return;
  }
  if (!ids.value.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); moveSel(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); ctx.deleteSelected(); }
  else if (e.key === 'Enter') { e.preventDefault(); const id = ids.value[0]; ctx.clearSelection(); ctx.requestFocus(id, 0); }
}

// --- click (cmd/shift select; clear on plain click) ---
function onClick(e) {
  if (!ctx.isEnabled('multiSelect')) return;
  const wrapper = e.target.closest('.sc-block');
  if (e.metaKey || e.ctrlKey) {
    if (wrapper) { e.preventDefault(); ctx.toggleSelect(wrapper.dataset.blockId); }
    return;
  }
  if (e.shiftKey && wrapper && ctx.selection.anchor) {
    e.preventDefault();
    ctx.selectRange(ctx.selection.anchor, wrapper.dataset.blockId);
    return;
  }
  if (!e.target.closest(CHROME) && ids.value.length) ctx.clearSelection();
}

// --- rubber band ---
const band = ref(null);
const bandStyle = computed(() => band.value || {});
function onMouseDown(e) {
  if (!ctx.isEnabled('multiSelect') || e.button !== 0) return;
  if (e.target.closest(CHROME) || !e.target.closest('.scramble-editor')) return;
  const sx = e.clientX;
  const sy = e.clientY;
  let moved = false;
  const onMove = (ev) => {
    const x = Math.min(sx, ev.clientX);
    const y = Math.min(sy, ev.clientY);
    const w = Math.abs(ev.clientX - sx);
    const h = Math.abs(ev.clientY - sy);
    if (w + h > 6) moved = true;
    band.value = { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` };
    const hit = [];
    ctx.rootEl.value.querySelectorAll('.sc-block').forEach((wrapper) => {
      const t = wrapper.dataset.type;
      if (t === 'columns' || t === 'column') return;
      const r = wrapper.getBoundingClientRect();
      if (r.bottom > y && r.top < y + h && r.right > x && r.left < x + w) hit.push(wrapper.dataset.blockId);
    });
    ctx.setSelection(hit, hit[0]);
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    band.value = null;
    if (moved) {
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', swallow, true); };
      document.addEventListener('click', swallow, true);
    }
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// --- cross-block text copy + delete ---
function offsetWithin(content, node, nodeOffset) {
  const range = document.createRange();
  range.selectNodeContents(content);
  range.setEnd(node, nodeOffset);
  return range.toString().length;
}
function crossRange() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  const sc = contentOf(r.startContainer);
  const ec = contentOf(r.endContainer);
  if (!sc || !ec || sc === ec) return null;
  const root = ctx.rootEl.value;
  if (!root || !root.contains(sc) || !root.contains(ec)) return null;
  return {
    startId: blockIdOf(sc), endId: blockIdOf(ec),
    startOffset: offsetWithin(sc, r.startContainer, r.startOffset),
    endOffset: offsetWithin(ec, r.endContainer, r.endOffset),
  };
}
function covered(startId, endId) {
  const flat = flattenBlocks(ctx.doc.blocks);
  const si = flat.findIndex((b) => b.id === startId);
  const ei = flat.findIndex((b) => b.id === endId);
  return si < 0 || ei < 0 ? [] : flat.slice(si, ei + 1);
}
function onCopy(e) {
  const r = crossRange();
  if (!r) return;
  const blocks = covered(r.startId, r.endId);
  if (blocks.length < 2) return;
  const parts = blocks.map((b, i) => {
    const segs = (b.data && b.data.segments) || [{ text: '', marks: [] }];
    if (i === 0) return sliceSegments(segs, r.startOffset, segmentsLength(segs));
    if (i === blocks.length - 1) return sliceSegments(segs, 0, r.endOffset);
    return segs;
  });
  e.clipboardData.setData('text/plain', parts.map(segmentsText).join('\n'));
  e.clipboardData.setData('text/html', parts.map((p) => `<p>${segmentsToHTML(p)}</p>`).join(''));
  e.preventDefault();
}
function deleteAcrossBlocks() {
  const r = crossRange();
  if (!r) return false;
  const startLoc = findBlock(ctx.doc.blocks, r.startId);
  const endLoc = findBlock(ctx.doc.blocks, r.endId);
  if (!startLoc || !endLoc) return false;
  const before = sliceSegments(startLoc.block.data.segments, 0, r.startOffset);
  const after = sliceSegments(endLoc.block.data.segments, r.endOffset, segmentsLength(endLoc.block.data.segments));
  startLoc.block.data.segments = concatSegments(before, after);
  const flat = flattenBlocks(ctx.doc.blocks);
  const si = flat.findIndex((b) => b.id === r.startId);
  const ei = flat.findIndex((b) => b.id === r.endId);
  flat.slice(si + 1, ei + 1).forEach((b) => removeBlock(ctx.doc.blocks, b.id));
  ctx.requestFocus(r.startId, r.startOffset);
  ctx.emitEvent('block:updated', { id: r.startId });
  ctx.markChanged();
  return true;
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('copy', onCopy);
  const root = ctx.rootEl.value;
  if (root) {
    root.addEventListener('click', onClick);
    root.addEventListener('mousedown', onMouseDown);
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('copy', onCopy);
  const root = ctx.rootEl.value;
  if (root) {
    root.removeEventListener('click', onClick);
    root.removeEventListener('mousedown', onMouseDown);
  }
});
</script>
