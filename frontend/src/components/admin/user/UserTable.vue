<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, Loader, Pencil, ShieldCheck, ShieldOff } from 'lucide-vue-next'
import type { User } from '../../../types/admin/user.types'

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface Props {
  users: User[]
  pagination: Pagination
  loading?: boolean
  error?: string | null
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  searchQuery: '',
})

const emit = defineEmits<{
  'page-change': [page: number]
  'toggle-status': [user: User]
  'edit-user': [user: User]
}>()

const hasUsers = computed(() => props.users.length > 0)
const hasPreviousPage = computed(() => props.pagination.page > 1)
const hasNextPage = computed(() => props.pagination.page < props.pagination.pages)

// Slice users for current page (client-side pagination)
const paginatedUsers = computed(() => {
  const start = (props.pagination.page - 1) * props.pagination.limit
  const end = start + props.pagination.limit
  return props.users.slice(start, end)
})

const startIndex = computed(() => {
  return (props.pagination.page - 1) * props.pagination.limit + 1
})

const formatLastLogin = (value?: string | null) => {
  if (!value) return 'Belum pernah login'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const endIndex = computed(() => {
  return Math.min(props.pagination.page * props.pagination.limit, props.pagination.total)
})

const handlePreviousPage = () => {
  if (hasPreviousPage.value) {
    emit('page-change', props.pagination.page - 1)
  }
}

const handleNextPage = () => {
  if (hasNextPage.value) {
    emit('page-change', props.pagination.page + 1)
  }
}

</script>

<template>
  <div class="user-table-container">
    <!-- Error State -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Loader class="spinner" />
      <p>Memuat data user...</p>
    </div>

    <!-- Empty State / No Search Results -->
    <div v-else-if="!hasUsers" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <!-- Show different message based on search status -->
      <template v-if="searchQuery">
        <h3>Tidak ada user yang ditemukan</h3>
        <p>Coba gunakan kata kunci yang berbeda</p>
      </template>
      <template v-else>
        <h3>Belum ada user</h3>
        <p>Mulai dengan menambahkan user baru</p>
      </template>
    </div>

    <!-- Table -->
    <template v-else>
      <div class="table-wrapper">
        <table class="user-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Login Terakhir</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(user, index) in paginatedUsers" :key="user.id" class="table-row">
              <td class="cell-no">{{ startIndex + index }}</td>
              <td class="cell-name">
                <span class="user-avatar">{{ user.name.charAt(0).toUpperCase() }}</span>
                {{ user.name }}
              </td>
              <td class="cell-email">{{ user.email }}</td>
              <td class="cell-role">
                <span v-for="role in user.roles" :key="role.id" class="role-badge">
                  {{ role.name }}
                </span>
              </td>
              <td class="cell-last-login">{{ formatLastLogin(user.last_login_at) }}</td>
              <td class="cell-status">
                <span class="status-badge" :class="{ active: user.is_active, inactive: !user.is_active }">
                  {{ user.is_active ? 'Aktif' : 'Nonaktif' }}
                </span>
              </td>
              <td class="cell-actions">
                <button class="action-button action-button--edit" type="button" @click="emit('edit-user', user)" :disabled="loading">
                  <Pencil :size="15" /> Edit
                </button>
                <button class="action-button" :class="user.is_active ? 'action-button--deactivate' : 'action-button--activate'" type="button" @click="emit('toggle-status', user)" :disabled="loading">
                  <ShieldOff v-if="user.is_active" :size="15" />
                  <ShieldCheck v-else :size="15" />
                  {{ user.is_active ? 'Nonaktifkan' : 'Aktifkan' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <div class="pagination-info">
          Menampilkan {{ startIndex }}-{{ endIndex }} dari {{ pagination.total }} user
        </div>

        <div class="pagination-controls">
          <button
            class="pagination-btn"
            :disabled="!hasPreviousPage"
            @click="handlePreviousPage"
            aria-label="Previous page"
          >
            <ChevronLeft :size="18" />
            <span>Sebelumnya</span>
          </button>

          <div class="page-info">
            Halaman {{ pagination.page }} dari {{ pagination.pages }}
          </div>

          <button
            class="pagination-btn"
            :disabled="!hasNextPage"
            @click="handleNextPage"
            aria-label="Next page"
          >
            <span>Berikutnya</span>
            <ChevronRight :size="18" />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.user-table-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.error-message {
  padding: 16px;
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  border-radius: 8px;
  color: var(--color-danger);
  font-size: 14px;
  font-weight: 500;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px 32px;

  p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 14px;
  }
}

.spinner {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px 32px;

  svg {
    width: 48px;
    height: 48px;
    color: var(--muted-foreground);
  }

  h3 {
    margin: 0;
    color: var(--foreground);
    font-size: 18px;
  }

  p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 14px;
  }
}

.table-wrapper {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.user-table {
  width: 100%;
  border-collapse: collapse;

  thead {
    background: var(--muted);
    border-bottom: 1px solid var(--border);
  }

  th {
    padding: 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted-foreground);
  }

  tbody {
    background: var(--color-transparent);
  }
}

.table-row {
  border-bottom: 1px solid var(--border);
  transition: background 200ms ease;

  &:hover {
    background: var(--secondary);
  }

  &:last-child {
    border-bottom: none;
  }

  td {
    padding: 16px;
    font-size: 14px;
    color: var(--foreground);
  }
}

.cell-no {
  font-weight: 600;
  color: var(--muted-foreground);
  width: 50px;
}

.cell-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.cell-last-login {
  min-width: 170px;
  color: var(--muted-foreground) !important;
  font-size: 13px !important;
  white-space: nowrap;
}

.cell-email {
  font-size: 13px;
  color: var(--muted-foreground);
}

.cell-role {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.role-badge {
  display: inline-block;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--primary) 10%, var(--color-surface));
  border: 1px solid var(--primary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--primary);
  white-space: nowrap;
}

