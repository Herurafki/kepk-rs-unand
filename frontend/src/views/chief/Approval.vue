<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, Eye, RefreshCw, Search, XCircle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { decideApprove, decideReject, decideRevision, getChiefApplications, type ChiefApplication } from '../../services/chief/application.service'
import { getApiErrorMessage } from '../../services/api/error'

const router = useRouter()
const applications = ref<ChiefApplication[]>([])
const loading = ref(false)
const busy = ref('')
const error = ref('')
const success = ref('')
const search = ref('')
const decisionNote = ref('')

const items = computed(() => applications.value.filter(a =>
  ['REVIEW_COMPLETED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'].includes(a.status) &&
  (!search.value.trim() || [a.application_number, a.researcher_name, a.research_title]
    .some(v => String(v || '').toLowerCase().includes(search.value.trim().toLowerCase())))
))

const statusLabel = (s: string) => ({
  REVIEW_COMPLETED: 'Menunggu Keputusan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  REVISION_REQUIRED: 'Perlu Revisi',
}[s] || s.replaceAll('_', ' '))

const reviewLabel = (t?: string | null) => ({
  EXEMPTED: 'Exempted',
  EXPEDITED: 'Expedited',
  FULLBOARD: 'Full Board',
  FULL_BOARD: 'Full Board',
}[String(t || '').toUpperCase()] || 'Belum ditentukan')

async function load() {
  loading.value = true
  error.value = ''
  try { applications.value = await getChiefApplications() }
  catch (e) { error.value = getApiErrorMessage(e, 'Gagal memuat daftar persetujuan.') }
  finally { loading.value = false }
}

async function decide(id: string | number, type: 'approve' | 'revision' | 'reject') {
  if (type !== 'approve' && !decisionNote.value.trim()) {
    error.value = 'Catatan wajib diisi untuk revisi atau penolakan.'
    return
  }
  busy.value = String(id)
  error.value = ''
  success.value = ''
  try {
    if (type === 'approve') await decideApprove(String(id), decisionNote.value.trim() || undefined)
    if (type === 'revision') await decideRevision(String(id), decisionNote.value.trim())
    if (type === 'reject') await decideReject(String(id), decisionNote.value.trim() || undefined)
    decisionNote.value = ''
    success.value = 'Keputusan berhasil disimpan.'
    await load()
  } catch (e) { error.value = getApiErrorMessage(e, 'Keputusan gagal diproses.') }
  finally { busy.value = '' }
}

onMounted(load)
</script>

<template>
  <main class="page">
    <header class="heading">
      <div><span class="eyebrow">KETUA KEPK</span>
        <h1>Persetujuan Pengajuan</h1>
        <p>Periksa hasil review dan tetapkan keputusan akhir pengajuan kaji etik.</p>
      </div>
      <button class="button" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>
    <div v-if="error" class="alert error">
      <XCircle :size="17" /> {{ error }}
    </div>
    <div v-if="success" class="alert success">
      <CheckCircle2 :size="17" /> {{ success }}
    </div>
    <section class="card">
      <div class="toolbar"><label class="search">
          <Search :size="17" /><input v-model="search" placeholder="Cari nomor, peneliti, atau judul..." />
        </label></div>
      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" /> Memuat...
      </div>
      <div v-else class="table">
        <table>
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Peneliti</th>
              <th>Tipe Review</th>
              <th>Status</th>
              <th>Keputusan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in items" :key="a.id">
              <td><strong>{{ a.application_number }}</strong></td>
              <td><strong>{{ a.researcher_name || '—' }}</strong><small>{{ a.research_title || '—' }}</small></td>
              <td>{{ reviewLabel(a.review_type) }}</td>
              <td><span class="status">{{ statusLabel(a.status) }}</span></td>
              <td>
                <template v-if="a.status === 'REVIEW_COMPLETED'">
                  <textarea v-model="decisionNote" rows="2" placeholder="Catatan keputusan..." />
                  <div class="actions">
                    <button class="btn success-btn" :disabled="!!busy" @click="decide(a.id, 'approve')">
                      <CheckCircle2 :size="15" /> Setujui
                    </button>
                    <button class="btn warning-btn" :disabled="!!busy" @click="decide(a.id, 'revision')">Revisi</button>
                    <button class="btn danger-btn" :disabled="!!busy" @click="decide(a.id, 'reject')">
                      <XCircle :size="15" /> Tolak
                    </button>
                  </div>
                </template>
                <button v-else class="detail"
                  @click="router.push({ name: 'chief-application-detail', params: { id: a.id } })">
                  <Eye :size="15" /> Detail
                </button>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="5" class="empty">Tidak ada pengajuan pada daftar persetujuan.</td>
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
  gap: var(--space-6)
}

.heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start
}

.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em
}

h1 {
  margin: 8px 0;
  color: var(--foreground);
  font-size: clamp(24px, 3vw, 32px)
}

p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px
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
  cursor: pointer
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.toolbar {
  display: flex;
  padding: 18px;
  border-bottom: 1px solid var(--border)
}

.search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--muted-foreground)
}

input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--foreground);
  font: inherit
}

table {
  width: 100%;
  border-collapse: collapse
}

th,
td {
  padding: 14px 18px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--foreground)
}

th {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted-foreground);
  background: var(--color-overlay-subtle)
}

small {
  display: block;
  margin-top: 3px;
  color: var(--muted-foreground)
}

.status {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--color-info-soft);
  color: var(--color-info);
  font-size: 11px;
  font-weight: 600
}

.actions {
  display: flex;
  gap: 6px;
  margin-top: 7px
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 9px;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--primary-foreground);
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer
}

.success-btn {
  background: var(--color-success)
}

.warning-btn {
  background: var(--color-warning)
}

.danger-btn {
  background: var(--color-danger)
}

.btn:disabled {
  opacity: .55;
  cursor: not-allowed
}

textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 11px;
  resize: vertical
}

.alert {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 13px
}

.error {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.success {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.state,
.empty {
  text-align: center;
  color: var(--muted-foreground);
  padding: 50px
}

.spin {
  animation: spin 1s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media(max-width:800px) {
  .heading {
    flex-direction: column
  }

  .table {
    overflow-x: auto
  }

  table {
    min-width: 1000px
  }
}
</style>