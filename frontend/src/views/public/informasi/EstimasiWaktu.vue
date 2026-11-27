<script setup lang="ts">
import PageHeader from '../../../components/shared/PageHeader.vue'
import StaticImagePreview from '../../../components/shared/StaticImagePreview.vue'

const imageSrc = `${import.meta.env.BASE_URL}images/informasi/estimasi-waktu.png`
</script>

<template>
  <div class="info-page">
    <PageHeader
      title="Estimasi Waktu"
      description="Tabel estimasi waktu proses setiap jenis pengajuan."
    />

    <StaticImagePreview
      :src="imageSrc"
      alt="Tabel estimasi waktu proses pengajuan"
      missing-hint="public/images/informasi/estimasi-waktu.png"
    />
  </div>
</template>
