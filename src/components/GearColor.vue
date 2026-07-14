<template>
  <span class="sc-gearcolor">
    <!-- Swatch doubles as the native OS color picker; checkerboard = transparent -->
    <label class="sc-gearcolor__swatch" :class="{ 'is-empty': !modelValue }" :style="swatchStyle" :title="modelValue || 'Transparent'">
      <input type="color" :value="hex" @input="emitColor($event.target.value)" />
    </label>
    <input
      type="text"
      class="sc-gearcolor__text"
      :placeholder="placeholder"
      :value="modelValue"
      @change="emitColor($event.target.value.trim())"
    />
    <button v-if="modelValue" class="sc-gearcolor__clear" title="Transparent" @mousedown.prevent="emitColor('')">✕</button>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' }, // '' = transparent (inherits the content background)
  placeholder: { type: String, default: 'transparent' },
});
const emit = defineEmits(['update:modelValue']);

// The native picker needs a 6-digit hex; when the value is empty or a non-hex
// CSS color (rgb()/named) we seed it with a sensible starting color.
const hex = computed(() => (/^#[0-9a-fA-F]{6}$/.test(props.modelValue) ? props.modelValue : '#4477dd'));
const swatchStyle = computed(() => (props.modelValue ? { background: props.modelValue } : {}));

function emitColor(v) { emit('update:modelValue', v); }
</script>
