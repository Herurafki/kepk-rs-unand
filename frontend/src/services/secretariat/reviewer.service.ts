import apiClient from '../api/client'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export interface Reviewer {
  id: string | number
  name: string
  email: string
  is_active: boolean
  specialization?: string | null
  position?: string | null
  organization?: string | null
  phone?: string | null
  address?: string | null
}

export async function getReviewers() {
  const response = await apiClient.get<ApiResponse<Reviewer[]>>('/users/reviewers')
  return response.data
}
