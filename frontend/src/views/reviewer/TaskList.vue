<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Check, Eye, LoaderCircle, RefreshCw, Search, X, XCircle } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import {
  acceptReviewerAssignment,
  getReviewerAssignments,
  rejectReviewerAssignment,
  type ReviewerAssignment,
} from '../../services/reviewer/review.service'
import { getApiErrorMessage } from '../../services/api/error'
import { useAuthStore } from '../../stores/routes/auth'
import apiClient from '../../services/api/client'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const availabilityAssignment = ref<ReviewerAssignment | null>(null)
const noConflictConfirmed = ref(false)
const availabilityDecision = ref<'ACCEPT' | 'REJECT'>('ACCEPT')
const reviewerProfile = ref<{ specialization?: string | null; position?: string | null; organization?: string | null; phone?: string | null; address?: string | null }>({})
const reviewerProfileLoading = ref(false)
const assignments = ref<ReviewerAssignment[]>([])
const loading = ref(true)
const busy = ref<string | number>('')
const error = ref('')
const success = ref('')

// Tab: langsung berlaku saat diklik
const tab = ref('ALL')

// Draft: nilai yang sedang diketik/dipilih di form
const search = ref('')
const typeFilter = ref('')
const startDate = ref('')
const endDate = ref('')

// Terapan: nilai yang benar-benar dipakai untuk memfilter tabel
const applied = reactive({ search: '', typeFilter: '', startDate: '', endDate: '' })

