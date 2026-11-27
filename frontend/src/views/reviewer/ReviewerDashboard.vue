<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  Layers,
  LoaderCircle,
  RefreshCw,
  XCircle,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getReviewerAssignments, type ReviewerAssignment } from '../../services/reviewer/review.service'
import { getApiErrorMessage } from '../../services/api/error'
import { useAuthStore } from '../../stores/routes/auth'

const router = useRouter()
const authStore = useAuthStore()
const assignments = ref<ReviewerAssignment[]>([])
const loading = ref(true)
const error = ref('')

const effectiveStatus = (item: ReviewerAssignment) =>
  item.has_submitted_review ? 'COMPLETED' : String(item.status || '').toUpperCase()

const pending = computed(() => assignments.value.filter((a) => effectiveStatus(a) === 'PENDING'))
const accepted = computed(() => assignments.value.filter((a) => effectiveStatus(a) === 'ACCEPTED'))
const completed = computed(() => assignments.value.filter((a) => effectiveStatus(a) === 'COMPLETED'))

const total = computed(() => assignments.value.length)
const progress = computed(() => (total.value ? Math.round((completed.value.length / total.value) * 100) : 0))

const recent = computed(() =>
  [...assignments.value]
    .sort(
      (a, b) =>
        new Date(String(b.updated_at || b.assigned_at || '')).getTime() -
        new Date(String(a.updated_at || a.assigned_at || '')).getTime(),
    )
    .slice(0, 5),
)

const stats = computed(() => [
  { key: 'ALL', label: 'Total Penugasan', value: total.value, hint: 'Seluruh tugas review Anda', icon: Layers, tone: 'neutral' },
  { key: 'PENDING', label: 'Menunggu Respons', value: pending.value.length, hint: 'Perlu diterima atau ditolak', icon: Clock3, tone: 'waiting' },
  { key: 'ACCEPTED', label: 'Siap Direview', value: accepted.value.length, hint: 'Sudah diterima, belum dinilai', icon: ClipboardCheck, tone: 'active' },
  { key: 'COMPLETED', label: 'Review Selesai', value: completed.value.length, hint: 'Penilaian telah dikirim', icon: CheckCircle2, tone: 'done' },
])

const statusLabel = (value: string) =>
  ({ PENDING: 'Menunggu Respons', ACCEPTED: 'Siap Direview', COMPLETED: 'Selesai', REJECTED: 'Ditolak' } as Record<string, string>)[value] || value || '—'

const typeLabel = (t?: string | null) =>
  ({ EXEMPTED: 'Exempted', EXPEDITED: 'Expedited', FULLBOARD: 'Full Board' } as Record<string, string>)[
    String(t || '').toUpperCase().replace('_', '')
  ] || '—'

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const formatForumDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Jadwal belum ditentukan'

const today = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

const isFullboard = (item: ReviewerAssignment) => String(item.review_type || '').toUpperCase().replace('_', '') === 'FULLBOARD'

const actionLabel = (item: ReviewerAssignment) => {
  const status = effectiveStatus(item)
  if (status === 'PENDING') return 'Tanggapi'
  if (status === 'ACCEPTED') return 'Nilai'
  return 'Detail'
}

function goToTasks(tab?: string) {
  router.push({ name: 'reviewer-tasks', query: tab && tab !== 'ALL' ? { tab } : undefined })
}

