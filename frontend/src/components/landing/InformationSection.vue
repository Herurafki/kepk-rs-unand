<script setup lang="ts">
import { RouterLink } from 'vue-router'

interface InfoCard {
  title: string
  description: string
  to: string
  icon: 'flow' | 'layers' | 'clock' | 'book'
}

const infoCards: InfoCard[] = [
  {
    title: 'Alur Proses Pengajuan',
    description: 'Lihat informasi, ketentuan, dan alur layanan penelitian di Rumah Sakit.',
    to: '/informasi/alur-pengajuan',
    icon: 'flow',
  },
  {
    title: 'Tarif Penelitian',
    description: 'Lihat informasi, ketentuan, dan alur layanan penelitian di Rumah Sakit.',
    to: '/informasi/tarif-komisi-etik',
    icon: 'layers',
  },
  {
    title: 'Estimasi Waktu',
    description: 'Lihat informasi, ketentuan, dan alur layanan penelitian di Rumah Sakit.',
    to: '/informasi/estimasi-waktu',
    icon: 'clock',
  },
  {
    title: 'Panduan Penggunaan',
    description: 'Lihat informasi, ketentuan, dan alur layanan penelitian di Rumah Sakit.',
    to: '/informasi/panduan-penggunaan',
    icon: 'book',
  },
]
</script>

<template>
  <section id="informasi" class="landing-section">
    <p class="landing-section__eyebrow">Informasi</p>
    <h2>DAFTAR INFORMASI LAYANAN</h2>

    <div class="landing-grid">
      <RouterLink v-for="card in infoCards" :key="card.title" :to="card.to" class="landing-card">
        <span class="landing-card__icon" aria-hidden="true">
          <svg v-if="card.icon === 'flow'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
            <circle cx="12" cy="6" r="2" />
            <path d="M7.5 10.5c1.5-1.5 3-1.5 4.5 0" />
            <path d="M12 8v3" />
            <path d="M16.5 10.5c-1.5-1.5-3-1.5-4.5 0" />
            <path d="M7 13.5c0 1.5 1.5 3 3 3" />
            <path d="M17 13.5c0 1.5-1.5 3-3 3" />
          </svg>
          <svg v-else-if="card.icon === 'layers'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2 2 6v4l10 4 10-4V6l-10-4z" />
            <path d="M2 14l10 4 10-4" />
            <path d="M2 18l10 4 10-4" />
          </svg>
          <svg v-else-if="card.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v6l4 2" />
          </svg>
          <svg v-else-if="card.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M10 7h4M10 12h4" />
          </svg>
        </span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.description }}</p>
        <span class="landing-link">Informasi lebih lanjut →</span>
      </RouterLink>
    </div>
  </section>
</template>
