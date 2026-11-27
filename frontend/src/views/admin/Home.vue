<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminUserStore } from '../../stores/admin/user.store'
import { Users, UserPlus } from 'lucide-vue-next'

const userStore = useAdminUserStore()

onMounted(async () => {
  // Load user count for dashboard
  await userStore.loadUsers(1)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1>Selamat Datang di Admin Dashboard</h1>
      <p class="page-subtitle">
        Kelola pengguna sistem dan lihat overview statistik
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <!-- Total Users Card -->
      <div class="stat-card">
        <div class="stat-icon users-icon">
          <Users :size="24" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Total User</p>
          <h3 class="stat-value">{{ userStore.pagination.total }}</h3>
          <p class="stat-description">Pengguna terdaftar dalam sistem</p>
        </div>
      </div>

      <!-- Quick Actions Card -->
      <div class="stat-card action-card">
        <div class="stat-icon action-icon">
          <UserPlus :size="24" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Aksi Cepat</p>
          <RouterLink to="/admin/user-add" class="quick-action-link">
            Tambah User Baru
          </RouterLink>
          <p class="stat-description">Buat akun pengguna baru</p>
        </div>
      </div>
    </div>

    <!-- Recent Users Section -->
    <div class="section recent-users">
      <div class="section-header">
        <h2>Tiga User Terbaru</h2>
        <RouterLink to="/admin/user-list" class="view-all-link">
          Lihat Semua →
        </RouterLink>
      </div>

      <div v-if="userStore.isLoading" class="loading-state">
        <p>Memuat data...</p>
      </div>

      <div v-else-if="userStore.hasUsers" class="users-list">
        <div v-for="user in [...userStore.users].sort((a, b) => new Date(String(b.updated_at || b.created_at || '')).getTime() - new Date(String(a.updated_at || a.created_at || '')).getTime()).slice(0, 3)" :key="user.id" class="user-item">
          <div class="user-info">
            <div class="user-avatar">
              {{ user.name.charAt(0).toUpperCase() }}
            </div>
            <div class="user-details">
              <p class="user-name">{{ user.name }}</p>
              <p class="user-email">{{ user.email }}</p>
            </div>
          </div>
          <div class="user-meta">
            <span class="user-status" :class="{ active: user.is_active }">
              {{ user.is_active ? 'Aktif' : 'Nonaktif' }}
            </span>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>Belum ada user di sistem</p>
        <RouterLink to="/admin/user-add" class="empty-state-link">
          Tambah user pertama
        </RouterLink>
      </div>
    </div>

    <!-- Info Section -->
    <div class="section info-section">
      <h2>Informasi Penting</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-title">👤 Kelola User</div>
          <p>Tambah, edit, atau nonaktifkan akun pengguna sistem</p>
        </div>
        <div class="info-item">
          <div class="info-title">📋 Lihat Daftar User</div>
          <p>Lihat semua user dengan paginasi dan informasi lengkap</p>
        </div>
        <div class="info-item">
          <div class="info-title">👥 Kelola Role</div>
          <p>Tetapkan role dan akses untuk setiap pengguna</p>
        </div>
        <div class="info-item">
          <div class="info-title">🔐 Profile Admin</div>
          <p>Lihat informasi profil admin Anda</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 100%;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 40px;
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

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}

.stat-card {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: all 200ms ease;
  box-shadow: var(--shadow-sm);

  &:hover {
    border-color: var(--ring);
    box-shadow: var(--shadow-md);
  }
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  color: var(--primary);
  flex-shrink: 0;

  &.users-icon {
    background: var(--gradient-primary-soft);
    color: var(--color-primary);
  }

  &.action-icon {
    background: var(--color-info-soft);
    color: var(--color-info);
  }
}

.stat-content {
  flex: 1;
}

.stat-label {
  margin: 0 0 4px 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.stat-value {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 700;
  color: var(--foreground);
}

.stat-description {
  margin: 0;
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.4;
}

.action-card .stat-value {
  font-size: 16px;
  margin-bottom: 0;
}

.quick-action-link {
  display: inline-block;
  padding: 8px 16px;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  transition: all 200ms ease;
  margin-bottom: 8px;

  &:hover {
    box-shadow: var(--shadow-primary-md);
    transform: translateY(-2px);
  }
}

/* Sections */
.section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--foreground);
  }
}

.view-all-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  transition: all 200ms ease;

  &:hover {
    gap: 6px;
  }
}

/* Users List */
.users-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--muted);
  border-radius: 8px;
  border: 1px solid var(--border);
  transition: all 200ms ease;

  &:hover {
    background: color-mix(in srgb, var(--secondary) 50%, var(--muted));
    border-color: var(--ring);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.user-details {
  min-width: 0;
}

.user-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email {
  margin: 0;
  font-size: 12px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-status {
  display: inline-block;
  padding: 4px 12px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;

  &.active {
    background: var(--color-primary-soft);
    color: var(--color-primary);
  }
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-text-muted);
}

.empty-state-link {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;

  &:hover {
    box-shadow: var(--shadow-primary-md);
  }
}

/* Info Section */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  padding: 16px;
  background: color-mix(in srgb, var(--secondary) 50%, var(--color-surface));
  border: 1px solid var(--border);
  border-radius: 8px;

  .info-title {
    margin: 0 0 8px 0;
    font-weight: 600;
    color: var(--foreground);
    font-size: 14px;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: var(--muted-foreground);
    line-height: 1.4;
  }
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 24px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}

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
