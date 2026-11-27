<script setup lang="ts">
import PageHeader from '../../../components/shared/PageHeader.vue'
import StaticImagePreview from '../../../components/shared/StaticImagePreview.vue'

const imageSrc = `${import.meta.env.BASE_URL}images/profil/struktur-organisasi.png`
</script>

<template>
  <div class="info-page">
    <PageHeader
      title="Struktur Organisasi"
      description="Bagan struktur organisasi Rumah Sakit Universitas Andalas."
    />

    <StaticImagePreview
      :src="imageSrc"
      alt="Struktur Organisasi Rumah Sakit Universitas Andalas"
      missing-hint="public/images/profil/struktur-organisasi.png"
    />
  </div>
</template>
