<template>
  <div class="sc-callout" :class="{ 'sc-callout--banner': variant === 'banner' }">
    <span class="sc-callout__icon">{{ block.data.icon }}</span>
    <div
      ref="el"
      class="sc-callout__text sc-text"
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
  variant: { type: String, default: 'callout' }, // callout | banner
});

const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const { el, onInput, onKeydown } = useEditableText(props.block, ctx);
</script>
