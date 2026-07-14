<template>
  <div class="sc-accordion">
    <BlockView v-for="item in block.children" :key="item.id" :block="item" />
    <button v-if="!readonly" class="sc-accordion__additem" @mousedown.prevent="addItem">+ Add accordion item</button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useEditor } from '../composables/editor.js';
import BlockView from '../components/BlockView.vue';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);

function addItem() {
  const item = ctx.createBlock('accordion-item');
  item.children = [ctx.createBlock('paragraph')];
  props.block.children.push(item);
  ctx.emitEvent('block:created', { id: item.id, in: props.block.id });
  ctx.markChanged();
  ctx.requestFocus(item.id, 0); // focus the new item's title
}
</script>
