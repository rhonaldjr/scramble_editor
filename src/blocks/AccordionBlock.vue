<template>
  <div class="sc-accordion" :class="{ 'sc-accordion--open': !collapsed }">
    <div class="sc-accordion__head">
      <button
        type="button"
        class="sc-accordion__chev"
        :class="{ 'is-collapsed': collapsed }"
        :aria-expanded="String(!collapsed)"
        title="Expand / collapse"
        @mousedown.prevent="toggle"
      >▾</button>
      <div
        ref="el"
        class="sc-accordion__title"
        data-role="content"
        :contenteditable="!readonly"
        :data-placeholder="'Accordion title'"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
      />
    </div>
    <div v-show="!collapsed" class="sc-accordion__body">
      <BlockView v-for="child in block.children" :key="child.id" :block="child" />
      <button v-if="!readonly && !block.children.length" class="sc-accordion__add" @mousedown.prevent="addBody">+ Add content</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useEditor } from '../composables/editor.js';
import { useEditableText } from '../composables/useEditableText.js';
import BlockView from '../components/BlockView.vue';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const collapsed = computed(() => Boolean(props.block.props && props.block.props.collapsed));

// Reuse the contenteditable↔segments bridge for the title (paint + read + focus),
// but override key handling so the title doesn't split/merge like a text block.
const { el, onInput, onPaste } = useEditableText(props.block, ctx);

function toggle() { ctx.toggleCollapsed(props.block.id); }

function addBody() {
  const p = ctx.createBlock('paragraph');
  props.block.children.push(p);
  ctx.emitEvent('block:created', { id: p.id, in: props.block.id });
  ctx.markChanged();
  ctx.requestFocus(p.id, 0);
}

function onKeydown(e) {
  if (readonly.value) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    // Enter in the title drops into the body rather than splitting the title.
    e.preventDefault();
    if (props.block.props && props.block.props.collapsed) ctx.toggleCollapsed(props.block.id);
    if (!props.block.children.length) addBody();
    else ctx.requestFocus(props.block.children[0].id, 0);
  }
}
</script>
