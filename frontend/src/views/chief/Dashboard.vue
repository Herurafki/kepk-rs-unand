<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  RefreshCw,
  Users,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getChiefApplications, type ChiefApplication } from '../../services/chief/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { useAuthStore } from '../../stores/routes/auth'

const router = useRouter()
const authStore = useAuthStore()
const applications = ref<ChiefApplication[]>([])
const loading = ref(false)
const errorMessage = ref('')

const normalizeType = (t?: string | null) => String(t || '').toUpperCase().replace('_', '')

const ethics = computed(() => applications.value.filter((a) => a.application_type === 'IZIN_ETIK'))

const counts = computed(() => ({
  waiting: ethics.value.filter((a) => a.status === 'WAITING_REVIEWER' && !a.review_type).length,
  review: ethics.value.filter((a) => ['UNDER_REVIEW', 'REVIEW_COMPLETED'].includes(a.status)).length,
  approved: ethics.value.filter((a) => a.status === 'APPROVED').length,
  revision: ethics.value.filter((a) => a.status === 'REVISION_REQUIRED').length,
}))

const stats = computed(() => [
  { label: 'Perlu Penetapan', value: counts.value.waiting, hint: 'Belum ditetapkan jenis telaahnya', icon: Clock3, tone: 'waiting' },
  { label: 'Dalam Review', value: counts.value.review, hint: 'Sedang atau selesai direview', icon: Users, tone: 'review' },
  { label: 'Disetujui', value: counts.value.approved, hint: 'Telah disetujui KEPK', icon: CheckCircle2, tone: 'done' },
  { label: 'Perlu Revisi', value: counts.value.revision, hint: 'Menunggu perbaikan peneliti', icon: ClipboardList, tone: 'revision' },
])

// Sama seperti menu Peninjauan: izin etik yang menunggu penetapan atau sedang/selesai direview
const REVIEW_MENU_STATUSES = ['WAITING_REVIEWER', 'UNDER_REVIEW', 'REVIEW_COMPLETED']

const latest = computed(() =>
  ethics.value
    .filter((a) => REVIEW_MENU_STATUSES.includes(a.status))
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 3),
)

const reviewLabel = (type?: string | null) =>
  ({ EXEMPTED: 'Exempted', EXPEDITED: 'Expedited', FULLBOARD: 'Full Board' } as Record<string, string>)[normalizeType(type)] ?? 'Belum ditetapkan'

const statusClass = (s: string) =>
  ({
    WAITING_REVIEWER: 'status--waiting',
    UNDER_REVIEW: 'status--under',
    REVIEW_COMPLETED: 'status--complete',
    APPROVED: 'status--approved',
    PERMIT_ISSUED: 'status--approved',
    REVISION_REQUIRED: 'status--revision',
    REJECTED: 'status--revision',
  } as Record<string, string>)[s] || ''

const statusLabel = (s: string) =>
  ({
    WAITING_REVIEWER: 'Menunggu Penetapan',
    UNDER_REVIEW: 'Sedang Direview',
    REVIEW_COMPLETED: 'Review Selesai',
    APPROVED: 'Disetujui',
    REVISION_REQUIRED: 'Perlu Revisi',
    REJECTED: 'Ditolak',
    PERMIT_ISSUED: 'Surat Diterbitkan',
  } as Record<string, string>)[s] ?? s.replaceAll('_', ' ')

const today = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

const formatDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    applications.value = await getChiefApplications()
  } catch (e) {
    errorMessage.value = getApiErrorMessage(e, 'Gagal memuat pengajuan Ketua KEPK.')
  } finally {
    loading.value = false
  }
}

const openDetail = (id: string | number) => router.push({ name: 'chief-application-detail', params: { id } })

// Halaman Peninjauan dicari otomatis. Jika masih salah, isi nama route yang benar di sini.
const REVIEW_LIST_ROUTE = ''

function findReviewListTarget() {
  // 1) Nama route yang diisi manual atau yang umum dipakai
  const names = [REVIEW_LIST_ROUTE, 'chief-reviews', 'chief-review', 'chief-review-list', 'chief-applications', 'chief-peninjauan']
    .filter(Boolean)
    .find((name) => router.hasRoute(name))
  if (names) return { name: names }

  // 2) Turunkan dari route detail: /ketua/peninjauan/:id -> /ketua/peninjauan
  const detail = router.getRoutes().find((r) => r.name === 'chief-application-detail')
  if (detail) {
    const base = detail.path.replace(/\/:[^/]+\??$/, '')
    if (base && base !== detail.path && router.resolve(base).matched.length) return { path: base }
  }

  // 3) Cocokkan lewat path statis
  const byPath = router
    .getRoutes()
    .find((r) => /(chief|ketua)/i.test(r.path) && /(review|peninjauan)/i.test(r.path) && !/(:|history|riwayat)/i.test(r.path))
  return byPath ? { path: byPath.path } : null
}

function goToReviews() {
  const target = findReviewListTarget()
  if (!target) {
    errorMessage.value = 'Halaman Peninjauan tidak ditemukan. Isi REVIEW_LIST_ROUTE dengan nama route yang benar.'
    return
  }
  router.push(target)
}

onMounted(load)
</script>

