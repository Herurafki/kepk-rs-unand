import apiClient from '../api/client'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export interface ApplicationHistory {
  id: string | number
  application_id: string | number
  previous_status?: string | null
  new_status: string
  changed_by: string | number
  changed_by_name?: string | null
  note?: string | null
  created_at: string
}

export async function getApplicationHistory(applicationId: string) {
  const response = await apiClient.get<ApiResponse<ApplicationHistory[]>>('/applications/' + applicationId + '/history')
  return response.data
}
