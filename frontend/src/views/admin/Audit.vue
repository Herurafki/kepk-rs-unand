<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import apiClient from '../../services/api/client'

interface AuditRole {
  name: string
  user_role_id: number | string
}
interface AuditItem {
  id: string | number
  user_name: string | null
  user_email: string | null
  user_roles: AuditRole[] | string[] | null
  action: string
  method: string | null
  path: string | null
  status_code: number | null
  ip_address: string | null
  user_agent: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  entity_type?: string | null
  entity_id?: string | number | null
  created_at: string
}

const items = ref<AuditItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const search = ref('')
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const actionFilter = ref('')
const actionOptions = [
  { label: 'Semua metode', value: '' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
]
const hasItems = computed(() => items.value.length > 0)
const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 2, totalPages.value - 4))
  const end = Math.min(totalPages.value, start + 4)
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)
})
const successfulCount = computed(() => items.value.filter(item => item.status_code !== null && item.status_code >= 200 && item.status_code < 400).length)
const failedCount = computed(() => items.value.filter(item => item.status_code !== null && item.status_code >= 400).length)
const unknownCount = computed(() => items.value.filter(item => item.status_code === null).length)
let searchTimer: ReturnType<typeof setTimeout> | undefined

async function loadAudit() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await apiClient.get('/admin/audit-trail', {
      params: {
        page: page.value,
        limit: 25,
        search: search.value.trim() || undefined,
        action: actionFilter.value || undefined,
      },
    })
    const data = response.data.data
    items.value = Array.isArray(data?.items) ? data.items : []
    total.value = Number(data?.pagination?.total || 0)
    totalPages.value = Math.max(1, Number(data?.pagination?.total_pages || 1))
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || 'Audit trail gagal dimuat.'
  } finally {
    loading.value = false
  }
}

function updateSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadAudit()
  }, 350)
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function methodClass(method: string | null) {
  return `method-${(method || 'other').toLowerCase()}`
}

function statusLabel(code: number | null) {
  if (code === null) return 'Belum diketahui'
  return code >= 200 && code < 400 ? 'Berhasil' : 'Gagal'
}

function statusClass(code: number | null) {
  if (code === null) return 'status-unknown'
  return code >= 200 && code < 400 ? 'status-success' : 'status-failed'
}

function rolesLabel(roles: AuditItem['user_roles']) {
  if (!Array.isArray(roles) || !roles.length) return 'Role tidak tersedia'
  return roles.map(role => typeof role === 'string' ? role : role.name).filter(Boolean).join(', ')
}

function displayAction(item: AuditItem) {
  return (item.action || 'Aktivitas').replaceAll('_', ' ')
}

function prettyJson(value: Record<string, unknown> | null | undefined) {
  if (!value || !Object.keys(value).length) return 'Tidak ada data'
  return JSON.stringify(value, null, 2)
}

function closeDetail(event: MouseEvent) {
  const details = (event.currentTarget as HTMLElement).closest('details')
  if (details) details.open = false
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || loading.value) return
  page.value = nextPage
  loadAudit()
}

