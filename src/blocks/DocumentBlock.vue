<template>
  <div class="sc-document" :class="{ 'sc-fit': fit }">
    <div v-if="block.data.url" class="sc-document__wrap" :style="frameStyle">
      <div class="sc-document__bar">
        <span class="sc-document__type">{{ icon }} {{ label }}</span>
        <span class="sc-document__name">{{ block.data.name || block.data.url }}</span>
        <a class="sc-document__open" :href="block.data.url" target="_blank" rel="noopener" download>Open</a>
      </div>

      <iframe
        v-if="viewerHtml"
        class="sc-document__frame"
        :srcdoc="viewerHtml"
        sandbox="allow-same-origin"
        referrerpolicy="no-referrer"
      />
      <iframe
        v-else-if="viewerUrl"
        class="sc-document__frame"
        :src="viewerUrl"
        frameborder="0"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <div v-else class="sc-document__fallback">
        <p v-if="resolving">Preparing preview…</p>
        <template v-else>
          <p>Can’t preview this {{ label.toLowerCase() }} inline.</p>
          <p class="sc-document__hint">
            PDFs preview directly. Office/ODF files need a public URL or a
            <code>resolveDocumentUrl</code> adapter (which may also return rendered
            <code>{ html }</code> — see the example).
          </p>
          <a :href="block.data.url" target="_blank" rel="noopener" download>Download the file</a>
        </template>
      </div>

      <template v-if="!readonly">
        <button class="sc-media__gear" title="Document options" @mousedown.prevent.stop="showGear = !showGear">⚙</button>
        <span class="sc-resize" title="Drag to resize" @mousedown.prevent="startResize" />
        <div v-if="showGear" class="sc-media-gear" @mousedown.stop>
          <label class="sc-media-gear__row">
            <span>URL</span>
            <input type="url" :value="block.data.url" @change="setUrl($event.target.value)" />
          </label>
          <label class="sc-media-gear__row">
            <span>Type</span>
            <select :value="docType" @change="setType($event.target.value)">
              <option value="">auto-detect</option>
              <option value="pdf">PDF</option>
              <option value="word">Document (docx/odt)</option>
              <option value="powerpoint">Presentation (pptx/odp)</option>
              <option value="excel">Spreadsheet (xlsx/ods)</option>
            </select>
          </label>
          <label class="sc-media-gear__row">
            <span>Width</span>
            <input type="number" min="200" step="10" placeholder="full" :value="block.data.width || ''" @change="setDim('width', $event.target.value)" />
          </label>
          <label class="sc-media-gear__row">
            <span>Height</span>
            <input type="number" min="160" step="10" :value="block.data.height || 480" @change="setDim('height', $event.target.value)" />
          </label>
          <div v-if="inSlide" class="sc-media-gear__row">
            <span>Slide</span>
            <button class="sc-media-gear__btn" :class="{ 'is-active': fit }" @mousedown.prevent="fitToSlide">Fit to slide</button>
          </div>
        </div>
      </template>
    </div>

    <div
      v-else-if="!readonly"
      class="sc-document__drop"
      :class="{ 'is-over': over }"
      @dragover.prevent.stop="over = true"
      @dragleave="over = false"
      @drop.prevent.stop="onDrop"
    >
      <label v-if="hasUploader" class="sc-document__btn">
        <input type="file" :accept="ACCEPT" hidden @change="onPick" />
        Click or drop a document (PDF, Word, PowerPoint, Excel, ODF)
      </label>
      <input class="sc-media__url" type="url" placeholder="…or paste a document URL" @change="setUrl($event.target.value)" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { detectDocType, docTypeLabel, docTypeIcon, defaultViewerUrl } from '../core/documents.js';
import { useSlideFit } from '../composables/useSlideFit.js';

const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.ppt,.pptx,.odp,.xls,.xlsx,.ods,.csv';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const over = ref(false);
const showGear = ref(false);
const viewerUrl = ref('');
const viewerHtml = ref('');
const resolving = ref(false);
let lastFile = null; // transient File from the last upload/drop (for host renderers)

const hasUploader = computed(() => typeof ctx.adapters.value.upload === 'function');
const docType = computed(() => props.block.data.docType || detectDocType(props.block.data.name || props.block.data.url));
const label = computed(() => docTypeLabel(docType.value));
const icon = computed(() => docTypeIcon(docType.value));
const { inSlide } = useSlideFit();
const fit = computed(() => inSlide && !props.block.data.width);
const frameStyle = computed(() => {
  if (fit.value) return {}; // slide CSS sizes it to contain
  return {
    width: props.block.data.width ? `${props.block.data.width}px` : '100%',
    height: `${props.block.data.height || 480}px`,
  };
});

