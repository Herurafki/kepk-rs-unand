<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {  Clock3, FileSearch, LoaderCircle, RefreshCw, Search } from 'lucide-vue-next'
import { getReviewerAssignments, getReviewerReviews } from '../../services/reviewer/review.service'
import { getApiErrorMessage } from '../../services/api/error'

type ReviewHistoryItem = Record<string, unknown> & {
  id?: string | number
  application_id?: string | number
  recommendation?: string
  comment?: string
  created_at?: string
  updated_at?: string
  application_number?: string
  research_title?: string
  researcher_name?: string
  review_type?: string
  status?: string
  rejected_at?: string
  rejected_assignment?: boolean
}

const records = ref<ReviewHistoryItem[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const filter = ref('ALL')

const tabs = [
  { value: 'ALL', label: 'Semua' },
  { value: 'APPROVE', label: 'Direkomendasikan' },
  { value: 'REVISION', label: 'Perlu Revisi' },
  { value: 'REJECT', label: 'Ditolak' },
  { value: 'REJECTED_ASSIGNMENT', label: 'Penugasan Ditolak' },
]

function recommendationOf(item: ReviewHistoryItem) {
  if (item.rejected_assignment) return 'REJECTED_ASSIGNMENT'
  return String(item.recommendation || item.decision || item.result || '').toUpperCase()
}

function recommendationLabel(item: ReviewHistoryItem) {
  const value = recommendationOf(item)
  if (value === 'REJECTED_ASSIGNMENT') return 'Penugasan ditolak'
  if (['APPROVE', 'APPROVED', 'ACCEPT'].includes(value)) return 'Direkomendasikan'
  if (['REVISION', 'REVISE', 'REVISION_REQUIRED'].includes(value)) return 'Perlu Revisi'
  if (['REJECT', 'REJECTED'].includes(value)) return 'Ditolak'
  return value || 'Terkirim'
}

function recommendationClass(item: ReviewHistoryItem) {
  const value = recommendationOf(item)
  if (value === 'REJECTED_ASSIGNMENT') return 'rejected'
  if (['APPROVE', 'APPROVED', 'ACCEPT'].includes(value)) return 'approved'
  if (['REVISION', 'REVISE', 'REVISION_REQUIRED'].includes(value)) return 'revision'
  if (['REJECT', 'REJECTED'].includes(value)) return 'rejected'
  return 'neutral'
}

function dateOf(item: ReviewHistoryItem) {
  const value = item.rejected_at || item.updated_at || item.created_at
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const filtered = computed(() => records.value.filter((item) => {
  const recommendation = recommendationOf(item)
  const matchesFilter = filter.value === 'ALL'
    || (filter.value === 'REJECTED_ASSIGNMENT' && item.rejected_assignment === true)
    || (filter.value === 'APPROVE' && ['APPROVE', 'APPROVED', 'ACCEPT'].includes(recommendation))
    || (filter.value === 'REVISION' && ['REVISION', 'REVISE', 'REVISION_REQUIRED'].includes(recommendation))
    || (filter.value === 'REJECT' && ['REJECT', 'REJECTED'].includes(recommendation))
  const term = search.value.trim().toLowerCase()
  const matchesSearch = !term || [
    item.application_number, item.research_title, item.researcher_name, item.application_id,
  ].some(value => String(value || '').toLowerCase().includes(term))
  return matchesFilter && matchesSearch
}))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [result, assignments] = await Promise.all([getReviewerReviews(), getReviewerAssignments(true)])
    const reviewedRecords = result as ReviewHistoryItem[]
    const rejectedRecords = assignments
      .filter(item => String(item.status || '').toUpperCase() === 'REJECTED')
      .map(item => ({
        ...item,
        id: 'rejected-assignment-' + item.id,
        rejected_assignment: true,
        rejected_at: String(item.rejected_at || item.updated_at || item.assigned_at || ''),
      })) as ReviewHistoryItem[]
    records.value = [...rejectedRecords, ...reviewedRecords]
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Riwayat penilaian reviewer gagal dimuat.')
  } finally {
    loading.value = false
  }
}

