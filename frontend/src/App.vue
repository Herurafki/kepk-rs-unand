<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/routes/auth'
import ToastContainer from './components/shared/ToastContainer.vue'
import IdleSessionGuard from './components/shared/IdleSessionGuard.vue'

const authStore = useAuthStore()

onMounted(async () => {
  // Initialize auth state by fetching current user
  // This ensures header state is in sync across all pages
  if (!authStore.initialized) {
    await authStore.fetchCurrentUser()
  }
})
</script>

<template>
  <ToastContainer />
    <IdleSessionGuard />
  <RouterView v-slot="{ Component, route }">
    <Transition name="page-slide" mode="out-in">
      <component :is="Component" :key="route.fullPath" />
    </Transition>
  </RouterView>
</template>
