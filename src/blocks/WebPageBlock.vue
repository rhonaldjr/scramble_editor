<template>
  <div class="sc-webpage">
    <div v-if="block.data.url" class="sc-webpage__wrap" :style="frameStyle">
      <iframe
        class="sc-webpage__frame"
        :src="block.data.url"
        frameborder="0"
        loading="lazy"
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
      <template v-if="!readonly">
        <button class="sc-media__gear" title="Web page options" @mousedown.prevent.stop="showGear = !showGear">⚙</button>
        <span class="sc-resize" title="Drag to resize" @mousedown.prevent="startResize" />
        <div v-if="showGear" class="sc-media-gear" @mousedown.stop>
          <label class="sc-media-gear__row">
            <span>URL</span>
            <input type="url" :value="block.data.url" @change="setUrl($event.target.value)" />
          </label>
          <label class="sc-media-gear__row">
            <span>Width</span>
            <input type="number" min="200" step="10" placeholder="full" :value="block.data.width || ''" @change="setDim('width', $event.target.value)" />
          </label>
          <label class="sc-media-gear__row">
            <span>Height</span>
            <input type="number" min="120" step="10" :value="block.data.height || 480" @change="setDim('height', $event.target.value)" />
          </label>
        </div>
      </template>
    </div>
    <input
      v-else-if="!readonly"
      class="sc-media__url"
      type="url"
      placeholder="Paste a web page URL to preview…"
      @change="setUrl($event.target.value)"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const showGear = ref(false);

const frameStyle = computed(() => ({
  width: props.block.data.width ? `${props.block.data.width}px` : '100%',
  height: `${props.block.data.height || 480}px`,
}));

function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function setUrl(value) {
  props.block.data.url = String(value || '').trim();
  changed();
}
function setDim(field, value) {
  const n = Number(value);
  props.block.data[field] = n > 0 ? n : (field === 'width' ? null : 480);
  ctx.emitEvent('media:resized', { id: props.block.id, width: props.block.data.width, height: props.block.data.height });
  changed();
}

// Web pages have no intrinsic aspect ratio — resize width and height freely.
function startResize(event) {
  const wrap = event.currentTarget.closest('.sc-webpage__wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startW = rect.width;
  const startH = rect.height;
  const onMove = (ev) => {
    props.block.data.width = Math.max(200, Math.round(startW + (ev.clientX - startX)));
    props.block.data.height = Math.max(120, Math.round(startH + (ev.clientY - startY)));
    ctx.emitEvent('media:resized', { id: props.block.id, width: props.block.data.width, height: props.block.data.height });
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    changed();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function closeGear(e) {
  if (showGear.value && !(e.target.closest && e.target.closest('.sc-webpage__wrap'))) showGear.value = false;
}
onMounted(() => document.addEventListener('mousedown', closeGear));
onBeforeUnmount(() => document.removeEventListener('mousedown', closeGear));
</script>
