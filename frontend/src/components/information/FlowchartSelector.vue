<script setup lang="ts">
import type { FlowchartOption, FlowchartType } from '../../data/submissionFlowcharts'

defineProps<{
  options: FlowchartOption[]
  modelValue: FlowchartType
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FlowchartType]
}>()
</script>

<template>
  <div class="flowchart-selector" role="tablist" aria-label="Jenis alur pengajuan">
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      role="tab"
      class="flowchart-selector__btn"
      :class="{ 'is-active': modelValue === option.key }"
      :aria-selected="modelValue === option.key"
      @click="emit('update:modelValue', option.key)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.flowchart-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.flowchart-selector__btn {
  padding: 10px 18px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--foreground);
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  transition: all 0.18s ease;
}

.flowchart-selector__btn:hover {
  border-color: var(--primary);
}

.flowchart-selector__btn.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}
</style>
