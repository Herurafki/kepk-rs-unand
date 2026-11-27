<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import UnifiedHeader from '../components/layout/UnifiedHeader.vue'
import DashboardSidebar from '../components/layout/DashboardSidebar.vue'
import { useAuthStore } from '../stores/routes/auth'

const authStore = useAuthStore()
const showDashboardSidebar = computed(() => !authStore.hasRole('peneliti'))
</script>

<template>
  <div class="dashboard-layout">
    <UnifiedHeader />

    <div class="dashboard-body">
      <DashboardSidebar v-if="showDashboardSidebar" />

      <main class="dashboard-content" :class="{ 'dashboard-content--full': !showDashboardSidebar }">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.dashboard-body {
  display: flex;
  flex: 1;
  gap: 0;
}

.dashboard-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  min-height: calc(100vh - 70px);
  min-width: 0;
}

.dashboard-content--full {
  width: 100%;
}

@media (max-width: 768px) {
  .dashboard-content {
    padding: 20px;
  }
}

@media (max-width: 640px) {
  .dashboard-body {
    flex-direction: column;
    padding-top: 0;
  }

  .dashboard-content {
    padding: 16px;
    min-height: auto;
  }
}
</style>
