<template>
  <div class="sc-pagestyle">
    <button
      class="sc-pagestyle__gear"
      title="Page style"
      @mousedown.prevent.stop="open = !open"
    >
      Aa
    </button>
    <div v-if="open" class="sc-pagestyle__menu" @mousedown.stop>
      <label class="sc-pagestyle__row">
        <input type="checkbox" :checked="style.fullWidth" @change="set({ fullWidth: !style.fullWidth })" />
        Full width
      </label>
      <label class="sc-pagestyle__row">
        <input type="checkbox" :checked="style.smallText" @change="set({ smallText: !style.smallText })" />
        Small text
      </label>
      <div class="sc-pagestyle__row">
        <span>Font</span>
        <select :value="style.font || 'default'" @change="set({ font: $event.target.value })">
          <option value="default">Default</option>
          <option value="serif">Serif</option>
          <option value="mono">Mono</option>
          <option v-for="f in customFonts" :key="f.id || f.value" :value="f.id || f.value">{{ f.label || f.id || f.value }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';

const ctx = useEditor();
const open = ref(false);
const style = computed(() => ctx.doc.style || {});
const customFonts = computed(() => (ctx.fonts ? ctx.fonts.value : []));

function set(patch) {
  ctx.setStyle(patch);
}

function onDocMouseDown() { if (open.value) open.value = false; }
onMounted(() => document.addEventListener('mousedown', onDocMouseDown));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMouseDown));
</script>