onMounted(loadAudit)
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <main class="audit-page">
    <header class="audit-header">
      <div class="audit-heading">
        <div class="audit-eyebrow"><span class="eyebrow-dot"></span> KEAMANAN SISTEM</div>
        <h1>Audit Trail</h1>
        <p>Pantau aktivitas pengguna dan perubahan yang terjadi di dalam sistem KEPK.</p>
      </div>
      <div class="header-total">
        <span class="total-label">Total aktivitas</span>
        <strong>{{ total.toLocaleString('id-ID') }}</strong>
        <span class="total-caption">Catatan tersimpan</span>
      </div>
    </header>

    <section class="audit-summary" aria-label="Ringkasan aktivitas">
      <article class="summary-card summary-all">
        <span class="summary-icon">▤</span>
        <div><span class="summary-label">Total ditemukan</span><strong>{{ total.toLocaleString('id-ID')
            }}</strong><small>Seluruh hasil sesuai filter</small></div>
      </article>
      <article class="summary-card">
        <span class="summary-icon success-icon">✓</span>
        <div><span class="summary-label">Berhasil</span><strong>{{ successfulCount }}</strong><small>Di halaman
            ini</small></div>
      </article>
      <article class="summary-card">
        <span class="summary-icon failed-icon">!</span>
        <div><span class="summary-label">Gagal</span><strong>{{ failedCount }}</strong><small>Di halaman ini</small>
        </div>
      </article>
      <article class="summary-card">
        <span class="summary-icon unknown-icon">…</span>
        <div><span class="summary-label">Belum diketahui</span><strong>{{ unknownCount }}</strong><small>Status belum
            tercatat</small></div>
      </article>
    </section>

    <section class="audit-panel">
      <div class="panel-heading">
        <div>
          <h2>Riwayat aktivitas</h2>
          <p>Daftar aktivitas terbaru yang tercatat oleh sistem.</p>
        </div>
        <button class="refresh-button" type="button" :disabled="loading" @click="loadAudit">
          <span :class="{ spinning: loading }">↻</span>
          {{ loading ? 'Memuat...' : 'Muat ulang' }}
        </button>
      </div>

      <div class="audit-toolbar">
        <label class="search-field">
          <span aria-hidden="true">⌕</span>
          <input v-model="search" type="search" placeholder="Cari pengguna, email, aktivitas, endpoint, atau IP..."
            @input="updateSearch">
          <kbd>⌕</kbd>
        </label>
        <label class="filter-field">
          <span>Metode</span>
          <select v-model="actionFilter" aria-label="Filter metode HTTP" @change="page = 1; loadAudit()">
            <option v-for="option in actionOptions" :key="option.value" :value="option.value">{{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="loading && !hasItems" class="audit-state">
        <span class="loading-spinner"></span>
        <strong>Memuat catatan aktivitas</strong>
        <p>Sedang mengambil data audit terbaru.</p>
      </div>
      <div v-else-if="errorMessage" class="audit-state audit-error">
        <span class="state-symbol">!</span>
        <strong>Catatan aktivitas gagal dimuat</strong>
        <p>{{ errorMessage }}</p>
        <button type="button" @click="loadAudit">Coba lagi</button>
      </div>
      <div v-else-if="!hasItems" class="audit-state">
        <span class="state-symbol">⌕</span>
        <strong>Tidak ada aktivitas ditemukan</strong>
        <p>Coba ubah kata kunci pencarian atau filter metode.</p>
        <button type="button" @click="search = ''; actionFilter = ''; page = 1; loadAudit()">Reset filter</button>
      </div>

      <div v-else class="audit-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pengguna</th>
              <th>Aktivitas</th>
              <th>Endpoint</th>
              <th>Alamat IP</th>
              <th>Hasil</th>
              <th><span class="sr-only">Detail</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td class="date-cell">
                <strong>{{ formatDate(item.created_at).split(',')[0] }}</strong>
                <small>{{ formatDate(item.created_at).split(',')[1]?.trim() || '' }}</small>
              </td>
              <td class="user-cell">
                <span class="user-avatar">{{ (item.user_name || 'U').trim().charAt(0).toUpperCase() }}</span>
                <span class="user-meta">
                  <strong>{{ item.user_name || 'Pengguna tidak tersedia' }}</strong>
                  <small>{{ item.user_email || rolesLabel(item.user_roles) }}</small>
                  <small class="user-role">{{ rolesLabel(item.user_roles) }}</small>
                </span>
              </td>
              <td class="activity-cell">
                <strong>{{ displayAction(item) }}</strong>
                <span class="method-badge" :class="methodClass(item.method)">{{ item.method || '—' }}</span>
              </td>
              <td class="endpoint-cell">
                <code>{{ item.path || 'Endpoint tidak tersedia' }}</code>
                <small v-if="item.entity_type">{{ item.entity_type }}<template v-if="item.entity_id"> · #{{
                    item.entity_id }}</template></small>
              </td>
              <td class="ip-cell">{{ item.ip_address || '—' }}</td>
              <td>
                <span class="status-badge" :class="statusClass(item.status_code)">
                  <span class="status-dot"></span>
                  {{ statusLabel(item.status_code) }}
                </span>
                <small v-if="item.status_code" class="status-code">{{ item.status_code }}</small>
              </td>
              <td class="detail-cell">
                <details class="audit-detail">
                  <summary aria-label="Lihat detail aktivitas" title="Lihat detail">Detail</summary>
                  <div class="detail-popover">
                    <div class="detail-heading">
                      <div class="detail-heading-copy">
                        <strong>Detail aktivitas #{{ item.id }}</strong>
                        <span>{{ formatDate(item.created_at) }}</span>
                      </div>
                      <button class="detail-close" type="button" aria-label="Tutup detail aktivitas" title="Tutup"
                        @click="closeDetail">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div class="detail-meta">
                      <span><b>Metode</b>{{ item.method || '—' }}</span>
                      <span><b>Status HTTP</b>{{ item.status_code ?? '—' }}</span>
                      <span><b>IP Address</b>{{ item.ip_address || '—' }}</span>
                      <span><b>Role</b>{{ rolesLabel(item.user_roles) }}</span>
                    </div>
                    <div class="detail-data">
                      <strong>Data sebelum perubahan</strong>
                      <pre>{{ prettyJson(item.old_data) }}</pre>
                    </div>
                    <div class="detail-data">
                      <strong>Data setelah perubahan</strong>
                      <pre>{{ prettyJson(item.new_data) }}</pre>
                    </div>
                    <div v-if="item.user_agent" class="detail-agent"><b>Perangkat / Browser</b>{{ item.user_agent }}
                    </div>
                  </div>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="audit-pagination">
        <span>Menampilkan <strong>{{ hasItems ? (page - 1) * 25 + 1 : 0 }}–{{ (page - 1) * 25 + items.length }}</strong>
          dari
          <strong>{{ total }}</strong> aktivitas</span>
        <div class="pagination-controls">
          <button type="button" :disabled="page <= 1 || loading" @click="changePage(page - 1)">← Sebelumnya</button>
          <div class="page-numbers" aria-label="Pilih halaman">
            <button v-for="pageNumber in pageNumbers" :key="pageNumber" type="button"
              :class="{ 'is-current': pageNumber === page }" :aria-current="pageNumber === page ? 'page' : undefined"
              :disabled="loading" @click="changePage(pageNumber)">{{ pageNumber }}</button>
          </div>
          <span class="page-indicator">{{ page }} / {{ totalPages }}</span>
          <button type="button" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">Berikutnya
            →</button>
        </div>
      </footer>
    </section>

    <div class="audit-footnote">
      <span class="footnote-icon">i</span>
      <p><strong>Catatan keamanan:</strong> Audit Trail bersifat hanya-baca. Catatan aktivitas tidak dapat diubah atau
        dihapus melalui aplikasi, termasuk oleh Superadmin.</p>
    </div>
  </main>
