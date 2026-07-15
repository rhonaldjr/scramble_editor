<template>
  <div class="sc-platform" :class="{ 'sc-platform--empty': !html }">
    <div v-if="block.data.heading" class="sc-platform__heading">{{ block.data.heading }}</div>

    <div class="sc-platform__body" :style="frameStyle">
      <iframe
        v-if="html"
        class="sc-platform__frame"
        :srcdoc="wrappedHtml"
        sandbox="allow-same-origin allow-popups"
        referrerpolicy="no-referrer"
      />
      <div v-else class="sc-platform__placeholder">
        <template v-if="!hasResolver">🧩 Platform content isn’t configured for this app.</template>
        <template v-else-if="loading">Loading platform content…</template>
        <template v-else-if="!configured">Open ⚙ to search and pick content for this block.</template>
        <template v-else>No content returned.</template>
      </div>

      <template v-if="!readonly">
        <button class="sc-media__gear" title="Platform content options" @mousedown.prevent.stop="showGear = !showGear">⚙</button>
        <span class="sc-resize" title="Drag to resize" @mousedown.prevent="startResize" />
      </template>
    </div>

    <div v-if="showGear && !readonly" class="sc-media-gear sc-platform-gear" @mousedown.stop>
      <label class="sc-media-gear__row">
        <span>Heading</span>
        <input type="text" placeholder="optional" :value="block.data.heading" @input="set('heading', $event.target.value)" />
      </label>
      <div class="sc-media-gear__row">
        <span>Align</span>
        <span>
          <button v-for="a in ['left', 'center', 'right']" :key="a" class="sc-media-gear__btn" :class="{ 'is-active': align === a }" @mousedown.prevent="ctx.setProps(block.id, { align: a })">{{ a }}</button>
        </span>
      </div>
      <label class="sc-media-gear__row">
        <span>Width</span>
        <input type="number" min="200" step="10" placeholder="full" :value="block.data.width || ''" @change="setDim('width', $event.target.value)" />
      </label>
      <label class="sc-media-gear__row">
        <span>Height</span>
        <input type="number" min="120" step="10" :value="block.data.height || 260" @change="setDim('height', $event.target.value)" />
      </label>
      <label class="sc-media-gear__row">
        <span>Refresh</span>
        <select :value="block.data.refresh" @change="setRefresh($event.target.value)">
          <option v-for="o in REFRESH_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label v-if="sources.length > 1" class="sc-media-gear__row">
        <span>Source</span>
        <select :value="block.data.source" @change="set('source', $event.target.value)">
          <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name || s.id }}</option>
        </select>
      </label>

      <div class="sc-platform-gear__search">
        <input
          type="search"
          placeholder="Search platform content…"
          :value="searchText"
          @input="onSearch($event.target.value)"
        />
        <button class="sc-media-gear__btn" title="Use the search text as this block's live query" :disabled="!searchText" @mousedown.prevent="useAsQuery">Use as query</button>
      </div>
      <div v-if="block.data.query" class="sc-platform-gear__query">
        Query: <strong>{{ block.data.query }}</strong>
        <button class="sc-platform-gear__clear" @mousedown.prevent="set('query', '')">✕</button>
      </div>
      <ul v-if="results.length" class="sc-platform-gear__results">
        <li v-for="r in results" :key="r.id">
          <label>
            <input type="checkbox" :checked="isSelected(r.id)" @change="toggle(r)" />
            <span>{{ r.title || r.id }}</span>
          </label>
        </li>
      </ul>
      <div v-else-if="searching" class="sc-platform-gear__hint">Searching…</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { REFRESH_OPTIONS, clampRefresh } from '../core/platform.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const showGear = ref(false);

const html = ref(props.block.data.html || '');
const loading = ref(false);
const searchText = ref('');
const searching = ref(false);
const results = ref([]);

