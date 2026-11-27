<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Eye, RefreshCw, XCircle, ChevronLeft, ChevronRight, Download } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getDiklitApplications, type DiklitApplication } from '../../services/diklit/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { exportExcel } from '../../utils/exportExcel'

const router = useRouter()
const applications = ref<DiklitApplication[]>([])
const loading = ref(false)
const errorMessage = ref('')
const search = ref('')
const status = ref('ALL')
const type = ref('ALL')
const period = ref('ALL')
const startDate = ref('')
const endDate = ref('')

const applied = reactive({
  search: '',
  status: 'ALL',
  type: 'ALL',
  period: 'ALL',
  startDate: '',
  endDate: '',
})
const currentPage = ref(1)
const pageSize = 5

const statusMeta: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: 'Menunggu verifikasi', className: 'status status--submitted' },
  ADMIN_REVIEW: { label: 'Sedang diverifikasi', className: 'status status--review' },
  REVISION_REQUIRED: { label: 'Revisi', className: 'status status--revision' },
  REQUIRED_ETHICS: { label: 'Dilanjutkan ke Etik', className: 'status status--required' },
  APPROVED: { label: 'Disetujui', className: 'status status--approved' },
  REJECTED: { label: 'Ditolak', className: 'status status--rejected' },
  PERMIT_ISSUED: { label: 'Surat diterbitkan', className: 'status status--issued' },
}

const types = {
  DATA_AWAL: 'Data Awal',
  IZIN_PENELITIAN: 'Izin Penelitian',
}

const filtered = computed(() => {
  const q = applied.search.trim().toLowerCase()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let from: Date | null = null
  let to: Date | null = null

  if (applied.period === 'TODAY') {
    from = today
    to = new Date(today)
    to.setDate(to.getDate() + 1)
  } else if (applied.period === '7_DAYS') {
    from = new Date(today)
    from.setDate(from.getDate() - 6)
    to = new Date(today)
    to.setDate(to.getDate() + 1)
  } else if (applied.period === '30_DAYS') {
    from = new Date(today)
    from.setDate(from.getDate() - 29)
    to = new Date(today)
    to.setDate(to.getDate() + 1)
  } else if (applied.period === 'CUSTOM' && applied.startDate) {
    from = new Date(`${applied.startDate}T00:00:00`)
    if (applied.endDate) {
      to = new Date(`${applied.endDate}T00:00:00`)
      to.setDate(to.getDate() + 1)
    }
  }

  return applications.value
    .filter((i) => {
      const createdAt = new Date(i.created_at)
      const matchesSearch =
        !q ||
        [i.application_number, i.research_title, i.researcher_name, i.researcher_institution].some(
          (v) => String(v || '').toLowerCase().includes(q)
        )
      const matchesStatus = applied.status === 'ALL' || i.status === applied.status
      const matchesType = applied.type === 'ALL' || i.application_type === applied.type
      const matchesPeriod = !from || (createdAt >= from && (!to || createdAt < to))

      return matchesSearch && matchesStatus && matchesType && matchesPeriod
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const paginatedApplications = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})

const meta = (s: string, application?: DiklitApplication) => {
  if (s === 'REQUIRED_ETHICS' && application?.application_type === 'IZIN_PENELITIAN' && application.requires_ethics) {
    return { label: 'Dilanjutkan ke Etik', className: 'status status--review' }
  }
  return statusMeta[s] ?? { label: s.replaceAll('_', ' '), className: 'status' }
}

const date = (v: string) =>
  new Date(v).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    applications.value = (await getDiklitApplications()).data ?? []
  } catch (e) {
    errorMessage.value = getApiErrorMessage(e, 'Gagal memuat verifikasi.')
  } finally {
    loading.value = false
  }
}

function detail(id: string) {
  router.push({ name: 'diklit-application-detail', params: { id } })
}


function resetFilters() {
  search.value = ''
  status.value = 'ALL'
  type.value = 'ALL'
  period.value = 'ALL'
  startDate.value = ''
  endDate.value = ''
}