</template>

<style scoped>
.audit-page {
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  padding: 30px 28px 48px;
  color: var(--foreground)
}

.audit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px
}

.audit-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 9px;
  color: var(--primary);
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .11em
}

.eyebrow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 0 4px var(--color-primary-soft)
}

.audit-heading h1 {
  margin: 0;
  font-size: 1.85rem;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -.035em
}

.audit-heading p {
  margin: 9px 0 0;
  color: var(--muted-foreground);
  font-size: .91rem
}

.header-total {
  display: flex;
  min-width: 170px;
  flex-direction: column;
  align-items: flex-end;
  padding: 13px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card)
}

.total-label,
.total-caption {
  color: var(--muted-foreground);
  font-size: .75rem
}

.header-total strong {
  margin: 2px 0;
  font-size: 1.65rem;
  line-height: 1.2;
  font-weight: 800;
  font-variant-numeric: tabular-nums
}

.audit-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 17px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.summary-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: 11px;
  background: var(--muted);
  color: var(--foreground);
  font-size: 1.15rem;
  font-weight: 800
}

.summary-icon.success-icon {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.summary-icon.failed-icon {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.summary-icon.unknown-icon {
  background: var(--color-neutral-soft);
  color: var(--muted-foreground)
}

.summary-card>div {
  display: grid;
  min-width: 0;
  gap: 2px
}

.summary-label {
  color: var(--muted-foreground);
  font-size: .76rem;
  font-weight: 600
}

.summary-card strong {
  font-size: 1.35rem;
  line-height: 1.3;
  font-weight: 800;
  font-variant-numeric: tabular-nums
}

.summary-card small {
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: .7rem;
  text-overflow: ellipsis;
  white-space: nowrap
}

.audit-panel {
  overflow: visible;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 17px
}

.panel-heading h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800
}

.panel-heading p {
  margin: 5px 0 0;
  color: var(--muted-foreground);
  font-size: .81rem
}

.refresh-button,
.audit-state button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .8rem;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--transition-base), border-color var(--transition-base)
}

.refresh-button:hover,
.audit-state button:hover {
  border-color: var(--primary);
  background: var(--color-primary-softer)
}

.refresh-button span {
  font-size: 1.05rem
}

