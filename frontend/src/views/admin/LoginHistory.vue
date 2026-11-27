<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import apiClient from '../../services/api/client'

interface LoginItem {
  id: number | string
  user_name: string | null
  email: string
  event_type: string
  status: string
  failure_reason: string | null
  roles: string[] | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

const items = ref<LoginItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

const search = ref('')
const status = ref('')
const from = ref('')
const to = ref('')

const page = ref(1)
const limit = 25
const total = ref(0)
const totalPages = ref(1)

const summary = ref({
  total: 0,
  successful: 0,
  failed: 0,
  today: 0,
})

const hasItems = computed(() => items.value.length > 0)

const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 2, totalPages.value - 4))
  const end = Math.min(totalPages.value, start + 4)
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
})

async function loadHistory() {
  loading.value = true
  errorMessage.value = ''
  try {
    const r = await apiClient.get('/admin/login-history', {
      params: {
        page: page.value,
        limit,
        search: search.value.trim() || undefined,
        status: status.value || undefined,
        from: from.value || undefined,
        to: to.value || undefined,
      },
    })
    const d = r.data?.data
    items.value = Array.isArray(d?.items) ? d.items : []
    total.value = Number(d?.pagination?.total || 0)
    totalPages.value = Math.max(1, Number(d?.pagination?.total_pages || 1))
    summary.value = {
      total: Number(d?.summary?.total || 0),
      successful: Number(d?.summary?.successful || 0),
      failed: Number(d?.summary?.failed || 0),
      today: Number(d?.summary?.today || 0),
    }
  } catch (e: any) {
    errorMessage.value = e.response?.data?.message || 'Riwayat login gagal dimuat.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  loadHistory()
}

function changePage(n: number) {
  if (n < 1 || n > totalPages.value || loading.value) return
  page.value = n
  loadHistory()
}

function date(v: string) {
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d)
}

function eventLabel(i: LoginItem) {
  return i.event_type === 'LOGOUT'
    ? 'Logout'
    : i.status === 'SUCCESS'
    ? 'Login berhasil'
    : 'Login gagal'
}

function roleLabel(v: string[] | null) {
  return Array.isArray(v) && v.length
    ? v
        .map((x) => (x.toUpperCase() === 'ADMIN' ? 'SUPERADMIN' : x.toUpperCase()))
        .join(', ')
    : '—'
}

