<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ClipboardList, Eye, FileEdit, FileText, MoreVertical, RefreshCw } from 'lucide-vue-next'
import { getAllApplications, type ApplicationData } from '../../services/researcher/data-collection.service'
import { getApiErrorMessage } from '../../services/api/error'

type StatusMeta = { label: string; className: string }
type StatusFilterGroup = 'VERIFIKASI_BERKAS' | 'REVIEW' | string

// Field tambahan dari backend (belum ada di tipe ApplicationData)
type ApplicationListItem = ApplicationData & {
  revision_requested_by_roles?: string[] | null
  expedited_revision_requests?: { status?: string }[] | null
}

const applications = ref<ApplicationListItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const statusFilter = ref('ALL')
const typeFilter = ref('ALL')
const statusMeta: Record<string, StatusMeta> = { DRAFT: { label: 'Draft', className: 'status status--draft' }, SUBMITTED: { label: 'Verifikasi Berkas', className: 'status status--submitted' }, ADMIN_REVIEW: { label: 'Verifikasi Berkas', className: 'status status--review' }, REVISION_REQUIRED: { label: 'Revisi', className: 'status status--revision' }, ADMIN_APPROVED: { label: 'Disetujui', className: 'status status--approved' }, REQUIRED_ETHICS: { label: 'Dilanjutkan ke Etik', className: 'status status--review' }, SEKRETARIS_REVIEW: { label: 'Verifikasi Berkas', className: 'status status--review' }, WAITING_REVIEWER: { label: 'Review', className: 'status status--waiting' }, UNDER_REVIEW: { label: 'Review', className: 'status status--review' }, REVIEW_COMPLETED: { label: 'Review', className: 'status status--completed' }, APPROVED: { label: 'Disetujui', className: 'status status--approved' }, REJECTED: { label: 'Ditolak', className: 'status status--rejected' }, PERMIT_ISSUED: { label: 'Surat Diterbitkan', className: 'status status--issued' } }
const statusFilterGroups: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'VERIFIKASI_BERKAS', label: 'Verifikasi Berkas' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'REVISION_REQUIRED', label: 'Revisi' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'PERMIT_ISSUED', label: 'Surat Diterbitkan' },
]
const getStatusFilterGroup = (status: string): StatusFilterGroup => {
  if (['SUBMITTED', 'ADMIN_REVIEW', 'SEKRETARIS_REVIEW'].includes(status)) return 'VERIFIKASI_BERKAS'
  if (['WAITING_REVIEWER', 'UNDER_REVIEW', 'REVIEW_COMPLETED'].includes(status)) return 'REVIEW'
  if (status === 'REQUIRED_ETHICS') return 'APPROVED'
  return status
}
const applicationTypeLabels: Record<string, string> = { DATA_AWAL: 'Pengambilan Data Awal', IZIN_PENELITIAN: 'Pengajuan Penelitian', IZIN_ETIK: 'Pengajuan Kaji Etik' }
const filteredApplications = computed(() => { const q = searchQuery.value.trim().toLowerCase(); return applications.value.filter(a => (!q || [a.application_number, a.research_title, a.research_institution].some(v => String(v || '').toLowerCase().includes(q))) && (statusFilter.value === 'ALL' || getStatusFilterGroup(a.status) === statusFilter.value) && (typeFilter.value === 'ALL' || a.application_type === typeFilter.value)).sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()) })
const getStatusMeta = (status: string, application?: ApplicationData): StatusMeta => {
  if (status === 'REQUIRED_ETHICS' || (status === 'ADMIN_APPROVED' && application?.application_type === 'IZIN_PENELITIAN' && application.requires_ethics === true)) {
    return { label: 'Dilanjutkan ke Etik', className: 'status status--review' }
  }
  return statusMeta[status] ?? { label: status.replaceAll('_', ' '), className: 'status status--default' }
}
const getApplicationTypeLabel = (type: string) => applicationTypeLabels[type] ?? type.replaceAll('_', ' ')
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

