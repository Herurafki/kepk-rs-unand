<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  src: string
  alt: string
  /** Shown inside the placeholder box when the image fails to load. */
  missingHint: string
}>()

const failed = ref(false)

function handleError() {
  failed.value = true
}
</script>

<template>
  <div class="static-image-preview">
    <img
      v-show="!failed"
      :src="props.src"
      :alt="props.alt"
      @error="handleError"
    >
    <div v-if="failed" class="static-image-preview__missing">
      <p>Gambar belum tersedia.</p>
      <p>
        Letakkan file pada
        <code>{{ props.src }}</code>
        untuk menampilkan gambar ini.
      </p>
    </div>
  </div>
</template>

<style scoped>
.static-image-preview img {
  width: 100%;
  border-radius: 14px;
  border: 1px solid var(--border);
  display: block;
}

.static-image-preview__missing {
  display: grid;
  gap: 6px;
  padding: 32px 20px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  background: var(--card);
  color: var(--muted-foreground);
  text-align: center;
}

.static-image-preview__missing code {
  color: var(--accent-foreground);
  font-weight: 600;
}
</style>
