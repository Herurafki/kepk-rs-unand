<script setup lang="ts">
import { computed,  ref } from 'vue'
import { UserPlus, Search, X, CheckCircle2, AlertCircle, RefreshCw, UserCheck, UserX, Pencil } from 'lucide-vue-next'
import apiClient from '../../services/api/client'
import { getApiErrorMessage } from '../../services/api/error'
import { getReviewers, type Reviewer } from '../../services/secretariat/reviewer.service'

const search = ref('')
const showForm = ref(false)
const editingReviewer = ref<Reviewer | null>(null)
const loading = ref(false)
const loadingList = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const reviewers = ref<Reviewer[]>([])
const emptyForm = () => ({ name: '', email: '', password: '', specialization: '', position: '' })
const form = ref(emptyForm())

const filteredReviewers = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return reviewers.value
  return reviewers.value.filter(reviewer =>
    reviewer.name.toLowerCase().includes(keyword) || reviewer.email.toLowerCase().includes(keyword),
  )
})

async function loadReviewers() {
  loadingList.value = true
  errorMessage.value = ''
  try {
    reviewers.value = (await getReviewers()).data ?? []
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal memuat daftar reviewer.')
  } finally {
    loadingList.value = false
  }
}

function openCreateForm() { editingReviewer.value = null; form.value = emptyForm(); showForm.value = true }
function openEditForm(reviewer: Reviewer) {
  editingReviewer.value = reviewer
  form.value = { name: reviewer.name, email: reviewer.email, password: '', specialization: reviewer.specialization || '', position: reviewer.position || '' }
  showForm.value = true
}
async function saveReviewer() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    if (editingReviewer.value) {
      await apiClient.put(`/users/reviewers/${editingReviewer.value.id}`, { name: form.value.name, email: form.value.email, specialization: form.value.specialization, position: form.value.position })
      successMessage.value = 'Data reviewer berhasil diperbarui.'
    } else {
      await apiClient.post('/users', { ...form.value, role: 'REVIEWER' })
      successMessage.value = 'Reviewer berhasil ditambahkan.'
    }
    form.value = emptyForm()
    editingReviewer.value = null
    showForm.value = false
    await loadReviewers()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal menambahkan reviewer.')
  } finally {
    loading.value = false
  }
}

async function toggleReviewerStatus(reviewer: Reviewer) {
  const nextStatus = !reviewer.is_active
  try {
    await apiClient.patch(`/users/reviewers/${reviewer.id}/status`, { is_active: nextStatus })
    successMessage.value = nextStatus ? 'Reviewer berhasil diaktifkan.' : 'Reviewer berhasil dinonaktifkan.'
    await loadReviewers()
  } catch (error) { errorMessage.value = getApiErrorMessage(error, 'Status reviewer gagal diperbarui.') }
}
</script>

