<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Eye, RefreshCw, AlertCircle, Download } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getSecretariatApplications, type SecretariatApplication } from '../../services/secretariat/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { exportExcel } from '../../utils/exportExcel'

const router = useRouter()
const applications = ref<SecretariatApplication[]>([])
const loading = ref(false)
const errorMessage = ref('')

const search = ref('')
const status = ref('ALL')
const period = ref('ALL')
const startDate = ref('')
const endDate = ref('')
const applied = reactive({ search: '', status: 'ALL', period: 'ALL', startDate: '', endDate: '' })

const statusMapping: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'Disetujui', className: 'status-approved' },
  REJECTED: { label: 'Ditolak', className: 'status-rejected' },
  REVIEW_COMPLETED: { label: 'Selesai direview', className: 'status-review-completed' },
  UNDER_REVIEW: { label: 'Sedang direview', className: 'status-under-review' },
  WAITING_REVIEWER: { label: 'Menunggu reviewer', className: 'status-waiting-reviewer' },
  REVISION_REQUIRED: { label: 'Revisi', className: 'status-revision-required' },
  ADMIN_APPROVED: { label: 'Menunggu Verifikasi', className: 'status-admin-approved' },
  SEKRETARIS_REVIEW: { label: 'Belum Diverifikasi', className: 'status-sekretaris-review' },
  PERMIT_ISSUED: { label: 'Surat diterbitkan', className: 'status-permit-issued' },
}

const filtered = computed(() => {
  const q = applied.search.trim().toLowerCase()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start: number | null = null
  let end: number | null = null
  if (applied.period === 'TODAY') {
    start = today.getTime()
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1); end = tomorrow.getTime() - 1
  } else if (applied.period === '7_DAYS' || applied.period === '30_DAYS') {
    const from = new Date(today); from.setDate(from.getDate() - (applied.period === '7_DAYS' ? 6 : 29)); start = from.getTime()
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1); end = tomorrow.getTime() - 1
  } else if (applied.period === 'CUSTOM') {
    start = applied.startDate ? new Date(applied.startDate + 'T00:00:00').getTime() : null
    end = applied.endDate ? new Date(applied.endDate + 'T23:59:59.999').getTime() : null
  }

  return [...applications.value]
    .filter((i) => {
      if (i.application_type !== 'IZIN_ETIK') return false
      const createdAt = new Date(i.created_at).getTime()
      const matchesSearch =
        !q || [i.application_number, i.researcher_name, i.research_title].some((v) => String(v || '').toLowerCase().includes(q))
      const matchesStatus = applied.status === 'ALL' || i.status === applied.status
      const matchesStart = start === null || createdAt >= start
      const matchesEnd = end === null || createdAt <= end
      return matchesSearch && matchesStatus && matchesStart && matchesEnd
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
})

function resetFilters() {
  search.value = ''; status.value = 'ALL'; period.value = 'ALL'; startDate.value = ''; endDate.value = ''
}

function exportFilteredApplications() {
  exportExcel({
    title: 'LAPORAN DATA PENGAJUAN SEKRETARIAT',
    fileName: 'laporan-pengajuan-sekretariat-' + new Date().toISOString().slice(0, 10),
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
      { key: 'application_type', title: 'Jenis Pengajuan', width: 150, value: item => item.application_type },
      { key: 'review_type', title: 'Jenis Review', width: 130, value: item => item.review_type },
      { key: 'status', title: 'Status', width: 175, value: item => statusMapping[item.status]?.label || item.status },
      { key: 'created_at', title: 'Tanggal Pengajuan', width: 130, value: item => date(item.created_at) },
      { key: 'updated_at', title: 'Terakhir Diperbarui', width: 145, value: item => date(item.updated_at || item.created_at) },
    ],
  })
}

const date = (v: string) =>
  new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    applications.value = (await getSecretariatApplications()).data ?? []
  } catch (e) {
    errorMessage.value = getApiErrorMessage(e, 'Gagal memuat pengajuan.')
  } finally {
    loading.value = false
  }
}

function detail(id: string) {
  router.push({ name: 'secretariat-application-detail', params: { id } })
}
watch(period, value => { if (value !== 'CUSTOM') { startDate.value = ''; endDate.value = '' } })
watch([search, status, period, startDate, endDate], () => {
  applied.search = search.value.trim()
  applied.status = status.value
  applied.period = period.value
  applied.startDate = period.value === 'CUSTOM' ? startDate.value : ''
  applied.endDate = period.value === 'CUSTOM' ? endDate.value : ''
})
onMounted(load)
</script>

