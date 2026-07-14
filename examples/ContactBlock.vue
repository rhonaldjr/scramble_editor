<!--
  Sample CUSTOM block — authored by the host, registered via the public API in
  HostApp.vue. It searches the host's data (ctx.adapters.fetchContacts), stores
  the pick in block.data.contact, renders a card in view mode, and (in HostApp)
  defines Markdown/HTML exporters. Nothing here is part of the component.
-->
<template>
  <div class="sc-contact-wrap">
    <div v-if="block.data.contact" class="sc-contact">
      <span class="sc-contact__name">{{ block.data.contact.name }}</span>
      <span v-if="block.data.contact.role" class="sc-contact__role">{{ block.data.contact.role }}</span>
      <a class="sc-contact__email" :href="`mailto:${block.data.contact.email}`">{{ block.data.contact.email }}</a>
      <button v-if="!readonly" class="sc-contact__clear" @click="clear">Change</button>
    </div>

    <div v-else-if="!readonly" class="sc-contact-edit">
      <input
        v-model="query"
        class="sc-contact__search"
        type="text"
        placeholder="Search contacts…"
        @input="search"
        @focus="search"
      />
      <div v-if="results.length" class="sc-contact__results">
        <div
          v-for="c in results"
          :key="c.id"
          class="sc-contact__result"
          @mousedown.prevent="pick(c)"
        >
          {{ c.name }} · {{ c.role || c.email }}
        </div>
      </div>
    </div>

    <div v-else class="sc-contact--empty">No contact selected</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useEditor } from '../src/index.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);

const query = ref('');
const results = ref([]);

async function search() {
  const fetchContacts = ctx.adapters.value.fetchContacts;
  if (typeof fetchContacts === 'function') {
    results.value = (await fetchContacts(query.value)) || [];
  }
}
function pick(c) {
  props.block.data.contact = c;
  results.value = [];
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function clear() {
  props.block.data.contact = null;
  ctx.markChanged();
}
</script>

<style>
.sc-contact { display: inline-flex; align-items: baseline; gap: 8px; padding: 8px 12px; border: 1px solid #e9e9e7; border-radius: 6px; }
.sc-contact__name { font-weight: 600; }
.sc-contact__role { color: #9b9a97; font-size: 0.85em; }
.sc-contact__email { color: #2383e2; text-decoration: none; font-size: 0.9em; }
.sc-contact__clear { border: 1px solid #e9e9e7; background: #fff; border-radius: 5px; padding: 2px 8px; cursor: pointer; color: #9b9a97; font-size: 12px; }
.sc-contact-edit { position: relative; display: inline-block; }
.sc-contact__search { width: 240px; padding: 6px 8px; border: 1px solid #e9e9e7; border-radius: 5px; font: inherit; }
.sc-contact__results { position: absolute; top: 100%; left: 0; z-index: 45; min-width: 240px; background: #fff; border: 1px solid #e9e9e7; border-radius: 6px; box-shadow: 0 6px 24px rgba(15,15,15,0.16); margin-top: 4px; max-height: 240px; overflow-y: auto; }
.sc-contact__result { padding: 6px 10px; cursor: pointer; }
.sc-contact__result:hover { background: #f1f1f0; }
.sc-contact--empty { color: #9b9a97; font-style: italic; }
</style>