<template>
  <main class="page">
    <header class="hero">
      <div class="hero-text">
        <span class="eyebrow">KETUA KEPK</span>
        <h1>Dashboard</h1>
        <p v-if="authStore.user" class="welcome">
          Selamat datang, <strong>{{ authStore.user.name }}</strong>
        </p>
        <span class="today"><CalendarClock :size="14" /> {{ today }}</span>
      </div>
      <button class="button" type="button" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>

    <!-- Pengajuan yang perlu ditetapkan -->
    <section v-if="!loading && counts.waiting" class="notice">
      <div class="notice-icon"><BellRing :size="20" /></div>
      <div class="notice-text">
        <strong>{{ counts.waiting }} pengajuan menunggu penetapan jenis telaah</strong>
        <p>Tentukan Exempted, Expedited, atau Full Board agar proses review dapat berjalan.</p>
      </div>
      <button class="notice-action" type="button" @click="goToReviews">
        Tetapkan sekarang <ArrowRight :size="16" />
      </button>
    </section>

    <!-- Statistik -->
    <section class="stats">
      <article v-for="item in stats" :key="item.label" class="stat" :class="`stat--${item.tone}`">
        <span class="stat-icon"><component :is="item.icon" :size="20" /></span>
        <span class="stat-label">{{ item.label }}</span>
        <strong class="stat-value">{{ loading ? '–' : item.value }}</strong>
        <small class="stat-hint">{{ item.hint }}</small>
      </article>
    </section>

    <!-- Pengajuan terbaru -->
    <section class="card">
      <header class="card-header">
        <div>
          <h2>Pengajuan Terbaru</h2>
          <p>Tiga pengajuan terbaru dari menu Peninjauan.</p>
        </div>
        <button class="view-all" type="button" @click="goToReviews">
          Lihat semua <ArrowRight :size="16" />
        </button>
      </header>

      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" /> Memuat...
      </div>

      <div v-else class="table">
        <table>
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Peneliti</th>
              <th>Judul</th>
              <th>Tipe Review</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in latest" :key="a.id">
              <td>
                <strong>{{ a.application_number }}</strong>
                <small>{{ formatDate(a.created_at) }}</small>
              </td>
              <td>
                <strong>{{ a.researcher_name || '—' }}</strong>
                <small>{{ a.researcher_email || '—' }}</small>
              </td>
              <td class="title">{{ a.research_title || '—' }}</td>
              <td>
                <span class="type" :class="{ 'type--unset': !a.review_type }">{{ reviewLabel(a.review_type) }}</span>
              </td>
              <td><span :class="['status', statusClass(a.status)]">{{ statusLabel(a.status) }}</span></td>
              <td>
                <button class="detail" type="button" @click="openDetail(a.id)">
                  <Eye :size="16" /> Detail
                </button>
              </td>
            </tr>
            <tr v-if="!latest.length">
              <td colspan="6" class="empty">Belum ada pengajuan pada menu Peninjauan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page {
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

.button,
.detail,
.view-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.button:hover,
.view-all:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.button:disabled {
  opacity: .6;
  cursor: wait;
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
  color: var(--muted-foreground);
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.stat {
  display: grid;
  grid-template-columns: 44px 1fr;
  align-items: center;
  column-gap: 12px;
  row-gap: 2px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  grid-row: span 3;
  border-radius: var(--radius-md);
  background: var(--color-info-soft);
  color: var(--color-info);
}

.stat--waiting .stat-icon { background: var(--color-warning-soft); color: var(--color-warning); }
.stat--review .stat-icon { background: var(--color-info-soft); color: var(--color-info); }
.stat--done .stat-icon { background: var(--color-success-soft); color: var(--color-success); }
.stat--revision .stat-icon { background: var(--color-danger-soft); color: var(--color-danger); }

.stat-label {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 600;
}

.stat-value {
  color: var(--foreground);
  font-size: 28px;
  line-height: 1.1;
}

.stat-hint {
  color: var(--muted-foreground);
  font-size: 11px;
  line-height: 1.4;
}

/* ===== Kartu & filter ===== */
.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--color-overlay-subtle);
}

.card-header h2 {
  margin: 0 0 4px;
  color: var(--foreground);
  font-size: 16px;
}

.card-header p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

.view-all {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
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
}

tbody tr:last-child td {
  border-bottom: 0;
}

th {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted-foreground);
  background: var(--color-overlay-subtle);
}

tbody tr:hover {
  background: var(--color-primary-light);
}

small {
  display: block;
  margin-top: 3px;
  color: var(--muted-foreground);
}

.title {
  max-width: 280px;
}

.type,
.status {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--color-info-soft);
  color: var(--color-info);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.type--unset {
  background: var(--muted);
  color: var(--muted-foreground);
}

.status--waiting { background: var(--color-warning-soft); color: var(--color-warning); }
.status--under { background: var(--color-info-soft); color: var(--color-info); }
.status--complete,
.status--approved { background: var(--color-success-soft); color: var(--color-success); }
.status--revision { background: var(--color-danger-soft); color: var(--color-danger); }

.detail {
  color: var(--primary);
  font-size: 12px;
}

.empty,
.state {
  text-align: center;
  color: var(--muted-foreground);
  padding: 50px;
}

.alert {
  padding: 12px;
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
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
@media (max-width: 1000px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

}

@media (max-width: 720px) {
  .hero,
  .card-header {
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
    grid-template-columns: 1fr;
  }

  table {
    min-width: 1000px;
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
}
</style>