.refresh-button:disabled {
  opacity: .55;
  cursor: not-allowed
}

.spinning {
  animation: spin 1s linear infinite
}

.audit-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--color-background)
}

.search-field {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 180px;
  flex: 1;
  padding: 0 11px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--muted-foreground)
}

.search-field>span {
  font-size: 1.25rem
}

.search-field input {
  width: 100%;
  min-width: 0;
  padding: 10px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: .82rem
}

.search-field input::placeholder {
  color: var(--muted-foreground);
  opacity: .8
}

.search-field:focus-within {
  border-color: var(--ring);
  box-shadow: var(--shadow-focus)
}

.search-field kbd {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--muted-foreground);
  font-size: .68rem
}

.filter-field {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted-foreground);
  font-size: .78rem;
  font-weight: 700
}

.filter-field select {
  min-width: 125px;
  padding: 10px 30px 10px 11px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .81rem
}

.audit-table-wrap {
  width: 100%;
  overflow-x: auto
}

table {
  width: 100%;
  min-width: 1080px;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  font-size: .8rem
}

th {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
  white-space: nowrap
}

td {
  padding: 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle
}

tbody tr {
  transition: background var(--transition-fast)
}

tbody tr:hover {
  background: var(--color-primary-softer)
}

tbody tr:last-child td {
  border-bottom: 0
}

.date-cell {
  min-width: 112px;
  white-space: nowrap
}

.date-cell strong {
  display: block;
  font-size: .78rem;
  font-weight: 700
}

.date-cell small {
  display: block;
  margin-top: 4px;
  color: var(--muted-foreground);
  font-size: .72rem
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 175px
}

.user-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--primary);
  font-size: .82rem;
  font-weight: 800
}

.user-meta {
  display: grid;
  min-width: 0;
  gap: 3px
}

.user-meta strong {
  overflow: hidden;
  max-width: 165px;
  font-size: .78rem;
  text-overflow: ellipsis;
  white-space: nowrap
}

.user-meta small {
  overflow: hidden;
  max-width: 165px;
  color: var(--muted-foreground);
  font-size: .69rem;
  text-overflow: ellipsis;
  white-space: nowrap
}

.user-meta .user-role {
  color: var(--primary);
  font-weight: 700
}

.activity-cell {
  min-width: 160px
}

.activity-cell>strong {
  display: block;
  max-width: 190px;
  margin-bottom: 6px;
  font-size: .76rem;
  line-height: 1.4;
  text-transform: capitalize
}

.method-badge {
  display: inline-flex;
  padding: 3px 7px;
  border-radius: 5px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: .65rem;
  font-weight: 800;
  letter-spacing: .04em
}

.method-post {
  background: var(--color-info-soft);
  color: var(--color-info)
}

.method-put,
.method-patch {
  background: var(--color-primary-soft);
  color: var(--primary)
}

.method-delete {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.endpoint-cell {
  min-width: 185px;
  max-width: 260px
}

.endpoint-cell code {
  display: block;
  overflow-wrap: anywhere;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: .7rem;
  line-height: 1.5
}

.endpoint-cell small {
  display: block;
  margin-top: 5px;
  color: var(--muted-foreground);
  font-size: .67rem
}

.ip-cell {
  min-width: 110px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: .7rem;
  white-space: nowrap
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--radius-full);
  font-size: .68rem;
  font-weight: 800;
  white-space: nowrap
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor
}

.status-success {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.status-failed {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.status-unknown {
  background: var(--muted);
  color: var(--muted-foreground)
}

.status-code {
  display: block;
  margin: 5px 0 0 3px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: .67rem
}

.detail-cell {
  width: 72px
}

.audit-detail {
  position: relative
}

.audit-detail summary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--primary);
  font-size: .7rem;
  font-weight: 800;
  cursor: pointer;
  list-style: none;
  white-space: nowrap
}

.audit-detail summary::-webkit-details-marker {
  display: none
}

.audit-detail summary:hover {
  background: var(--color-primary-softer)
}

.detail-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 8px);
  right: 0;
  width: min(440px, calc(100vw - 40px));
  max-height: 65vh;
  overflow: auto;
  padding: 15px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-lg)
}

.detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 11px;
  border-bottom: 1px solid var(--border)
}

.detail-heading-copy {
  display: grid;
  gap: 4px;
  min-width: 0
}

.detail-heading strong {
  font-size: .84rem
}

