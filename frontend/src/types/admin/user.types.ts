export interface Role {
  id: number
  code: string
  name: string
  description?: string
  is_active: boolean
}

export interface User {
  id: number | string
  name: string
  email: string
  is_active: boolean
  roles: Role[]
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: string
  is_active?: boolean
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  password?: string
  role: string
  is_active?: boolean
}

export interface UserResponse {
  success: boolean
  message: string
  data: User
}

export interface UsersListResponse {
  success: boolean
  message: string
  count: number
  data: User[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface RolesResponse {
  success: boolean
  count: number
  data: Role[]
}
