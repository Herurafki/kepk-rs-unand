import apiClient from '../api/client'

export interface SecretariatApplication {
  id: string
  application_number: string
  application_type: string
  research_title?: string | null
  status: string
  created_at: string
  updated_at: string
  researcher_name?: string | null
  researcher_email?: string | null
  researcher_category?: string | null
  researcher_institution?: string | null
  researcher_faculty?: string | null
  researcher_phone?: string | null
  researcher_program_study?: string | null
  researcher_nip?: string | null
  researcher_nim?: string | null
  researcher_nik?: string | null
  researcher_address?: string | null
  researcher_department?: string | null
  review_type?: string | null
  screening?: Record<string, any> | null
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export async function getSecretariatApplications() {
  const response = await apiClient.get<ApiResponse<SecretariatApplication[]>>('/applications')
  return response.data
}

export async function getSecretariatApplication(id: string) {
  const [secretariatResult, applicationResult] = await Promise.all([
    apiClient.get<ApiResponse<SecretariatApplication>>('/sekretaris/applications/' + id),
    apiClient.get<ApiResponse<SecretariatApplication>>('/applications/' + id).catch(() => null),
  ])
  const secretariat = secretariatResult.data
  const generalApplication = applicationResult?.data?.data
  return {
    ...secretariat,
    data: {
      ...secretariat.data,
      screening: secretariat.data.screening ?? generalApplication?.screening ?? null,
    },
  }
}

export async function getSecretariatRevisions(id: string) {
  const response = await apiClient.get<ApiResponse<SecretariatRevision[]>>('/applications/' + id + '/revisions')
  return response.data
}

export interface SecretariatRevision {
  id: string
  revision_number: number
  note?: string | null
  requested_by_name?: string | null
  created_at?: string | null
  submitted_at?: string | null
}

export async function forwardSecretariatApplication(id: string) {
  const response = await apiClient.post<ApiResponse<SecretariatApplication>>('/sekretaris/applications/' + id + '/forward')
  return response.data
}

export async function requestSecretariatRevision(id: string, note: string) {
  const response = await apiClient.post<ApiResponse<SecretariatApplication>>('/sekretaris/applications/' + id + '/revision', { note })
  return response.data
}

export async function rejectSecretariatApplication(id: string, note: string) {
  const response = await apiClient.post<ApiResponse<SecretariatApplication>>('/sekretaris/applications/' + id + '/reject', { note })
  return response.data
}