const tabs = [
  { value: 'ALL', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu Respons' },
  { value: 'ACCEPTED', label: 'Siap Direview' },
  { value: 'COMPLETED', label: 'Selesai' },
]

const normalizeType = (t?: string | null) => String(t || '').toUpperCase().replace('_', '')

function effectiveStatus(item: ReviewerAssignment) {
  if (item.has_submitted_review) return 'COMPLETED'
  return String(item.status || '').toUpperCase()
}

const tabCount = (value: string) =>
  assignments.value.filter((a) => (value === 'ALL' ? true : effectiveStatus(a) === value)).length

const filtered = computed(() => {
  const term = applied.search.trim().toLowerCase()
  const start = applied.startDate ? new Date(applied.startDate + 'T00:00:00').getTime() : null
  const end = applied.endDate ? new Date(applied.endDate + 'T23:59:59.999').getTime() : null

  return assignments.value
    .filter((item) => {
      if (tab.value !== 'ALL' && effectiveStatus(item) !== tab.value) return false

      if (term) {
        const matches = [item.application_number, item.research_title, item.researcher_name, item.application_id]
          .some((value) => String(value || '').toLowerCase().includes(term))
        if (!matches) return false
      }

      if (applied.typeFilter && normalizeType(item.review_type) !== applied.typeFilter) return false

      if (start !== null || end !== null) {
        const assignedAt = item.assigned_at ? new Date(item.assigned_at).getTime() : NaN
        if (Number.isNaN(assignedAt)) return false
        if (start !== null && assignedAt < start) return false
        if (end !== null && assignedAt > end) return false
      }

      return true
    })
    .sort(
      (a, b) =>
        new Date(String(b.updated_at || b.assigned_at || '')).getTime() -
        new Date(String(a.updated_at || a.assigned_at || '')).getTime(),
    )
})

const statusLabel = (value?: string) =>
  ({
    PENDING: 'Menunggu Respons',
    ACCEPTED: 'Siap Direview',
    COMPLETED: 'Selesai',
    REJECTED: 'Ditolak',
  }[String(value || '').toUpperCase()] || value || '—')

const typeLabel = (t?: string | null) =>
  ({ EXEMPTED: 'Exempted', EXPEDITED: 'Expedited', FULLBOARD: 'Full Board' }[normalizeType(t)] || '—')

async function load() {
  loading.value = true
  error.value = ''
  try {
    assignments.value = await getReviewerAssignments()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Gagal memuat daftar tugas reviewer.')
  } finally {
    loading.value = false
  }
}

// Notifikasi sukses hilang otomatis
let successTimer: ReturnType<typeof setTimeout> | undefined
function showSuccess(message: string) {
  success.value = message
  clearTimeout(successTimer)
  successTimer = setTimeout(() => (success.value = ''), 4000)
}
onBeforeUnmount(() => clearTimeout(successTimer))

async function openAvailabilityForm(item: ReviewerAssignment, decision: 'ACCEPT' | 'REJECT' = 'ACCEPT') {
  availabilityAssignment.value = item
  availabilityDecision.value = decision
  noConflictConfirmed.value = false
  error.value = ''
  reviewerProfileLoading.value = true
  try {
    const response = await apiClient.get('/users/reviewers/me')
    reviewerProfile.value = response.data?.data || {}
  } catch (e) {
    reviewerProfile.value = {}
    error.value = getApiErrorMessage(e, 'Data profil reviewer gagal dimuat. Silakan coba lagi.')
  } finally {
    reviewerProfileLoading.value = false
  }
}
function closeAvailabilityForm() {
  if (busy.value) return
  availabilityAssignment.value = null
  noConflictConfirmed.value = false
}
async function confirmAvailability() {
  const item = availabilityAssignment.value
  if (!item || !noConflictConfirmed.value) return
  busy.value = item.id
  error.value = ''
  success.value = ''
  try {
    if (availabilityDecision.value === 'ACCEPT') await acceptReviewerAssignment(item.id)
    else await rejectReviewerAssignment(item.id)
    const decision = availabilityDecision.value
    availabilityAssignment.value = null
    noConflictConfirmed.value = false
    showSuccess(decision === 'ACCEPT' ? 'Pernyataan kesediaan dikonfirmasi dan penugasan diterima.' : 'Pernyataan penolakan dikonfirmasi dan penugasan ditolak.')
    await load()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Respons penugasan gagal disimpan.')
  } finally {
    busy.value = ''
  }
}
async function respond(item: ReviewerAssignment, accept: boolean) {
  busy.value = item.id
  error.value = ''
  success.value = ''
  try {
    if (accept) await acceptReviewerAssignment(item.id)
    else await rejectReviewerAssignment(item.id)
    showSuccess(accept ? 'Penugasan diterima.' : 'Penugasan ditolak.')
    await load()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Respons penugasan gagal disimpan.')
  } finally {
    busy.value = ''
  }
}

function syncFiltersToRoute() {
  router.replace({
    query: {
      ...route.query,
      search: applied.search || undefined,
      tab: tab.value !== 'ALL' ? tab.value : undefined,
      type: applied.typeFilter || undefined,
      from: applied.startDate || undefined,
      to: applied.endDate || undefined,
    },
  })
}

function applyFilters() {
  applied.search = search.value.trim()
  applied.typeFilter = typeFilter.value
  applied.startDate = startDate.value
  applied.endDate = endDate.value
  syncFiltersToRoute()
}

function resetFilters() {
  search.value = ''
  typeFilter.value = ''
  startDate.value = ''
  endDate.value = ''
  tab.value = 'ALL'
  applyFilters()
}

function selectTab(value: string) {
  tab.value = value
  syncFiltersToRoute()
}

function openReview(item: ReviewerAssignment) {
  router.push({ name: 'reviewer-task-detail', params: { id: item.application_id }, query: route.query })
}

onMounted(() => {
  search.value = String(route.query.search || '')
  tab.value = String(route.query.tab || 'ALL')
  typeFilter.value = normalizeType(String(route.query.type || ''))
  startDate.value = String(route.query.from || '')
  endDate.value = String(route.query.to || '')

  Object.assign(applied, {
    search: search.value,
    typeFilter: typeFilter.value,
    startDate: startDate.value,
    endDate: endDate.value,
  })
  load()
})
</script>

<template>
  <main class="task-page">
    <header class="heading">
      <div>
        <span class="eyebrow">REVIEWER KEPK</span>
        <h1>Daftar Tugas Review</h1>
        <p>Kelola penugasan dan buka formulir penilaian pengajuan.</p>
      </div>
      <button class="refresh" type="button" :disabled="loading" @click="load">
        <RefreshCw :size="16" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="error" class="alert error">
      <XCircle :size="18" />{{ error }}
    </div>
    <div v-if="success" class="alert success">
      <Check :size="18" />{{ success }}
    </div>

    <section class="card">
      <nav class="tabs">
        <button v-for="item in tabs" :key="item.value" type="button" :class="{ active: tab === item.value }"
          @click="selectTab(item.value)">
          {{ item.label }} <span>{{ tabCount(item.value) }}</span>
        </button>
      </nav>

      <div class="toolbar">
        <div class="search-field">
          <Search :size="16" />
          <input v-model="search" type="search" placeholder="Cari nomor, judul, atau ID pengajuan..."
            @keyup.enter="applyFilters" />
        </div>

        <div class="filter-controls">
          <select v-model="typeFilter" aria-label="Filter jenis telaah">
            <option value="">Semua jenis</option>
            <option value="EXEMPTED">Exempted</option>
            <option value="EXPEDITED">Expedited</option>
            <option value="FULLBOARD">Full Board</option>
          </select>

          <label class="date-field">
            <span>Penugasan dari</span>
            <input v-model="startDate" type="date" aria-label="Tanggal penugasan mulai" />
          </label>
          <label class="date-field">
            <span>Sampai</span>
            <input v-model="endDate" type="date" :min="startDate || undefined" aria-label="Tanggal penugasan akhir" />
          </label>

          <button class="apply-filter" type="button" @click="applyFilters">Terapkan</button>
          <button class="reset-filter" type="button" @click="resetFilters">Reset filter</button>
        </div>
      </div>

      <div class="result-bar">
        <span class="count">{{ filtered.length }} tugas</span>
      </div>

      <div v-if="loading" class="state">
        <LoaderCircle :size="28" class="spin" /> Memuat daftar tugas...
      </div>
      <div v-else-if="!filtered.length" class="empty">Tidak ada tugas pada filter ini.</div>
      <div v-else class="table-wrap">
        <table class="task-table">
          <thead>
            <tr>
              <th>Nomor Pengajuan</th>
              <th>Judul Penelitian</th>
              <th>Nama Peneliti</th>
              <th>Jenis Telaah</th>
              <th>Tanggal Penugasan</th>
              <th>Status</th>
              <th class="action-heading">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="item.id">
              <td class="application-number">{{ item.application_number || ('Pengajuan #' + item.application_id) }}</td>
              <td class="research-title">{{ item.research_title || 'Judul penelitian belum tersedia' }}</td>
              <td>{{ item.researcher_name || '—' }}</td>
              <td>{{ typeLabel(item.review_type) }}</td>
              <td>{{ item.assigned_at ? new Date(item.assigned_at).toLocaleDateString('id-ID') : '—' }}</td>
              <td>
                <span class="status" :class="'status-' + effectiveStatus(item).toLowerCase()">
                  {{ statusLabel(effectiveStatus(item)) }}
                </span>
              </td>
              <td>
                <div class="actions">
                  <template v-if="String(item.status || '').toUpperCase() === 'PENDING' && !item.has_submitted_review">
                    <button class="open secondary" type="button" @click="openReview(item)">
                      <Eye :size="15" />
                    </button>
                    <button class="accept" type="button" :disabled="busy === item.id" @click="openAvailabilityForm(item)">
                      <LoaderCircle v-if="busy === item.id" :size="15" class="spin" />
                      <Check :size="15" v-else /> Terima
                    </button>
                    <button class="reject" type="button" :disabled="busy === item.id" @click="openAvailabilityForm(item, 'REJECT')">
                      <X :size="15" /> Tolak
                    </button>
                  </template>
                  <button v-else-if="effectiveStatus(item) === 'ACCEPTED'" class="open" type="button"
                    @click="openReview(item)">
                    <Eye :size="15" /> Penilaian
                  </button>
                  <button v-else class="open secondary" type="button" @click="openReview(item)">
                    <Eye :size="15" /> Detail
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="availabilityAssignment" class="modal-backdrop" @click.self="closeAvailabilityForm">
      <section class="availability-modal" role="dialog" aria-modal="true" aria-labelledby="availability-title">
        <header class="availability-header">
          <h2 id="availability-title">{{ availabilityDecision === 'ACCEPT' ? 'FORMULIR KESEDIAAN REVIEWER' : 'FORMULIR PENOLAKAN KESEDIAAN REVIEWER' }}</h2>
          <button class="modal-close" type="button" aria-label="Tutup" @click="closeAvailabilityForm"><X :size="20" /></button>
        </header>
        <p class="availability-intro">Saya yang bertanda tangan di bawah ini, reviewer yang ditunjuk oleh Komite Etik Penelitian Kesehatan (KEPK) Rumah Sakit Universitas Andalas, menyatakan data identitas dan keputusan atas penugasan sebagai berikut:</p>
        <section class="form-section">
          <h3>I. IDENTITAS REVIEWER</h3>
          <dl class="availability-data">
            <div><dt>Nama Lengkap &amp; Gelar</dt><dd>{{ authStore.user?.name || '—' }}</dd></div>
            <div><dt>Bidang Keahlian</dt><dd>{{ reviewerProfile.specialization || 'Belum tercantum pada profil' }}</dd></div>
            <div><dt>Posisi</dt><dd>{{ reviewerProfile.position || 'Belum tercantum pada profil' }}</dd></div>
            <div><dt>Organisasi / Institusi</dt><dd>{{ reviewerProfile.organization || 'Belum tercantum pada profil' }}</dd></div>
            <div><dt>No. HP</dt><dd>{{ reviewerProfile.phone || 'Belum tercantum pada profil' }}</dd></div>
            <div><dt>Alamat</dt><dd>{{ reviewerProfile.address || 'Belum tercantum pada profil' }}</dd></div>
          </dl>
        </section>
        <section class="form-section">
          <h3>II. PROTOKOL PENELITIAN YANG DIREVIEW</h3>
          <dl class="availability-data">
            <div><dt>Judul Penelitian</dt><dd>{{ availabilityAssignment.research_title || '—' }}</dd></div>
            <div><dt>Nama Peneliti Utama</dt><dd>{{ availabilityAssignment.researcher_name || '—' }}</dd></div>
            <div><dt>Jenis Telaah</dt><dd>{{ typeLabel(availabilityAssignment.review_type) }}</dd></div>
          </dl>
        </section>
        <section class="form-section">
          <h3>III. PERNYATAAN {{ availabilityDecision === 'ACCEPT' ? 'KESEDIAAN' : 'PENOLAKAN' }}</h3>
          <p>Dengan ini saya menyatakan bahwa saya:</p>
          <ol class="availability-statements">
            <template v-if="availabilityDecision === 'ACCEPT'">
              <li>Bersedia melakukan telaah etik terhadap protokol tersebut di atas secara objektif, independen, dan profesional sesuai pedoman etik penelitian yang berlaku, serta menyerahkan hasil telaah kepada Sekretariat KEPK RS Universitas Andalas dalam batas waktu yang ditetapkan.</li>
              <li>Menjaga kerahasiaan seluruh dokumen, data, dan informasi protokol yang saya terima, dan tidak menggunakannya untuk kepentingan di luar proses telaah etik.</li>
              <li>Akan segera memberitahukan Ketua KEPK apabila di kemudian hari muncul potensi konflik kepentingan terkait protokol ini.</li>
            </template>
            <template v-else>
              <li>Tidak bersedia melakukan telaah etik terhadap protokol tersebut di atas, sehingga penugasan ini tidak dapat saya laksanakan.</li>
              <li>Tidak dapat menyatakan kesanggupan untuk memenuhi tanggung jawab telaah, termasuk penyelesaian penilaian dalam batas waktu yang ditetapkan.</li>
              <li>Memahami bahwa penolakan ini akan disampaikan kepada Ketua KEPK agar dapat dipertimbangkan penunjukan reviewer pengganti.</li>
            </template>
          </ol>
        </section>
        <section class="form-section">
          <h3>IV. DEKLARASI {{ availabilityDecision === 'ACCEPT' ? 'KONFLIK KEPENTINGAN' : 'PENOLAKAN PENUGASAN' }}</h3>
          <label class="conflict-confirm">
            <input v-model="noConflictConfirmed" type="checkbox" />
            <span v-if="availabilityDecision === 'ACCEPT'">Saya <strong>TIDAK MEMILIKI</strong> hubungan afiliasi, kepentingan pribadi, finansial, maupun profesional dengan peneliti utama dan/atau sponsor yang dapat memengaruhi objektivitas penilaian saya.</span>
            <span v-else>Saya menyatakan <strong>TIDAK BERSEDIA MENERIMA</strong> penugasan telaah etik ini dan memahami bahwa penugasan akan dikembalikan kepada Ketua KEPK untuk ditindaklanjuti.</span>
          </label>
          <p v-if="!noConflictConfirmed" class="conflict-hint">Centang pernyataan di atas untuk mengonfirmasi keputusan Anda.</p>
        </section>
        <footer class="availability-actions">
          <button class="cancel-availability" type="button" :disabled="!!busy" @click="closeAvailabilityForm">Batal</button>
          <button class="submit-availability" type="button" :disabled="!noConflictConfirmed || !!busy" @click="confirmAvailability">
            <LoaderCircle v-if="busy" :size="16" class="spin" /><span v-else>Kirim</span>
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>

<style scoped>
.task-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  color: var(--foreground);
}

.heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
}

h1 {
  margin: 7px 0;
  font-size: clamp(24px, 3vw, 32px);
}

.heading p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.refresh,
.open,
.accept,
.reject {
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
  cursor: pointer;
}

.refresh:hover,
.open.secondary:hover {
  border-color: var(--primary);
  background: var(--color-primary-soft);
}

.refresh:disabled,
.actions button:disabled {
  opacity: .6;
  cursor: wait;
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

/* ===== Tabs ===== */
.tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 12px 14px 0;
  border-bottom: 1px solid var(--border);
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.tabs button.active {
  border-bottom-color: var(--primary);
  color: var(--primary);
  font-weight: 800;
}

.tabs span {
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--muted);
  font-size: 10px;
}

/* ===== Filter ===== */
.toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto;
  align-items: end;
  gap: 12px 16px;
  padding: 16px 20px;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.search-field svg {
  position: absolute;
  left: 12px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.toolbar .search-field input {
  width: 100%;
  padding-left: 36px;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 10px;
}

.toolbar input,
.toolbar select {
  box-sizing: border-box;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--input, var(--border));
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .8rem;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}

.toolbar .search-field input {
  padding-left: 36px;
}

.toolbar select {
  min-width: 150px;
  padding-right: 8px;
  cursor: pointer;
}

