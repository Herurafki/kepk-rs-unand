<script setup lang="ts">
import { RouterView } from 'vue-router'
import UnifiedHeader from '../components/layout/UnifiedHeader.vue'
import SiteFooter from '../components/layout/SiteFooter.vue'
</script>

<template>
  <div class="public-layout">
    <UnifiedHeader />

    <main class="public-main">
      <RouterView />
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.public-layout {
  display: flex;
  flex-direction: column;
}

.public-main {
  width: min(1160px, 100%);
  margin: 0 auto;
  padding: 0 16px 48px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

@media (max-width: 640px) {
  .public-main {
      padding-inline: 12px;
    }
}
</style>
