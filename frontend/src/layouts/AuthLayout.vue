<script setup lang="ts">
import { RouterView } from 'vue-router'
import UnifiedHeader from '../components/layout/UnifiedHeader.vue'
</script>

<template>
  <div class="auth-layout">
    <UnifiedHeader />
    <main class="auth-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.auth-main {
  flex: 1;
  padding: 40px 16px;
}
</style>
