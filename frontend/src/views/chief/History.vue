<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Eye, RefreshCw, Search } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { getChiefApplications, type ChiefApplication } from '../../services/chief/application.service'
import { getApiErrorMessage } from '../../services/api/error'

const router = useRouter()
const route = useRoute()
const applications = ref<ChiefApplication[]>([])
const loading = ref(false)
const error = ref('')

// Tab: langsung berlaku saat diklik
const tab = ref('ALL')

// Draft: nilai yang sedang diketik/dipilih di form
const search = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const startDate = ref('')
const endDate = ref('')

// Terapan: nilai yang benar-benar dipakai untuk memfilter tabel
const applied = reactive({ search: '', statusFilter: '', typeFilter: '', startDate: '', endDate: '' })

const tabs = [
  ['ALL', 'Semua'],
  ['APPROVED,PERMIT_ISSUED', 'Disetujui'],
  ['REJECTED', 'Ditolak'],
]

const normalizeType = (t?: string | null) => String(t || '').toUpperCase().replace('_', '')

const items = computed(() => {
  const q = applied.search.trim().toLowerCase()
  const start = applied.startDate ? new Date(applied.startDate + 'T00:00:00').getTime() : null
  const end = applied.endDate ? new Date(applied.endDate + 'T23:59:59.999').getTime() : null

  return applications.value
    .filter((a) => {
      if (a.application_type !== 'IZIN_ETIK' || !['APPROVED', 'REJECTED', 'PERMIT_ISSUED'].includes(a.status)) return false
      if (tab.value !== 'ALL' && !tab.value.split(',').includes(a.status)) return false
      if (q && ![a.application_number, a.researcher_name, a.research_title].some((v) => String(v || '').toLowerCase().includes(q))) return false
      if (applied.statusFilter && a.status !== applied.statusFilter) return false
      if (applied.typeFilter && normalizeType(a.review_type) !== applied.typeFilter) return false
      const createdAt = new Date(a.created_at).getTime()
      if (start !== null && createdAt < start) return false
      if (end !== null && createdAt > end) return false
      return true
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
})

function syncFiltersToRoute() {
  router.replace({
    query: {
      ...route.query,
      search: applied.search || undefined,
      tab: tab.value !== 'ALL' ? tab.value : undefined,
      status: applied.statusFilter || undefined,
      type: applied.typeFilter || undefined,
      from: applied.startDate || undefined,
      to: applied.endDate || undefined,
    },
  })
}

function applyFilters() {
  applied.search = search.value.trim()
  applied.statusFilter = statusFilter.value
  applied.typeFilter = typeFilter.value
  applied.startDate = startDate.value
  applied.endDate = endDate.value
  syncFiltersToRoute()
}

function resetFilters() {
  search.value = ''
  statusFilter.value = ''
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

const label = (t?: string | null) =>
  ({ EXEMPTED: 'Exempted', EXPEDITED: 'Expedited', FULLBOARD: 'Full Board' }[normalizeType(t)] || '—')

const status = (s: string) =>
  ({ APPROVED: 'Disetujui', REJECTED: 'Ditolak', PERMIT_ISSUED: 'Surat Diterbitkan' }[s] || s.replaceAll('_', ' '))

const statusClass = (s: string) => ({
  APPROVED: 'status--approved',
  PERMIT_ISSUED: 'status--approved',
  REJECTED: 'status--rejected',
}[s] || '')

async function load() {
  loading.value = true
  error.value = ''
  try {
    applications.value = await getChiefApplications()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Gagal memuat daftar review.')
  } finally {
    loading.value = false
  }
}

function openDetail(a: ChiefApplication) {
  router.push({ name: 'chief-application-detail', params: { id: a.id }, query: route.query })
}

onMounted(() => {
  search.value = String(route.query.search || '')
  tab.value = String(route.query.tab || 'ALL')
  statusFilter.value = String(route.query.status || '')
  typeFilter.value = normalizeType(String(route.query.type || ''))
  startDate.value = String(route.query.from || '')
  endDate.value = String(route.query.to || '')

  Object.assign(applied, {
    search: search.value,
    statusFilter: statusFilter.value,
    typeFilter: typeFilter.value,
    startDate: startDate.value,
    endDate: endDate.value,
  })
  load()
})
</script>

<template>
  <main class="page">
    <header class="heading">
      <div>
        <span class="eyebrow">KETUA KEPK</span>
        <h1>Riwayat Peninjauan</h1>
        <p>Daftar pengajuan yang jenis telaahnya sudah ditetapkan.</p>
      </div>
      <button class="button" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="error" class="alert">{{ error }}</div>

    <section class="card">
      <div class="tabs">
        <button v-for="[value, text] in tabs" :key="value" type="button" :class="{ active: tab === value }"
          @click="selectTab(value)">{{ text }}</button>
      </div>

      <div class="toolbar">
        <div class="search-field">
          <Search :size="16" />
          <input v-model="search" type="search" placeholder="Cari nomor, judul, atau peneliti..."
            @keyup.enter="applyFilters" />
        </div>

        <div class="filter-controls">
          <select v-model="statusFilter" aria-label="Filter status">
            <option value="">Semua status</option>
            <option value="APPROVED">Disetujui</option>
            <option value="PERMIT_ISSUED">Surat Diterbitkan</option>
            <option value="REJECTED">Ditolak</option>
          </select>

          <select v-model="typeFilter" aria-label="Filter jenis telaah">
            <option value="">Semua jenis</option>
            <option value="EXEMPTED">Exempted</option>
            <option value="EXPEDITED">Expedited</option>
            <option value="FULLBOARD">Full Board</option>
          </select>

          <label class="date-field">
            <span>Mulai</span>
            <input v-model="startDate" type="date" aria-label="Tanggal mulai" />
          </label>
          <label class="date-field">
            <span>Sampai</span>
            <input v-model="endDate" type="date" :min="startDate || undefined" aria-label="Tanggal akhir" />
          </label>

          <button class="apply-filter" type="button" @click="applyFilters">Terapkan</button>
          <button class="reset-filter" type="button" @click="resetFilters">Reset filter</button>
        </div>
      </div>

      <div class="result-bar">
        <span class="count">{{ items.length }} pengajuan</span>
      </div>

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
              <th>Jenis Telaah</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in items" :key="a.id">
              <td><strong>{{ a.application_number }}</strong></td>
              <td>{{ a.researcher_name || '—' }}</td>
              <td class="title">{{ a.research_title || '—' }}</td>
              <td><span class="type">{{ label(a.review_type) }}</span></td>
              <td><span :class="['status', statusClass(a.status)]">{{ status(a.status) }}</span></td>
              <td>
                <button class="detail" @click="openDetail(a)">
                  <Eye :size="15" /> Detail
                </button>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="6" class="empty">Tidak ada pengajuan yang sesuai.</td>
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
}

.heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
}

h1 {
  margin: 8px 0;
  color: var(--foreground);
  font-size: clamp(24px, 3vw, 32px);
}

p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px;
}

.button,
.detail,
.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
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
  gap: 6px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  overflow: auto;
}

.tabs button {
  white-space: nowrap;
}

.tabs button:hover {
  border-color: var(--primary);
}

.tabs button.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}

/* ===== Filter ===== */
.toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto;
  align-items: end;
  gap: 12px 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
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
  border-bottom: 1px solid var(--border);
}

.count {
  color: var(--muted-foreground);
  font-size: 12px;
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

th {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted-foreground);
  background: var(--color-overlay-subtle);
}

tbody tr:hover {
  background: var(--color-primary-light);
}

.title {
  max-width: 340px;
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

.status--approved {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status--rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

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
    flex-direction: column;
    align-items: stretch;
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

  table {
    min-width: 950px;
  }
}
</style>