.cell-status {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid var(--color-transparent);

  &.active {
    background: color-mix(in srgb, var(--primary) 10%, var(--color-surface));
    color: var(--primary);
    border-color: var(--primary);
  }

  &.inactive {
    background: color-mix(in srgb, var(--destructive) 10%, var(--color-surface));
    color: var(--destructive);
    border-color: var(--destructive);
  }
}

 .cell-actions { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.action-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--color-surface); color: var(--foreground); font-size: 12px;
  font-weight: 600; cursor: pointer; transition: background 180ms ease, border-color 180ms ease;
}
.action-button:hover:not(:disabled) { background: var(--secondary); }
.action-button:disabled { opacity: .55; cursor: not-allowed; }
.action-button--edit, .action-button--activate { color: var(--primary); border-color: var(--primary); }
.action-button--deactivate { color: var(--destructive); border-color: var(--destructive); }

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  gap: 16px;
}

.pagination-info {
  font-size: 14px;
  color: var(--muted-foreground);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pagination-btn {
  all: unset;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
  background: var(--color-surface);
  transition: all 200ms ease;

  &:hover:not(:disabled) {
    background: var(--secondary);
    border-color: var(--primary);
    color: var(--primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.page-info {
  font-size: 13px;
  color: var(--muted-foreground);
  min-width: 140px;
  text-align: center;
}

@media (max-width: 768px) {
  .user-table {
    font-size: 12px;

    th,
    td {
      padding: 12px;
    }
  }

  .pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-controls {
    flex-direction: column;
  }

  .pagination-btn {
    width: 100%;
    justify-content: center;
  }

  .cell-name {
    flex-direction: column;
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    font-size: 10px;
  }
}

@media (max-width: 640px) {
  .table-wrapper {
    overflow-x: auto;
  }

  .user-table {
    min-width: 900px;
  }
}
</style>
