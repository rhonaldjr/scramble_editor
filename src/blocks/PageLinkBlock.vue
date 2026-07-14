<template>
  <div class="sc-pagelink-wrap">
    <a v-if="block.data.docId" class="sc-pagelink" href="#" @click.prevent="open">
      📄 {{ block.data.title || block.data.docId }}
    </a>
    <span v-else class="sc-pagelink--empty">No page linked</span>
    <select v-if="!readonly" class="sc-pagelink__select" @change="onPick">
      <option value="">{{ block.data.docId ? 'Change linked page…' : 'Link a page…' }}</option>
      <option v-for="d in docs" :key="d.id" :value="d.id" :selected="d.id === block.data.docId">
        {{ d.title || d.id }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useEditor } from '../composables/editor.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const docs = ref([]);

onMounted(async () => {
  const list = ctx.adapters.value.listDocuments; // host provides the page list
  if (typeof list === 'function') {
    try { docs.value = (await list()) || []; } catch { docs.value = []; }
  }
});

function onPick(e) {
  const id = e.target.value;
  if (!id) return;
  const d = docs.value.find((x) => x.id === id);
  props.block.data.docId = id;
  props.block.data.title = d ? d.title : id;
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function open() {
  // The host owns navigation — it decides how to load the linked document.
  ctx.emitEvent('page-link:open', { id: props.block.id, docId: props.block.data.docId });
}
</script>