// Revisi dari reviewer diunggah lewat halaman Detail, bukan lewat Edit
const isReviewerRevision = (a: ApplicationListItem) =>
  a.status === 'REVISION_REQUIRED' &&
  (a.revision_requested_by_roles?.includes('REVIEWER') === true ||
    a.expedited_revision_requests?.some((r) => r.status === 'OPEN') === true)

// Edit aktif hanya saat perlu revisi dan revisi itu BUKAN dari reviewer
const canEdit = (a: ApplicationListItem) => a.status === 'REVISION_REQUIRED' && !isReviewerRevision(a)

const editTitle = (a: ApplicationListItem) =>
  isReviewerRevision(a)
    ? 'Revisi dari reviewer diunggah melalui halaman Detail'
    : canEdit(a)
      ? 'Edit pengajuan'
      : 'Edit hanya tersedia saat pengajuan perlu direvisi'

const needsEthics = (a: ApplicationData) =>
  a.application_type === 'IZIN_PENELITIAN' &&
  ['REQUIRED_ETHICS', 'ADMIN_APPROVED'].includes(a.status) &&
  a.requires_ethics === true

const hasLetter = (a: ApplicationData) => a.status === 'PERMIT_ISSUED'
const openDetail = (a: ApplicationData) => { window.location.href = '/dashboard/research/status/' + a.id }
const openEdit = (a: ApplicationListItem) => { if (canEdit(a)) window.location.href = '/dashboard/research/status/' + a.id + '/edit' }
const downloadLetter = async (a: ApplicationData) => { if (!hasLetter(a)) return; try { const { default: apiClient } = await import('../../services/api/client'); const response = await apiClient.get('/applications/' + a.id + '/letter', { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = 'surat-' + a.application_number + '.pdf'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url) } catch (error) { errorMessage.value = getApiErrorMessage(error, 'Surat belum dapat diunduh. Silakan coba lagi.') } }
const loadApplications = async () => { loading.value = true; errorMessage.value = ''; try { const response = await getAllApplications(); applications.value = (response.data ?? []) as ApplicationListItem[] } catch (error) { errorMessage.value = getApiErrorMessage(error, 'Gagal memuat daftar pengajuan. Silakan coba lagi.') } finally { loading.value = false } }
onMounted(loadApplications)
</script>

<template>
  <main class="application-status">
    <section class="page-heading">
      <div>
        <p class="eyebrow">PENGAJUAN</p>
        <h1>Daftar Pengajuan</h1>
      </div>
      <div class="heading-actions">
        <button class="refresh-button" type="button" :disabled="loading" @click="loadApplications">
        <RefreshCw :size="18" :class="{ 'is-spinning': loading }" /><span>Muat ulang</span>
        </button>
      </div>
    </section>
    <div v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</div>
    <section class="application-card">
      <div v-if="!loading && applications.length > 0" class="filter-bar">
        <div class="filter-field filter-field--search"><label for="application-search">Cari</label><input
            id="application-search" v-model="searchQuery" type="search" placeholder="Nomor, judul, atau institusi...">
        </div>
        <div class="filter-field"><label for="application-status-filter">Status</label><select
            id="application-status-filter" v-model="statusFilter">
            <option v-for="group in statusFilterGroups" :key="group.value" :value="group.value">{{ group.label }}</option>
          </select></div>
        <div class="filter-field"><label for="application-type-filter">Jenis Pengajuan</label><select
            id="application-type-filter" v-model="typeFilter">
            <option value="ALL">Semua Jenis</option>
            <option v-for="(label, type) in applicationTypeLabels" :key="type" :value="type">{{ label }}</option>
          </select></div>
        <button v-if="searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'" class="clear-filter" type="button"
          @click="searchQuery = ''; statusFilter = 'ALL'; typeFilter = 'ALL'">Reset</button>
      </div>
      <div v-if="loading" class="state-container">
        <RefreshCw :size="32" class="is-spinning" />
        <p>Memuat daftar pengajuan...</p>
      </div>
      <div v-else-if="!applications.length" class="state-container state-container--empty">
        <div class="empty-icon">
          <ClipboardList :size="34" />
        </div>
        <h2>Belum Ada Pengajuan</h2>
        <p>Pengajuan yang Anda kirim akan muncul di halaman ini.</p>
        <RouterLink to="/dashboard/research/data-collection" class="primary-button">Buat Pengajuan</RouterLink>
      </div>
      <div v-else-if="!filteredApplications.length" class="state-container state-container--empty">
        <div class="empty-icon">
          <ClipboardList :size="34" />
        </div>
        <h2>Pengajuan Tidak Ditemukan</h2>
        <p>Tidak ada pengajuan yang sesuai dengan filter yang dipilih.</p>
      </div>
      <div v-else class="table-wrapper">
        <table class="application-table">
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Judul Penelitian</th>
              <th>Pengajuan</th>
              <th>Status</th>
              <th>Tanggal Submit</th>
              <th class="action-column">Detail</th>
              <th class="action-column">Edit</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="application in filteredApplications" :key="application.id">
              <td class="application-number">{{ application.application_number }}</td>
              <td class="research-title"><span>{{ application.research_title || 'Tanpa judul' }}</span></td>
              <td class="application-type">{{ getApplicationTypeLabel(application.application_type) }}</td>
              <td><span :class="getStatusMeta(application.status, application).className">{{ getStatusMeta(application.status, application).label
                  }}</span><span v-if="needsEthics(application)" class="ethics-required-badge">Etik diperlukan</span><span
                  v-if="isReviewerRevision(application)" class="ethics-required-badge">Revisi reviewer · buka Detail</span>
              </td>
              <td class="submitted-date">{{ formatDate(application.created_at) }}</td>
              <td class="action-cell"><button class="icon-button" type="button" title="Lihat detail"
                  @click="openDetail(application)">
                  <Eye :size="20" />
                </button></td>
              <td class="action-cell"><button class="icon-button"
                  :class="{ 'icon-button--disabled': !canEdit(application) }" type="button"
                  :disabled="!canEdit(application)" :title="editTitle(application)" @click="openEdit(application)">
                  <FileEdit :size="19" />
                </button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p v-if="filteredApplications.length" class="table-note">
      <FileText :size="15" /> Menampilkan {{ filteredApplications.length }} dari {{ applications.length }} pengajuan
      Anda.
    </p>
    <div class="mobile-hint">
      <MoreVertical :size="16" /><span>Geser tabel ke samping untuk melihat seluruh kolom.</span>
    </div>
  </main>
</template>

<style scoped>
.application-status {
  width: 100%;
  max-width: 1226px;
  margin: 0 auto;
  color: var(--foreground)
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: 4px 0 24px
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--primary);
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .12em
}

