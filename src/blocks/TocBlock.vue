<template>
  <nav class="sc-toc" :class="{ 'sc-toc--sticky': block.props && block.props.sticky }">
    <ul v-if="headings.length" class="sc-toc__list">
      <li v-for="h in headings" :key="h.id" :style="{ marginLeft: `${(h.level - 1) * 14}px` }">
        <a href="#" @click.prevent="scrollTo(h.id)">{{ h.text }}</a>
      </li>
    </ul>
    <div v-else class="sc-toc__empty">No headings yet</div>
    <label v-if="!readonly" class="sc-toc__sticky">
      <input type="checkbox" :checked="block.props && block.props.sticky" @change="toggleSticky" /> Sticky
    </label>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useEditor } from '../composables/editor.js';
import { flattenBlocks } from '../core/model.js';
import { headingLevel } from '../core/collapse.js';
import { segmentsText } from '../core/segments.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);

// Reactive: rebuilds as the document's headings change.
const headings = computed(() =>
  flattenBlocks(ctx.doc.blocks)
    .filter((b) => headingLevel(b.type) > 0)
    .map((b) => ({ id: b.id, level: headingLevel(b.type), text: segmentsText(b.data.segments) || 'Untitled' })),
);

function scrollTo(id) {
  const root = ctx.rootEl.value;
  const el = root && root.querySelector(`.sc-block[data-block-id="${id}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function toggleSticky(e) {
  props.block.props = props.block.props || {};
  props.block.props.sticky = e.target.checked;
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
</script>
