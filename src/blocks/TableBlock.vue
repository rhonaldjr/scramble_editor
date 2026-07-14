<template>
  <div class="sc-table-wrap">
    <table class="sc-table">
      <colgroup>
        <col v-for="i in colCount" :key="i" :style="colStyle(i - 1)" />
        <col v-if="!readonly" class="sc-table__ctrlcol" />
      </colgroup>

      <tr v-if="!readonly" class="sc-table__ctrlrow">
        <td v-for="i in colCount" :key="i">
          <button class="sc-table__op" title="Delete column" @click="delCol(i - 1)">×</button>
          <span
            v-if="i < colCount"
            class="sc-table__colresize"
            title="Drag to resize column"
            @mousedown.prevent="startColResize(i - 1, $event)"
          />
        </td>
        <td />
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
        <td v-if="!readonly" class="sc-table__ctrl">
          <button class="sc-table__op" title="Delete row" @click="delRow(r)">×</button>
        </td>
      </tr>
    </table>

    <div v-if="!readonly" class="sc-table__controls">
      <button class="sc-table__op" @click="addRow">＋ Row</button>
      <button class="sc-table__op" @click="addCol">＋ Column</button>
      <span class="sc-table__sep" />
      <button class="sc-table__op" :disabled="!canMerge('right')" @mousedown.prevent="merge('right')">⬌ Merge right</button>
      <button class="sc-table__op" :disabled="!canMerge('down')" @mousedown.prevent="merge('down')">⬍ Merge down</button>
      <button class="sc-table__op" :disabled="!canSplit" @mousedown.prevent="split">⬚ Split</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useEditor } from '../composables/editor.js';
import TableCell from './TableCell.vue';
import * as table from '../core/table.js';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const active = ref(null); // { r, c } of the last-focused cell

const rows = computed(() => props.block.data.rows);
const colCount = computed(() => (rows.value[0] ? rows.value[0].length : 0));

// Upgrade legacy array cells to objects once (silent migration for old docs).
onMounted(() => {
  if (rows.value.some((row) => row.some((cell) => Array.isArray(cell)))) {
    props.block.data.rows = table.normalizeTable(rows.value);
  }
});

function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function colStyle(i) {
  const w = (props.block.data.colWidths || [])[i];
  return w ? { width: `${w}px` } : {};
}
function setCell(r, c, segs) { rows.value[r][c].segments = segs; changed(); }

function addRow() { table.addRow(rows.value); changed(); }
function addCol() { table.addColumn(rows.value); changed(); }
function delRow(r) { table.deleteRow(rows.value, r); active.value = null; changed(); }
function delCol(c) {
  table.deleteColumn(rows.value, c);
  if (props.block.data.colWidths) props.block.data.colWidths.splice(c, 1);
  active.value = null;
  changed();
}

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

// --- column resize (drag the boundary handles in the control row) ---
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
