<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, FileCheck2, FileText, Eye, RefreshCw, XCircle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getDiklitApplications, type DiklitApplication } from '../../services/diklit/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { useAuthStore } from '../../stores/routes/auth'

const router = useRouter()
const applications = ref<DiklitApplication[]>([])
const loading = ref(false)
const errorMessage = ref('')
const selectedYear = ref(new Date().getFullYear())
const authStore = useAuthStore()

const recentApplications = computed(() => [...applications.value].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).slice(0, 3))

const stats = computed(() => ({
  total: applications.value.length,
  waiting: applications.value.filter(i => i.status === 'SUBMITTED').length,
  revision: applications.value.filter(i => i.status === 'REVISION_REQUIRED').length,
  approved: applications.value.filter(i => i.status === 'APPROVED' || (i.status === 'ADMIN_APPROVED' && !(i.application_type === 'IZIN_PENELITIAN' && i.requires_ethics))).length,
  rejected: applications.value.filter(i => i.status === 'REJECTED').length,
}))

const availableYears = computed(() => {
  const years = new Set<number>([new Date().getFullYear()])
  applications.value.forEach(application => {
    const year = new Date(application.created_at).getFullYear()
    if (Number.isFinite(year)) years.add(year)
  })
  return [...years].sort((a, b) => b - a)
})

const monthlyChart = computed(() => Array.from({ length: 12 }, (_, month) => ({
  label: new Date(selectedYear.value, month, 1).toLocaleDateString('id-ID', { month: 'short' }),
  count: applications.value.filter(application => {
    const created = new Date(application.created_at)
    return created.getFullYear() === selectedYear.value && created.getMonth() === month
  }).length,
})))

const chartMax = computed(() => Math.max(...monthlyChart.value.map(item => item.count), 1))

const statusMeta: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: 'Menunggu verifikasi', className: 'status status--submitted' },
  ADMIN_REVIEW: { label: 'Sedang diverifikasi', className: 'status status--review' },
  REVISION_REQUIRED: { label: 'Revisi', className: 'status status--revision' },
  REQUIRED_ETHICS: { label: 'Dilanjutkan ke Etik', className: 'status status--approved' },
  APPROVED: { label: 'Disetujui', className: 'status status--approved' },
  REJECTED: { label: 'Ditolak', className: 'status status--rejected' },
  PERMIT_ISSUED: { label: 'Surat diterbitkan', className: 'status status--issued' },
}

const typeLabels: Record<string, string> = { DATA_AWAL: 'Data Awal', IZIN_PENELITIAN: 'Izin Penelitian', IZIN_ETIK: 'Kaji Etik' }
const meta = (s: string, application?: DiklitApplication) => {
  if (s === 'ADMIN_APPROVED' && application?.application_type === 'IZIN_PENELITIAN' && application.requires_ethics) {
    return { label: 'Dilanjutkan ke Etik', className: 'status status--review' }
  }
  return statusMeta[s] ?? { label: s.replaceAll('_', ' '), className: 'status' }
}
const typeLabel = (t: string) => typeLabels[t] ?? t.replaceAll('_', ' ')
const date = (v: string) => new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { applications.value = (await getDiklitApplications()).data ?? [] } catch (e) { errorMessage.value = getApiErrorMessage(e, 'Gagal memuat dashboard.') } finally { loading.value = false }
}

function detail(id: string) { router.push({ name: 'diklit-application-detail', params: { id } }) }
onMounted(load)
</script>

