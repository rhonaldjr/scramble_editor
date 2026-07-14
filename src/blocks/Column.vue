<template>
  <div class="sc-column">
    <BlockView v-for="child in block.children" :key="child.id" :block="child" />
  </div>
</template>

<script setup>
import BlockView from '../components/BlockView.vue';
defineProps({ block: { type: Object, required: true } });
</script>
