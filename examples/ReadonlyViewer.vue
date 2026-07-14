<!--
  Read-only viewer example — render a stored document without editing, and
  export it. Useful for published pages / previews.
-->
<template>
  <div class="ex">
    <div class="ex__bar">
      <strong>Read-only viewer</strong>
      <span style="flex:1" />
      <button @click="out = editor.getMarkdown()">Markdown</button>
      <button @click="out = editor.getHTML()">HTML</button>
    </div>
    <ScrambleEditor ref="editor" v-model="doc" :readonly="true" />
    <pre v-if="out" class="ex__out">{{ out }}</pre>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ScrambleEditor } from '../src/index.js';

const editor = ref(null);
const out = ref('');
const doc = ref({
  id: 'viewer',
  title: 'Viewer',
  style: {},
  blocks: [
    { id: 'h', type: 'heading-1', data: { segments: [{ text: 'Published page', marks: [] }] }, props: {}, children: [] },
    { id: 'p', type: 'paragraph', data: { segments: [{ text: 'This document is ', marks: [] }, { text: 'read-only', marks: ['bold'] }, { text: ' — no toolbar, no handles, no editing.', marks: [] }] }, props: {}, children: [] },
    { id: 'c', type: 'callout', data: { segments: [{ text: 'Export to Markdown or HTML with the buttons above.', marks: [] }], icon: '💡' }, props: {}, children: [] },
    { id: 'l1', type: 'checklist', data: { segments: [{ text: 'Renders every block type', marks: [] }], checked: true }, props: {}, children: [] },
  ],
});
</script>

<style>
.ex { max-width: 820px; margin: 0 auto; }
.ex__bar { display: flex; align-items: center; gap: 8px; padding: 8px 24px; }
.ex__bar button { padding: 4px 9px; border: 1px solid #ddd; border-radius: 5px; background: #fff; cursor: pointer; font-size: 12px; }
.ex__out { margin: 0 24px; background: #fafafa; border: 1px solid #e9e9e7; border-radius: 6px; padding: 10px; font-size: 12px; white-space: pre-wrap; overflow: auto; max-height: 260px; }
</style>
