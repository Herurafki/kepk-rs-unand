<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import apiClient from '../../services/api/client'

interface ApplicationItem {
  id: number | string
  application_number: string
  application_type: string
  status: string
  research_title: string | null
  created_at: string
  updated_at: string
  researcher_name: string
  researcher_email: string
  researcher_institution: string | null
  parent_application_number: string | null
  is_active: boolean
  is_overdue: boolean
}
interface StatusSummary {
  status: string;
  total: number;
}

interface HistoryItem {
  id: number | string;
  previous_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
  changed_by_name: string | null;
  changed_by_roles: string[];
}

const items = ref<ApplicationItem[]>([]);
const loading = ref(false),
  errorMessage = ref('');
const search = ref(''),
  status = ref(''),
  type = ref(''),
  from = ref(''),
  to = ref('');

const page = ref(1),
  limit = 20,
  total = ref(0),
  totalPages = ref(1);
  
const summary = ref({
  total: 0,
  active: 0,
  completed: 0,
  rejected: 0,
  overdue: 0,
  by_status: [] as StatusSummary[],
  by_type: [] as { application_type: string; total: number }[],
});
const detailOpen = ref(false),
  detailLoading = ref(false),
  selected = ref<ApplicationItem | null>(null);
const history = ref<HistoryItem[]>([]);

const hasItems = computed(() => items.value.length > 0);
const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 2, totalPages.value - 4));
  const end = Math.min(totalPages.value, start + 4);
  return Array.from(
    { length: Math.max(0, end - start + 1) },
    (_, i) => start + i
  );
});
const maxStatusCount = computed(() =>
  Math.max(1, ...summary.value.by_status.map((x) => Number(x.total)))
);

const typeLabels: Record<string, string> = {
  DATA_AWAL: 'Data Awal',
  IZIN_PENELITIAN: 'Izin Penelitian',
  IZIN_ETIK: 'Izin Etik',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Diajukan',
  ADMIN_REVIEW: 'Verifikasi Admin',
  ADMIN_APPROVED: 'Disetujui Admin',
  SEKRETARIS_REVIEW: 'Review Sekretariat',
  WAITING_REVIEWER: 'Menunggu Reviewer',
  UNDER_REVIEW: 'Dalam Review',
  REVIEW_COMPLETED: 'Review Selesai',
  REVISION_REQUIRED: 'Perlu Revisi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  NOT_ASSESSABLE: 'Tidak Dapat Dinilai',
  PERMIT_ISSUED: 'Izin Diterbitkan',
  BEBAS_KAJI_ETIK: 'Bebas Kaji Etik',
  IZIN_ETIK: 'Izin Etik',
};

function typeLabel(v: string) {
  return typeLabels[v] || v.replaceAll('_', ' ');
}

function statusLabel(v: string) {
  return statusLabels[v] || v.replaceAll('_', ' ');
}

function date(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
}

async function loadSummary() {
  try {
    const r = await apiClient.get('/admin/application-monitoring/summary', {
      params: { from: from.value || undefined, to: to.value || undefined },
    });
    const d = r.data?.data || {};
    summary.value = {
      total: Number(d.total || 0),
      active: Number(d.active || 0),
      completed: Number(d.completed || 0),
      rejected: Number(d.rejected || 0),
      overdue: Number(d.overdue || 0),
      by_status: Array.isArray(d.by_status) ? d.by_status : [],
      by_type: Array.isArray(d.by_type) ? d.by_type : [],
    };
  } catch (e: any) {
    errorMessage.value =
      e.response?.data?.message || 'Ringkasan monitoring gagal dimuat.';
    throw e;
  }
}

