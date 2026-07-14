<template>
  <div class="sc-bookmark-wrap">
    <a v-if="block.data.url" class="sc-bookmark" :href="block.data.url" target="_blank" rel="noopener">
      <div class="sc-bookmark__text">
        <div class="sc-bookmark__title">{{ (block.data.meta && block.data.meta.title) || block.data.url }}</div>
        <div v-if="block.data.meta && block.data.meta.description" class="sc-bookmark__desc">
          {{ block.data.meta.description }}
        </div>
        <div class="sc-bookmark__host">{{ block.data.url }}</div>
      </div>
      <img v-if="block.data.meta && block.data.meta.image" class="sc-bookmark__img" :src="block.data.meta.image" alt="" />
    </a>
    <input
      v-if="!readonly"
      class="sc-media__url"
      type="text"
      placeholder="Paste a URL to bookmark…"
      :value="block.data.url"
      @change="setUrl"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useEditor } from '../composables/editor.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);

async function setUrl(e) {
  const url = e.target.value.trim();
  props.block.data.url = url;
  // The host provides link-preview metadata via an adapter (optional).
  const fetchMeta = ctx.adapters.value.fetchEmbedMeta;
  if (url && typeof fetchMeta === 'function') {
    try {
      props.block.data.meta = await fetchMeta(url);
    } catch {
      props.block.data.meta = null;
    }
  }
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
</script>
