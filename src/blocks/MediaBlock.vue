<template>
  <figure class="sc-media" :class="{ 'sc-fit': fit }">
    <template v-if="block.data.url">
      <div class="sc-media__frame" :style="frameStyle">
        <img v-if="kind === 'image'" class="sc-media__img" :src="block.data.url" :alt="block.data.caption || ''" />
        <video
          v-else-if="kind === 'video'"
          class="sc-media__video"
          :src="block.data.url"
          :controls="opt('controls', true)"
          :autoplay="opt('autoplay')"
          :loop="opt('loop')"
          :muted="opt('muted')"
        />
        <audio v-else-if="kind === 'audio'" :src="block.data.url" controls />
        <a v-else class="sc-media__file" :href="block.data.url" download>📎 {{ block.data.caption || block.data.url }}</a>

        <template v-if="!readonly">
          <button class="sc-media__gear" title="Media options" @mousedown.prevent.stop="showGear = !showGear">⚙</button>
          <span v-if="resizable" class="sc-resize" title="Drag to resize" @mousedown.prevent="startResize" />

          <div v-if="showGear" class="sc-media-gear" @mousedown.stop>
            <label class="sc-media-gear__row">
              <span>URL</span>
              <input type="text" :value="block.data.url" @change="setUrl($event.target.value)" />
            </label>
            <label class="sc-media-gear__row">
              <span>Caption</span>
              <input type="text" :value="block.data.caption" @input="setCaption" />
            </label>
            <div class="sc-media-gear__row">
              <span>Align</span>
              <span>
                <button
                  v-for="a in ['left', 'center', 'right']"
                  :key="a"
                  class="sc-media-gear__btn"
                  :class="{ 'is-active': align === a }"
                  @mousedown.prevent="setAlign(a)"
                >{{ a }}</button>
              </span>
            </div>
            <div class="sc-media-gear__row">
              <span>Wrap text</span>
              <span>
                <button
                  v-for="w in [['', 'off'], ['left', 'left'], ['right', 'right']]"
                  :key="w[0]"
                  class="sc-media-gear__btn"
                  :class="{ 'is-active': wrap === w[0] }"
                  @mousedown.prevent="setWrap(w[0])"
                >{{ w[1] }}</button>
              </span>
            </div>
            <label v-if="resizable" class="sc-media-gear__row">
              <span>Width</span>
              <input type="number" min="80" step="10" placeholder="auto" :value="block.data.width || ''" @change="setWidth($event.target.value)" />
            </label>
            <div v-if="resizable && inSlide" class="sc-media-gear__row">
              <span>Slide</span>
              <button class="sc-media-gear__btn" :class="{ 'is-active': fit }" @mousedown.prevent="fitToSlide">Fit to slide</button>
            </div>
            <label v-for="o in videoOpts" :key="o.key" class="sc-media-gear__row sc-media-gear__check">
              <input type="checkbox" :checked="opt(o.key, o.def)" @change="setOption(o.key, $event.target.checked)" />
              {{ o.label }}
            </label>
          </div>
        </template>
      </div>
      <figcaption v-if="readonly && block.data.caption">{{ block.data.caption }}</figcaption>
    </template>

    <div
      v-else-if="!readonly"
      class="sc-media__drop"
      :class="{ 'is-over': over }"
      @dragover.prevent.stop="over = true"
      @dragleave="over = false"
      @drop.prevent.stop="onDrop"
    >
      <label v-if="hasUploader" class="sc-media__btn">
        <input type="file" :accept="accept" hidden @change="onPick" />
        Click or drop a {{ kind }}
      </label>
      <input class="sc-media__url" type="text" placeholder="…or paste a URL" @change="setUrl($event.target.value)" />
    </div>
  </figure>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { startMediaResize } from '../composables/useMediaResize.js';
import { useSlideFit } from '../composables/useSlideFit.js';

const props = defineProps({
  block: { type: Object, required: true },
  kind: { type: String, default: 'image' }, // image | video | audio | file
});

const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const over = ref(false);
const showGear = ref(false);

const hasUploader = computed(() => typeof ctx.adapters.value.upload === 'function');
const resizable = computed(() => props.kind === 'image' || props.kind === 'video');
const accept = computed(() =>
  props.kind === 'image' ? 'image/*' : props.kind === 'video' ? 'video/*' : props.kind === 'audio' ? 'audio/*' : '*/*',
);
const videoOpts =
  props.kind === 'video'
    ? [
        { key: 'controls', label: 'Controls', def: true },
        { key: 'autoplay', label: 'Autoplay', def: false },
        { key: 'loop', label: 'Loop', def: false },
        { key: 'muted', label: 'Muted', def: false },
      ]
    : [];
const { inSlide } = useSlideFit();
const fit = computed(() => inSlide && !props.block.data.width && (props.kind === 'image' || props.kind === 'video'));
const frameStyle = computed(() => (props.block.data.width ? { width: `${props.block.data.width}px` } : {}));
// Alignment/wrap live on props (block-level, shared with the handle menu).
// Fall back to the legacy data.align so older documents still align.
const align = computed(() => (props.block.props && props.block.props.align) || props.block.data.align || 'left');
const wrap = computed(() => (props.block.props && props.block.props.wrap) || '');

function fitToSlide() {
  props.block.data.width = null; // clear explicit size → CSS contains it in the slide
  ctx.emitEvent('media:resized', { id: props.block.id, width: null, fit: true });
  changed();
}

function opt(k, d = false) {
  const o = props.block.data.options || {};
  return k in o ? o[k] : d;
}
function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function setUrl(value) {
  const url = String(value || '').trim();
  props.block.data.url = url;
  if (url) ctx.emitEvent('media:uploaded', { id: props.block.id, kind: props.kind, url });
  changed();
}
function setCaption(e) { props.block.data.caption = e.target.value; ctx.markChanged(); }
function setAlign(a) { ctx.setProps(props.block.id, { align: a }); ctx.emitEvent('media:configured', { id: props.block.id, align: a }); }
function setWrap(w) { ctx.setProps(props.block.id, { wrap: w }); ctx.emitEvent('media:configured', { id: props.block.id, wrap: w }); }
function setWidth(v) {
  const w = Number(v);
  props.block.data.width = w > 0 ? w : null;
  ctx.emitEvent('media:resized', { id: props.block.id, width: props.block.data.width });
  changed();
}
function setOption(k, v) {
  props.block.data.options = { ...(props.block.data.options || {}), [k]: v };
  ctx.emitEvent('media:configured', { id: props.block.id, option: k, value: v });
  changed();
}

async function upload(file) {
  const r = await ctx.adapters.value.upload(file);
  const url = typeof r === 'string' ? r : r.url;
  props.block.data.url = url;
  ctx.emitEvent('media:uploaded', { id: props.block.id, kind: props.kind, url, name: file.name });
  changed();
}
async function onPick(e) { const f = e.target.files && e.target.files[0]; if (f && hasUploader.value) await upload(f); }
async function onDrop(e) { over.value = false; const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && hasUploader.value) await upload(f); }

function startResize(e) {
  startMediaResize(e, e.currentTarget.closest('.sc-media__frame'), props.block, ctx);
}

function closeGear(e) {
  if (showGear.value && !(e.target.closest && e.target.closest('.sc-media__frame'))) showGear.value = false;
}
onMounted(() => document.addEventListener('mousedown', closeGear));
onBeforeUnmount(() => document.removeEventListener('mousedown', closeGear));
</script>
