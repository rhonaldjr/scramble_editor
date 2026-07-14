<!--
  Minimal example — the smallest possible integration.
  Just v-model. The document lives in the host's state.
-->
<template>
  <div class="ex">
    <ScrambleEditor v-model="doc" />
    <details class="ex__json">
      <summary>document (v-model)</summary>
      <pre>{{ JSON.stringify(doc, null, 2) }}</pre>
    </details>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ScrambleEditor } from '../src/index.js';

const doc = ref({
  id: 'minimal',
  title: 'Minimal',
  style: {},
  blocks: [
    { id: 'h', type: 'heading-1', data: { segments: [{ text: 'Minimal editor', marks: [] }] }, props: {}, children: [] },
    { id: 'p', type: 'paragraph', data: { segments: [{ text: 'One prop: v-model. Type “/” for blocks.', marks: [] }] }, props: {}, children: [] },
  ],
});
</script>

<style>
.ex { max-width: 820px; margin: 0 auto; }
.ex__json { margin: 12px 24px; font-size: 12px; color: #787774; }
.ex__json pre { background: #fafafa; border: 1px solid #e9e9e7; border-radius: 6px; padding: 8px; overflow: auto; max-height: 220px; }
</style>
