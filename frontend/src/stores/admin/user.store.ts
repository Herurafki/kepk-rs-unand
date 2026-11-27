import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { userManagementService } from '../../services/admin/user-management.service'
import type { User, Role, CreateUserPayload, UpdateUserPayload } from '../../types/admin/user.types'

export const useAdminUserStore = defineStore('admin-user', () => {
  // State
  const users = ref<User[]>([])
  const filteredUsers = ref<User[]>([])
  const roles = ref<Role[]>([])
  const selectedUser = ref<User | null>(null)
  const isLoading = ref(false)
  const isLoadingRoles = ref(false)
  const error = ref<string | null>(null)
  const rolesError = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const searchQuery = ref('')

  // Getters
  const userCount = computed(() => users.value.length)
  const isError = computed(() => error.value !== null)
  const hasUsers = computed(() => users.value.length > 0)

  // Actions
  const loadUsers = async (page: number = 1, search?: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userManagementService.listUsers(
        page,
        pagination.value.limit,
        search,
      )

      users.value = response.data

      // Initialize filtered users with all users (no search filter applied yet)
      filteredUsers.value = response.data

      // Handle pagination response from API
      if (response.pagination) {
        // API provides pagination object
        pagination.value = response.pagination
      } else {
        // Fallback 1: use response.count if provided
        // Fallback 2: calculate total from data.length (when all data returned in one request)
        const totalCount = response.count || response.data.length || 0
        const calculatedPages = Math.ceil(totalCount / pagination.value.limit)

        pagination.value = {
          page: page,  // Use the requested page number
          limit: pagination.value.limit,
          total: totalCount,
          pages: calculatedPages > 0 ? calculatedPages : 1,
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users'
      error.value = errorMessage
      console.error('Load users error:', err)
    } finally {
      isLoading.value = false
    }
  }

  const loadRoles = async () => {
    isLoadingRoles.value = true
    rolesError.value = null

    try {
      const rolesData = await userManagementService.fetchRoles()
      roles.value = rolesData

      if (rolesData.length === 0) {
        console.warn('No roles returned from API - endpoint returned empty array')
        rolesError.value = 'Tidak ada role yang tersedia di sistem'
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal memuat daftar role'
      console.error('Load roles error:', err)
      rolesError.value = errorMessage
      roles.value = []
    } finally {
      isLoadingRoles.value = false
    }
  }

  const loadUserDetail = async (userId: number | string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userManagementService.getUserById(userId)
      selectedUser.value = response.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user'
      error.value = errorMessage
      console.error('Load user detail error:', err)
    } finally {
      isLoading.value = false
    }
  }

  const addUser = async (payload: CreateUserPayload) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userManagementService.createUser(payload)
      users.value.unshift(response.data)
      return response.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user'
      error.value = errorMessage
      console.error('Create user error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const updateUserData = async (userId: number | string, payload: UpdateUserPayload) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userManagementService.updateUser(userId, payload)
      const updatedUser = response.data
      const matchesUser = (user: User) => String(user.id) === String(userId)

      const index = users.value.findIndex(matchesUser)
      if (index > -1) users.value[index] = updatedUser

      const filteredIndex = filteredUsers.value.findIndex(matchesUser)
      if (filteredIndex > -1) filteredUsers.value[filteredIndex] = updatedUser

      if (selectedUser.value && matchesUser(selectedUser.value)) {
        selectedUser.value = updatedUser
      }
      return updatedUser
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user'
      error.value = errorMessage
      console.error('Update user error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const setUserActiveStatus = async (userId: number | string, isActive: boolean) => {
    isLoading.value = true
    error.value = null
    try {
      const response = await userManagementService.setUserActiveStatus(userId, isActive)
      const index = users.value.findIndex(user => String(user.id) === String(userId))
      if (index !== -1) users.value[index] = { ...users.value[index], ...response.data }
      const filteredIndex = filteredUsers.value.findIndex(user => String(user.id) === String(userId))
      if (filteredIndex !== -1) filteredUsers.value[filteredIndex] = { ...filteredUsers.value[filteredIndex], ...response.data }
      if (selectedUser.value && String(selectedUser.value.id) === String(userId)) {
        selectedUser.value = { ...selectedUser.value, ...response.data }
      }
      return response.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal mengubah status akun'
      error.value = errorMessage
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const setSearchQuery = (query: string) => {
    searchQuery.value = query
    pagination.value.page = 1
    filterUsersBySearch(query)
  }

  // Client-side search filtering
  const filterUsersBySearch = (query: string) => {
    if (!query.trim()) {
      // No search query - show all users
      filteredUsers.value = users.value
    } else {
      // Filter by name or email (case-insensitive)
      const lowerQuery = query.toLowerCase().trim()
      filteredUsers.value = users.value.filter(user => {
        const nameMatch = user.name.toLowerCase().includes(lowerQuery)
        const emailMatch = user.email.toLowerCase().includes(lowerQuery)
        return nameMatch || emailMatch
      })
    }

    // Update pagination based on filtered results
    const filteredCount = filteredUsers.value.length
    const calculatedPages = Math.ceil(filteredCount / pagination.value.limit)

    pagination.value = {
      page: 1,
      limit: pagination.value.limit,
      total: filteredCount,
      pages: calculatedPages > 0 ? calculatedPages : 1,
    }
  }

  const clearSelectedUser = () => {
    selectedUser.value = null
  }

  return {
    // State
    users,
    filteredUsers,
    roles,
    selectedUser,
    isLoading,
    isLoadingRoles,
    error,
    rolesError,
    pagination,
    searchQuery,
    // Getters
    userCount,
    isError,
    hasUsers,
    // Actions
    loadUsers,
    loadRoles,
    loadUserDetail,
    addUser,
    updateUserData,
    setUserActiveStatus,
    clearError,
    setSearchQuery,
    filterUsersBySearch,
    clearSelectedUser,
  }
})
