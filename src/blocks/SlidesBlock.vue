<template>
  <div class="sc-slides">
    <div v-if="!readonly" class="sc-slides__bar" contenteditable="false">
      <span class="sc-slides__label">🖼 Slides · {{ block.children.length }}</span>
      <span class="sc-slides__actions">
        <button class="sc-slides__btn" @mousedown.prevent="addSlide">+ Add slide</button>
        <button class="sc-slides__btn sc-slides__btn--go" :disabled="!block.children.length" @mousedown.prevent="present(0)">▶ Present</button>
      </span>
    </div>

    <BlockView v-for="child in block.children" :key="child.id" :block="child" />

    <!-- Full-screen slideshow overlay -->
    <div v-if="presenting" class="sc-present" @click.self="stop">
      <div class="sc-present__stage">
        <BlockView v-if="currentSlide" :key="currentSlide.id" :block="currentSlide" />
      </div>
      <div class="sc-present__controls" contenteditable="false">
        <button class="sc-present__nav" :disabled="index === 0" @mousedown.prevent="go(-1)">‹</button>
        <span class="sc-present__count">{{ index + 1 }} / {{ block.children.length }}</span>
        <button class="sc-present__nav" :disabled="index >= block.children.length - 1" @mousedown.prevent="go(1)">›</button>
        <button class="sc-present__close" @mousedown.prevent="stop">Esc ✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import BlockView from '../components/BlockView.vue';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);

const presenting = ref(false);
const index = ref(0);
const currentSlide = computed(() => props.block.children[index.value] || null);

function addSlide() {
  const slide = ctx.createBlock('slide');
  slide.children = [ctx.createBlock('paragraph')];
  props.block.children.push(slide);
  ctx.emitEvent('block:created', { id: slide.id, in: props.block.id });
  ctx.markChanged();
}

function present(i) {
  if (!props.block.children.length) return;
  index.value = Math.max(0, Math.min(i, props.block.children.length - 1));
  presenting.value = true;
  document.addEventListener('keydown', onKey);
}
function stop() {
  presenting.value = false;
  document.removeEventListener('keydown', onKey);
}
function go(delta) {
  index.value = Math.max(0, Math.min(index.value + delta, props.block.children.length - 1));
}
function onKey(e) {
  if (e.key === 'Escape') { stop(); e.preventDefault(); }
  else if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); e.preventDefault(); }
}

onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>
