<script setup lang="ts">
import { useAuthStore } from '../../stores/routes/auth'

const authStore = useAuthStore()
</script>

<template>
  <main>
    <h1>Dashboard Penma</h1>

    <p v-if="authStore.user">
      Selamat datang, {{ authStore.user.name }}.
    </p>
  </main>
</template>