<template>
  <div class="dashboard">
    <header class="hero">
      <div class="hero-text">
        <span class="eyebrow">DIKLIT</span>
        <h1>Dashboard</h1>
        <p v-if="authStore.user" class="welcome">
          Selamat datang, <strong>{{ authStore.user.name }}</strong>
        </p>
      </div>
      <button class="refresh" type="button" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="errorMessage" class="alert">
      <AlertCircle :size="18" />{{ errorMessage }}
    </div>

    <section class="stats">
      <article class="stat-card stat-card--blue">
        <span class="stat-icon"><FileText :size="22" /></span>
        <span class="stat-label">Total Pengajuan</span>
        <strong class="stat-value">{{ loading ? '–' : stats.total }}</strong>
        <small class="stat-hint">Seluruh pengajuan masuk</small>
      </article>
      <article class="stat-card stat-card--orange">
        <span class="stat-icon"><ClipboardList :size="22" /></span>
        <span class="stat-label">Menunggu Verifikasi</span>
        <strong class="stat-value">{{ loading ? '–' : stats.waiting }}</strong>
        <small class="stat-hint">Perlu diperiksa Diklit</small>
      </article>
      <article class="stat-card stat-card--purple">
        <span class="stat-icon"><FileCheck2 :size="22" /></span>
        <span class="stat-label">Dalam Revisi</span>
        <strong class="stat-value">{{ loading ? '–' : stats.revision }}</strong>
        <small class="stat-hint">Menunggu perbaikan peneliti</small>
      </article>
      <article class="stat-card stat-card--green">
        <span class="stat-icon"><CheckCircle2 :size="22" /></span>
        <span class="stat-label">Disetujui</span>
        <strong class="stat-value">{{ loading ? '–' : stats.approved }}</strong>
        <small class="stat-hint">Pengajuan yang telah disetujui</small>
      </article>
      <article class="stat-card stat-card--red">
        <span class="stat-icon"><XCircle :size="22" /></span>
        <span class="stat-label">Ditolak</span>
        <strong class="stat-value">{{ loading ? '–' : stats.rejected }}</strong>
        <small class="stat-hint">Pengajuan yang ditolak</small>
      </article>
    </section>

    <section class="card">
      <div class="card-head">
        <div>
          <h2>Pengajuan per Bulan</h2>
          <p>Distribusi pengajuan berdasarkan tahun yang dipilih.</p>
        </div>
        <label class="year-select">
          <select v-model="selectedYear" aria-label="Pilih tahun grafik">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
        </label>
      </div>
      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" />Memuat grafik...
      </div>
      <div v-else class="bar-chart" role="img" :aria-label="`Grafik batang pengajuan tahun ${selectedYear}`">
        <div v-for="item in monthlyChart" :key="item.label" class="bar-column" :title="`${item.label}: ${item.count} pengajuan`">
          <span class="bar-value">{{ item.count }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ height: `${item.count ? Math.max((item.count / chartMax) * 100, 8) : 0}%` }" />
          </div>
          <span class="bar-label">{{ item.label }}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div>
          <h2>Pengajuan Terbaru</h2>
          <p>Tiga pengajuan terbaru berdasarkan waktu pembaruan.</p>
        </div>
        <RouterLink class="view-all" to="/diklit/courses">
          Lihat semua <ArrowRight :size="16" />
        </RouterLink>
      </div>
      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" />Memuat pengajuan...
      </div>
      <div v-else-if="!recentApplications.length" class="state">
        <XCircle :size="30" />Belum ada pengajuan
      </div>
      <div v-else class="table">
        <table>
          <thead>
            <tr>
              <th>Nomor Pengajuan</th>
              <th>Peneliti</th>
              <th>Jenis</th>
              <th>Status</th>
              <th>Diajukan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in recentApplications" :key="i.id">
              <td><button class="link" type="button" @click="detail(i.id)"><strong>{{ i.application_number }}</strong></button></td>
              <td><strong>{{ i.researcher_name || '—' }}</strong><small>{{ i.researcher_email || '—' }}</small></td>
              <td><span >{{ typeLabel(i.application_type) }}</span></td>
              <td><span :class="meta(i.status, i).className">{{ meta(i.status, i).label }}</span></td>
              <td>{{ date(i.created_at) }}</td>
              <td>
                <button class="detail" type="button" @click="detail(i.id)">
                  <Eye :size="16" /> Detail
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  color: var(--foreground);
}

/* Header */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--gradient-primary-soft);
  box-shadow: var(--shadow-sm);
}

