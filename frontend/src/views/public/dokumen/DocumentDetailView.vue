<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import PageHeader from '../../../components/shared/PageHeader.vue'
import { documents, type DocumentKey } from '../../../data/documents'

const props = defineProps<{
  documentKey: DocumentKey
}>()

const doc = computed(() => documents[props.documentKey])
</script>

<template>
  <div class="info-page">
    <PageHeader :title="doc.title" :description="doc.description" />

    <div class="doc-detail">
      <div class="doc-detail__meta">
        <span class="doc-detail__format">Format: {{ doc.format }}</span>
        <a class="doc-detail__download" :href="doc.fileUrl" target="_blank" rel="noopener noreferrer">
          <ExternalLink :size="16" aria-hidden="true" />
          Buka {{ doc.format }}
        </a>
      </div>

      <div class="doc-detail__preview">
        <iframe v-if="doc.format === 'PDF'" :src="doc.fileUrl" :title="doc.title" />
        <p v-else>
          Preview tidak tersedia untuk format {{ doc.format }} di halaman ini. Gunakan tombol Buka {{ doc.format }} untuk melihat dokumen pada tab baru.
        </p>
      </div>


    </div>
  </div>
</template>

<style scoped>
.doc-detail {
  display: grid;
  gap: 14px;
}

.doc-detail__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.doc-detail__format {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted-foreground);
}

.doc-detail__download {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 600;
  text-decoration: none;
}

.doc-detail__download:hover {
  filter: brightness(1.06);
}

.doc-detail__preview {
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  min-height: 480px;
  background: var(--card);
  display: grid;
}

.doc-detail__preview iframe {
  width: 100%;
  height: 480px;
  border: 0;
}

.doc-detail__preview p {
  margin: 0;
  padding: 24px;
  color: var(--muted-foreground);
  text-align: center;
  align-self: center;
}

.doc-detail__hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted-foreground);
}

.doc-detail__hint code {
  color: var(--accent-foreground);
}

@media (max-width: 640px) {
  .doc-detail__preview,
    .doc-detail__preview iframe {
      min-height: 360px;
      height: 360px;
    }
}
</style>