function openAssignment(item: ReviewerAssignment) {
  // Penugasan yang belum direspons ditanggapi dari daftar tugas
  if (effectiveStatus(item) === 'PENDING') return goToTasks('PENDING')
  router.push({ name: 'reviewer-task-detail', params: { id: item.application_id } })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    assignments.value = await getReviewerAssignments()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Gagal memuat dashboard reviewer.')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="dashboard">
    <header class="hero">
      <div class="hero-text">
        <span class="eyebrow">KEPK · REVIEWER</span>
        <h1>Dashboard</h1>
        <p v-if="authStore.user" class="welcome">
          Selamat datang, <strong>{{ authStore.user.name }}</strong>
        </p>
        <span class="today"><CalendarClock :size="14" /> {{ today }}</span>
      </div>
      <button class="refresh" type="button" :disabled="loading" @click="load">
        <RefreshCw :size="16" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="error" class="alert"><XCircle :size="18" />{{ error }}</div>

    <div v-if="loading" class="state">
      <LoaderCircle :size="28" class="spin" /> Memuat ringkasan...
    </div>

    <template v-else>
      <!-- Penugasan yang perlu ditanggapi -->
      <section v-if="pending.length" class="notice">
        <div class="notice-icon"><BellRing :size="20" /></div>
        <div class="notice-text">
          <strong>{{ pending.length }} penugasan menunggu respons Anda</strong>
          <p>Terima atau tolak penugasan agar proses review dapat dilanjutkan.</p>
        </div>
        <button class="notice-action" type="button" @click="goToTasks('PENDING')">
          Tanggapi sekarang <ArrowRight :size="16" />
        </button>
      </section>

      <!-- Ringkasan -->
      <section class="stats">
        <button
          v-for="item in stats"
          :key="item.key"
          type="button"
          class="stat"
          :class="`stat--${item.tone}`"
          @click="goToTasks(item.key)">
          <span class="stat-icon"><component :is="item.icon" :size="20" /></span>
          <span class="stat-label">{{ item.label }}</span>
          <strong class="stat-value">{{ item.value }}</strong>
          <small class="stat-hint">{{ item.hint }}</small>
        </button>
      </section>

      <!-- Progres -->
      <section class="progress-card">
        <div class="progress-head">
          <div>
            <h2>Progres Review</h2>
            <p>{{ completed.length }} dari {{ total }} penugasan telah diselesaikan.</p>
          </div>
          <strong class="progress-percent">{{ progress }}%</strong>
        </div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
          <span class="progress-bar" :style="{ width: progress + '%' }" />
        </div>
      </section>

      <!-- Penugasan terbaru -->
      <section class="card">
        <header class="card-header">
          <div>
            <h2>Penugasan Terbaru</h2>
            <p>Lima penugasan dengan pembaruan terakhir.</p>
          </div>
          <button class="view-all" type="button" @click="goToTasks()">
            Lihat semua <ArrowRight :size="16" />
          </button>
        </header>

        <div v-if="!recent.length" class="empty">Belum ada penugasan reviewer.</div>

        <ul v-else class="assignment-list">
          <li v-for="item in recent" :key="item.id" class="assignment">
            <div class="assignment-main">
              <div class="assignment-top">
                <span class="assignment-number">{{ item.application_number || ('Pengajuan #' + item.application_id) }}</span>
                <span class="type-pill">{{ typeLabel(item.review_type) }}</span>
              </div>
              <h3>{{ item.research_title || 'Judul penelitian belum tersedia' }}</h3>
              <div class="assignment-meta">
                <span>{{ item.researcher_name || 'Nama peneliti belum tersedia' }}</span>
                <span>Ditugaskan {{ formatDate(item.assigned_at) }}</span>
                <span v-if="isFullboard(item)" class="forum-date">
                  <CalendarClock :size="12" /> Forum: {{ formatForumDate(item.forum_date) }}
                </span>
              </div>
            </div>

            <span class="status" :class="'status-' + effectiveStatus(item).toLowerCase()">
              {{ statusLabel(effectiveStatus(item)) }}
            </span>

            <button
              class="open"
              :class="{ 'open--primary': effectiveStatus(item) !== 'COMPLETED' }"
              type="button"
              @click="openAssignment(item)">
              <Eye :size="15" /> {{ actionLabel(item) }}
            </button>
          </li>
        </ul>
      </section>
    </template>
  </main>
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
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .09em;
}

h1 {
  margin: 6px 0 4px;
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
.view-all,
.open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
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
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.stat:hover {
  border-color: var(--primary);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  grid-row: span 3;
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--muted-foreground);
}

.stat--waiting .stat-icon { background: var(--color-warning-soft); color: var(--color-warning); }
.stat--active .stat-icon { background: var(--primary-muted); color: var(--primary); }
.stat--done .stat-icon { background: var(--color-success-soft); color: var(--color-success); }

.stat-label {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 600;
}

.stat-value {
  font-size: 28px;
  line-height: 1.1;
}

.stat-hint {
  color: var(--muted-foreground);
  font-size: 11px;
  line-height: 1.4;
}

/* ===== Progres ===== */
.progress-card {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-head h2 {
  margin: 0 0 4px;
  font-size: 15px;
}

.progress-head p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

.progress-percent {
  color: var(--primary);
  font-size: 22px;
}

.progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--muted);
}

.progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  transition: width .4s ease;
}

/* ===== Penugasan terbaru ===== */
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
  font-size: 16px;
}

.card-header p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

.view-all {
  color: var(--primary);
}

.assignment-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.assignment {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.assignment:last-child {
  border-bottom: 0;
}

.assignment:hover {
  background: var(--color-primary-light);
}

.assignment-main {
  flex: 1;
  min-width: 0;
}

.assignment-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.assignment-number {
  color: var(--primary);
  font-size: 11px;
  font-weight: 800;
}

.type-pill {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-info-soft);
  color: var(--color-info);
  font-size: 10px;
  font-weight: 700;
}

.assignment h3 {
  margin: 6px 0;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.45;
}

.assignment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: var(--muted-foreground);
  font-size: 11px;
}

.forum-date {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-warning);
  font-weight: 600;
}

.status {
  flex: 0 0 auto;
  padding: 5px 10px;
  border-radius: var(--radius-full);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.status-pending { background: var(--color-warning-soft); color: var(--color-warning); }
.status-accepted { background: var(--color-info-soft); color: var(--color-info); }
.status-completed { background: var(--color-success-soft); color: var(--color-success); }

.open {
  min-width: 96px;
  color: var(--foreground);
}

.open:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.open--primary {
  border-color: transparent;
  background: var(--primary);
  color: var(--primary-foreground);
}

.open--primary:hover {
  color: var(--primary-foreground);
  opacity: .9;
}

/* ===== Status halaman ===== */
.empty,
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 38px 16px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--destructive);
  font-size: 13px;
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

@media (max-width: 700px) {
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

  .assignment {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .assignment-main {
    flex-basis: 100%;
  }

  .open {
    margin-left: auto;
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

  .progress-bar {
    transition: none;
  }
}
</style>