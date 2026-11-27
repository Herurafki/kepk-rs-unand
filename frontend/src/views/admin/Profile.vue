<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/routes/auth'
import { useAdminUserStore } from '../../stores/admin/user.store'
import type { User, Role } from '../../types/admin/user.types'
import UserCard from '../../components/admin/user/UserCard.vue'
import ChangePasswordForm from '../../components/shared/ChangePasswordForm.vue'

const authStore = useAuthStore()
const userStore = useAdminUserStore()

const currentUser = computed((): User | null => {
  // Transform AuthUser to User type
  if (authStore.user) {
    return {
      id: authStore.user.id,
      name: authStore.user.name,
      email: authStore.user.email,
      is_active: authStore.user.is_active,
      roles: authStore.user.roles.map((roleName: string): Role => ({
        id: 0,
        code: roleName.toLowerCase(),
        name: roleName,
        is_active: true,
      })),
    }
  }
  return null
})

const isLoading = computed(() => {
  return userStore.isLoading
})

const error = computed(() => {
  return userStore.error
})

onMounted(async () => {
  // If auth store doesn't have current user, try to load it
  if (!authStore.user) {
    try {
      await authStore.fetchCurrentUser()
    } catch (e) {
      console.error('Failed to fetch current user:', e)
    }
  }
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1>Profile Admin</h1>
      <p class="page-subtitle">
        Informasi profil akun Anda
      </p>
    </div>

    <UserCard
      :user="currentUser"
      :loading="isLoading"
      :error="error"
    />
    <ChangePasswordForm />
  </div>
</template>

<style scoped>
.page-container {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 40px;
}

.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-inverse);
  letter-spacing: -0.5px;
}

.page-subtitle {
  margin: 0;
  font-size: 16px;
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 24px;
  }
}
</style>
