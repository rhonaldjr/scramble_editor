<template>
  <div v-if="ctx.handle.open" ref="menuEl" class="sc-menu" :style="style" @mousedown.stop>
    <!-- main -->
    <template v-if="panel === 'main'">
      <div v-if="targets.length > 1" class="sc-menu__item" @mousedown.prevent="panel = 'turn'">
        <span>Turn into</span><span class="sc-menu__arrow">›</span>
      </div>
      <div class="sc-menu__item" @mousedown.prevent="run(() => ctx.duplicate(id))">Duplicate</div>
      <div class="sc-menu__item" @mousedown.prevent="run(() => ctx.moveUp(id))">Move up</div>
      <div class="sc-menu__item" @mousedown.prevent="run(() => ctx.moveDown(id))">Move down</div>
      <div class="sc-menu__item" @mousedown.prevent="run(() => ctx.copyLink(id))">Copy block link</div>
      <div class="sc-menu__item" @mousedown.prevent="run(comment)">Comment</div>
      <div class="sc-menu__item" @mousedown.prevent="panel = 'text'">
        <span>Text color</span><span class="sc-menu__arrow">›</span>
      </div>
      <div class="sc-menu__item" @mousedown.prevent="panel = 'bg'">
        <span>Background color</span><span class="sc-menu__arrow">›</span>
      </div>
      <div class="sc-menu__item" @mousedown.prevent="run(setBackgroundImage)">Background image…</div>
      <div class="sc-menu__item sc-menu__item--static">
        <span>Align</span>
        <span class="sc-menu__aligns">
          <button
            v-for="a in ['left', 'center', 'right']"
            :key="a"
            class="sc-menu__alignbtn"
            :class="{ 'is-active': currentAlign === a }"
            :title="`Align ${a}`"
            @mousedown.prevent="run(() => ctx.setProps(id, { align: a }))"
          >{{ ALIGN_ICON[a] }}</button>
        </span>
      </div>
      <div class="sc-menu__item sc-menu__item--danger" @mousedown.prevent="run(() => ctx.removeBlock(id))">Delete</div>
    </template>

    <!-- turn into -->
    <template v-else-if="panel === 'turn'">
      <div class="sc-menu__item" @mousedown.prevent="panel = 'main'">‹ Back</div>
      <div
        v-for="t in targets"
        :key="t.type"
        class="sc-menu__item"
        @mousedown.prevent="run(() => ctx.turnInto(id, t.type))"
      >
        <span><span class="sc-menu__icon">{{ t.icon }}</span>{{ t.label }}</span>
        <span v-if="t.type === currentType">✓</span>
      </div>
    </template>

    <!-- color panels -->
    <template v-else>
      <div class="sc-menu__item" @mousedown.prevent="panel = 'main'">‹ Back</div>
      <div
        v-for="tok in COLOR_TOKENS"
        :key="tok"
        class="sc-menu__item"
        @mousedown.prevent="run(() => ctx.setColor(id, colorProp, tok))"
      >
        <span><span class="sc-swatch" :style="swatch(tok)">A</span>{{ labelOf(tok) }}</span>
        <span v-if="tok === currentColor">✓</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import { findBlock } from '../core/model.js';
import { COLOR_TOKENS, TEXT_COLORS, BG_COLORS } from '../core/colors.js';

const ctx = useEditor();
const panel = ref('main');
const menuEl = ref(null);
const ALIGN_ICON = { left: '⇤', center: '↔', right: '⇥' };
const currentAlign = computed(() => (current.value && current.value.block.props && current.value.block.props.align) || 'left');

const id = computed(() => ctx.handle.id);
const style = computed(() => ({ position: 'fixed', left: `${ctx.handle.x}px`, top: `${ctx.handle.y}px` }));

const current = computed(() => (id.value ? findBlock(ctx.doc.blocks, id.value) : null));
const currentType = computed(() => (current.value ? current.value.block.type : null));
const targets = computed(() => (currentType.value ? ctx.turnIntoTargets(currentType.value) : []));

const colorProp = computed(() => (panel.value === 'text' ? 'color' : 'background'));
const currentColor = computed(() => {
  const b = current.value && current.value.block;
  return (b && b.props && b.props[colorProp.value]) || 'default';
});

function swatch(tok) {
  return panel.value === 'text'
    ? { color: TEXT_COLORS[tok] || 'inherit' }
    : { background: BG_COLORS[tok] || 'transparent' };
}
function labelOf(tok) {
  return tok[0].toUpperCase() + tok.slice(1);
}

function comment() {
  ctx.openComments(id.value, ctx.handle.x, ctx.handle.y);
}
function setBackgroundImage() {
  const b = current.value && current.value.block;
  const currentUrl = (b && b.props && b.props.backgroundImage) || '';
  const url = window.prompt('Background image URL (empty to clear)', currentUrl);
  if (url === null) return;
  ctx.setBackground(id.value, { image: url.trim() });
}
function close() {
  ctx.closeHandleMenu();
  panel.value = 'main';
}
function run(fn) {
  fn();
  close();
}

watch(() => ctx.handle.open, (open) => { if (open) panel.value = 'main'; });

function onDocMouseDown() { if (ctx.handle.open) close(); } // inside clicks are stopped by @mousedown.stop
function onKey(e) { if (e.key === 'Escape' && ctx.handle.open) close(); }
onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown);
  document.removeEventListener('keydown', onKey);
});
</script>