<template>
  <div class="page">
    <header class="heading">
      <div>
        <span class="eyebrow">SEKRETARIAT KEPK</span>
        <h1>Anggota Reviewer</h1>
        <p>Kelola anggota reviewer. Sekretaris dapat menambahkan reviewer, tetapi tidak menugaskan reviewer ke
          pengajuan.</p>
      </div>
      <button class="primary" @click="openCreateForm">
        <UserPlus :size="17" /> Tambah Reviewer
      </button>
    </header>

    <div v-if="successMessage" class="success">
      <CheckCircle2 :size="18" />{{ successMessage }}
    </div>
    <div v-if="errorMessage" class="alert">
      <AlertCircle :size="18" />{{ errorMessage }}
    </div>

    <section class="card">
      <div class="toolbar">
        <label>
          <Search :size="17" /><input v-model="search" placeholder="Cari nama atau email reviewer..." />
        </label>
        <button class="refresh" :disabled="loadingList" @click="loadReviewers">
          <RefreshCw :size="16" :class="{ spin: loadingList }" /> Muat ulang
        </button>
      </div>

      <div v-if="loadingList" class="state">
        <RefreshCw :size="28" class="spin" />Memuat reviewer...
      </div>
      <div v-else-if="!filteredReviewers.length" class="state">
        <UserPlus :size="34" />
        <strong>{{ search ? 'Reviewer tidak ditemukan' : 'Belum ada anggota reviewer' }}</strong>
        <span>{{ search ? 'Coba gunakan nama atau email yang berbeda.' : 'Tambahkan reviewer untuk mulai membangun daftar anggota.' }}</span>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Spesialisasi</th>
              <th>Posisi</th>
              <th>Organisasi</th>
              <th>Nomor Telepon</th>
              <th>Alamat</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="reviewer in filteredReviewers" :key="reviewer.id">
              <td><strong>{{ reviewer.name }}</strong></td>
              <td>{{ reviewer.email }}</td>
              <td>{{ reviewer.specialization || '—' }}</td>
              <td>{{ reviewer.position || '—' }}</td>
              <td>{{ reviewer.organization || '—' }}</td>
              <td>{{ reviewer.phone || '—' }}</td>
              <td>{{ reviewer.address || '—' }}</td>
              <td><span :class="reviewer.is_active ? 'active-status' : 'inactive-status'">
                  {{ reviewer.is_active ? 'Aktif' : 'Nonaktif' }}
                </span></td>
              <td class="row-actions">
                <button class="icon-action" type="button" title="Edit reviewer" @click="openEditForm(reviewer)"><Pencil :size="15" /></button>
                <button class="icon-action" type="button" :title="reviewer.is_active ? 'Nonaktifkan reviewer' : 'Aktifkan reviewer'" @click="toggleReviewerStatus(reviewer)"><component :is="reviewer.is_active ? UserX : UserCheck" :size="15" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <form class="modal" @submit.prevent="saveReviewer">
        <div class="modal-head">
          <div>
            <h2>{{ editingReviewer ? 'Edit Reviewer' : 'Tambah Reviewer' }}</h2>
            <p>{{ editingReviewer ? 'Perbarui informasi anggota reviewer.' : 'Buat akun reviewer baru.' }}</p>
          </div><button type="button" class="close" @click="showForm = false">
            <X :size="18" />
          </button>
        </div>
        <label class="field">Nama<input v-model="form.name" required /></label>
        <label class="field">Email<input v-model="form.email" type="email" required /></label>
        <label v-if="!editingReviewer" class="field">Password<input v-model="form.password" type="password" minlength="8" required /></label>
        <label class="field">Spesialisasi<input v-model="form.specialization" placeholder="Contoh: Farmakologi Klinik" /></label>
        <label class="field">Posisi<input v-model="form.position" placeholder="Contoh: Dokter Spesialis" /></label>
        <div class="modal-actions"><button type="button" class="secondary"
            @click="showForm = false; editingReviewer = null">Batal</button><button class="primary" :disabled="loading">{{ loading ? 'Menyimpan...' : (editingReviewer ? 'Simpan Perubahan' : 'Simpan Reviewer') }}</button></div>
      </form>
    </div>
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

.primary,
.secondary,
.close,
.refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer
}

.primary {
  border: 0;
  background: var(--primary);
  color: var(--primary-foreground)
}

.secondary,
.refresh {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground)
}

.close {
  padding: 6px;
  border: 0;
  background: transparent;
  color: var(--muted-foreground)
}

button:disabled {
  opacity: .55;
  cursor: not-allowed
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
  justify-content: space-between;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid var(--border)
}

.toolbar label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 520px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--muted-foreground)
}

.toolbar input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--foreground);
  font: inherit
}

 .row-actions { display:flex; gap:8px; }
.icon-action { display:inline-grid; place-items:center; width:32px; height:32px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--card); color:var(--foreground); cursor:pointer; }
.icon-action:hover { border-color:var(--primary); color:var(--primary); }
.table-wrap {
  overflow: auto
}

table {
  width: 100%;
  border-collapse: collapse
}

th,
td {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-size: 13px;
  color: var(--foreground)
}

th {
  background: var(--color-overlay-subtle);
  color: var(--muted-foreground);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .05em
}

tr:hover {
  background: var(--color-primary-light); 
}

.active-status,
.inactive-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600
}

.active-status {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.inactive-status {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.state {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-foreground);
  text-align: center
}

.state strong {
  color: var(--foreground)
}

.success,
.alert {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md)
}

.success {
  border: 1px solid var(--color-success-border);
  background: var(--color-success-soft);
  color: var(--color-success)
}

.alert {
  border: 1px solid var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--color-overlay)
}

.modal {
  width: min(520px, 100%);
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-lg)
}

.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px
}

.modal-head h2 {
  margin: 0 0 4px;
  color: var(--foreground)
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 14px;
  color: var(--muted-foreground);
  font-size: 13px
}

.field input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: 0;
  background: var(--background);
  color: var(--foreground);
  font: inherit
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px
}

.spin {
  animation: spin .9s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media(max-width:700px) {

  .heading,
  .toolbar {
    flex-direction: column
  }

  .toolbar label {
    max-width: none
  }

  .refresh {
    align-self: flex-end
  }
}
</style>
