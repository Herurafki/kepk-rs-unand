<script setup lang="ts">
import UnifiedHeader from '../../layout/UnifiedHeader.vue'
import DashboardSidebar from '../../layout/DashboardSidebar.vue'
</script>

<template>
  <div class="admin-layout">
    <UnifiedHeader />

    <div class="admin-body">
      <DashboardSidebar />

      <main class="admin-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.admin-body {
  display: flex;
  flex: 1;
  gap: 0;
}

.admin-main {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

/* Scrollbar styling */
.admin-main::-webkit-scrollbar {
  width: 8px;
}

.admin-main::-webkit-scrollbar-track {
  background: var(--color-transparent);
}

.admin-main::-webkit-scrollbar-thumb {
  background: var(--color-neutral-soft);
  border-radius: 4px;

  &:hover {
    background: var(--color-overlay-strong);
  }
}

@media (max-width: 768px) {
  .admin-main {
    padding: 20px;
  }
}

@media (max-width: 640px) {
  .admin-body {
    flex-direction: column;
    padding-top: 0;
  }

  .admin-main {
    padding: 16px;
  }
}
</style>
