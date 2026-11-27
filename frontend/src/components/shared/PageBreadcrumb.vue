<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export interface BreadcrumbEntry {
  label: string
  to?: string
}

const route = useRoute()

// Breadcrumb trail comes from route.meta so it stays driven by the router
// instead of manual path parsing. "Beranda" is always prepended.
const trail = computed<BreadcrumbEntry[]>(() => {
  const fromMeta = (route.meta.breadcrumb as BreadcrumbEntry[] | undefined) ?? []
  return [{ label: 'Beranda', to: '/' }, ...fromMeta]
})
</script>

<template>
  <nav class="page-breadcrumb" aria-label="Breadcrumb">
    <ol>
      <li v-for="(entry, index) in trail" :key="entry.label">
        <RouterLink v-if="entry.to && index < trail.length - 1" :to="entry.to">
          {{ entry.label }}
        </RouterLink>
        <span v-else aria-current="page">{{ entry.label }}</span>
        <span v-if="index < trail.length - 1" class="page-breadcrumb__sep" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.page-breadcrumb ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
}

.page-breadcrumb li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.page-breadcrumb a {
  color: var(--muted-foreground);
  text-decoration: none;
}

.page-breadcrumb a:hover {
  color: var(--primary);
  text-decoration: underline;
}

.page-breadcrumb [aria-current='page'] {
  color: var(--foreground);
  font-weight: 600;
}

.page-breadcrumb__sep {
  color: var(--muted-foreground);
}
</style>
