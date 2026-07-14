<template>
  <pre class="sc-code"><code
    v-if="readonly"
    ref="viewEl"
    :class="block.data.language ? `language-${block.data.language}` : ''"
  >{{ block.data.code }}</code><code
    v-else
    ref="el"
    data-role="code"
    contenteditable="true"
    spellcheck="false"
    @input="onInput"
  >{{ initial }}</code></pre>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useEditor } from '../composables/editor.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const el = ref(null);
const viewEl = ref(null);
const initial = props.block.data.code || '';

function onInput() {
  props.block.data.code = el.value.textContent;
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}

function highlight() {
  if (readonly.value && viewEl.value && window.hljs) {
    try {
      window.hljs.highlightElement(viewEl.value);
    } catch {
      /* best effort */
    }
  }
}
onMounted(highlight);
watch(() => props.block.data.code, highlight);
</script>
