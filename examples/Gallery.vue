<!-- Examples gallery — switch between the sample integrations. -->
<template>
  <div class="gallery">
    <nav class="gallery__tabs">
      <span class="gallery__brand">Scramble examples</span>
      <button
        v-for="e in examples"
        :key="e.key"
        class="gallery__tab"
        :class="{ active: current === e.key }"
        @click="current = e.key"
      >
        {{ e.label }}
      </button>
      <a class="gallery__link" href="https://github.com" target="_blank" rel="noopener">source</a>
    </nav>
    <div class="gallery__body">
      <component :is="active" :key="current" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import MinimalEditor from './MinimalEditor.vue';
import PersistedEditor from './PersistedEditor.vue';
import ReadonlyViewer from './ReadonlyViewer.vue';
import HostApp from './HostApp.vue';

const examples = [
  { key: 'host', label: 'Full host app', comp: HostApp },
  { key: 'minimal', label: 'Minimal', comp: MinimalEditor },
  { key: 'persist', label: 'Persistence', comp: PersistedEditor },
  { key: 'readonly', label: 'Read-only viewer', comp: ReadonlyViewer },
];
const current = ref('host');
const active = computed(() => examples.find((e) => e.key === current.value).comp);
</script>

<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.gallery { display: flex; flex-direction: column; height: 100vh; }
.gallery__tabs { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid #e9e9e7; background: #fafafa; }
.gallery__brand { font-weight: 700; margin-right: 8px; }
.gallery__tab { padding: 5px 10px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.gallery__tab.active { border-color: #2383e2; color: #2383e2; }
.gallery__link { margin-left: auto; font-size: 12px; color: #787774; }
.gallery__body { flex: 1; min-height: 0; overflow: auto; }
</style>