function exportFilteredApplications() {
  exportExcel({
    title: 'LAPORAN DATA VERIFIKASI DIKLIT',
    fileName: 'laporan-verifikasi-diklit-' + new Date().toISOString().slice(0, 10),
    subtitle: 'Data mengikuti filter aktif · Total ' + filtered.value.length + ' pengajuan',
    rows: filtered.value,
    columns: [
      { key: 'application_number', title: 'No. Pengajuan', width: 145, value: item => item.application_number },
      { key: 'researcher_name', title: 'Nama Peneliti', width: 180, value: item => item.researcher_name },
      { key: 'researcher_category', title: 'Kategori Peneliti', width: 135, value: item => item.researcher_category },
      { key: 'researcher_email', title: 'Email Peneliti', width: 210, value: item => item.researcher_email },
      { key: 'researcher_nim', title: 'NIM', width: 125, value: item => item.researcher_nim },
      { key: 'researcher_nip', title: 'NIP', width: 150, value: item => item.researcher_nip },
      { key: 'researcher_nik', title: 'NIK', width: 150, value: item => item.researcher_nik },
      { key: 'researcher_phone', title: 'Nomor HP', width: 140, value: item => item.researcher_phone },
      { key: 'researcher_address', title: 'Alamat', width: 260, value: item => item.researcher_address },
      { key: 'researcher_institution', title: 'Institusi', width: 190, value: item => item.researcher_institution },
      { key: 'researcher_faculty', title: 'Fakultas', width: 170, value: item => item.researcher_faculty },
      { key: 'researcher_program_study', title: 'Program Studi', width: 180, value: item => item.researcher_program_study },
      { key: 'researcher_department', title: 'Departemen', width: 170, value: item => item.researcher_department },
      { key: 'research_title', title: 'Judul Penelitian', width: 280, value: item => item.research_title },
      { key: 'application_type', title: 'Jenis Pengajuan', width: 150, value: item => types[item.application_type as keyof typeof types] ?? item.application_type },
      { key: 'status', title: 'Status Verifikasi', width: 175, value: item => meta(item.status, item).label },
      { key: 'created_at', title: 'Tanggal Pengajuan', width: 130, value: item => date(item.created_at) },
      { key: 'updated_at', title: 'Terakhir Diperbarui', width: 145, value: item => date(item.updated_at || item.created_at) },
    ],
  })
}

function previousPage() {
  if (currentPage.value > 1) currentPage.value--
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

function resetCustomPeriod() {
  startDate.value = ''
  endDate.value = ''
}


watch(period, (value) => {
  if (value !== 'CUSTOM') resetCustomPeriod()
})

watch([search, status, type, period, startDate, endDate], () => {
  applied.search = search.value.trim()
  applied.status = status.value
  applied.type = type.value
  applied.period = period.value
  applied.startDate = period.value === 'CUSTOM' ? startDate.value : ''
  applied.endDate = period.value === 'CUSTOM' ? endDate.value : ''
  currentPage.value = 1
})

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value
})

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="heading">
      <div>
        <span class="eyebrow">DIKLIT</span>
        <h1>Verifikasi</h1>
        <p>Daftar seluruh pengajuan yang perlu dipantau dan diverifikasi.</p>
      </div>
      <button class="button" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>

    <section class="card">
      <div class="filters">
        <div class="search-field">
          <input v-model="search" type="search" placeholder="Cari nomor, judul, atau peneliti..."
            />
        </div>

        <div class="filter-controls">
          <select v-model="status" aria-label="Filter status">
            <option value="ALL">Semua status</option>
            <option v-for="(m, s) in statusMeta" :key="s" :value="s">{{ m.label }}</option>
          </select>

          <select v-model="type" aria-label="Filter jenis">
            <option value="ALL">Semua jenis</option>
            <option v-for="(label, key) in types" :key="key" :value="key">{{ label }}</option>
          </select>

          <select v-model="period" aria-label="Filter periode">
            <option value="ALL">Semua periode</option>
            <option value="TODAY">Hari ini</option>
            <option value="7_DAYS">7 hari terakhir</option>
            <option value="30_DAYS">30 hari terakhir</option>
            <option value="CUSTOM">Pilih periode</option>
          </select>

          <template v-if="period === 'CUSTOM'">
            <label class="date-field">
              <span>Mulai</span>
              <input v-model="startDate" type="date" aria-label="Tanggal mulai" />
            </label>
            <label class="date-field">
              <span>Sampai</span>
              <input v-model="endDate" type="date" :min="startDate || undefined" aria-label="Tanggal akhir" />
            </label>
          </template>

          <button class="reset-filter" type="button" @click="resetFilters">Reset</button>
          <button class="export-filter" type="button" :disabled="!filtered.length" @click="exportFilteredApplications">
            <Download :size="15" /> Export {{ filtered.length }} data
          </button>
        </div>
      </div>

      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" />Memuat pengajuan...
      </div>

      <div v-else-if="!filtered.length" class="state">
        <XCircle :size="30" />Tidak ada pengajuan
      </div>

      <template v-else>
        <!-- <div class="result-info">
          Menampilkan <strong>{{ firstItem }}–{{ lastItem }}</strong> dari <strong>{{ filtered.length }}</strong> pengajuan
        </div> -->

        <div class="table">
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
              <tr v-for="i in paginatedApplications" :key="i.id">
                <td>
                  <button class="link" @click="detail(i.id)">
                    <strong>{{ i.application_number }}</strong>
                  </button>
                </td>
                <td>
                  <strong>{{ i.researcher_name || '—' }}</strong>
                  <small>{{ i.researcher_email || '—' }}</small>
                </td>
                <td>{{ types[i.application_type as keyof typeof types] ?? i.application_type }}</td>
                <td><span :class="meta(i.status, i).className">{{ meta(i.status, i).label }}</span></td>
                <td>{{ date(i.created_at) }}</td>
                <td>
                  <button class="detail" @click="detail(i.id)">
                    <Eye :size="16" /> Detail
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <span>Halaman {{ currentPage }} dari {{ totalPages }}</span>
          <div class="pagination-actions">
            <button class="page-button" :disabled="currentPage === 1" @click="previousPage">
              <ChevronLeft :size="16" /> Sebelumnya
            </button>
            <button class="page-button" :disabled="currentPage === totalPages" @click="nextPage">
              Berikutnya <ChevronRight :size="16" />
            </button>
          </div>
        </div>
      </template>
    </section>
  </div>
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
  gap: var(--space-4);
  align-items: flex-start
}