.page-heading h1 {
  margin: 0;
  color: var(--primary);
  font-size: clamp(1.6rem, 2.2vw, 2rem);
  font-weight: 700;
  letter-spacing: -.02em;
  text-transform: uppercase
}

.heading-actions { display: flex; align-items: center; gap: 10px; }

.refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--primary);
  font: inherit;
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer
}

.refresh-button:disabled {
  opacity: .65;
  cursor: not-allowed
}

.filter-bar {
  display: grid;
  grid-template-columns: minmax(240px, 1.5fr) minmax(170px, .7fr) minmax(190px, .8fr) auto;
  gap: 12px;
  align-items: end;
  padding: 16px;
  border-bottom: 1px solid var(--border)
}

.filter-field {
  display: grid;
  gap: 6px
}

.filter-field label {
  color: var(--muted-foreground);
  font-size: .72rem;
  font-weight: 700
}

.filter-field input,
.filter-field select {
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--foreground);
  font: inherit;
  font-size: .82rem
}

.clear-filter {
  min-height: 40px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--primary);
  font: inherit;
  font-size: .8rem;
  font-weight: 600
}

.application-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-md)
}

.table-wrapper {
  width: 100%;
  overflow-x: auto
}

.application-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  table-layout: fixed
}

.application-table th,
.application-table td {
  padding: 16px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle
}

