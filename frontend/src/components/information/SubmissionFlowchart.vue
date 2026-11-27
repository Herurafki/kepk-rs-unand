<script setup lang="ts">
import type { FlowchartStep } from '../../data/submissionFlowcharts'

defineProps<{
  image: string
  steps: FlowchartStep[]
}>()
</script>

<template>
  <div class="submission-flowchart-container">
    <!-- Gambar flowchart di sisi kiri (elemen utama) -->
    <div class="submission-flowchart-image">
      <img :src="image" :alt="'Flowchart alur pengajuan'" class="flowchart-image" />
    </div>

    <!-- Keterangan langkah-langkah di sisi kanan -->
    <div class="submission-flowchart-steps">
      <h2>Penjelasan Tahapan</h2>
      <ol class="submission-flowchart">
        <li v-for="(step, index) in steps" :key="step.title" class="submission-flowchart__step">
          <span class="submission-flowchart__index">{{ index + 1 }}</span>
          <div class="submission-flowchart__content">
            <h3>{{ step.title }}</h3>
            <p>{{ step.description }}</p>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.submission-flowchart {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 14px;
}

.submission-flowchart__step {
  display: flex;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
}

.submission-flowchart__index {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 700;
}

.submission-flowchart__content h3 {
  margin: 0 0 4px;
  font-size: 1rem;
  color: var(--accent-foreground);
}

.submission-flowchart__content p {
  margin: 0;
  color: var(--muted-foreground);
}

@media (max-width: 640px) {
  .submission-flowchart__step {
      padding: 14px;
    }
}

/* Desktop: Layout 2 kolom (gambar kiri, keterangan kanan) */
.submission-flowchart-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: start;
}

/* Gambar flowchart di sisi kiri - elemen utama */
.submission-flowchart-image {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  padding: 1rem 0;
}

.flowchart-image {
  max-width: 100%;
  height: auto;
  max-height: 700px;
  object-fit: contain;
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.dark .flowchart-image {
  box-shadow: var(--shadow-sm);
}

/* Keterangan langkah-langkah di sisi kanan */
.submission-flowchart-steps {
  width: 100%;
}

.submission-flowchart-steps h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  color: var(--foreground);
}

/* Daftar langkah-langkah */
.submission-flowchart {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.submission-flowchart__step {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--card);
  border-radius: var(--radius);
  border-left: 4px solid var(--primary);
}

.submission-flowchart__index {
  min-width: 2.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-radius: 50%;
  font-weight: 600;
  flex-shrink: 0;
}

.submission-flowchart__content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
}

.submission-flowchart__content p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted-foreground);
  line-height: 1.5;
}

/* Tablet: Transisi ke 1 kolom */
@media (max-width: 1024px) {
  .submission-flowchart-container {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .flowchart-image {
    max-height: 500px;
  }
}

/* Mobile: Layout 1 kolom (gambar atas, keterangan bawah) */
@media (max-width: 768px) {
  .submission-flowchart-container {
    gap: 1.5rem;
  }

  .flowchart-image {
    max-height: 400px;
  }

  .submission-flowchart-steps h2 {
    margin: 1rem 0 1rem 0;
  }

  .submission-flowchart__step {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .submission-flowchart__index {
    min-width: 2rem;
    width: 2rem;
    height: 2rem;
    font-size: 0.9rem;
  }

  .submission-flowchart__content h3 {
    font-size: 0.95rem;
  }

  .submission-flowchart__content p {
    font-size: 0.85rem;
  }
}
</style>
