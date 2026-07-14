<template>
  <div class="sc-slide" :class="`sc-slide--${aspect}`" :style="slideStyle">
    <BlockView v-for="child in block.children" :key="child.id" :block="child" />

    <template v-if="!readonly">
      <button class="sc-media__gear" title="Slide options" @mousedown.prevent.stop="showGear = !showGear">⚙</button>
      <div v-if="showGear" class="sc-media-gear sc-slide-gear" @mousedown.stop>
        <div class="sc-media-gear__row">
          <span>Background</span>
          <span class="sc-slide-swatches">
            <button
              v-for="c in SWATCHES"
              :key="c.label"
              class="sc-slide-swatch"
              :style="{ background: c.value || 'transparent' }"
              :title="c.label"
              @mousedown.prevent="setBg(c.value)"
            >{{ c.value ? '' : '∅' }}</button>
          </span>
        </div>
        <label class="sc-media-gear__row">
          <span>Color</span>
          <input type="text" placeholder="#0b1e3b / rgb()…" :value="block.props && block.props.backgroundColor || ''" @change="setBg($event.target.value)" />
        </label>
        <label class="sc-media-gear__row">
          <span>Image URL</span>
          <input type="url" placeholder="https://…" :value="block.props && block.props.backgroundImage || ''" @change="setImage($event.target.value)" />
        </label>
        <div class="sc-media-gear__row">
          <span>Aspect</span>
          <span>
            <button
              v-for="a in ['16x9', '4x3', 'auto']"
              :key="a"
              class="sc-media-gear__btn"
              :class="{ 'is-active': aspect === a }"
              @mousedown.prevent="setAspect(a)"
            >{{ a.replace('x', ':') }}</button>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, provide, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import BlockView from '../components/BlockView.vue';

// Tell descendant media blocks they live in a slide, so they auto-fit it.
provide('scInSlide', true);

const SWATCHES = [
  { label: 'None', value: '' },
  { label: 'Navy', value: '#0b1e3b' },
  { label: 'Ink', value: '#1f1f1f' },
  { label: 'Plum', value: '#3b1e3b' },
  { label: 'Forest', value: '#123524' },
  { label: 'Sand', value: '#f4ecd8' },
];

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const showGear = ref(false);

const aspect = computed(() => (props.block.data && props.block.data.aspect) || '16x9');
const slideStyle = computed(() => {
  const p = props.block.props || {};
  const s = {};
  if (p.backgroundColor) s.background = p.backgroundColor;
  if (p.backgroundImage) {
    s.backgroundImage = `url("${p.backgroundImage}")`;
    s.backgroundSize = 'cover';
    s.backgroundPosition = 'center';
  }
  return s;
});

function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function setBg(value) { ctx.setBackground(props.block.id, { color: String(value || '').trim() }); }
function setImage(value) { ctx.setBackground(props.block.id, { image: String(value || '').trim() }); }
function setAspect(a) {
  props.block.data = { ...(props.block.data || {}), aspect: a };
  changed();
}

function closeGear(e) {
  if (showGear.value && !(e.target.closest && e.target.closest('.sc-slide'))) showGear.value = false;
}
onMounted(() => document.addEventListener('mousedown', closeGear));
onBeforeUnmount(() => document.removeEventListener('mousedown', closeGear));
</script>