async function loadList() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const r = await apiClient.get('/admin/application-monitoring', {
      params: {
        page: page.value,
        limit,
        search: search.value.trim() || undefined,
        status: status.value || undefined,
        type: type.value || undefined,
        from: from.value || undefined,
        to: to.value || undefined,
      },
    });
    const d = r.data?.data || {};
    items.value = Array.isArray(d.items) ? d.items : [];
    total.value = Number(d.pagination?.total || 0);
    totalPages.value = Math.max(1, Number(d.pagination?.total_pages || 1));
  } catch (e: any) {
    errorMessage.value =
      e.response?.data?.message || 'Daftar pengajuan gagal dimuat.';
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.allSettled([loadSummary(), loadList()]);
}

function applyFilters() {
  page.value = 1;
  refreshAll();
}

function changePage(n: number) {
  if (n < 1 || n > totalPages.value || loading.value) return;
  page.value = n;
  loadList();
}

async function openHistory(item: ApplicationItem) {
  selected.value = item;
  detailOpen.value = true;
  detailLoading.value = true;
  history.value = [];
  try {
    const r = await apiClient.get(
      `/admin/application-monitoring/${item.id}/history`
    );
    history.value = Array.isArray(r.data?.data?.history)
      ? r.data.data.history
      : [];
  } catch (e: any) {
    errorMessage.value =
      e.response?.data?.message || 'Riwayat status gagal dimuat.';
  } finally {
    detailLoading.value = false;
  }
}

function closeHistory() {
  detailOpen.value = false;
  selected.value = null;
  history.value = [];
}
onMounted(refreshAll)
</script>

