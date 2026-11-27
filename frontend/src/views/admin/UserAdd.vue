<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminUserStore } from '../../stores/admin/user.store'
import UserForm from '../../components/admin/user/UserForm.vue'
import type { CreateUserPayload } from '../../types/admin/user.types'

const router = useRouter()
const userStore = useAdminUserStore()

const showSuccess = ref(false)
const successTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

onMounted(async () => {
  // Load roles for the dropdown
  if (userStore.roles.length === 0) {
    await userStore.loadRoles()
  }
})

const handleSubmit = async (payload: CreateUserPayload) => {
  try {
    await userStore.addUser(payload)
    showSuccess.value = true
    userStore.clearError()

    // Show success message and redirect
    successTimeout.value = setTimeout(() => {
      router.push('/admin/user-list')
    }, 2000)
  } catch (error) {
    console.error('Failed to create user:', error)
    // Error is already set in the store
    showSuccess.value = false
  }
}

const handleReset = () => {
  userStore.clearError()
  showSuccess.value = false
  if (successTimeout.value) {
    clearTimeout(successTimeout.value)
  }
}

onMounted(() => {
  return () => {
    if (successTimeout.value) {
      clearTimeout(successTimeout.value)
    }
  }
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1>Tambah User Baru</h1>
      <p class="page-subtitle">
        Buat akun pengguna baru dan tetapkan role mereka
      </p>
    </div>

    <UserForm
      :roles="userStore.roles"
      :loading="userStore.isLoading"
      :loading-roles="userStore.isLoadingRoles"
      :error="userStore.error"
      :roles-error="userStore.rolesError"
      :success="showSuccess"
      @submit="handleSubmit"
      @reset="handleReset"
    />
  </div>
</template>

<style scoped>
.page-container {
  max-width: 900px;
  margin: 0;
}

.page-header {
  margin-bottom: 40px;
  padding-left: 12px;
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

@media (max-width: 768px) {
  .page-container {
    max-width: 100%;
  }

  .page-header h1 {
    font-size: 24px;
  }
}
</style>
