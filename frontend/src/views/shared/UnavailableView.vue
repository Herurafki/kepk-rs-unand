<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/routes/auth'
import { getDashboardPath } from '../../utils/role-permissions'
const route = useRoute()
const authStore = useAuthStore()
const dashboard = computed(() => getDashboardPath(authStore.user?.roles ?? []))
</script>

<template>
  <section class="unavailable-page">
    <h1>Halaman belum tersedia</h1>
    <p>Fitur ini masih dalam pengembangan.</p>
    <RouterLink
      v-if="route.path !== dashboard"
      :to="dashboard"
      class="btn btn--primary"
    >
      Kembali ke dashboard
    </RouterLink>
    <RouterLink v-else to="/dashboard/profile" class="btn btn--primary"
      >Lihat profil</RouterLink
    >
  </section>
</template>

<style scoped>
.unavailable-page {
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  color: var(--foreground);
}
p {
  color: var(--muted-foreground);
  margin-bottom: var(--space-6);
}
</style>