<template>
  <main class="monitoring-page">
    <header class="page-header">
      <div>
        <div class="eyebrow"><span></span> PEMANTAUAN SISTEM</div>
        <h1>Monitoring Pengajuan</h1>
        <p>Pantau seluruh pengajuan KEPK, status proses, dan riwayat perpindahan tahap.</p>
      </div><button class="refresh" :disabled="loading" @click="refreshAll">↻ {{ loading ? 'Memuat...' : 'Muat ulang'}}</button>
    </header>

    <section class="summary-grid">
      <article class="summary-card"><small>Total
          pengajuan</small><strong>{{ summary.total.toLocaleString('id-ID') }}</strong><span>Seluruh jenis layanan</span>
      </article>
      <article class="summary-card"><small>Dalam
          proses</small><strong>{{ summary.active.toLocaleString('id-ID') }}</strong><span>Belum mencapai status
          akhir</span></article>
      <article class="summary-card"><small>Izin
          diterbitkan</small><strong>{{ summary.completed.toLocaleString('id-ID') }}</strong><span>Pengajuan
          selesai</span></article>
      <article class="summary-card"><small>Perlu
          perhatian</small><strong>{{ summary.overdue.toLocaleString('id-ID') }}</strong><span>Aktif tanpa pembaruan lebih
          dari 7 hari</span></article>
    </section>

    <section class="analytics-grid">
      <article class="panel analytics-panel">
        <div class="section-title">
          <div>
            <h2>Pengajuan berdasarkan status</h2>
            <p>Distribusi status seluruh pengajuan.</p>
          </div>
        </div>
        <div v-if="summary.by_status.length" class="status-bars">
          <div v-for="row in summary.by_status" :key="row.status" class="bar-row">
            <div><span>{{ statusLabel(row.status) }}</span><b>{{ row.total }}</b></div>
            <div class="bar-track"><span :style="{ width: (Number(row.total) / maxStatusCount * 100) + '%' }"></span></div>
          </div>
        </div>
        <div v-else class="empty-chart">Belum ada data status.</div>
      </article>
      <article class="panel analytics-panel">
        <div class="section-title">
          <div>
            <h2>Jenis pengajuan</h2>
            <p>Jumlah pengajuan per layanan.</p>
          </div>
        </div>
        <div v-if="summary.by_type.length" class="type-list">
          <div v-for="row in summary.by_type" :key="row.application_type" class="type-row">
            <div><span class="type-dot"></span><span>{{ typeLabel(row.application_type) }}</span></div>
            <strong>{{ row.total }}</strong>
          </div>
        </div>
        <div v-else class="empty-chart">Belum ada data jenis pengajuan.</div>
      </article>
    </section>

    <section class="panel list-panel">
      <div class="section-title list-heading">
        <div>
          <h2>Daftar seluruh pengajuan</h2>
          <p>Pilih pengajuan untuk melihat riwayat perubahannya.</p>
        </div><span class="count-chip">{{ total.toLocaleString('id-ID') }} data</span>
      </div>
      <form class="filters" @submit.prevent="applyFilters"><input v-model="search" type="search"
          placeholder="Cari nomor, judul, peneliti, email..."><select v-model="type">
          <option value="">Semua jenis</option>
          <option value="DATA_AWAL">Data Awal</option>
          <option value="IZIN_PENELITIAN">Izin Penelitian</option>
          <option value="IZIN_ETIK">Izin Etik</option>
        </select><select v-model="status">
          <option value="">Semua status</option>
          <option v-for="row in summary.by_status" :key="row.status" :value="row.status">{{ statusLabel(row.status) }}
          </option>
        </select><label>Dari <input v-model="from" type="date"></label><label>Sampai <input v-model="to"
            type="date"></label><button class="primary" type="submit">Terapkan</button><button type="button"
          @click="search = ''; type = ''; status = ''; from = ''; to = ''; applyFilters()">Reset</button></form>
      <div v-if="loading && !hasItems" class="state">Memuat data pengajuan...</div>
      <div v-else-if="errorMessage && !hasItems" class="state error"><strong>Data gagal dimuat</strong>
        <p>{{ errorMessage }}</p><button @click="refreshAll">Coba lagi</button>
      </div>
      <div v-else-if="!hasItems" class="state">Tidak ada pengajuan yang sesuai filter.</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nomor / tanggal</th>
              <th>Peneliti</th>
              <th>Judul penelitian</th>
              <th>Jenis</th>
              <th>Status saat ini</th>
              <th>Pembaruan</th>
              <th>Monitoring</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td><strong>{{ item.application_number }}</strong><small>{{ date(item.created_at) }}</small><small
                  v-if="item.parent_application_number" class="parent">Turunan dari
                  {{ item.parent_application_number }}</small></td>
              <td><strong>{{ item.researcher_name }}</strong><small>{{ item.researcher_email }}</small></td>
              <td class="title-cell">{{ item.research_title || '—' }}</td>
              <td>{{ typeLabel(item.application_type) }}</td>
              <td><span class="status-pill" :class="{ terminal: !item.is_active }">{{ statusLabel(item.status) }}</span></td>
              <td>{{ date(item.updated_at) }}</td>
              <td><span v-if="item.is_overdue" class="attention">Tertunda &gt; 7 hari</span><span
                  v-else-if="item.is_active" class="active">Aktif</span><span v-else class="done">Selesai</span></td>
              <td><button class="detail-button" type="button" @click="openHistory(item)">Riwayat →</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="pagination"><span>Menampilkan
          <b>{{ hasItems ? (page - 1) * limit + 1 : 0 }}–{{ (page - 1) * limit + items.length }}</b> dari <b>{{ total }}</b> pengajuan</span>
        <div><button :disabled="page <= 1 || loading" @click="changePage(page - 1)">← Sebelumnya</button><button
            v-for="n in pageNumbers" :key="n" :class="{ current: n === page }" :disabled="loading"
            @click="changePage(n)">{{ n }}</button><span>{{ page }} / {{ totalPages }}</span><button
            :disabled="page >= totalPages || loading" @click="changePage(page + 1)">Berikutnya →</button></div>
      </footer>
    </section>

    <div v-if="detailOpen" class="modal-backdrop" @click.self="closeHistory" @keydown.esc="closeHistory">
      <section class="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <header>
          <div><small>DETAIL MONITORING</small>
            <h2 id="history-title">{{ selected?.application_number }}</h2>
            <p>{{ selected?.researcher_name }} · {{ selected ? typeLabel(selected.application_type) : '' }}</p>
          </div><button class="close-button" aria-label="Tutup detail" @click="closeHistory">×</button>
        </header>
        <div class="modal-body">
          <div class="current-status"><small>Status saat
              ini</small><strong>{{ selected ? statusLabel(selected.status) : '—' }}</strong><span>{{ selected?.research_title || 'Judul tidak tersedia'}}</span></div>
          <h3>Riwayat perpindahan status</h3>
          <div v-if="detailLoading" class="state">Memuat riwayat...</div>
          <div v-else-if="!history.length" class="state">Belum ada riwayat status.</div>
          <ol v-else class="timeline">
            <li v-for="entry in history" :key="entry.id"><span class="timeline-dot"></span>
              <div>
                <div class="timeline-head">
                  <strong>{{ statusLabel(entry.new_status) }}</strong><time>{{ date(entry.created_at) }}</time></div>
                <p v-if="entry.previous_status" class="transition">{{ statusLabel(entry.previous_status) }} <span>→</span>
                  {{ statusLabel(entry.new_status) }}</p>
                <p v-if="entry.note" class="note">{{ entry.note }}</p><small>{{ entry.changed_by_name || 'Sistem' }}<template
                    v-if="entry.changed_by_roles?.length"> · {{ entry.changed_by_roles.join(', ') }}</template></small>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.monitoring-page {
  max-width: 1600px;
  margin: auto;
  padding: 28px 26px 48px;
  color: var(--foreground)
}

