<template>
  <component
    :is="header ? 'th' : 'td'"
    ref="el"
    class="sc-table__cell"
    :colspan="colSpan > 1 ? colSpan : null"
    :rowspan="rowSpan > 1 ? rowSpan : null"
    :contenteditable="!readonly"
    @input="onInput"
    @focus="$emit('focus')"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { segmentsToHTML } from '../core/segments.js';
import { cellSegments } from '../core/table.js';
import { domToSegments } from '../composables/useEditableText.js';

const props = defineProps({
  cell: { type: [Object, Array], required: true }, // { segments, colSpan?, rowSpan? } (or legacy segment[])
  header: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits(['update', 'focus']);

const el = ref(null);
const colSpan = computed(() => (props.cell && props.cell.colSpan) || 1);
const rowSpan = computed(() => (props.cell && props.cell.rowSpan) || 1);
let internal = false;

function paint() { if (el.value) el.value.innerHTML = segmentsToHTML(cellSegments(props.cell)); }
onMounted(paint);
watch(() => props.cell, () => { if (internal) { internal = false; return; } paint(); }, { deep: true });

function onInput() { internal = true; emit('update', domToSegments(el.value)); }
</script>
