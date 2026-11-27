import apiClient from './api/client'

export interface LetterNumberSettings {
  templates: Record<string, string>
  registration_start: number
  editable_templates: string[]
  can_edit_registration_start: boolean
}

type ApiResponse<T> = { success: boolean; message?: string; data: T }

export async function getLetterNumberSettings() {
  const response = await apiClient.get<ApiResponse<LetterNumberSettings>>('/settings/letter-numbers')
  return response.data.data
}

export async function saveLetterNumberSettings(payload: {
  templates: Record<string, string>
  registration_start?: number
  password: string
}) {
  const response = await apiClient.put<ApiResponse<LetterNumberSettings>>('/settings/letter-numbers', payload)
  return response.data
}
