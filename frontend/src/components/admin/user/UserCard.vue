<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Mail, CheckCircle, Lock } from 'lucide-vue-next'
import type { User } from '../../../types/admin/user.types'

interface Props {
  user: User | null
  loading?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
})

const userInitials = computed(() => {
  if (!props.user?.name) return '?'
  return props.user.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const formatDate = (date: string | undefined) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="user-card-container">
    <!-- Loading State -->
    <div v-if="loading" class="card loading-state">
      <div class="spinner" />
      <p>Memuat profil...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="card error-state">
      <p>{{ error }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!user" class="card empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <h3>Profil tidak tersedia</h3>
      <p>Silakan muat ulang halaman</p>
    </div>

    <!-- User Card -->
    <div v-else class="card user-card">
      <!-- Header -->
      <div class="card-header">
        <div class="avatar-large">
          {{ userInitials }}
        </div>
        <div class="header-info">
          <h2 class="user-name">{{ user.name }}</h2>
          <div class="status-info">
            <span class="status-badge" :class="{ active: user.is_active, inactive: !user.is_active }">
              <CheckCircle :size="14" />
              {{ user.is_active ? 'Akun Aktif' : 'Akun Nonaktif' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="card-divider" />

      <!-- Content -->
      <div class="card-content">
        <!-- Email Section -->
        <div class="info-section">
          <div class="info-item">
            <div class="info-icon">
              <Mail :size="18" />
            </div>
            <div class="info-details">
              <p class="info-label">Email</p>
              <p class="info-value">{{ user.email }}</p>
            </div>
          </div>
        </div>

        <!-- Roles Section -->
        <div class="info-section" v-if="user.roles && user.roles.length > 0">
          <div class="info-header">
            <Lock :size="18" />
            <span>Role & Akses</span>
          </div>
          <div class="roles-list">
            <div v-for="role in user.roles" :key="role.id" class="role-item">
              <span class="role-name">{{ role.name }}</span>
              <span v-if="role.description" class="role-description">
                {{ role.description }}
              </span>
            </div>
          </div>
        </div>

        <!-- Created Date Section -->
        <div class="info-section" v-if="user.created_at">
          <div class="info-item">
            <div class="info-icon">
              <Calendar :size="18" />
            </div>
            <div class="info-details">
              <p class="info-label">Akun Dibuat</p>
              <p class="info-value">{{ formatDate(user.created_at) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="card-footer">
        <p class="footer-text">
          Ini adalah profil Anda. Data ini bersifat read-only dan tidak dapat diubah dari halaman ini.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-card-container {
  max-width: 500px;
  margin: 0 auto;
}

.card {
  background: var(--color-surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px 32px;
  text-align: center;

  p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  svg {
    width: 48px;
    height: 48px;
    color: var(--color-text-muted);
  }
}

.loading-state {
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-neutral-soft);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}

.user-card {
  padding: 0;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 32px;
  background: var(--gradient-primary-soft);
  border-bottom: 1px solid var(--color-primary-shadow);
}

.avatar-large {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  font-size: 28px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: var(--shadow-primary-md);
}

.header-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-name {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.5px;
}

.status-info {
  display: flex;
  gap: 8px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;

  &.active {
    background: var(--color-success-soft);
    color: var(--color-success);
    border: 1px solid var(--color-success-border);
  }

  &.inactive {
    background: var(--color-danger-soft);
    color: var(--color-danger);
    border: 1px solid var(--color-danger-border);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.card-divider {
  height: 1px;
  background: var(--gradient-shimmer);
}

.card-content {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.info-header svg {
  color: var(--color-primary);
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.info-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  flex-shrink: 0;
}

.info-details {
  flex: 1;
}

.info-label {
  margin: 0 0 4px 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.info-value {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  word-break: break-all;
}

.roles-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--color-primary-softer);
  border: 1px solid var(--color-primary-soft);
  border-radius: 8px;
}

.role-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &:not(:last-child) {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-primary-soft);
  }
}

.role-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.role-description {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.card-footer {
  padding: 16px 32px;
  background: var(--color-primary-softer);
  border-top: 1px solid var(--color-primary-soft);
}

.footer-text {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

@media (max-width: 640px) {
  .card-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px;
  }

  .avatar-large {
    width: 64px;
    height: 64px;
    font-size: 24px;
  }

  .card-content {
    padding: 24px;
  }

  .status-info {
    justify-content: center;
  }
}
</style>
