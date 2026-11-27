<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/routes/auth'
import { useAdminUserStore } from '../../stores/admin/user.store'
import AdminLayout from '../../components/admin/layout/AdminLayout.vue'
import DiklitDashboard from '../diklit/Dashboard.vue'

const route = useRoute()
const authStore = useAuthStore()
const userStore = useAdminUserStore()

const isDiklitDashboard = computed(() =>
  authStore.hasRole('diklit') && route.name === 'admin-dashboard',
)

onMounted(async () => {
  if (authStore.hasRole('admin')) {
    await userStore.loadRoles()
  }
})
</script>

<template>
  <AdminLayout>
    <DiklitDashboard v-if="isDiklitDashboard" />
    <router-view v-else />
  </AdminLayout>
</template>
