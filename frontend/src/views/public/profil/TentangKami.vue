<script setup lang="ts">
import PageHeader from "../../../components/shared/PageHeader.vue"
</script>
<template>
  <div class="info-page">
    <PageHeader
      title="Tentang Kami"
      description="Informasi mengenai Komisi Etik Penelitian Kesehatan Rumah Sakit Universitas Andalas."
    />
    <!-- Section Utama: Tentang KEPK -->
    <section class="about-section">
      <div class="about-content">
        <div class="about-text">
          <h2>Komisi Etik Penelitian Kesehatan</h2>
<p>
            Rumah Sakit Universitas Andalas (RS UNAND) merupakan rumah sakit milik perguruan tinggi negeri yang menyelenggarakan pelayanan kesehatan sekaligus menjadi wahana pendidikan, pelatihan, penelitian, dan pengabdian kepada masyarakat. Dalam menjalankan fungsi tersebut, RS UNAND menjadi lokasi berbagai penelitian kesehatan yang dapat melibatkan pasien, keluarga pasien, tenaga kesehatan, data rekam medis, spesimen biologik, maupun hewan coba.
          </p>
          <p>
            Penelitian kesehatan yang melibatkan manusia, baik secara langsung melalui intervensi, wawancara, atau kuesioner, maupun secara tidak langsung melalui pemanfaatan data sekunder, rekam medis, atau spesimen biologik tersimpan, harus menjunjung tinggi hak, keselamatan, privasi, dan kesejahteraan subjek penelitian. Oleh karena itu, penelitian memerlukan penilaian kelayakan etik dari Komite Etik Penelitian Kesehatan (KEPK) yang independen, kompeten, dan berwenang.
          </p>
          <p>
            KEPK RS UNAND dibentuk sebagai bagian dari tata kelola klinis dan penelitian (clinical and research governance) rumah sakit. KEPK bertujuan memastikan penelitian kesehatan yang dilaksanakan di lingkungan RS UNAND memenuhi prinsip ilmiah dan etik sesuai peraturan perundang-undangan, pedoman nasional Komisi Etik Penelitian dan Pengembangan Kesehatan Nasional (KEPPKN) Kementerian Kesehatan, serta pedoman etik penelitian kesehatan internasional.
          </p>        </div>
        <div class="about-logo">
          <img 
            src="/images/profil/Logo RS Unand.png" 
            alt="Logo Rumah Sakit Universitas Andalas" 
            class="logo-image"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about-section {
  padding: 2rem 0;
  margin-bottom: 2rem;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.about-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: center;
}

.about-text {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.about-text h2 {
  margin: 0;
  color: var(--primary);
  font-size: 1.75rem;
}

.about-text p {
  margin: 0;
  line-height: 1.6;
  text-align: justify;
  color: var(--foreground);
}

.about-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

.logo-image {
  max-width: 100%;
  height: auto;
  max-height: 350px;
  object-fit: contain;
}

.vision-mission {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 1rem;
}

.vision-item {
  padding: 1.5rem;
  background-color: var(--card);
  border-radius: var(--radius);
  border-left: 4px solid var(--primary);
}

.vision-item h4 {
  margin: 0 0 1rem 0;
  color: var(--primary);
  font-size: 1.1rem;
}

.vision-item p,
.vision-item ul {
  margin: 0;
  color: var(--foreground);
  line-height: 1.6;
}

.vision-item ul {
  padding-left: 1.5rem;
}

.vision-item li {
  margin-bottom: 0.5rem;
}

.vision-item li:last-child {
  margin-bottom: 0;
}

@media (max-width: 1024px) {
  .about-content {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
}

@media (max-width: 1024px) {
  .vision-mission {
      grid-template-columns: 1fr;
    }
}

@media (max-width: 1024px) {
  .about-text h2 {
      font-size: 1.5rem;
    }
}

@media (max-width: 1024px) {
  .logo-image {
      max-height: 300px;
    }
}

@media (max-width: 768px) {
  .about-section {
      padding: 1rem 0;
    }
}

@media (max-width: 768px) {
  .about-text h2 {
      font-size: 1.25rem;
    }
}

@media (max-width: 768px) {
  .about-text p {
      text-align: left;
      font-size: 0.9rem;
    }
}

@media (max-width: 768px) {
  .logo-image {
      max-height: 250px;
    }
}
</style>

