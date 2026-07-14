<template>
  <div class="sc-embed">
    <div v-if="block.data.url" class="sc-embed__wrap" :style="frameStyle">
      <iframe class="sc-embed__frame" :src="src" frameborder="0" allowfullscreen />
      <template v-if="!readonly">
        <button class="sc-media__gear" title="Embed options" @mousedown.prevent.stop="showGear = !showGear">⚙</button>
        <span class="sc-resize" title="Drag to resize" @mousedown.prevent="startResize" />
        <div v-if="showGear" class="sc-media-gear" @mousedown.stop>
          <label class="sc-media-gear__row">
            <span>URL</span>
            <input type="text" :value="block.data.url" @change="setUrl($event.target.value)" />
          </label>
          <label class="sc-media-gear__row">
            <span>Width</span>
            <input type="number" min="120" step="10" placeholder="auto" :value="block.data.width || ''" @change="setWidth($event.target.value)" />
          </label>
        </div>
      </template>
    </div>
    <input
      v-else-if="!readonly"
      class="sc-media__url"
      type="text"
      placeholder="Paste a URL to embed (YouTube, etc.)…"
      @change="setUrl($event.target.value)"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { youtubeId } from '../core/embed.js';
import { startMediaResize } from '../composables/useMediaResize.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const showGear = ref(false);
const src = computed(() => {
  const id = youtubeId(props.block.data.url);
  return id ? `https://www.youtube.com/embed/${id}` : props.block.data.url;
});
const frameStyle = computed(() => (props.block.data.width ? { width: `${props.block.data.width}px` } : {}));

function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function setUrl(value) {
  props.block.data.url = String(value || '').trim();
  changed();
}
function setWidth(v) {
  const w = Number(v);
  props.block.data.width = w > 0 ? w : null;
  ctx.emitEvent('media:resized', { id: props.block.id, width: props.block.data.width });
  changed();
}
function startResize(e) {
  startMediaResize(e, e.currentTarget.closest('.sc-embed__wrap'), props.block, ctx);
}

function closeGear(e) {
  if (showGear.value && !(e.target.closest && e.target.closest('.sc-embed__wrap'))) showGear.value = false;
}
onMounted(() => document.addEventListener('mousedown', closeGear));
onBeforeUnmount(() => document.removeEventListener('mousedown', closeGear));
</script>