.page-header,
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px
}

.page-header {
  margin-bottom: 20px
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  font-size: .7rem;
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
  font-size: 1.8rem;
  letter-spacing: -.03em
}

.page-header p,
.section-title p {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  font-size: .82rem
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
  font-size: .77rem;
  font-weight: 700;
  cursor: pointer
}

.refresh:hover,
.pagination button:hover,
.detail-button:hover {
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
  gap: 12px;
  margin-bottom: 14px
}

.summary-card {
  display: grid;
  gap: 5px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.summary-card small {
  color: var(--muted-foreground);
  font-size: .75rem
}

.summary-card strong {
  font-size: 1.55rem;
  font-weight: 800
}

.summary-card span {
  color: var(--muted-foreground);
  font-size: .7rem
}

.analytics-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 14px;
  margin-bottom: 14px
}

.panel {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.analytics-panel {
  padding: 18px 20px
}

.section-title h2 {
  margin: 0;
  font-size: 1rem
}

.status-bars,
.type-list {
  display: grid;
  gap: 13px;
  margin-top: 19px
}

.bar-row>div:first-child,
.type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: .77rem
}

.bar-row b,
.type-row strong {
  font-variant-numeric: tabular-nums
}

.bar-track {
  height: 7px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--muted)
}

.bar-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  transition: width .25s ease
}

.type-row>div {
  display: flex;
  align-items: center;
  gap: 9px
}

.type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary)
}

.empty-chart {
  padding: 35px 8px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: .8rem
}

.list-panel {
  margin-top: 14px
}

.list-heading {
  padding: 19px 20px 15px
}

.count-chip {
  padding: 6px 9px;
  border-radius: var(--radius-md);
  background: var(--muted);
  font-size: .73rem;
  font-weight: 800
}

.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 13px 17px;
  border-block: 1px solid var(--border);
  background: var(--color-background)
}

.filters>input {
  flex: 1;
  min-width: 210px
}

.filters input,
.filters select {
  min-height: 36px;
  padding: 7px 9px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font-size: .75rem
}

.filters label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted-foreground);
  font-size: .72rem
}

.filters label input {
  width: 130px
}

.filters .primary {
  border-color: var(--primary);
  background: var(--primary);
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
  padding: 11px 12px;
  background: var(--color-background);
  color: var(--muted-foreground);
  font-size: .66rem;
  text-transform: uppercase;
  white-space: nowrap
}

td {
  padding: 12px;
  border-top: 1px solid var(--border);
  font-size: .74rem;
  vertical-align: middle
}