const FILTER_KEY = 'penma:reviewer:history-filters'
function resetFilters() { search.value = ''; filter.value = 'ALL' }
watch([search, filter], () => sessionStorage.setItem(FILTER_KEY, JSON.stringify({ search: search.value, filter: filter.value })))
onMounted(() => { try { const saved = JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}'); search.value = typeof saved.search === 'string' ? saved.search : ''; filter.value = typeof saved.filter === 'string' ? saved.filter : 'ALL' } catch { resetFilters() }; load() })
</script>

<template>
  <main class="history-page">
    <header class="page-heading">
      <div>
        <span class="eyebrow">REVIEWER KEPK</span>
        <h1>Riwayat Review</h1>
        <p>Daftar penilaian yang sudah dikirim dan penugasan yang pernah ditolak.</p>
      </div>
      <button class="refresh-button" type="button" :disabled="loading" @click="load">
        <RefreshCw :size="16" :class="{ spinning: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="error" class="inline-error" role="alert">{{ error }}</div>

    <section class="history-card">
      <div class="toolbar">
        <label class="search-field">
          <Search :size="17" />
          <input v-model="search" type="search" placeholder="Cari nomor, judul, peneliti, atau ID pengajuan" />
        </label>
        <span class="result-count">{{ filtered.length }} riwayat</span>
      </div>

      <nav class="filter-tabs" aria-label="Filter rekomendasi">
        <button v-for="tab in tabs" :key="tab.value" type="button" :class="{ active: filter === tab.value }"
          @click="filter = tab.value">
          {{ tab.label }}
        </button>
      </nav>

      <div v-if="loading" class="state">
        <LoaderCircle :size="26" class="spinning" /> Memuat riwayat review...
      </div>
      <div v-else-if="!filtered.length" class="empty-state">
        <FileSearch :size="34" />
        <strong>Belum ada riwayat review</strong>
        <p>Penilaian yang sudah dikirim dan penugasan yang ditolak akan tampil di halaman ini.</p>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pengajuan</th>
              <th>Judul Penelitian</th>
              <th>Nama Peneliti</th>
              <th>Jenis Telaah</th>
              <th>Rekomendasi</th>
              <th>Tanggal Review</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="String(item.id || item.application_id)">
              <td class="application-id">{{ item.application_number || ('Pengajuan #' + (item.application_id || '—')) }}
              </td>
              <td class="research-title">{{ item.research_title || 'Judul belum tersedia' }}</td>
              <td>{{ item.researcher_name || '—' }}</td>
              <td>{{ item.review_type || '—' }}</td>
              <td><span class="recommendation" :class="'recommendation--' + recommendationClass(item)">
                  {{ recommendationLabel(item) }}</span></td>
              <td><span class="date-cell">
                  <Clock3 :size="14" />{{ dateOf(item) }}
                </span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.history-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  color: var(--foreground);
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  color: var(--primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .09em;
}

h1 {
  margin: 7px 0;
  font-size: clamp(24px, 3vw, 32px);
}

.page-heading p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.6;
}

.refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
  white-space: nowrap;
}

.refresh-button:disabled {
  opacity: .6;
  cursor: wait;
}

.history-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
}

.reset-filter { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--card); color: var(--foreground); cursor: pointer; font: inherit }
.reset-filter:hover { border-color: var(--primary); color: var(--primary) }
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-bottom: 1px solid var(--border);
}

.search-field {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 1;
  max-width: 560px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--muted-foreground);
}

.search-field input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
}

.result-count {
  color: var(--muted-foreground);
  font-size: 12px;
  white-space: nowrap;
}

.filter-tabs {
  display: flex;
  gap: 6px;
  padding: 0 18px 14px;
  overflow-x: auto;
}

.filter-tabs button {
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 8px 11px;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.filter-tabs button.active {
  border-color: var(--border);
  background: var(--muted);
  color: var(--foreground);
  font-weight: 700;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

th {
  padding: 12px 16px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}

td {
  padding: 15px 16px;
  border-top: 1px solid var(--border);
  vertical-align: middle;
}

.application-id {
  color: var(--primary);
  font-weight: 750;
  white-space: nowrap;
}

.research-title {
  min-width: 220px;
  max-width: 360px;
  font-weight: 650;
  line-height: 1.5;
}

.recommendation {
  display: inline-flex;
  border-radius: var(--radius-full);
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}

.recommendation--approved {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.recommendation--revision {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.recommendation--rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.recommendation--neutral {
  background: var(--muted);
  color: var(--muted-foreground);
}

.date-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 54px 20px;
  color: var(--muted-foreground);
  text-align: center;
}

.empty-state strong {
  color: var(--foreground);
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.inline-error {
  padding: 12px 14px;
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 13px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .page-heading {
    flex-direction: column;
  }

  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-field {
    max-width: none;
  }
}
</style>
