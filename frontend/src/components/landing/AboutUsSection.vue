<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="about-us-section">
    <div class="about-us-content">
      <!-- Kolom Kiri: Teks -->
      <div class="about-us-text">
        <p class="about-us-label">TENTANG KAMI</p>
        <h2 class="about-us-title">Komisi Etik Penelitian Kesehatan</h2>

        <div class="about-us-body">
          <p>
            Rumah Sakit Universitas Andalas (RS UNAND) merupakan rumah sakit milik perguruan tinggi negeri yang menyelenggarakan pelayanan kesehatan sekaligus menjadi wahana pendidikan, pelatihan, penelitian, dan pengabdian kepada masyarakat. Dalam menjalankan fungsi tersebut, RS UNAND menjadi lokasi berbagai penelitian kesehatan yang dapat melibatkan pasien, keluarga pasien, tenaga kesehatan, data rekam medis, spesimen biologik, maupun hewan coba.
          </p>
          <p>
            Penelitian kesehatan yang melibatkan manusia, baik secara langsung melalui intervensi, wawancara, atau kuesioner, maupun secara tidak langsung melalui pemanfaatan data sekunder, rekam medis, atau spesimen biologik tersimpan, harus menjunjung tinggi hak, keselamatan, privasi, dan kesejahteraan subjek penelitian. Oleh karena itu, penelitian memerlukan penilaian kelayakan etik dari Komite Etik Penelitian Kesehatan (KEPK) yang independen, kompeten, dan berwenang.
          </p>
          <p>
            KEPK RS UNAND dibentuk sebagai bagian dari tata kelola klinis dan penelitian (clinical and research governance) rumah sakit. KEPK bertujuan memastikan penelitian kesehatan yang dilaksanakan di lingkungan RS UNAND memenuhi prinsip ilmiah dan etik sesuai peraturan perundang-undangan, pedoman nasional Komisi Etik Penelitian dan Pengembangan Kesehatan Nasional (KEPPKN) Kementerian Kesehatan, serta pedoman etik penelitian kesehatan internasional.
          </p>        </div>

        <RouterLink class="about-us-link" to="/profil/tentang-kami">
          Selengkapnya →
        </RouterLink>
      </div>

      <!-- Kolom Kanan: Logo -->
      <div class="about-us-logo">
        <img
          src="/images/profil/Logo RS Unand.png"
          alt="Logo Rumah Sakit Universitas Andalas"
          class="logo-image"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-us-section {
  padding: 3rem 1.5rem;
  background-color: var(--background);
}

.about-us-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: center;
}

.about-us-text {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.about-us-label {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary);
  letter-spacing: 0.05em;
}

.about-us-title {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 700;
  color: var(--primary);
  line-height: 1.2;
}

.about-us-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.about-us-body p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--foreground);
  text-align: justify;
}

.about-us-link {
  align-self: flex-start;
  padding: 0.75rem 1.5rem;
  background-color: var(--primary);
  color: var(--primary-foreground);
  text-decoration: none;
  border-radius: var(--radius);
  font-weight: 600;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.about-us-link:hover {
  background-color: var(--accent);
  color: var(--accent-foreground);
  transform: translateX(4px);
}

.about-us-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

@media (max-width: 1024px) {
  .about-us-content {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
}

@media (max-width: 1024px) {
  .about-us-section {
      padding: 2rem 1rem;
    }
}

@media (max-width: 768px) {
  .about-us-section {
      padding: 1.5rem 1rem;
    }
}

@media (max-width: 768px) {
  .about-us-content {
      gap: 1rem;
    }
}

@media (max-width: 768px) {
  .about-us-title {
      font-size: 1.5rem;
    }
}

@media (max-width: 768px) {
  .about-us-body p {
      font-size: 0.9rem;
      text-align: left;
    }
}
</style>