<template>
  <div class="page">
    <header class="heading">
      <div>
        <span class="eyebrow">SEKRETARIAT KEPK</span>
        <h1>Pengajuan</h1>
        <p>Verifikasi dan monitoring pengajuan yang menjadi ranah Sekretariat KEPK.</p>
      </div>
      <button class="button" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="errorMessage" class="alert">
      <AlertCircle :size="18" />{{ errorMessage }}
    </div>

    <section class="card">
      <div class="toolbar">
        <div class="search-field">
          <input v-model="search" type="search" placeholder="Cari nomor, judul, atau peneliti..." />
        </div>

        <div class="filter-controls">
          <select v-model="status" aria-label="Filter status">
            <option value="ALL">Semua status</option>
            <option v-for="(v, k) in statusMapping" :key="k" :value="k">{{ v.label }}</option>
          </select>

          <select v-model="period" aria-label="Filter periode">
            <option value="ALL">Semua periode</option><option value="TODAY">Hari ini</option><option value="7_DAYS">7 hari terakhir</option><option value="30_DAYS">30 hari terakhir</option><option value="CUSTOM">Pilih periode</option>
          </select>
          <template v-if="period === 'CUSTOM'">
            <label class="date-field"><span>Mulai</span><input v-model="startDate" type="date" aria-label="Tanggal mulai" /></label>
            <label class="date-field"><span>Sampai</span><input v-model="endDate" type="date" :min="startDate || undefined" aria-label="Tanggal akhir" /></label>
          </template>
          <button class="reset-filter" type="button" @click="resetFilters">Reset</button>
          <button class="export-filter" type="button" :disabled="!filtered.length" @click="exportFilteredApplications"><Download :size="15" /> Export {{ filtered.length }} data</button>
        </div>
      </div>

      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" />Memuat...
      </div>

      <div v-else class="table">
        <table>
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Peneliti</th>
              <th>Judul</th>
              <th>Status</th>
              <th>Tanggal Pengajuan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in filtered" :key="i.id">
              <td><strong>{{ i.application_number }}</strong></td>
              <td>
                <strong>{{ i.researcher_name || '—' }}</strong>
                <small>{{ i.researcher_email || '—' }}</small>
              </td>
              <td class="title">{{ i.research_title || '—' }}</td>
              <td>
                <span class="status" :class="statusMapping[i.status]?.className || ''">
                  {{ statusMapping[i.status]?.label || i.status }}
                </span>
              </td>
              <td>{{ date(i.created_at) }}</td>
              <td>
                <button class="detail" @click="detail(i.id)">
                  <Eye :size="16" /> Detail
                </button>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="6" class="empty">Tidak ada pengajuan yang sesuai.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
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
.detail {
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
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm);
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
  min-width: 170px;
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

.reset-filter,
.export-filter {
  height: 38px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: .8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.reset-filter { border: 1px solid var(--border); background: var(--card); color: var(--foreground); }
.export-filter { display:inline-flex; align-items:center; justify-content:center; gap:7px; height:38px; padding:0 14px; border:1px solid var(--primary); border-radius:var(--radius-md); background:var(--primary); color:var(--primary-foreground); font:inherit; font-size:.8rem; font-weight:600; white-space:nowrap; cursor:pointer; }
.export-filter:disabled { opacity:.45; cursor:not-allowed; }

.reset-filter:hover {
  border-color: var(--primary);
  color: var(--primary);
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

small {
  display: block;
  color: var(--muted-foreground);
  margin-top: 3px;
}

.title {
  max-width: 300px;
}

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

.status-permit-issued,
.status-approved {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status-revision-required,
.status-rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.status-waiting-reviewer,
.status-under-review,
.status-review-completed {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.status-admin-approved,
.status-sekretaris-review {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.empty,
.state {
  text-align: center;
  color: var(--muted-foreground);
  padding: 50px;
}

.alert {
  display: flex;
  gap: 8px;
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
@media (max-width: 1100px) {
  .toolbar {
    grid-template-columns: 1fr;
  }

  .filter-controls {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .heading {
    flex-direction: column;
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

  table {
    min-width: 900px;
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