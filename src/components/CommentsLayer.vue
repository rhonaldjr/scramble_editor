<template>
  <div v-if="ui.open" class="sc-comments" :style="style" @mousedown.stop>
    <div v-for="t in threads" :key="t.id" class="sc-comments__thread">
      <div v-for="(m, i) in t.messages" :key="i" class="sc-comments__msg">
        <span class="sc-comments__author">{{ m.author || 'Someone' }}</span>
        <span class="sc-comments__text">{{ m.text }}</span>
      </div>
      <button class="sc-comments__resolve" @mousedown.prevent="resolve(t)">Resolve</button>
    </div>
    <div class="sc-comments__new">
      <input
        v-model="draft"
        class="sc-comments__input"
        type="text"
        placeholder="Add a comment…"
        @keydown.enter.prevent="add"
      />
      <button class="sc-comments__send" @mousedown.prevent="add">Send</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';

const ctx = useEditor();
const ui = ctx.commentUi;
const draft = ref('');
const threads = computed(() => (ui.blockId ? ctx.commentsFor(ui.blockId) : []));
const style = computed(() => ({ position: 'fixed', left: `${ui.x}px`, top: `${ui.y}px` }));

function add() {
  const text = draft.value.trim();
  if (!text || !ui.blockId) return;
  // Host persists + updates the `comments` prop.
  ctx.emitEvent('comment:added', { blockId: ui.blockId, text });
  draft.value = '';
}
function resolve(t) {
  ctx.emitEvent('comment:resolved', { id: t.id, blockId: t.blockId });
}

function onDocMouseDown() { if (ui.open) ctx.closeComments(); }
onMounted(() => document.addEventListener('mousedown', onDocMouseDown));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMouseDown));
</script>