const hasResolver = computed(() => typeof ctx.adapters.value.platformResolve === 'function');
const sources = computed(() => (ctx.platform && ctx.platform.value && ctx.platform.value.sources) || []);
const align = computed(() => (props.block.props && props.block.props.align) || 'left');
const configured = computed(() => Boolean(props.block.data.query || (props.block.data.ids && props.block.data.ids.length)));
const frameStyle = computed(() => ({
  width: props.block.data.width ? `${props.block.data.width}px` : '100%',
  height: `${props.block.data.height || 260}px`,
}));
const wrappedHtml = computed(() =>
  '<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark">' +
  '<style>body{font:14px/1.5 system-ui,-apple-system,sans-serif;margin:12px;color:#111}a{color:#2266dd}img{max-width:100%}</style>' +
  `</head><body>${html.value || ''}</body></html>`);

function changed() { ctx.emitEvent('block:updated', { id: props.block.id }); ctx.markChanged(); }
function set(field, value) { props.block.data[field] = value; ctx.emitEvent('platform:configured', { id: props.block.id, field }); changed(); }
function setDim(field, value) {
  const n = Number(value);
  props.block.data[field] = n > 0 ? n : (field === 'width' ? null : 260);
  ctx.emitEvent('media:resized', { id: props.block.id, width: props.block.data.width, height: props.block.data.height });
  changed();
}
function setRefresh(v) { props.block.data.refresh = clampRefresh(v === 'none' ? 'none' : Number(v)); changed(); scheduleRefresh(); }

const isSelected = (id) => (props.block.data.ids || []).includes(id);
function toggle(r) {
  const ids = new Set(props.block.data.ids || []);
  if (ids.has(r.id)) ids.delete(r.id); else ids.add(r.id);
  props.block.data.ids = [...ids];
  props.block.data.query = ''; // selecting items overrides a free query
  ctx.emitEvent('platform:configured', { id: props.block.id });
  changed();
  resolve();
}
function useAsQuery() {
  props.block.data.query = searchText.value.trim();
  props.block.data.ids = [];
  ctx.emitEvent('platform:configured', { id: props.block.id });
  changed();
  resolve();
}

// --- search (debounced) ---
let searchTimer = null;
function onSearch(text) {
  searchText.value = text;
  clearTimeout(searchTimer);
  const fn = ctx.adapters.value.platformSearch;
  if (!fn || !text.trim()) { results.value = []; return; }
  searching.value = true;
  searchTimer = setTimeout(async () => {
    try {
      const r = await fn(text.trim(), { source: props.block.data.source, blockId: props.block.id });
      results.value = Array.isArray(r) ? r : [];
    } catch { results.value = []; }
    searching.value = false;
  }, 250);
}

// --- resolve the block's content HTML ---
async function resolve() {
  const fn = ctx.adapters.value.platformResolve;
  if (!fn) return;
  loading.value = true;
  try {
    const r = await fn({ query: props.block.data.query, ids: props.block.data.ids || [], source: props.block.data.source, blockId: props.block.id });
    const h = typeof r === 'string' ? r : (r && r.html) || '';
    html.value = h;
    props.block.data.html = h; // cache for export/persistence (no markChanged — derived)
    ctx.emitEvent('platform:loaded', { id: props.block.id });
  } catch {
    html.value = props.block.data.html || '';
  }
  loading.value = false;
}

// --- refresh interval ---
let timer = null;
function scheduleRefresh() {
  clearInterval(timer);
  const r = clampRefresh(props.block.data.refresh);
  if (typeof r === 'number') timer = setInterval(resolve, r * 1000);
}

// Free width/height resize (drag the corner).
function startResize(event) {
  const body = event.currentTarget.closest('.sc-platform__body');
  if (!body) return;
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startW = rect.width;
  const startH = rect.height;
  const onMove = (ev) => {
    props.block.data.width = Math.max(200, Math.round(startW + (ev.clientX - startX)));
    props.block.data.height = Math.max(120, Math.round(startH + (ev.clientY - startY)));
    ctx.emitEvent('media:resized', { id: props.block.id, width: props.block.data.width, height: props.block.data.height });
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    changed();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function closeGear(e) {
  if (showGear.value && !(e.target.closest && e.target.closest('.sc-platform'))) showGear.value = false;
}

watch(() => [props.block.data.query, (props.block.data.ids || []).join(','), props.block.data.source], resolve);
onMounted(() => {
  if (configured.value) resolve();
  scheduleRefresh();
  document.addEventListener('mousedown', closeGear);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  clearTimeout(searchTimer);
  document.removeEventListener('mousedown', closeGear);
});
</script>
