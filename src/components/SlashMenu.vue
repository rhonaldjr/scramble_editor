<template>
  <div v-if="open" class="sc-slash" :style="pos" role="listbox">
    <div
      v-for="(b, i) in items"
      :key="b.type"
      class="sc-slash__item"
      :class="{ active: i === active }"
      @mousedown.prevent="pick(b)"
    >
      <span class="sc-slash__icon">{{ b.icon }}</span>{{ b.label }}
    </div>
    <div v-if="!items.length" class="sc-slash__empty">No blocks</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { listBlocks } from '../core/registry.js';
import { caretOffset } from '../composables/useEditableText.js';

const ctx = useEditor();
const open = ref(false);
const query = ref('');
const active = ref(0);
const blockId = ref(null);
const slashOffset = ref(0);
const pos = ref({});

const items = computed(() => {
  const allowed = ctx.config.value && ctx.config.value.blocks ? new Set(ctx.config.value.blocks) : null;
  const q = query.value.toLowerCase();
  return listBlocks().filter(
    (b) => (!allowed || allowed.has(b.type)) && ((b.label || '').toLowerCase().includes(q) || b.type.includes(q)),
  );
});

function currentEditable() {
  const el = document.activeElement;
  return el && el.closest && el.closest('[data-role="content"]') ? el : null;
}

function place() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const r = sel.getRangeAt(0).getBoundingClientRect();
  pos.value = { position: 'fixed', left: `${Math.round(r.left)}px`, top: `${Math.round(r.bottom + 4)}px` };
}

function onInput() {
  if (!ctx.isEnabled('slashMenu')) { open.value = false; return; }
  const el = currentEditable();
  if (!el) { open.value = false; return; }
  const id = el.closest('.sc-block') && el.closest('.sc-block').dataset.blockId;
  const text = el.textContent;
  const caret = caretOffset(el);
  if (!open.value) {
    const prev = text[caret - 1];
    if (prev === '/' && (caret - 1 === 0 || /\s/.test(text[caret - 2]))) {
      open.value = true;
      blockId.value = id;
      slashOffset.value = caret - 1;
      active.value = 0;
      place();
      ctx.emitEvent('slash:opened', { id });
    }
  }
  if (open.value) {
    if (id !== blockId.value || caret <= slashOffset.value || text[slashOffset.value] !== '/') {
      open.value = false;
      return;
    }
    query.value = text.slice(slashOffset.value + 1, caret);
    if (/\s/.test(query.value)) open.value = false;
    active.value = 0;
  }
}

function onKeydown(e) {
  if (!open.value) return;
  if (e.key === 'ArrowDown') { active.value = (active.value + 1) % Math.max(items.value.length, 1); stop(e); }
  else if (e.key === 'ArrowUp') { active.value = (active.value - 1 + items.value.length) % Math.max(items.value.length, 1); stop(e); }
  else if (e.key === 'Enter') { if (items.value[active.value]) pick(items.value[active.value]); stop(e); }
  else if (e.key === 'Escape') { open.value = false; stop(e); }
}
function stop(e) { e.preventDefault(); e.stopPropagation(); }

function pick(b) {
  ctx.slashPick(blockId.value, slashOffset.value, b.type);
  open.value = false;
  query.value = '';
  ctx.emitEvent('slash:selected', { type: b.type });
}

let rootEl;
onMounted(() => {
  rootEl = ctx.rootEl.value;
  if (rootEl) {
    rootEl.addEventListener('input', onInput);
    rootEl.addEventListener('keydown', onKeydown, true);
  }
});
onBeforeUnmount(() => {
  if (rootEl) {
    rootEl.removeEventListener('input', onInput);
    rootEl.removeEventListener('keydown', onKeydown, true);
  }
});
</script>