.application-table th {
  background: var(--background);
  color: var(--foreground);
  font-size: .82rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap
}

.application-table td {
  background: var(--color-surface);
  color: var(--foreground);
  font-size: .84rem
}

.application-table tbody tr:last-child td {
  border-bottom: 0
}

.application-table tbody tr:hover td {
  background: var(--color-primary-light);
}

.application-table th:nth-child(1),
.application-table td:nth-child(1) {
  width: 125px
}

.application-table th:nth-child(2),
.application-table td:nth-child(2) {
  width: 27%
}

.application-table th:nth-child(3),
.application-table td:nth-child(3) {
  width: 150px
}

.application-table th:nth-child(4),
.application-table td:nth-child(4) {
  width: 145px
}

.application-table th:nth-child(5),
.application-table td:nth-child(5) {
  width: 135px
}

.application-table th:nth-child(n+6),
.application-table td:nth-child(n+6) {
  width: 62px;
  text-align: center
}

.application-number {
  font-weight: 600;
  color: var(--foreground) !important;
  white-space: nowrap
}

.research-title {
  line-height: 1.45;
  word-break: break-word
}

.application-type {
  line-height: 1.35
}

.submitted-date {
  white-space: nowrap
}

.status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 31px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: .78rem;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  white-space: nowrap
}

.status--draft,
.status--waiting {
  color: var(--color-warning);
  background: var(--color-warning-soft)
}

.status--submitted,
.status--review {
  color: var(--accent-foreground);
  background: var(--color-success-soft)
}

.status--revision {
  color: var(--destructive-foreground);
  background: var(--destructive)
}

.status--approved,
.status--completed,
.status--issued {
  color: var(--accent-foreground);
  background: var(--color-success-soft)
}

.status--rejected {
  color: var(--destructive);
  background: var(--color-danger-soft)
}

.status--default {
  color: var(--muted-foreground);
  background: var(--color-neutral-soft)
}

.ethics-required-badge {
  display: block;
  margin-top: 6px;
  color: var(--color-warning);
  font-size: .68rem;
  font-weight: 700
}

.action-cell {
  text-align: center !important
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--card);
  color: var(--primary);
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease, opacity .15s ease
}

.icon-button:hover:not(:disabled) {
  background: var(--muted);
  border-color: var(--primary)
}

.icon-button--disabled,
.icon-button:disabled {
  opacity: .4;
  cursor: not-allowed
}

.state-container {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-foreground);
  text-align: center
}

.state-container p {
  margin: 0;
  font-size: .88rem
}

.state-container--empty {
  padding: 40px 20px
}

.state-container--empty h2 {
  margin: 4px 0 0;
  color: var(--foreground);
  font-size: 1.05rem
}

.state-container--empty p {
  max-width: 420px;
  line-height: 1.5
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--muted);
  color: var(--primary)
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  margin-top: 8px;
  padding: 0 16px;
  border-radius: 9px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: .84rem;
  font-weight: 600;
  text-decoration: none
}

.alert {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: .84rem
}

.alert--error {
  border: 1px solid var(--destructive);
  background: var(--destructive-muted);
  color: var(--destructive)
}

.table-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 2px 0;
  color: var(--muted-foreground);
  font-size: .76rem
}

.mobile-hint {
  display: none;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  color: var(--muted-foreground);
  font-size: .72rem
}

.is-spinning {
  animation: spin .8s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media (max-width: 900px) {
  .filter-bar {
    grid-template-columns: 1fr 1fr
  }

  .filter-field--search {
    grid-column: 1 / -1
  }

  .clear-filter {
    width: fit-content
  }

  .mobile-hint {
    display: flex
  }
}

@media (max-width: 640px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column
  }

  .refresh-button {
    align-self: stretch;
    justify-content: center
  }

  .filter-bar {
    grid-template-columns: 1fr
  }

  .filter-field--search {
    grid-column: auto
  }
}
</style>