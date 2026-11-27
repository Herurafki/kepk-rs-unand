<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, RefreshCw } from 'lucide-vue-next'
import { getChiefApplications, type ChiefApplication } from '../../services/chief/application.service'
import { getApiErrorMessage } from '../../services/api/error'

const applications = ref<ChiefApplication[]>([])
const loading = ref(false)
const error = ref('')

const total = computed(() => applications.value.length)
const byType = computed(() => ({
  exempted: applications.value.filter(a => a.review_type === 'EXEMPTED').length,
  expedited: applications.value.filter(a => a.review_type === 'EXPEDITED').length,
  fullboard: applications.value.filter(a => ['FULLBOARD', 'FULL_BOARD'].includes(String(a.review_type))).length,
}))
const byStatus = computed(() => ({
  approved: applications.value.filter(a => a.status === 'APPROVED').length,
  rejected: applications.value.filter(a => a.status === 'REJECTED').length,
  revision: applications.value.filter(a => a.status === 'REVISION_REQUIRED').length,
  review: applications.value.filter(a => ['UNDER_REVIEW', 'REVIEW_COMPLETED'].includes(a.status)).length,
}))

async function load() {
  loading.value = true
  error.value = ''
  try { applications.value = await getChiefApplications() }
  catch (e) { error.value = getApiErrorMessage(e, 'Gagal memuat laporan.') }
  finally { loading.value = false }
}

function exportCsv() {
  const headers = ['Nomor Registrasi', 'Peneliti', 'Judul', 'Tipe Review', 'Status', 'Tanggal Pengajuan']
  const rows = applications.value.map(a => [a.application_number, a.researcher_name || '', a.research_title || '', a.review_type || '', a.status, a.created_at])
  const quote = (value: unknown) => '"' + String(value).replaceAll('"', '""') + '"'
  const csv = [headers, ...rows].map(row => row.map(quote).join(',')).join(String.fromCharCode(10))
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'laporan-kepk.csv'
  link.click()
  URL.revokeObjectURL(url)
}
onMounted(load)
</script>

<template>
  <main class="page">
    <header class="heading">
      <div><span class="eyebrow">KETUA KEPK</span>
        <h1>Laporan KEPK</h1>
        <p>Ringkasan pengajuan, tipe review, dan keputusan untuk pemantauan Ketua KEPK.</p>
      </div>
      <div class="heading-actions"><button class="button" :disabled="loading" @click="load">
          <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
        </button><button class="button primary" :disabled="loading || !applications.length" @click="exportCsv">
          <Download :size="17" /> Ekspor CSV
        </button></div>
    </header>
    <div v-if="error" class="alert">{{ error }}</div>
    <div v-if="loading" class="state">
      <RefreshCw :size="28" class="spin" /> Memuat...
    </div>
    <template v-else>
      <section class="stats">
        <div class="stat"><span>Total Pengajuan</span><strong>{{ total }}</strong></div>
        <div class="stat"><span>Exempted</span><strong>{{ byType.exempted }}</strong></div>
        <div class="stat"><span>Expedited</span><strong>{{ byType.expedited }}</strong></div>
        <div class="stat"><span>Full Board</span><strong>{{ byType.fullboard }}</strong></div>
      </section>
      <section class="card">
        <header class="card-header">
          <h2>Ringkasan Status</h2>
        </header>
        <div class="summary">
          <div><span>Sedang / selesai review</span><strong>{{ byStatus.review }}</strong></div>
          <div><span>Disetujui</span><strong>{{ byStatus.approved }}</strong></div>
          <div><span>Perlu revisi</span><strong>{{ byStatus.revision }}</strong></div>
          <div><span>Ditolak</span><strong>{{ byStatus.rejected }}</strong></div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6)
}

.heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start
}

.heading-actions {
  display: flex;
  gap: 8px
}

.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em
}

h1 {
  margin: 8px 0;
  color: var(--foreground);
  font-size: clamp(24px, 3vw, 32px)
}

p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  cursor: pointer
}

.primary {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground)
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px
}

.stat {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card)
}

.stat span,
.summary span {
  display: block;
  color: var(--muted-foreground);
  font-size: 11px
}

.stat strong {
  display: block;
  margin-top: 5px;
  color: var(--foreground);
  font-size: 25px
}

.card-header {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--color-overlay-subtle)
}

.card-header h2 {
  margin: 0;
  color: var(--foreground);
  font-size: 15px
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr)
}

.summary div {
  padding: 18px;
  border-right: 1px solid var(--border)
}

.summary div:last-child {
  border-right: 0
}

.summary strong {
  display: block;
  margin-top: 6px;
  color: var(--foreground);
  font-size: 22px
}

.alert {
  padding: 12px;
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 13px
}

.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px;
  color: var(--muted-foreground)
}

.spin {
  animation: spin 1s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media(max-width:800px) {

  .heading,
  .heading-actions {
    flex-direction: column
  }

  .stats,
  .summary {
    grid-template-columns: 1fr 1fr
  }

  .summary div {
    border-right: 0;
    border-bottom: 1px solid var(--border)
  }
}
</style>