.toolbar input:focus,
.toolbar select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-field span {
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 600;
}

.apply-filter,
.reset-filter {
  height: 38px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: .8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.apply-filter {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.apply-filter:hover {
  opacity: .9;
}

.reset-filter {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
}

.reset-filter:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.result-bar {
  padding: 10px 20px;
  border-top: 1px solid var(--border);
}

.count {
  color: var(--muted-foreground);
  font-size: 12px;
}

/* ===== Tabel ===== */
.table-wrap {
  width: 100%;
  overflow-x: auto;
  border-top: 1px solid var(--border);
}

.task-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  font-size: 12px;
}

.task-table th {
  padding: 13px 14px;
  background: var(--background);
  color: var(--muted-foreground);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .03em;
  white-space: nowrap;
}

.task-table td {
  padding: 15px 14px;
  border-top: 1px solid var(--border);
  vertical-align: middle;
  line-height: 1.5;
}

.task-table tbody tr:first-child td {
  border-top: 0;
}

.task-table tbody tr:hover {
  background: var(--color-primary-light);
}

.application-number {
  color: var(--primary);
  font-weight: 800;
  white-space: nowrap;
}

.research-title {
  min-width: 220px;
  max-width: 320px;
  font-weight: 700;
}

.action-heading {
  min-width: 170px;
}

.task-table td:last-child {
  min-width: 170px;
}

.task-table .actions {
  flex-wrap: nowrap;
}

.status {
  display: inline-flex;
  border-radius: var(--radius-full);
  padding: 4px 8px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.status-accepted {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.status-pending {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status-completed {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  flex: 0 0 auto;
}

.accept {
  border-color: var(--color-success-border);
  background: var(--color-success-soft);
  color: var(--color-success);
}

.reject {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--destructive);
}

.open {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: transparent;
}

.open:hover {
  background: #4ba111;
}

.open.secondary {
  background: var(--card);
  color: var(--foreground);
  border-color: var(--border);
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.error {
  background: var(--color-danger-soft);
  color: var(--destructive);
}

.success {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.state,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 42px 16px;
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
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
@media (max-width: 1100px) {
  .toolbar {
    grid-template-columns: 1fr;
  }

  .filter-controls {
    justify-content: flex-start;
  }
}

@media (max-width: 700px) {
  .heading {
    align-items: stretch;
    flex-direction: column;
  }

  .refresh {
    align-self: flex-start;
  }

  .filter-controls > select,
  .filter-controls > .date-field,
  .filter-controls > .apply-filter,
  .filter-controls > .reset-filter {
    flex: 1 1 100%;
  }

  .date-field input {
    width: 100%;
  }

  .open.secondary {
    visibility: hidden;
  }

  .task-table {
    min-width: 1050px;
  }
}

.modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgb(15 23 42 / 55%)}
.availability-modal{width:min(100%,760px);max-height:min(92vh,900px);overflow-y:auto;padding:30px 42px;border:1px solid var(--border);border-radius:18px;background:var(--card);color:var(--foreground);box-shadow:var(--shadow-lg)}
.availability-header{display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:26px}
.availability-header h2{margin:0;text-align:center;font-size:20px;font-weight:800}
.modal-close{position:absolute;right:-22px;top:-18px;display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:50%;background:var(--muted);color:var(--foreground);cursor:pointer}
.availability-intro{margin:0 0 26px;font-size:13px;line-height:1.55;text-align:justify}
.form-section{margin-top:24px}.form-section h3{margin:0 0 12px;font-size:17px;font-weight:800}.form-section>p{margin:0 0 10px;font-size:13px}
.availability-data{display:grid;gap:7px;margin:0;padding-left:16px;font-size:13px}.availability-data div{display:grid;grid-template-columns:155px 12px minmax(0,1fr)}
.availability-data dt::after{content:':';float:right;margin-right:8px}.availability-data dd{grid-column:3;margin:0}
.availability-statements{display:grid;gap:12px;margin:0;padding-left:21px;font-size:13px;line-height:1.55;text-align:justify}
.conflict-confirm{display:flex;align-items:flex-start;gap:12px;font-size:13px;line-height:1.5;cursor:pointer}.conflict-confirm input{width:22px;height:22px;flex:0 0 22px;margin:2px 0 0;accent-color:var(--primary)}
.conflict-hint{margin:8px 0 0 34px!important;color:var(--color-warning);font-size:11px!important}
.availability-actions{display:flex;justify-content:flex-end;gap:16px;margin-top:30px}
.cancel-availability,.submit-availability{min-width:122px;padding:12px 20px;border:0;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.cancel-availability{background:var(--muted);color:var(--foreground)}.submit-availability{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--primary);color:var(--primary-foreground)}
.submit-availability:disabled,.cancel-availability:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:640px){.availability-modal{padding:24px 20px}.availability-header h2{padding:0 20px;font-size:16px}.availability-data div{grid-template-columns:125px 12px minmax(0,1fr);font-size:12px}.form-section h3{font-size:15px}.availability-statements,.availability-intro,.conflict-confirm{font-size:12px}.availability-actions{gap:10px}.cancel-availability,.submit-availability{min-width:0;flex:1}}

</style>