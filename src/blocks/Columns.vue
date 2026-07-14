<template>
  <div class="sc-columns">
    <BlockView v-for="col in block.children" :key="col.id" :block="col" />
  </div>
</template>

<script setup>
import BlockView from '../components/BlockView.vue';
defineProps({ block: { type: Object, required: true } });
</script>