td small {
  display: block;
  margin-top: 4px;
  color: var(--muted-foreground);
  font-size: .68rem
}

.title-cell {
  max-width: 190px;
  min-width: 140px
}

.parent {
  color: var(--primary) !important
}

.status-pill {
  display: inline-block;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--primary);
  font-size: .68rem;
  font-weight: 800;
  white-space: nowrap
}

.status-pill.terminal {
  background: var(--muted);
  color: var(--muted-foreground)
}

.attention,
.active,
.done {
  font-size: .7rem;
  font-weight: 800;
  white-space: nowrap
}

.attention {
  color: var(--color-danger)
}

.active {
  color: var(--primary)
}

.done {
  color: var(--color-success)
}

.detail-button {
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--primary);
  font-size: .7rem;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap
}

.state {
  padding: 42px 16px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: .82rem
}

.error {
  color: var(--color-danger)
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 17px;
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: .73rem
}

.pagination b {
  color: var(--foreground)
}

.pagination>div {
  display: flex;
  align-items: center;
  gap: 4px
}

.pagination button {
  padding: 7px 8px
}

.pagination button.current {
  border-color: var(--primary);
  background: var(--color-primary-soft);
  color: var(--primary)
}

.pagination>div>span {
  padding: 0 5px;
  color: var(--foreground);
  font-weight: 800
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--overlay, rgba(0, 0, 0, .48))
}

.history-modal {
  width: min(650px, 100%);
  max-height: min(85vh, 850px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  box-shadow: var(--shadow-lg)
}

.history-modal>header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid var(--border)
}

.history-modal header small {
  color: var(--primary);
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .1em
}

.history-modal header h2 {
  margin: 5px 0;
  font-size: 1.15rem
}

.history-modal header p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: .78rem
}

.close-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--muted-foreground);
  font-size: 1.3rem;
  cursor: pointer
}

.close-button:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.modal-body {
  max-height: calc(85vh - 90px);
  overflow-y: auto;
  padding: 19px 20px
}

.current-status {
  display: grid;
  gap: 5px;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--color-background)
}

.current-status small {
  color: var(--muted-foreground);
  font-size: .7rem
}

.current-status strong {
  font-size: .95rem
}

.current-status span {
  color: var(--muted-foreground);
  font-size: .75rem
}

.modal-body h3 {
  margin: 20px 0 14px;
  font-size: .9rem
}

.timeline {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none
}

.timeline li {
  position: relative;
  display: grid;
  grid-template-columns: 15px 1fr;
  gap: 11px;
  padding-bottom: 19px
}

.timeline li:not(:last-child):before {
  position: absolute;
  top: 14px;
  bottom: 0;
  left: 6px;
  width: 1px;
  background: var(--border);
  content: ''
}

.timeline-dot {
  z-index: 1;
  width: 13px;
  height: 13px;
  margin-top: 2px;
  border: 3px solid var(--primary);
  border-radius: 50%;
  background: var(--card)
}

.timeline-head {
  display: flex;
  justify-content: space-between;
  gap: 12px
}

.timeline-head strong {
  font-size: .8rem
}

.timeline time,
.timeline small {
  color: var(--muted-foreground);
  font-size: .69rem
}

.transition,
.note {
  margin: 6px 0;
  color: var(--muted-foreground);
  font-size: .75rem;
  line-height: 1.5
}

.transition span {
  color: var(--primary);
  font-weight: 800
}

.timeline small {
  display: block
}

@media(max-width:900px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr)
  }

  .analytics-grid {
    grid-template-columns: 1fr
  }

  .pagination {
    align-items: flex-start;
    flex-direction: column
  }
}

@media(max-width:600px) {
  .monitoring-page {
    padding: 20px 13px 35px
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column
  }

  .filters>* {
    flex: 1
  }

  .filters>input {
    flex-basis: 100%
  }

  .pagination>div {
    flex-wrap: wrap
  }

  .timeline-head {
    flex-direction: column;
    gap: 4px
  }
}
</style>