function browser(v: string | null) {
  if (!v) return 'Tidak diketahui'
  if (/Edg\//i.test(v)) return 'Microsoft Edge'
  if (/Chrome\//i.test(v)) return 'Google Chrome'
  if (/Firefox\//i.test(v)) return 'Mozilla Firefox'
  if (/Safari\//i.test(v) && !/Chrome\//i.test(v)) return 'Safari'
  return v.length > 70 ? v.slice(0, 67) + '…' : v
}

function reason(v: string | null) {
  return v === 'ACCOUNT_INACTIVE'
    ? 'Akun dinonaktifkan'
    : v === 'INVALID_CREDENTIALS'
    ? 'Email atau password tidak valid'
    : v || ''
}

onMounted(loadHistory)
</script>
<template>
    <main class="login-history-page">
        <header class="page-header">
            <div>
                <div class="eyebrow"><span></span> KEAMANAN SISTEM</div>
                <h1>Riwayat Login</h1>
                <p>Pantau aktivitas autentikasi pengguna, termasuk percobaan login yang gagal.</p>
            </div><button class="refresh" :disabled="loading" @click="loadHistory">↻ {{ loading ? 'Memuat...' : 'Muat ulang'}}</button>
        </header>
        <section class="summary-grid">
            <article><small>Total catatan</small><strong>{{ summary.total.toLocaleString('id-ID') }}</strong></article>
            <article><small>Login berhasil</small><strong>{{ summary.successful.toLocaleString('id-ID') }}</strong>
            </article>
            <article><small>Login gagal</small><strong>{{ summary.failed.toLocaleString('id-ID') }}</strong></article>
            <article><small>Aktivitas hari ini</small><strong>{{ summary.today.toLocaleString('id-ID') }}</strong>
            </article>
        </section>
        <section class="panel">
            <div class="panel-head">
                <div>
                    <h2>Aktivitas autentikasi</h2>
                    <p>Catatan terbaru ditampilkan terlebih dahulu.</p>
                </div><b>{{ total.toLocaleString('id-ID') }} catatan</b>
            </div>
            <form class="filters" @submit.prevent="applyFilters"><input v-model="search" type="search"
                    placeholder="Cari nama, email, atau alamat IP..."><select v-model="status">
                    <option value="">Semua status</option>
                    <option value="SUCCESS">Berhasil</option>
                    <option value="FAILED">Gagal</option>
                </select><label>Dari <input v-model="from" type="date"></label><label>Sampai <input v-model="to"
                        type="date"></label><button class="primary" type="submit">Terapkan</button><button type="button"
                    @click="search = ''; status = ''; from = ''; to = ''; applyFilters()">Reset</button></form>
            <div v-if="loading && !hasItems" class="state">Memuat riwayat login...</div>
            <div v-else-if="errorMessage" class="state error"><strong>Gagal memuat riwayat</strong>
                <p>{{ errorMessage }}</p><button @click="loadHistory">Coba lagi</button>
            </div>
            <div v-else-if="!hasItems" class="state">Tidak ada riwayat login yang sesuai filter.</div>
            <div v-else class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>Pengguna</th>
                            <th>Aktivitas</th>
                            <th>Role</th>
                            <th>Alamat IP</th>
                            <th>Perangkat / Browser</th>
                            <th>Hasil</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in items" :key="item.id">
                            <td>{{ date(item.created_at) }}</td>
                            <td><strong>{{ item.user_name || 'Pengguna tidak terdaftar'}}</strong><small>{{ item.email }}</small></td>
                            <td><strong>{{ eventLabel(item) }}</strong><small
                                    class="reason">{{ reason(item.failure_reason) }}</small></td>
                            <td>{{ roleLabel(item.roles) }}</td>
                            <td class="ip">{{ item.ip_address || '—' }}</td>
                            <td class="device" :title="item.user_agent || ''">{{ browser(item.user_agent) }}</td>
                            <td><span class="pill"
                                    :class="item.status === 'SUCCESS' ? 'success' : 'failed'">{{ item.status === 'SUCCESS' ? 'Berhasil' : 'Gagal' }}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <footer class="pagination"><span>Menampilkan
                    <b>{{ hasItems ? (page - 1) * limit + 1 : 0 }}–{{ (page - 1) * limit + items.length }}</b> dari <b>{{ total }}</b>
                    catatan</span>
                <div><button :disabled="page <= 1 || loading" @click="changePage(page - 1)">← Sebelumnya</button><button
                        v-for="n in pageNumbers" :key="n" :class="{ current: n === page }" :disabled="loading"
                        @click="changePage(n)">{{ n }}</button><span>{{ page }} / {{ totalPages }}</span><button
                        :disabled="page >= totalPages || loading" @click="changePage(page + 1)">Berikutnya →</button></div>
            </footer>
        </section>
        <p class="note"><b>Privasi:</b> Password dan token tidak pernah disimpan dalam riwayat login.</p>
    </main>
</template>
<style scoped>
.login-history-page {
    max-width: 1500px;
    margin: auto;
    padding: 30px 28px 48px;
    color: var(--foreground)
}

.page-header,
.panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px
}

.page-header {
    margin-bottom: 22px
}

.eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--primary);
    font-size: .72rem;
    font-weight: 800;
    letter-spacing: .1em
}

.eyebrow span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary)
}

h1 {
    margin: 8px 0 0;
    font-size: 1.85rem;
    letter-spacing: -.03em
}

.page-header p,
.panel-head p {
    margin: 7px 0 0;
    color: var(--muted-foreground);
    font-size: .84rem
}

button,
input,
select {
    font: inherit
}

