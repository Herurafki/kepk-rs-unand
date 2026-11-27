<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getSecretariatApplications, type SecretariatApplication } from '../../services/secretariat/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { useAuthStore } from '../../stores/routes/auth'

const router = useRouter()
const authStore = useAuthStore()
const applications = ref<SecretariatApplication[]>([])
const loading = ref(false)
const errorMessage = ref('')

const stats = computed(() => ({
  total: applications.value.length,
  waiting: applications.value.filter((i) => ['ADMIN_APPROVED', 'SEKRETARIS_REVIEW'].includes(i.status)).length,
  revision: applications.value.filter((i) => i.status === 'REVISION_REQUIRED').length,
  review: applications.value.filter((i) => ['WAITING_REVIEWER', 'UNDER_REVIEW', 'REVIEW_COMPLETED'].includes(i.status)).length,
  completed: applications.value.filter((i) => ['APPROVED', 'REJECTED', 'PERMIT_ISSUED'].includes(i.status)).length,
}))

const statCards = computed(() => [
  { label: 'Total Pengajuan', value: stats.value.total, hint: 'Seluruh pengajuan masuk', icon: FileText, tone: 'blue' },
  { label: 'Menunggu Verifikasi', value: stats.value.waiting, hint: 'Perlu diperiksa Sekretariat', icon: Clock3, tone: 'orange' },
  { label: 'Dalam Revisi', value: stats.value.revision, hint: 'Menunggu perbaikan peneliti', icon: FileCheck2, tone: 'purple' },
  { label: 'Dalam Proses Review', value: stats.value.review, hint: 'Ditangani Ketua dan reviewer', icon: Users, tone: 'green' },
  { label: 'Selesai', value: stats.value.completed, hint: 'Disetujui, ditolak, atau surat terbit', icon: ClipboardCheck, tone: 'red' },
])

const recentApplications = computed(() =>
  [...applications.value]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 3),
)

// Grafik hanya untuk tahun berjalan agar bulan yang sama dari tahun berbeda tidak tercampur
const chartYear = new Date().getFullYear()
const monthlyChart = computed(() =>
  Array.from({ length: 12 }, (_, month) => ({
    label: new Date(2000, month, 1).toLocaleDateString('id-ID', { month: 'short' }),
    count: applications.value.filter((i) => {
      const created = new Date(i.created_at)
      return created.getFullYear() === chartYear && created.getMonth() === month
    }).length,
  })),
)
const chartMax = computed(() => Math.max(...monthlyChart.value.map((i) => i.count), 1))
const chartTotal = computed(() => monthlyChart.value.reduce((sum, i) => sum + i.count, 0))

const statusMeta: Record<string, { label: string; className: string }> = {
  ADMIN_APPROVED: { label: 'Menunggu verifikasi', className: 'status status--waiting' },
  SEKRETARIS_REVIEW: { label: 'Belum diverifikasi', className: 'status status--waiting' },
  REVISION_REQUIRED: { label: 'Revisi', className: 'status status--revision' },
  WAITING_REVIEWER: { label: 'Menunggu reviewer', className: 'status status--review' },
  UNDER_REVIEW: { label: 'Sedang direview', className: 'status status--review' },
  REVIEW_COMPLETED: { label: 'Review selesai', className: 'status status--completed' },
  APPROVED: { label: 'Disetujui', className: 'status status--approved' },
  REJECTED: { label: 'Ditolak', className: 'status status--rejected' },
  PERMIT_ISSUED: { label: 'Surat diterbitkan', className: 'status status--issued' },
}
const meta = (s: string) => statusMeta[s] ?? { label: s.replaceAll('_', ' '), className: 'status' }

const date = (v: string) => new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const today = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    applications.value = (await getSecretariatApplications()).data ?? []
  } catch (e) {
    errorMessage.value = getApiErrorMessage(e, 'Gagal memuat dashboard sekretariat.')
  } finally {
    loading.value = false
  }
}

function detail(id: string) {
  router.push({ name: 'secretariat-application-detail', params: { id } })
}

// Halaman daftar Pengajuan diturunkan dari route detail: /x/applications/:id -> /x/applications
function goToApplications(status?: string) {
  const query = status ? { status } : undefined
  const detailRoute = router.getRoutes().find((r) => r.name === 'secretariat-application-detail')
  const base = detailRoute?.path.replace(/\/:[^/]+\??$/, '')
  const path = base && base !== detailRoute?.path && router.resolve(base).matched.length ? base : '/secretariat/applications'
  router.push({ path, query })
}

onMounted(load)
</script>

