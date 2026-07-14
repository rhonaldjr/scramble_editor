<template>
  <div class="sc-list-item" :class="`sc-list-item--${marker}`">
    <span v-if="marker === 'bullet'" class="sc-marker">•</span>
    <span v-else-if="marker === 'number'" class="sc-marker sc-marker--number"></span>
    <input
      v-else
      type="checkbox"
      class="sc-marker sc-marker--check"
      :checked="block.data.checked"
      :disabled="readonly"
      @change="toggleChecked"
    />
    <component
      :is="'div'"
      ref="el"
      class="sc-text"
      data-role="content"
      :contenteditable="!readonly"
      @input="onInput"
      @keydown="onKeydown"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useEditor } from '../composables/editor.js';
import { useEditableText } from '../composables/useEditableText.js';

const props = defineProps({
  block: { type: Object, required: true },
  marker: { type: String, default: 'bullet' }, // bullet | number | check
});

const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const { el, onInput, onKeydown } = useEditableText(props.block, ctx);

function toggleChecked(e) {
  props.block.data.checked = e.target.checked;
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
</script>