.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em
}

h1 {
  margin: var(--space-2) 0;
  color: var(--foreground);
  font-size: clamp(24px, 3vw, 32px)
}

p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px
}

.button,
.detail,
.page-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  cursor: pointer
}

.button:disabled,
.page-button:disabled {
  opacity: .5;
  cursor: not-allowed
}

.alert {
  padding: 12px;
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}


.filters {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto;
  align-items: end;
  gap: 12px 16px;
  padding: 16px 20px;
  background: var(--color-background);
}

/* Search dengan ikon di dalam input */
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

.search-field input {
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

/* Kontrol form seragam */
.filters input,
.filters select {
  box-sizing: border-box;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .8rem;
  transition: border-color .15s, box-shadow .15s;
}

.filters select {
  min-width: 150px;
  padding-right: 8px;
  cursor: pointer;
}

.filters input:focus,
.filters select:focus {
  outline: none;
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

.reset-filter {
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}

.export-filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--primary-foreground);
  font: inherit;
  font-size: .8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.export-filter:disabled {
  opacity: .45;
  cursor: not-allowed;
}


.result-info {
  padding: 12px var(--space-6);
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 13px
}

.result-info strong {
  color: var(--foreground)
}

.table {
  overflow: auto
}

table {
  width: 100%;
  border-collapse: collapse
}

th {
  padding: 12px var(--space-4);
  background: var(--background);
  color: var(--muted-foreground);
  font-size: 11px;
  text-align: left;
  text-transform: uppercase
}

td {
  padding: 14px var(--space-4);
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--foreground)
}

tr:hover {
  background: var(--color-primary-light); 
}

.link {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer
}

.link strong {
  color: var(--primary)
}

.link span,
small {
  color: var(--muted-foreground)
}

small {
  display: block;
  margin-top: 3px
}

.status {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  background: var(--color-neutral-soft);
  color: var(--color-text-muted)
}

.status--submitted,
.status--require{
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
.status--issued {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.state {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: var(--space-2);
  color: var(--muted-foreground)
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 13px
}

.pagination-actions {
  display: flex;
  gap: var(--space-2)
}

.page-button {
  color: var(--foreground);
  font-size: 13px
}

.spin {
  animation: spin .9s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media(max-width:1100px) {
  .filters {
    grid-template-columns: 1fr;
  }
  .filter-controls {
    justify-content: flex-start;
  }
}

@media(max-width:900px) {
  .filters {
    grid-template-columns: 1fr 1fr
  }
}

@media(max-width:640px) {
  .heading,
  .pagination {
    flex-direction: column;
    align-items: stretch
  }

  .filter-controls > select,
  .filter-controls > .date-field,
  .filter-controls > .reset-filter,
  .filter-controls > .export-filter {
    flex: 1 1 100%;
  }
  .date-field input {
    width: 100%;
  }
  .pagination-actions {
    justify-content: space-between
  }
}
</style>
