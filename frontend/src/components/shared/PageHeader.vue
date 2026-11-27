<script setup lang="ts">


withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: '',
})
</script>

<template>
  <header class="page-header">
    <h1>{{ title }}</h1>
    <p v-if="description">{{ description }}</p>
  </header>
</template>

<style scoped>
.page-header {
  display: grid;
  gap: 8px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  color: var(--foreground);
}

.page-header p {
  margin: 0;
  color: var(--muted-foreground);
}
</style>