function fitToSlide() {
  props.block.data.width = null;
  props.block.data.height = null;
  ctx.emitEvent('media:resized', { id: props.block.id, width: null, height: null, fit: true });
  changed();
}

// Wrap host-rendered HTML in a minimal, isolated document for the srcdoc iframe.
function wrapHtml(inner) {
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>body{font:14px/1.5 system-ui,-apple-system,sans-serif;margin:16px;color:#111;background:#fff}' +
    'img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>' +
    `</head><body>${inner || ''}</body></html>`;
}

// Resolve how to preview the document. The host `resolveDocumentUrl` adapter runs
// first (per-block pull hook) and may return a URL (string / `{ url }`) or fully
// rendered `{ html }` (e.g. docx/xlsx converted client-side). Otherwise we use
// the built-in default (native PDF / Office Online viewer). The File from the
// last upload/drop is passed along so a host can render it without re-fetching.
async function resolveViewer() {
  const url = props.block.data.url;
  const type = docType.value;
  if (!url) { viewerUrl.value = ''; viewerHtml.value = ''; return; }
  const resolver = ctx.adapters.value.resolveDocumentUrl;
  let resolved = null;
  if (typeof resolver === 'function') {
    resolving.value = true;
    try {
      resolved = await resolver({ url, type, name: props.block.data.name || '', blockId: props.block.id, file: lastFile });
    } catch { /* fall back to the default below */ } finally {
      resolving.value = false;
    }
  }
  if (resolved && typeof resolved === 'object' && resolved.html != null) {
    viewerHtml.value = wrapHtml(resolved.html);
    viewerUrl.value = '';
    props.block.data.viewerUrl = '';
    return;
  }
  const u = typeof resolved === 'string' ? resolved : (resolved && resolved.url) || '';
  viewerHtml.value = '';
  viewerUrl.value = u || defaultViewerUrl(url, type);
  props.block.data.viewerUrl = viewerUrl.value; // persisted so export can reuse it
}
watch(() => [props.block.data.url, docType.value], resolveViewer, { immediate: true });

function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function announce(extra = {}) {
  ctx.emitEvent('document:added', {
    id: props.block.id, url: props.block.data.url, name: props.block.data.name || '', type: docType.value, ...extra,
  });
}

function setUrl(value) {
  const url = String(value || '').trim();
  props.block.data.url = url;
  props.block.data.name = props.block.data.name || nameFromUrl(url);
  props.block.data.docType = '';
  if (url) announce();
  changed();
}
function setType(value) {
  props.block.data.docType = value;
  ctx.emitEvent('document:configured', { id: props.block.id, type: value });
  changed();
}
function setDim(field, value) {
  const n = Number(value);
  props.block.data[field] = n > 0 ? n : (field === 'width' ? null : 480);
  ctx.emitEvent('media:resized', { id: props.block.id, width: props.block.data.width, height: props.block.data.height });
  changed();
}

function nameFromUrl(url) {
  const clean = String(url).split(/[?#]/)[0];
  const seg = clean.slice(clean.lastIndexOf('/') + 1);
  return /^https?:|^data:|^blob:/.test(url) && seg ? decodeURIComponent(seg) : '';
}

async function upload(file) {
  lastFile = file; // kept for the resolver so a host can render it directly
  const r = await ctx.adapters.value.upload(file);
  const url = typeof r === 'string' ? r : r.url;
  props.block.data.url = url;
  props.block.data.name = (r && r.name) || file.name;
  props.block.data.docType = detectDocType(file.name, file.type) || '';
  ctx.emitEvent('media:uploaded', { id: props.block.id, url, name: props.block.data.name });
  announce({ uploaded: true });
  changed();
}
async function onPick(e) { const f = e.target.files && e.target.files[0]; if (f && hasUploader.value) await upload(f); }
async function onDrop(e) { over.value = false; const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && hasUploader.value) await upload(f); }

// Free width/height resize (documents have no intrinsic aspect ratio).
function startResize(event) {
  const wrap = event.currentTarget.closest('.sc-document__wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startW = rect.width;
  const startH = rect.height;
  const onMove = (ev) => {
    props.block.data.width = Math.max(200, Math.round(startW + (ev.clientX - startX)));
    props.block.data.height = Math.max(160, Math.round(startH + (ev.clientY - startY)));
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
  if (showGear.value && !(e.target.closest && e.target.closest('.sc-document__wrap'))) showGear.value = false;
}
onMounted(() => document.addEventListener('mousedown', closeGear));
onBeforeUnmount(() => document.removeEventListener('mousedown', closeGear));
</script>