.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
}

h1 {
  margin: 6px 0 4px;
  color: var(--foreground);
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.2;
}

.welcome {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px;
}

.welcome strong { color: var(--foreground); }

.refresh,
.detail,
.view-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}

.refresh:hover,
.view-all:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.refresh:disabled {
  opacity: .6;
  cursor: wait;
}

.alert {
  display: flex;
  gap: var(--space-2);
  padding: 12px;
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Statistik */
.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-4);
}

.stat-card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  row-gap: 2px;
  column-gap: 10px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  grid-column: 2;
  grid-row: 1 / span 3;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
}

.stat-label {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 600;
}

.stat-value {
  color: var(--foreground);
  font-size: 28px;
  line-height: 1.15;
}

.stat-hint {
  color: var(--muted-foreground);
  font-size: 11px;
  line-height: 1.4;
}

.stat-card--blue .stat-icon { background: var(--color-info-soft); color: var(--color-info); }
.stat-card--orange .stat-icon { background: var(--color-warning-soft); color: var(--color-warning); }
.stat-card--purple .stat-icon { background: var(--color-primary-soft); color: var(--primary); }
.stat-card--green .stat-icon { background: var(--color-success-soft); color: var(--color-success); }
.stat-card--red .stat-icon { background: var(--color-neutral-soft); color: var(--muted-foreground); }

/* Kartu dan judul */
.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--color-overlay-subtle);
}

.card-head h2 {
  margin: 0 0 4px;
  color: var(--foreground);
  font-size: 16px;
}

.card-head p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

.view-all {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.year-select select {
  min-width: 92px;
  padding: 7px 28px 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

/* Grafik batang */
.bar-chart {
  height: 280px;
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding: 24px 28px 20px;
}

.bar-column {
  height: 100%;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.bar-track {
  height: 210px;
  width: min(42px, 70%);
  display: flex;
  align-items: flex-end;
  border-radius: 10px;
  background: var(--color-overlay-subtle);
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  border-radius: 10px 10px 0 0;
  background: var(--primary);
  transition: height 300ms ease;
}

.bar-column:hover .bar-fill { opacity: .85; }

.bar-value,
.bar-label {
  font-size: 11px;
  color: var(--muted-foreground);
}

/* Tabel */
.table { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 14px 18px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--foreground);
  white-space: nowrap;
}

tbody tr:last-child td { border-bottom: 0; }

th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--muted-foreground);
  background: var(--color-overlay-subtle);
}

tbody tr:hover { background: var(--color-primary-light); }

td small {
  display: block;
  margin-top: 3px;
  color: var(--muted-foreground);
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--primary);
  font: inherit;
  cursor: pointer;
}

.type,
.status {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.type {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.status {
  background: var(--color-neutral-soft);
  color: var(--muted-foreground);
}

.status--submitted,
.status--waiting {
  background: var(--color-info-soft);
  color: var(--color-info)
}

.status--review {
  background: var(--color-warning-soft);
  color: var(--color-warning)
}

.status--revision,
.status--rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.status--approved,
.status--completed,
.status--issued {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.detail {
  color: var(--primary);
  font-size: 12px;
}

.state {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-foreground);
}

.spin { animation: spin 1s linear infinite; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsif */
@media (max-width: 1100px) {
  .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .hero,
  .card-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero { padding: 18px; }

  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  .bar-chart {
    gap: 5px;
    padding-inline: 12px;
  }
}

@media (max-width: 480px) {
  .stats { grid-template-columns: 1fr; }
  .year-select { align-self: flex-end; }
}

button:not(:disabled) {
  transition: background-color var(--transition-base), color var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base), transform var(--transition-fast);
}

button:not(:disabled):hover { transform: translateY(-1px); }
button:not(:disabled):active { transform: translateY(0); }

@media (prefers-reduced-motion: reduce) {
  button:not(:disabled) { transition: none; }
  .bar-fill { transition: none; }
}
</style>
