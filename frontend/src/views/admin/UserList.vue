<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Search, X, ShieldCheck, ShieldOff, AlertTriangle, Loader, Pencil } from 'lucide-vue-next'
import { useToast } from '../../composables/useToast'
import type { User } from '../../types/admin/user.types'
import { useAdminUserStore } from '../../stores/admin/user.store'
import UserTable from '../../components/admin/user/UserTable.vue'

const userStore = useAdminUserStore()
const toast = useToast()
const selectedUser = ref<User | null>(null)
const isSavingStatus = ref(false)
const editingUser = ref<User | null>(null)
const editForm = ref({ name: '', email: '', role: '' })
const isSavingEdit = ref(false)
const currentPage = ref(1)
const searchInput = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  await userStore.loadUsers(1)
})

const handlePageChange = async (page: number) => {
  currentPage.value = page
  await userStore.loadUsers(page, searchInput.value)
  // Scroll to table
  const tableElement = document.querySelector('.user-table-container')
  if (tableElement) {
    tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const handleSearch = async (query: string) => {
  searchInput.value = query
  currentPage.value = 1

  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Debounce search - wait 300ms after user stops typing
  searchTimeout = setTimeout(() => {
    // Apply client-side filtering
    userStore.filterUsersBySearch(query)
  }, 300)
}

const handleToggleStatus = (user: User) => {
  selectedUser.value = user
}

const handleEditUser = async (user: User) => {
  editingUser.value = user
  editForm.value = { name: user.name, email: user.email, role: user.roles?.[0]?.name ?? '' }
  if (userStore.roles.length === 0) await userStore.loadRoles()
}

const closeEditDialog = () => {
  if (!isSavingEdit.value) editingUser.value = null
}

const saveUserEdit = async () => {
  if (!editingUser.value || isSavingEdit.value) return
  if (!editForm.value.name.trim() || !editForm.value.email.trim() || !editForm.value.role) {
    toast.error('Nama, email, dan role wajib diisi.')
    return
  }
  isSavingEdit.value = true
  try {
    await userStore.updateUserData(editingUser.value.id, {
      name: editForm.value.name.trim(),
      email: editForm.value.email.trim(),
      role: editForm.value.role,
    })
    toast.success('Data user berhasil diperbarui.')
    editingUser.value = null
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Gagal memperbarui data user.')
  } finally {
    isSavingEdit.value = false
  }
}

const closeStatusDialog = () => {
  if (isSavingStatus.value) return
  selectedUser.value = null
}

const confirmToggleStatus = async () => {
  if (!selectedUser.value || isSavingStatus.value) return
  const user = selectedUser.value
  const nextStatus = !user.is_active
  isSavingStatus.value = true
  try {
    await userStore.setUserActiveStatus(user.id, nextStatus)
    toast.success(nextStatus
      ? `Akun ${user.name} berhasil diaktifkan.`
      : `Akun ${user.name} berhasil dinonaktifkan.`)
    selectedUser.value = null
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Gagal mengubah status akun.')
  } finally {
    isSavingStatus.value = false
  }
}

const clearSearch = () => {
  searchInput.value = ''
  currentPage.value = 1

  // Clear pending search timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Clear search filter - show all users
  userStore.filterUsersBySearch('')
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1>Daftar User</h1>
      <p class="page-subtitle">
        Kelola dan lihat semua pengguna sistem
      </p>
    </div>

    <!-- Search Section -->
    <div class="search-section">
      <div class="search-wrapper">
        <Search class="search-icon" :size="18" />
        <input
          v-model="searchInput"
          type="text"
          placeholder="Cari berdasarkan nama atau email..."
          class="search-input"
          @input="handleSearch(searchInput)"
        />
        <button
          v-if="searchInput"
          class="clear-btn"
          @click="clearSearch"
          aria-label="Clear search"
        >
          <X :size="18" />
        </button>
      </div>
      <div v-if="searchInput" class="search-results-info">
        Hasil pencarian untuk: <strong>{{ searchInput }}</strong>
      </div>
    </div>

    <UserTable
      :users="userStore.filteredUsers"
      :pagination="userStore.pagination"
      :loading="userStore.isLoading"
      :error="userStore.error"
      :search-query="searchInput"
      @page-change="handlePageChange"
      @toggle-status="handleToggleStatus"
      @edit-user="handleEditUser"
    />

    <Teleport to="body">
      <Transition name="status-dialog">
        <div v-if="editingUser" class="status-dialog-backdrop" @click.self="closeEditDialog">
          <section class="status-dialog edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title">
            <div class="status-dialog__icon is-success"><Pencil :size="23" /></div>
            <h2 id="edit-dialog-title">Edit Data User</h2>
            <p class="edit-dialog__description">Perbarui informasi akun {{ editingUser.name }}.</p>
            <form class="edit-form" @submit.prevent="saveUserEdit">
              <label>Nama
                <input v-model="editForm.name" class="edit-input" type="text" maxlength="255" required />
              </label>
              <label>Email
                <input v-model="editForm.email" class="edit-input" type="email" required />
              </label>
              <label>Role
                <select v-model="editForm.role" class="edit-input" required>
                  <option value="" disabled>Pilih role</option>
                  <option v-for="role in userStore.roles" :key="role.id" :value="role.name">{{ role.name }}</option>
                </select>
              </label>
              <div class="status-dialog__actions">
                <button class="dialog-button dialog-button--secondary" type="button" :disabled="isSavingEdit" @click="closeEditDialog">Batal</button>
                <button class="dialog-button dialog-button--primary" type="submit" :disabled="isSavingEdit">
                  <Loader v-if="isSavingEdit" class="dialog-spinner" :size="16" />
                  {{ isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="status-dialog">
        <div v-if="selectedUser" class="status-dialog-backdrop" @click.self="closeStatusDialog">
          <section class="status-dialog" role="dialog" aria-modal="true" aria-labelledby="status-dialog-title">
            <div class="status-dialog__icon" :class="selectedUser.is_active ? 'is-warning' : 'is-success'">
              <AlertTriangle v-if="selectedUser.is_active" :size="24" />
              <ShieldCheck v-else :size="24" />
            </div>
            <h2 id="status-dialog-title">{{ selectedUser.is_active ? 'Nonaktifkan Akun?' : 'Aktifkan Akun?' }}</h2>
            <p>
              {{ selectedUser.is_active
                ? `Akun ${selectedUser.name} tidak akan bisa masuk atau mengakses sistem sampai diaktifkan kembali.`
                : `Akun ${selectedUser.name} akan dapat masuk dan mengakses sistem kembali.` }}
            </p>
            <div class="status-dialog__actions">
              <button class="dialog-button dialog-button--secondary" type="button" :disabled="isSavingStatus" @click="closeStatusDialog">Batal</button>
              <button class="dialog-button" :class="selectedUser.is_active ? 'dialog-button--danger' : 'dialog-button--primary'" type="button" :disabled="isSavingStatus" @click="confirmToggleStatus">
                <Loader v-if="isSavingStatus" class="dialog-spinner" :size="16" />
                <ShieldOff v-else-if="selectedUser.is_active" :size="16" />
                <ShieldCheck v-else :size="16" />
                {{ isSavingStatus ? 'Menyimpan...' : selectedUser.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan' }}
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 100%;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: -0.5px;
}

.page-subtitle {
  margin: 0;
  font-size: 16px;
  color: var(--muted-foreground);
}

.search-section {
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-icon {
  position: absolute;
  left: 16px;
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  max-width: 500px;
  padding: 12px 16px 12px 48px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--foreground);
  font-size: 14px;
  transition: all 200ms ease;

  &::placeholder {
    color: var(--muted-foreground);
  }

  &:hover {
    border-color: color-mix(in srgb, var(--ring) 40%, var(--border));
  }

  &:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: var(--shadow-focus);
  }
}

.clear-btn {
  all: unset;
  position: absolute;
  right: 12px;
  padding: 8px;
  cursor: pointer;
  color: var(--muted-foreground);
  transition: all 200ms ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--foreground);
    background: var(--muted);
    border-radius: 6px;
  }

  &:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
}

.search-results-info {
  font-size: 13px;
  color: var(--muted-foreground);
  padding: 8px 12px;
  background: var(--secondary);
  border-radius: 6px;
  border-left: 3px solid var(--primary);

  strong {
    color: var(--primary);
    font-weight: 600;
  }
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 24px;
  }

  .search-input {
    max-width: 100%;
  }
}

.status-dialog-backdrop {
  position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center;
  padding: 20px; background: color-mix(in srgb, var(--foreground) 42%, transparent);
}
.status-dialog {
  width: min(440px, 100%); padding: 28px; border: 1px solid var(--border);
  border-radius: var(--radius-lg); background: var(--card); box-shadow: var(--shadow-lg); text-align: center;
}
.status-dialog__icon {
  width: 52px; height: 52px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 50%;
}
.status-dialog__icon.is-warning {
  color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 14%, var(--color-surface));
}
.status-dialog__icon.is-success {
  color: var(--color-success); background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
}
.status-dialog h2 { margin: 0 0 10px; color: var(--foreground); font-size: 20px; font-weight: 700; }
.status-dialog p { margin: 0; color: var(--muted-foreground); font-size: 14px; line-height: 1.6; }
.status-dialog__actions { display: flex; justify-content: center; gap: 10px; margin-top: 24px; }
.dialog-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px;
  padding: 9px 14px; border: 1px solid transparent; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 160ms ease, background 160ms ease;
}
.dialog-button:disabled { opacity: .6; cursor: not-allowed; }
.dialog-button--secondary { color: var(--foreground); border-color: var(--border); background: var(--color-surface); }
.dialog-button--primary { color: var(--primary-foreground); background: var(--primary); }
.dialog-button--danger { color: white; background: var(--color-danger); }
.dialog-spinner { animation: spin 1s linear infinite; }
.status-dialog-enter-active, .status-dialog-leave-active { transition: opacity 160ms ease; }
.status-dialog-enter-from, .status-dialog-leave-to { opacity: 0; }


.edit-dialog { text-align: left; }
.edit-dialog__description { margin-bottom: 18px !important; }
.edit-form { display: flex; flex-direction: column; gap: 14px; margin-top: 18px; }
.edit-form label { display: flex; flex-direction: column; gap: 6px; color: var(--foreground); font-size: 13px; font-weight: 600; }
.edit-input {
  width: 100%; min-height: 40px; padding: 9px 11px; border: 1px solid var(--border);
  border-radius: var(--radius-md); background: var(--color-surface); color: var(--foreground);
  font: inherit; font-weight: 400;
}
.edit-input:focus { outline: none; border-color: var(--ring); box-shadow: var(--shadow-focus); }

</style>
