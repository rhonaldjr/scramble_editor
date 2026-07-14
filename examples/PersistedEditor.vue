<!--
  Persistence example — persistence is the HOST's job, done through the
  component's interface (v-model + @change). The component stores nothing.

  Pattern: load on mount, debounced autosave on @change, manual save.
  Swap localStorage for your REST/GraphQL API and nothing about the component
  changes.
-->
<template>
  <div class="ex">
    <div class="ex__bar">
      <strong>Persisted editor</strong>
      <span class="ex__status">{{ savedAt ? `Saved ${savedAt}` : 'Editing…' }}</span>
      <span style="flex:1" />
      <button @click="save()">Save now</button>
      <button @click="reload">Reload</button>
      <button @click="clear">Clear storage</button>
    </div>
    <ScrambleEditor v-model="doc" @change="onChange" />
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { ScrambleEditor } from '../src/index.js';

const KEY = 'scramble:persisted-example';
const savedAt = ref(null);

function starter() {
  return {
    id: 'persisted',
    title: 'Persisted',
    style: {},
    blocks: [
      { id: 'h', type: 'heading-1', data: { segments: [{ text: 'Persistence lives in the host', marks: [] }] }, props: {}, children: [] },
      { id: 'p', type: 'paragraph', data: { segments: [{ text: 'Edit, then reload the page — your changes are restored from localStorage.', marks: [] }] }, props: {}, children: [] },
    ],
  };
}
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || starter(); } catch { return starter(); }
}

const doc = ref(load());

let timer = null;
function onChange(next) {
  savedAt.value = null; // dirty
  clearTimeout(timer);
  timer = setTimeout(() => save(next), 500); // debounced autosave
}
function save(next) {
  localStorage.setItem(KEY, JSON.stringify(next || doc.value));
  savedAt.value = new Date().toLocaleTimeString();
}
function reload() { doc.value = load(); }
function clear() { localStorage.removeItem(KEY); doc.value = starter(); savedAt.value = null; }

onBeforeUnmount(() => clearTimeout(timer));
</script>

<style>
.ex { max-width: 820px; margin: 0 auto; }
.ex__bar { display: flex; align-items: center; gap: 8px; padding: 8px 24px; }
.ex__bar button { padding: 4px 9px; border: 1px solid #ddd; border-radius: 5px; background: #fff; cursor: pointer; font-size: 12px; }
.ex__status { color: #787774; font-size: 12px; }
</style>
