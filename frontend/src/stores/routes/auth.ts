import { hasAnyRole } from '../../utils/role-permissions'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { apiClient } from '../../services/api'
import { login as loginRequest, logout as logoutRequest, type LoginPayload } from '../../services/auth/auth.service'

export interface AuthUser {
  id: string
  name: string
  email: string
  is_active: boolean
  roles: string[]
  researcher?: {
    id: string
    category?: {
      id: number
      name: string
    }
    profile?: {
      nik: string | null
      nim: string | null
      nip: string | null
      phone: string | null
      address: string | null
      faculty: string | null
      department: string | null
      institution: string | null
      program_study: string | null
    }
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const hasRole = (role: string) => {
    return hasAnyRole(user.value?.roles ?? [], [role])
  }

  async function fetchCurrentUser() {
    loading.value = true

    try {
      const response = await apiClient.get<{
        success: boolean
        data: {
          user: AuthUser
        }
      }>('/auth/me')

      user.value = response.data.data.user
    } catch {
      user.value = null
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function login(payload: LoginPayload) {
    loading.value = true
    try {
      user.value = await loginRequest(payload)
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true

    try {
      await logoutRequest()
    } finally {
      user.value = null
      loading.value = false
    }
  }

  function clearAuth() {
    user.value = null
  }

  return {
    user,
    initialized,
    loading,
    isAuthenticated,
    fetchCurrentUser,
    login,
    logout,
    clearAuth,
	hasRole,
  }
})
