<template>
  <div v-if="open" class="sc-slash" :style="pos" role="listbox">
    <div
      v-for="(c, i) in items"
      :key="c.id"
      class="sc-slash__item"
      :class="{ active: i === active }"
      @mousedown.prevent="pick(c)"
    >
      <span class="sc-slash__icon">@</span>{{ c.name }}<span class="sc-slash__hint">{{ c.role || c.email || '' }}</span>
    </div>
    <div v-if="!items.length" class="sc-slash__empty">No contacts</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { caretOffset } from '../composables/useEditableText.js';

const ctx = useEditor();
const open = ref(false);
const items = ref([]);
const active = ref(0);
const blockId = ref(null);
const atOffset = ref(0);
const pos = ref({});

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

async function query(q) {
  const fetchContacts = ctx.adapters.value.fetchContacts;
  items.value = typeof fetchContacts === 'function' ? (await fetchContacts(q)) || [] : [];
  active.value = 0;
}

async function onInput() {
  if (typeof ctx.adapters.value.fetchContacts !== 'function') { open.value = false; return; }
  const el = currentEditable();
  if (!el) { open.value = false; return; }
  const id = el.closest('.sc-block') && el.closest('.sc-block').dataset.blockId;
  const text = el.textContent;
  const caret = caretOffset(el);
  if (!open.value) {
    const prev = text[caret - 1];
    if (prev === '@' && (caret - 1 === 0 || /\s/.test(text[caret - 2]))) {
      open.value = true; blockId.value = id; atOffset.value = caret - 1;
      place(); await query('');
    }
  }
  if (open.value) {
    if (id !== blockId.value || caret <= atOffset.value || text[atOffset.value] !== '@') { open.value = false; return; }
    const q = text.slice(atOffset.value + 1, caret);
    if (/\s/.test(q)) { open.value = false; return; }
    await query(q);
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

function pick(c) {
  ctx.insertMention(blockId.value, atOffset.value, c);
  open.value = false;
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
