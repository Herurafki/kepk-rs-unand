import apiClient from '../api/client'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export interface SecretariatLetter {
  id: string
  application_id: string
  letter_number: string
  registration_number?: string | null
  letter_type: string
  file_path?: string | null
  generated_file_path?: string | null
  issued_by_user_role_id?: string | null
  letter_status: 'GENERATED' | 'SIGNED_UPLOADED' | string
  created_at?: string
  updated_at?: string
  application_number?: string
  application_type?: string
  application_status?: string
  researcher_name?: string | null
  researcher_email?: string | null
}

export async function getSecretariatLetters() {
  const response = await apiClient.get<ApiResponse<SecretariatLetter[]>>('/letters')
  return response.data
}

export async function getSecretariatApplicationLetter(applicationId: string) {
  try {
    const response = await apiClient.get<ApiResponse<SecretariatLetter>>('/applications/' + applicationId + '/letter')
    return response.data.data
  } catch (error: any) {
    if (error.response?.status === 404) return null
    throw error
  }
}

export async function downloadSecretariatLetter(id: string): Promise<Blob> {
  const response = await apiClient.get('/letters/' + id + '/download', { responseType: 'blob' })
  return response.data
}

export async function generateSecretariatLetter(applicationId: string, letterType: string, manualNumber?: string) {
  const response = await apiClient.post<ApiResponse<SecretariatLetter>>(
    '/applications/' + applicationId + '/letter/generate',
    { letter_type: letterType, manual_number: manualNumber },
  )
  return response.data
}

export async function uploadSignedSecretariatLetter(applicationId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file, file.name)
  const response = await apiClient.post<ApiResponse<SecretariatLetter>>(
    '/applications/' + applicationId + '/letter/upload-signed',
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return response.data
}