<template>
  <div class="dashboard">
    <header class="hero">
      <div class="hero-text">
        <span class="eyebrow">SEKRETARIAT KEPK</span>
        <h1>Dashboard</h1>
        <p v-if="authStore.user" class="welcome">
          Selamat datang, <strong>{{ authStore.user.name }}</strong>
        </p>
        <span class="today"><CalendarClock :size="14" /> {{ today }}</span>
      </div>
      <button class="refresh" type="button" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="errorMessage" class="alert">
      <AlertCircle :size="18" />{{ errorMessage }}
    </div>

    <!-- Pengajuan yang perlu diverifikasi -->
    <section v-if="!loading && stats.waiting" class="notice">
      <div class="notice-icon"><BellRing :size="20" /></div>
      <div class="notice-text">
        <strong>{{ stats.waiting }} pengajuan menunggu verifikasi Anda</strong>
        <p>Periksa kelengkapan berkas lalu teruskan ke Ketua KEPK, atau minta revisi.</p>
      </div>
      <button class="notice-action" type="button" @click="goToApplications('ADMIN_APPROVED')">
        Verifikasi sekarang <ArrowRight :size="16" />
      </button>
    </section>

    <!-- Statistik -->
    <section class="stats">
      <article v-for="item in statCards" :key="item.label" class="stat-card" :class="`stat-card--${item.tone}`">
        <span class="stat-icon"><component :is="item.icon" :size="22" /></span>
        <span class="stat-label">{{ item.label }}</span>
        <strong class="stat-value">{{ loading ? '–' : item.value }}</strong>
        <small class="stat-hint">{{ item.hint }}</small>
      </article>
    </section>

    <!-- Grafik -->
    <section class="card">
      <div class="card-head">
        <div>
          <h2>Pengajuan per Bulan</h2>
          <p>Distribusi pengajuan tahun {{ chartYear }}.</p>
        </div>
        <span class="chart-total">{{ chartTotal }} pengajuan</span>
      </div>
      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" />Memuat grafik...
      </div>
      <div v-else class="bar-chart">
        <div v-for="item in monthlyChart" :key="item.label" class="bar-column" :title="`${item.label}: ${item.count} pengajuan`">
          <span class="bar-value">{{ item.count }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ height: `${item.count ? Math.max((item.count / chartMax) * 100, 8) : 0}%` }" />
          </div>
          <span class="bar-label">{{ item.label }}</span>
        </div>
      </div>
    </section>

    <!-- Pengajuan terbaru -->
    <section class="card">
      <div class="card-head">
        <div>
          <h2>Pengajuan Terbaru</h2>
          <p>Tiga pengajuan terbaru berdasarkan waktu pembaruan.</p>
        </div>
        <button class="view-all" type="button" @click="goToApplications()">
          Lihat semua <ArrowRight :size="16" />
        </button>
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
              <th>Status</th>
              <th>Diajukan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in recentApplications" :key="i.id">
              <td><button class="link" type="button" @click="detail(i.id)"><strong>{{ i.application_number }}</strong></button></td>
              <td><strong>{{ i.researcher_name || '—' }}</strong><small>{{ i.researcher_email || '—' }}</small></td>
              <td><span :class="meta(i.status).className">{{ meta(i.status).label }}</span></td>
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

/* ===== Header ===== */
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

.welcome strong {
  color: var(--foreground);
}

.today {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: var(--muted-foreground);
  font-size: 12px;
}

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

/* ===== Pemberitahuan ===== */
.notice {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--color-warning-border);
  border-radius: 14px;
  background: var(--color-warning-soft);
}

.notice-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 10px;
  background: var(--card);
  color: var(--color-warning);
}

.notice-text {
  flex: 1;
  min-width: 0;
}

.notice-text strong {
  color: var(--foreground);
  font-size: 14px;
}

.notice-text p {
  margin: 3px 0 0;
  font-size: 12px;
}

.notice-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-warning);
  color: var(--primary-foreground);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

/* ===== Statistik ===== */
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

/* ===== Kartu ===== */
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
  font-size: 12px;
}

.view-all {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.chart-total {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

/* ===== Grafik ===== */
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

.bar-column:hover .bar-fill {
  opacity: .85;
}

.bar-value,
.bar-label {
  font-size: 11px;
  color: var(--muted-foreground);
}

/* ===== Tabel ===== */
.table {
  overflow-x: auto;
}

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

tbody tr:last-child td {
  border-bottom: 0;
}

th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--muted-foreground);
  background: var(--color-overlay-subtle);
}

tbody tr:hover {
  background: var(--color-primary-light);
}

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

.detail {
  color: var(--primary);
  font-size: 12px;
}

.status {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--color-neutral-soft);
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 600;
}

.status--waiting { background: var(--color-warning-soft); color: var(--color-warning); }
.status--review { background: var(--color-info-soft); color: var(--color-info); }
.status--revision,
.status--rejected { background: var(--color-danger-soft); color: var(--color-danger); }
.status--completed,
.status--approved,
.status--issued { background: var(--color-success-soft); color: var(--color-success); }

.state {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-foreground);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== Responsif ===== */
@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .hero,
  .card-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero {
    padding: 18px;
  }

  .notice {
    flex-wrap: wrap;
  }

  .notice-text {
    flex-basis: calc(100% - 56px);
  }

  .notice-action {
    width: 100%;
    justify-content: center;
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bar-chart {
    gap: 5px;
    padding-inline: 12px;
  }
}

@media (max-width: 480px) {
  .stats {
    grid-template-columns: 1fr;
  }
}

/* ===== Interaksi tombol ===== */
button:not(:disabled) {
  transition: background-color var(--transition-base), color var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base), transform var(--transition-fast);
}

button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  button:not(:disabled) {
    transition: none;
  }

  .bar-fill {
    transition: none;
  }
}
</style>