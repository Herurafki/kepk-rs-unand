<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="landing-hero">
    <div class="landing-hero__visual" aria-hidden="true">
      <img src="/images/background-rs-unand-3.jpeg" alt="">
    </div>

    <div class="landing-hero__content">
      <p class="landing-eyebrow">Komisi Etik Penelitian Kesehatan RS Universitas Andalas</p>
      <h1>Layanan Etik dan Perizinan Penelitian Kesehatan</h1>
      <p class="landing-hero__lead">
        KEPK RS UNAND mendukung proses pengajuan pengambilan data awal, izin penelitian, dan kaji etik secara terintegrasi, dengan perhatian pada perlindungan subjek, kelengkapan berkas, serta tata kelola penelitian yang bertanggung jawab.
      </p>

      <div class="landing-hero__actions">
        <RouterLink class="landing-btn landing-btn--primary" to="/dashboard/research/data-collection">
          Mulai Pengajuan
        </RouterLink>
        <RouterLink class="landing-btn landing-btn--secondary" to="/informasi/alur-pengajuan">
          Pelajari Alur
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.landing-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100svh;
  width: 100vw;
  margin-inline: calc(50% - 50vw);
  overflow: hidden;
  order: -1;
}

/* Gambar + scrim */
.landing-hero__visual {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.landing-hero__visual::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--color-scrim);
  z-index: 1;
}

.landing-hero__visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* Konten */
.landing-hero__content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 750px;
  padding: clamp(32px, 6vw, 48px) clamp(20px, 4vw, 36px);
}

.landing-hero h1 {
  margin: 10px 0 12px;
  font-size: clamp(1.5rem, 5vw, 3rem);
  line-height: 1.12;
  color: var(--color-text-inverse);
  overflow-wrap: break-word;
}

.landing-hero__lead {
  margin: 0;
  color: var(--color-text-inverse-soft);
  font-size: clamp(0.9rem, 1.2vw, 1.1rem);
  line-height: 1.6;
}

.landing-hero__actions {
  margin-top: clamp(20px, 3vw, 28px);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  width: 100%;
}

@media (max-width: 640px) {
  .landing-hero__actions {
    flex-direction: column;
    align-items: stretch;
    max-width: 320px;
    gap: 10px;
  }
}
</style>