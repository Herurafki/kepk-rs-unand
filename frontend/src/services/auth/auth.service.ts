import { apiClient } from '../api'
import type { AuthUser } from '../../stores/routes/auth'

export type LoginPayload =
  | { email: string; password: string }
  | { nik: string; password: string }

interface AuthMeResponse {
  success: boolean
  data: {
    user: AuthUser
  }
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  await apiClient.post('/auth/login', payload)

  const response = await apiClient.get<AuthMeResponse>('/auth/me')

  return response.data.data.user
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export interface Category {
  id: string
  name: string
}

export interface CategoriesResponse {
  success: boolean
  data: Category[]
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  category_id: string
  profile: {
    nim?: string
    nip?: string
    nik?: string
    institution?: string
    faculty?: string
    program_study?: string
    department?: string
    phone: string
    address: string
  }
}

export async function register(payload: RegisterPayload): Promise<{ verification_email_sent?: boolean }> {
  const response = await apiClient.post<{ data?: { user?: { verification_email_sent?: boolean } } }>('/auth/register', payload)
  return response.data.data?.user ?? {}
}

export async function verifyEmail(token: string): Promise<{ verified: boolean; message: string }> {
  const response = await apiClient.get<{ data: { verified: boolean; message: string } }>('/auth/verify-email', { params: { token } })
  return response.data.data
}

export async function resendVerification(email: string): Promise<{ message: string; sent?: boolean }> {
  const response = await apiClient.post<{ data: { message: string }; message?: string }>('/auth/resend-verification', { email })
  return { message: response.data.message ?? response.data.data?.message ?? 'Jika akun Peneliti belum terverifikasi, tautan akan dikirim.' }
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await apiClient.get<CategoriesResponse>('/researchers-categories')
  return response.data.data
}