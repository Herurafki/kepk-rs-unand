<script setup lang="ts">
import { RouterLink } from 'vue-router'

interface ServiceCard {
  title: string
  description: string
  to: string
  icon: 'document' | 'search' | 'shield' | 'clock'
}

const services: ServiceCard[] = [
  {
    title: 'Pengajuan Izin Penelitian',
    description: 'Ajukan permohonan izin untuk melaksanakan kegiatan penelitian di Rumah Sakit.',
    to: '/dashboard/research/permission',
    icon: 'document',
  },
  {
    title: 'Pengambilan Data Awal',
    description: 'Ajukan permohonan untuk melakukan pengambilan data awal penelitian.',
    to: '/dashboard/research/data-collection',
    icon: 'search',
  },
  {
    title: 'Pengajuan Etik Penelitian',
    description: 'Ajukan permohonan kaji etik untuk penelitian yang akan dilaksanakan.',
    to: '/dashboard/research/ethics',
    icon: 'shield',
  },
  {
    title: 'Perpanjangan Masa Berlaku Ethical Clearance',
    description: 'Ajukan permohonan untuk perpanjangan ethical clearance yang sudah ada.',
    to: '/dashboard/research/extension',
    icon: 'clock',
  },
]
</script>

<template>
  <section id="layanan" class="landing-section">
    <p class="landing-section__eyebrow">Layanan</p>
    <h2>LAYANAN PENGAJUAN</h2>

    <div class="landing-grid">
      <RouterLink v-for="service in services" :key="service.title" :to="service.to" class="landing-card">
        <span class="landing-card__icon" aria-hidden="true">
          <svg v-if="service.icon === 'document'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 6h16v12H4z" />
            <path d="M8 10h8M8 14h5" />
          </svg>
          <svg v-else-if="service.icon === 'search'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <svg v-else-if="service.icon === 'shield'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 3 4 7v6c0 5 3.5 7.7 8 8 4.5-.3 8-3 8-8V7l-8-4Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <svg v-else-if="service.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <h3>{{ service.title }}</h3>
        <p>{{ service.description }}</p>
        <span class="landing-link">Ajukan sekarang →</span>
      </RouterLink>
    </div>
  </section>
</template>
