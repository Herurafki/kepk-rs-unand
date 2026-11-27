import { apiClient } from '../api'
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserResponse,
  UsersListResponse,
  RolesResponse,
} from '../../types/admin/user.types'

/**
 * User Management Service
 * Provides API methods for admin user management operations
 *
 * Note: apiClient baseURL is already set to /api via VITE_API_BASE_URL
 * So we only specify the resource path (e.g., /users)
 */

export const userManagementService = {
  /**
   * Fetch all users with pagination
   */
  async listUsers(page: number = 1, limit: number = 10, search?: string) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (search) {
      params.append('search', search)
    }

    const response = await apiClient.get<UsersListResponse>(
      `/users?${params.toString()}`,
    )

    return response.data
  },

  /**
   * Get a single user by ID
   */
  async getUserById(userId: number | string) {
    const response = await apiClient.get<UserResponse>(
      `/users/${userId}`,
    )

    return response.data
  },

  /**
   * Create a new user
   */
  async createUser(payload: CreateUserPayload) {
    const response = await apiClient.post<UserResponse>(
      `/users`,
      payload,
    )

    return response.data
  },

  /**
   * Update an existing user
   */
  async updateUser(userId: number | string, payload: UpdateUserPayload) {
    const response = await apiClient.put<UserResponse>(
      `/users/${userId}`,
      payload,
    )

    return response.data
  },

  /** Change whether a user account can access the system. */
  async setUserActiveStatus(userId: number | string, isActive: boolean) {
    const response = await apiClient.patch<UserResponse>(
      `/users/${userId}/status`,
      { is_active: isActive },
    )
    return response.data
  },

  /**
   * Fetch all available roles for user management
   * Throws error if fetch fails so caller can handle it
   */
  async fetchRoles() {
    const response = await apiClient.get<RolesResponse>('/users/roles')
    return response.data.data
  },

  /**
   * Get current admin's profile (same user data, different context)
   */
  async getCurrentUser() {
    const response = await apiClient.get<UserResponse>(
      '/auth/me',
    )

    return response.data.data
  },
}
