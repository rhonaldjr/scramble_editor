<template>
  <div class="sc-table-block" @focusin="onFocusIn" @focusout="onFocusOut">
    <!-- Floating toolbar (appears when the table is focused) -->
    <div v-if="focused && !readonly" class="sc-tabletoolbar" @mousedown.prevent>
      <div class="sc-tt__group" role="group" aria-label="Table width">
        <button v-for="w in WIDTHS" :key="w.v" class="sc-tt__btn" :class="{ 'is-active': tableWidth === w.v }" :title="w.label" @click="setWidth(w.v)">{{ w.label }}</button>
      </div>
      <div class="sc-tt__group" role="group" aria-label="Align table">
        <button v-for="a in ALIGNS" :key="a.v" class="sc-tt__btn sc-tt__icon" :class="{ 'is-active': align === a.v }" :title="`Align ${a.v}`" @click="setAlign(a.v)">{{ a.icon }}</button>
      </div>
      <div class="sc-tt__group" role="group" aria-label="Insert">
        <button class="sc-tt__btn" title="Add row below" @click="addRow">＋ Row</button>
        <button class="sc-tt__btn" title="Add column right" @click="addCol">＋ Col</button>
      </div>
      <div class="sc-tt__group" role="group" aria-label="Delete">
        <button class="sc-tt__btn" :disabled="!active" title="Delete current row" @click="delActiveRow">✕ Row</button>
        <button class="sc-tt__btn" :disabled="!active" title="Delete current column" @click="delActiveCol">✕ Col</button>
      </div>
      <div class="sc-tt__group" role="group" aria-label="Cells">
        <button class="sc-tt__btn sc-tt__icon" :disabled="!canMerge('right')" title="Merge right" @click="merge('right')">⇥</button>
        <button class="sc-tt__btn sc-tt__icon" :disabled="!canMerge('down')" title="Merge down" @click="merge('down')">⤓</button>
        <button class="sc-tt__btn sc-tt__icon" :disabled="!canSplit" title="Split cell" @click="split">⤲</button>
      </div>
      <div class="sc-tt__group">
        <button class="sc-tt__btn sc-tt__icon sc-tt__danger" title="Delete table" @click="deleteTable">🗑</button>
      </div>
    </div>

    <div class="sc-table-wrap">
      <table class="sc-table" :style="tableStyle">
        <colgroup>
          <col v-for="i in colCount" :key="i" :style="colStyle(i - 1)" />
        </colgroup>

        <!-- thin resize strip: a drag handle at every column boundary -->
        <tr v-if="!readonly" class="sc-table__ctrlrow" contenteditable="false">
          <td v-for="i in colCount" :key="i">
            <span v-if="i < colCount" class="sc-table__colresize" title="Drag to resize column" @mousedown.prevent="startColResize(i - 1, $event)" />
          </td>
        </tr>

        <tr v-for="(row, r) in rows" :key="r">
          <template v-for="(cell, c) in row" :key="c">
            <TableCell
              v-if="!cell.covered"
              :cell="cell"
              :header="r === 0"
              :readonly="readonly"
              :class="{ 'is-active': active && active.r === r && active.c === c }"
              @update="setCell(r, c, $event)"
              @focus="active = { r, c }"
            />
          </template>
        </tr>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEditor } from '../composables/editor.js';
import TableCell from './TableCell.vue';
import * as table from '../core/table.js';

const WIDTHS = [{ v: 'full', label: 'Full' }, { v: '75', label: '75%' }, { v: '50', label: '50%' }];
const ALIGNS = [{ v: 'left', icon: '⇤' }, { v: 'center', icon: '↔' }, { v: 'right', icon: '⇥' }];

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const active = ref(null); // { r, c } of the last-focused cell
const focused = ref(false);

const rows = computed(() => props.block.data.rows);
const colCount = computed(() => (rows.value[0] ? rows.value[0].length : 0));
const tableWidth = computed(() => props.block.data.width || 'full');
const align = computed(() => (props.block.props && props.block.props.align) || 'left');
const tableStyle = computed(() => ({ width: tableWidth.value === '75' ? '75%' : tableWidth.value === '50' ? '50%' : '100%' }));

// Upgrade legacy array cells to objects once (silent migration for old docs).
onMounted(() => {
  if (rows.value.some((row) => row.some((cell) => Array.isArray(cell)))) {
    props.block.data.rows = table.normalizeTable(rows.value);
  }
});

let blurTimer = null;
function onFocusIn() { clearTimeout(blurTimer); focused.value = true; }
function onFocusOut(e) {
  const wrap = e.currentTarget;
  if (!wrap.contains(e.relatedTarget)) {
    blurTimer = setTimeout(() => { focused.value = false; }, 120);
  }
}
onBeforeUnmount(() => clearTimeout(blurTimer));

function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function colStyle(i) {
  const w = (props.block.data.colWidths || [])[i];
  return w ? { width: `${w}px` } : {};
}
function setCell(r, c, segs) { rows.value[r][c].segments = segs; changed(); }
function setWidth(w) { props.block.data.width = w; changed(); }
function setAlign(a) { ctx.setProps(props.block.id, { align: a }); }

function addRow() { table.addRow(rows.value); changed(); }
function addCol() { table.addColumn(rows.value); changed(); }
function delRow(r) { table.deleteRow(rows.value, r); active.value = null; changed(); }
function delCol(c) {
  table.deleteColumn(rows.value, c);
  if (props.block.data.colWidths) props.block.data.colWidths.splice(c, 1);
  active.value = null;
  changed();
}
function delActiveRow() { if (active.value) delRow(active.value.r); }
function delActiveCol() { if (active.value) delCol(active.value.c); }
function deleteTable() { ctx.removeBlock(props.block.id); }

// --- merge / split (act on the last-focused cell) ---
const activeCell = computed(() => {
  const a = active.value;
  return a && rows.value[a.r] ? rows.value[a.r][a.c] : null;
});
function canMerge(dir) {
  const a = active.value;
  const cell = activeCell.value;
  if (!a || !cell || cell.covered) return false;
  return dir === 'right'
    ? a.c + (cell.colSpan || 1) < colCount.value
    : a.r + (cell.rowSpan || 1) < rows.value.length;
}
const canSplit = computed(() => {
  const cell = activeCell.value;
  return Boolean(cell && ((cell.colSpan || 1) > 1 || (cell.rowSpan || 1) > 1));
});
function merge(dir) { if (active.value && table.mergeCells(rows.value, active.value.r, active.value.c, dir)) changed(); }
function split() { if (active.value && table.splitCell(rows.value, active.value.r, active.value.c)) changed(); }

// --- column resize (drag the boundary handles) ---
function startColResize(i, e) {
  const startX = e.clientX;
  const th = e.currentTarget.closest('td');
  const startW = (props.block.data.colWidths || [])[i] || (th ? th.getBoundingClientRect().width : 100);
  const onMove = (ev) => {
    const next = (props.block.data.colWidths || []).slice();
    while (next.length < colCount.value) next.push(null);
    next[i] = Math.max(48, Math.round(startW + (ev.clientX - startX)));
    props.block.data.colWidths = next;
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    changed();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
</script>
