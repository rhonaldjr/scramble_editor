<template>
  <div class="sc-table-wrap">
    <table class="sc-table">
      <tr v-if="!readonly" class="sc-table__ctrlrow">
        <td v-for="(c, i) in colCount" :key="i">
          <button class="sc-table__op" title="Delete column" @click="delCol(i)">×</button>
        </td>
        <td />
      </tr>
      <tr v-for="(row, r) in block.data.rows" :key="r">
        <TableCell
          v-for="(cell, c) in row"
          :key="c"
          :cell="cell"
          :header="r === 0"
          :readonly="readonly"
          @update="setCell(r, c, $event)"
        />
        <td v-if="!readonly" class="sc-table__ctrl">
          <button class="sc-table__op" title="Delete row" @click="delRow(r)">×</button>
        </td>
      </tr>
    </table>
    <div v-if="!readonly" class="sc-table__controls">
      <button class="sc-table__op" @click="addRow">＋ Row</button>
      <button class="sc-table__op" @click="addCol">＋ Column</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useEditor } from '../composables/editor.js';
import TableCell from './TableCell.vue';

const props = defineProps({ block: { type: Object, required: true } });
const ctx = useEditor();
const readonly = computed(() => ctx.readonly.value);
const colCount = computed(() => (props.block.data.rows[0] ? props.block.data.rows[0].length : 0));

const emptyCell = () => [{ text: '', marks: [] }];
function changed() {
  ctx.emitEvent('block:updated', { id: props.block.id });
  ctx.markChanged();
}
function setCell(r, c, segs) {
  props.block.data.rows[r][c] = segs;
  changed();
}
function addRow() { props.block.data.rows.push(props.block.data.rows[0].map(emptyCell)); changed(); }
function addCol() { props.block.data.rows.forEach((row) => row.push(emptyCell())); changed(); }
function delRow(r) { if (props.block.data.rows.length > 1) { props.block.data.rows.splice(r, 1); changed(); } }
function delCol(c) { if (colCount.value > 1) { props.block.data.rows.forEach((row) => row.splice(c, 1)); changed(); } }
</script>
