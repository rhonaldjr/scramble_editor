<template>
  <component
    :is="tag"
    ref="el"
    class="sc-text"
    :class="cls"
    data-role="content"
    :contenteditable="!readonly"
    @input="onInput"
    @keydown="onKeydown"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useEditor } from '../composables/editor.js';
import { useEditableText } from '../composables/useEditableText.js';

const props = defineProps({
  block: { type: Object, required: true },
  tag: { type: String, default: 'p' },
  cls: { type: String, default: '' },
});

const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const { el, onInput, onKeydown } = useEditableText(props.block, ctx);
</script>
