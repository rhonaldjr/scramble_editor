<template>
  <div class="sc-button-wrap" :class="`sc-button-wrap--${block.data.align || 'left'}`">
    <button
      type="button"
      class="sc-button"
      :class="{ 'sc-button--outline': block.data.variant === 'outline' }"
      :style="buttonStyle"
      @click="onClick"
    >{{ block.data.label || 'Button' }}</button>

    <template v-if="!readonly">
      <button class="sc-media__gear" title="Button options" @mousedown.prevent.stop="showGear = !showGear">⚙</button>
      <div v-if="showGear" class="sc-media-gear" @mousedown.stop>
        <label class="sc-media-gear__row">
          <span>Label</span>
          <input type="text" :value="block.data.label" @input="set('label', $event.target.value)" />
        </label>
        <div class="sc-media-gear__row">
          <span>On click</span>
          <span>
            <button
              v-for="a in ['link', 'event']"
              :key="a"
              class="sc-media-gear__btn"
              :class="{ 'is-active': (block.data.action || 'link') === a }"
              @mousedown.prevent="set('action', a)"
            >{{ a === 'link' ? 'Link' : 'Event' }}</button>
          </span>
        </div>
        <label v-if="(block.data.action || 'link') === 'link'" class="sc-media-gear__row">
          <span>URL</span>
          <input type="url" placeholder="https://…" :value="block.data.url" @change="set('url', $event.target.value.trim())" />
        </label>
        <div v-if="(block.data.action || 'link') === 'link'" class="sc-media-gear__row">
          <span>Open in</span>
          <span>
            <button
              v-for="t in [['_self', 'This tab'], ['_blank', 'New tab']]"
              :key="t[0]"
              class="sc-media-gear__btn"
              :class="{ 'is-active': (block.data.target || '_self') === t[0] }"
              @mousedown.prevent="set('target', t[0])"
            >{{ t[1] }}</button>
          </span>
        </div>
        <div class="sc-media-gear__row">
          <span>Style</span>
          <span>
            <button
              v-for="v in ['filled', 'outline']"
              :key="v"
              class="sc-media-gear__btn"
              :class="{ 'is-active': (block.data.variant || 'filled') === v }"
              @mousedown.prevent="set('variant', v)"
            >{{ v }}</button>
          </span>
        </div>
        <label class="sc-media-gear__row">
          <span>Button color</span>
          <GearColor :model-value="block.data.bgColor || ''" @update:model-value="set('bgColor', $event)" />
        </label>
        <label class="sc-media-gear__row">
          <span>Text color</span>
          <GearColor :model-value="block.data.textColor || ''" @update:model-value="set('textColor', $event)" />
        </label>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import GearColor from '../components/GearColor.vue';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const showGear = ref(false);

const buttonStyle = computed(() => {
  const { variant, textColor, bgColor } = props.block.data;
  const s = {};
  if (variant === 'outline') {
    s.background = 'transparent';
    if (bgColor) { s.borderColor = bgColor; s.color = bgColor; }
    if (textColor) s.color = textColor;
  } else {
    if (bgColor) s.background = bgColor;
    if (textColor) s.color = textColor;
  }
  return s;
});

function set(field, value) {
  props.block.data[field] = value;
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}

// Click behavior. The host always hears `button:clicked`; a link also navigates
// (in a published/readonly view, or immediately when it targets a new tab so it
// doesn't yank you out of the editor while editing).
function onClick() {
  const d = props.block.data;
  ctx.emitEvent('button:clicked', { id: props.block.id, label: d.label || '', action: d.action || 'link', url: d.url || '', target: d.target || '_self' });
  if ((d.action || 'link') === 'link' && d.url && (readonly.value || d.target === '_blank')) {
    window.open(d.url, d.target === '_blank' ? '_blank' : '_self');
  }
}

function closeGear(e) {
  if (showGear.value && !(e.target.closest && e.target.closest('.sc-button-wrap'))) showGear.value = false;
}
onMounted(() => document.addEventListener('mousedown', closeGear));
onBeforeUnmount(() => document.removeEventListener('mousedown', closeGear));
</script>