.refresh,
.filters button,
.pagination button,
.state button {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    color: var(--foreground);
    font-size: .78rem;
    font-weight: 700;
    cursor: pointer
}

.refresh:hover,
.pagination button:hover {
    border-color: var(--primary);
    background: var(--color-primary-soft)
}

button:disabled {
    opacity: .5;
    cursor: not-allowed
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 13px;
    margin-bottom: 20px
}

.summary-grid article {
    display: grid;
    gap: 6px;
    padding: 17px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--card);
    box-shadow: var(--shadow-sm)
}

.summary-grid small {
    color: var(--muted-foreground);
    font-size: .76rem
}

.summary-grid strong {
    font-size: 1.4rem;
    font-weight: 800
}

.panel {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    background: var(--card);
    box-shadow: var(--shadow-sm)
}

.panel-head {
    padding: 20px 22px 16px
}

.panel-head h2 {
    margin: 0;
    font-size: 1.05rem
}

.panel-head>b {
    padding: 6px 10px;
    border-radius: var(--radius-md);
    background: var(--muted);
    font-size: .75rem
}

.filters {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    padding: 14px 20px;
    border-block: 1px solid var(--border);
    background: var(--color-background)
}

.filters>input {
    flex: 1;
    min-width: 210px
}

.filters input,
.filters select {
    min-height: 37px;
    padding: 8px 10px;
    border: 1px solid var(--input);
    border-radius: var(--radius-md);
    background: var(--card);
    color: var(--foreground);
    font-size: .78rem
}

.filters label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--muted-foreground);
    font-size: .75rem
}

.filters label input {
    width: 135px
}

.filters .primary {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--primary-foreground)
}

.table-wrap {
    overflow-x: auto
}

table {
    width: 100%;
    border-collapse: collapse;
    text-align: left
}

th {
    padding: 12px 14px;
    background: var(--color-background);
    color: var(--muted-foreground);
    font-size: .68rem;
    text-transform: uppercase;
    white-space: nowrap
}

td {
    padding: 13px 14px;
    border-top: 1px solid var(--border);
    font-size: .77rem;
    vertical-align: middle
}

td small {
    display: block;
    margin-top: 4px;
    color: var(--muted-foreground);
    font-size: .7rem
}

.ip {
    white-space: nowrap;
    font-family: monospace
}

.device {
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap
}

.reason {
    color: var(--color-danger) !important
}

.pill {
    display: inline-block;
    padding: 5px 8px;
    border-radius: 999px;
    font-size: .7rem;
    font-weight: 800
}

.pill.success {
    background: var(--color-success-soft);
    color: var(--color-success)
}

.pill.failed {
    background: var(--color-danger-soft);
    color: var(--color-danger)
}

.state {
    padding: 48px 18px;
    text-align: center;
    color: var(--muted-foreground);
    font-size: .85rem
}

.error {
    color: var(--color-danger)
}

.pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    color: var(--muted-foreground);
    font-size: .75rem
}

.pagination b {
    color: var(--foreground)
}

.pagination div {
    display: flex;
    align-items: center;
    gap: 4px
}

.pagination div span {
    padding: 0 5px;
    color: var(--foreground);
    font-weight: 800
}

.pagination button {
    padding: 7px 9px
}

.pagination button.current {
    border-color: var(--primary);
    background: var(--color-primary-soft);
    color: var(--primary)
}

.note {
    margin: 14px 2px;
    color: var(--muted-foreground);
    font-size: .77rem
}

.note b {
    color: var(--foreground)
}

@media(max-width:850px) {
    .summary-grid {
        grid-template-columns: repeat(2, 1fr)
    }

    .pagination {
        align-items: flex-start;
        flex-direction: column
    }
}

@media(max-width:600px) {
    .login-history-page {
        padding: 22px 14px
    }

    .page-header {
        align-items: flex-start;
        flex-direction: column
    }

    .filters>* {
        flex: 1
    }

    .pagination div {
        flex-wrap: wrap
    }
}
</style>