<template>
  <div
    class="sc-block"
    :class="[alignClass, wrapClass, { 'sc-selected': selected, 'sc-remote': remote.length, 'sc-dim': dimmed }]"
    :style="remote.length ? { '--sc-remote-color': remote[0].color } : {}"
    :data-block-id="block.id"
    :data-type="block.type"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <div class="sc-block__row" :style="rowStyle">
      <span
        v-if="!readonly"
        class="sc-block__handle"
        draggable="true"
        title="Drag to move · click for actions"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @click="onHandleClick"
        >⠿</span
      >
      <span
        v-if="isCollapsible"
        class="sc-collapse"
        :class="{ 'sc-collapse--collapsed': collapsed }"
        @click="toggleCollapse"
        >▾</span
      >
      <component :is="def.component" v-if="def.component" :block="block" v-bind="def.componentProps || {}" />
      <span v-else class="sc-block__unknown">[unknown block: {{ block.type }}]</span>
      <span v-if="remote.length" class="sc-remote__tags">
        <span v-for="u in remote" :key="u.id" class="sc-remote__tag" :style="{ background: u.color }">{{ u.name }}</span>
      </span>
      <button v-if="comments.length" class="sc-comment-badge" title="Comments" @click="onComment">
        💬 {{ comments.length }}
      </button>
    </div>
    <div v-if="visibleChildren.length" class="sc-block__children">
      <BlockView v-for="child in visibleChildren" :key="child.id" :block="child" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getBlock } from '../core/registry.js';
import { TEXT_COLORS, BG_COLORS } from '../core/colors.js';
import { headingLevel, visibleAfterCollapse } from '../core/collapse.js';
import { useEditor } from '../composables/editor.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const def = computed(() => getBlock(props.block.type) || {});
const selected = computed(() => ctx.isSelected(props.block.id));
const remote = computed(() => (ctx.presenceFor ? ctx.presenceFor(props.block.id) : [])); // remote editors here
const comments = computed(() => (ctx.commentsFor ? ctx.commentsFor(props.block.id) : []));
const dimmed = computed(() =>
  Boolean(ctx.focusMode && ctx.focusMode.value) && ctx.activeBlockId && ctx.activeBlockId.value && ctx.activeBlockId.value !== props.block.id,
);
function onComment(e) {
  const r = e.currentTarget.getBoundingClientRect();
  ctx.openComments(props.block.id, r.left, r.bottom + 4);
}

const collapsed = computed(() => Boolean(props.block.props && props.block.props.collapsed));
const isCollapsible = computed(() => Boolean(def.value.collapsibleChildren) || headingLevel(props.block.type) > 0);
const visibleChildren = computed(() => {
  if (def.value.container) return []; // columns/column render their own children
  if (def.value.collapsibleChildren && collapsed.value) return []; // a collapsed toggle hides its children
  return visibleAfterCollapse(props.block.children || []);
});
function toggleCollapse() {
  ctx.toggleCollapsed(props.block.id);
}

const alignClass = computed(() => {
  const a = props.block.props && props.block.props.align;
  return a && a !== 'left' ? `sc-align-${a}` : null;
});
const wrapClass = computed(() => {
  const w = props.block.props && props.block.props.wrap;
  return w === 'left' || w === 'right' ? `sc-wrap-${w}` : null;
});

const rowStyle = computed(() => {
  const p = props.block.props || {};
  const s = {};
  if (TEXT_COLORS[p.color]) s.color = TEXT_COLORS[p.color];
  // Background: a palette token, or any raw CSS color, and/or an image URL.
  const bg = BG_COLORS[p.background] || p.backgroundColor;
  if (bg) { s.background = bg; s.borderRadius = '4px'; s.padding = '2px 6px'; }
  if (p.backgroundImage) {
    s.backgroundImage = `url("${p.backgroundImage}")`;
    s.backgroundSize = 'cover';
    s.backgroundPosition = 'center';
    s.borderRadius = '4px';
    s.padding = '2px 6px';
  }
  return s;
});

function onHandleClick(e) {
  if (!ctx.isEnabled('handleMenu')) return;
  const r = e.currentTarget.getBoundingClientRect();
  ctx.openHandleMenu(props.block.id, r.right + 4, r.top);
}

function onDragStart(e) {
  if (!ctx.isEnabled('dragAndDrop')) return;
  ctx.drag.id = props.block.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', props.block.id);
}
function onDragEnd() {
  ctx.drag.id = null;
}
function onDragOver(e) {
  if (!ctx.drag.id || ctx.drag.id === props.block.id) return;
  e.preventDefault();
}
function onDrop(e) {
  if (!ctx.drag.id || ctx.drag.id === props.block.id) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = e.currentTarget.getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;
  ctx.moveBlock(ctx.drag.id, props.block.id, after ? 'after' : 'before');
  ctx.drag.id = null;
}
</script>
