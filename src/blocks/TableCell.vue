<template>
  <component
    :is="header ? 'th' : 'td'"
    ref="el"
    class="sc-table__cell"
    :contenteditable="!readonly"
    @input="onInput"
  />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { segmentsToHTML } from '../core/segments.js';
import { domToSegments } from '../composables/useEditableText.js';

const props = defineProps({
  cell: { type: Array, required: true }, // segment[]
  header: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits(['update']);

const el = ref(null);
let internal = false;

function paint() {
  if (el.value) el.value.innerHTML = segmentsToHTML(props.cell);
}
onMounted(paint);
watch(
  () => props.cell,
  () => { if (internal) { internal = false; return; } paint(); },
  { deep: true },
);

function onInput() {
  internal = true;
  emit('update', domToSegments(el.value));
}
</script>