.detail-heading span {
  color: var(--muted-foreground);
  font-size: .7rem
}

.detail-close {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background var(--transition-base), color var(--transition-base), border-color var(--transition-base)
}

.detail-close:hover {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.detail-close svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round
}

.detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px 0
}

.detail-meta span {
  display: grid;
  gap: 3px;
  color: var(--foreground);
  font-size: .72rem;
  overflow-wrap: anywhere
}

.detail-meta b,
.detail-agent b {
  color: var(--muted-foreground);
  font-size: .66rem;
  text-transform: uppercase;
  letter-spacing: .04em
}

.detail-data {
  margin-top: 10px
}

.detail-data>strong {
  font-size: .73rem
}

.detail-data pre {
  max-height: 150px;
  overflow: auto;
  margin: 6px 0 0;
  padding: 9px;
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: .66rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere
}

.detail-agent {
  display: grid;
  gap: 5px;
  margin-top: 12px;
  color: var(--foreground);
  font-size: .69rem;
  overflow-wrap: anywhere
}

.audit-state {
  display: flex;
  min-height: 245px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 20px;
  text-align: center;
  color: var(--muted-foreground)
}

.audit-state strong {
  color: var(--foreground);
  font-size: .9rem
}

.audit-state p {
  margin: 0 0 7px;
  font-size: .8rem
}

.audit-error .state-symbol {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.state-symbol {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  margin-bottom: 4px;
  border-radius: 50%;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 1.25rem;
  font-weight: 800
}

.loading-spinner {
  width: 27px;
  height: 27px;
  margin-bottom: 7px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin .8s linear infinite
}

.audit-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: .75rem
}

.audit-pagination>span strong {
  color: var(--foreground);
  font-weight: 800
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px
}

.pagination-controls button {
  padding: 8px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .73rem;
  font-weight: 700;
  cursor: pointer
}

.pagination-controls button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary)
}

.pagination-controls button:disabled {
  opacity: .45;
  cursor: not-allowed
}

.page-indicator {
  min-width: 48px;
  text-align: center;
  color: var(--foreground);
  font-weight: 800;
  font-variant-numeric: tabular-nums
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 4px
}

.page-numbers button {
  min-width: 30px;
  padding: 7px 8px
}

.page-numbers button.is-current {
  border-color: var(--primary);
  background: var(--color-primary-soft);
  color: var(--primary)
}

.audit-footnote {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--color-info-soft);
  border-radius: var(--radius-md);
  background: var(--color-info-softer);
  color: var(--muted-foreground)
}

.footnote-icon {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  place-items: center;
  border: 1px solid var(--color-info);
  border-radius: 50%;
  color: var(--color-info);
  font-size: .7rem;
  font-weight: 800
}

.audit-footnote p {
  margin: 1px 0 0;
  font-size: .75rem;
  line-height: 1.5
}

.audit-footnote strong {
  color: var(--foreground)
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media(max-width:1050px) {
  .audit-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr))
  }

  .audit-page {
    padding: 24px 18px 40px
  }
}

@media(max-width:640px) {
  .audit-page {
    padding: 20px 12px 32px
  }

  .audit-header {
    align-items: flex-start;
    flex-direction: column
  }

  .header-total {
    width: 100%;
    align-items: flex-start
  }

  .audit-summary {
    gap: 9px
  }

  .summary-card {
    gap: 9px;
    padding: 12px
  }

  .summary-icon {
    width: 34px;
    height: 34px;
    flex-basis: 34px
  }

  .summary-card strong {
    font-size: 1.15rem
  }

  .panel-heading {
    align-items: flex-start;
    padding: 16px;
    flex-direction: column
  }

  .audit-toolbar {
    align-items: stretch;
    padding: 12px;
    flex-direction: column
  }

  .filter-field {
    justify-content: space-between
  }

  .filter-field select {
    flex: 1
  }

  .audit-pagination {
    align-items: flex-start;
    padding: 13px 14px;
    flex-direction: column
  }

  .pagination-controls {
    width: 100%;
    justify-content: space-between
  }

  .detail-popover {
    position: fixed;
    top: 50%;
    right: 12px;
    left: 12px;
    width: auto;
    max-height: 70vh;
    transform: translateY(-50%)
  }
}

@media(prefers-reduced-motion:reduce) {

  .spinning,
  .loading-spinner {
    animation: none
  }

  tbody tr,
  .refresh-button {
    transition: none
  }
}
</style>
