<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

defineProps<{
  question: string
  answer: string
  isOpen: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div class="faq-item" :class="{ 'is-open': isOpen }">
    <button
      type="button"
      class="faq-item__question"
      :aria-expanded="isOpen"
      @click="emit('toggle')"
    >
      <span>{{ question }}</span>
      <ChevronDown :size="18" class="faq-item__chevron" aria-hidden="true" />
    </button>
    <p v-show="isOpen" class="faq-item__answer">{{ answer }}</p>
  </div>
</template>

<style scoped>
.faq-item {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--color-surface);
  overflow: hidden;
}

.faq-item__question {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 0;
  background: none;
  text-align: left;
  font-family: inherit;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--foreground);
  cursor: pointer;
}

.faq-item__chevron {
  flex-shrink: 0;
  transition: transform 0.18s ease;
  color: var(--primary);
}

.faq-item.is-open .faq-item__chevron {
  transform: rotate(180deg);
}

.faq-item__answer {
  margin: 0;
  padding: 0 16px 16px;
  color: var(--muted-foreground);
}
</style>
