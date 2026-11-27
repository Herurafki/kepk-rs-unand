import apiClient from '../api/client'

export interface DiklitApplication {
  id: string
  application_number: string
  application_type: string
  group_category?: string | null
  research_title?: string | null
  research_location?: string | null
  research_institution?: string | null
  research_duration?: string | null
  status: string
  review_type?: string | null
  requires_ethics?: boolean
  created_at: string
  updated_at: string
  verifier_id?: string | number | null
  can_verify?: boolean
  verifier_name?: string | null
  verifier_email?: string | null
  researcher_id?: string
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
}

export interface DiklitScreening {
  question1: string
  question2: string
  question3: string
  question4: string
  question5: string
  question6: string
  recommendation?: 'ETIK' | 'TANPA ETIK' | string | null
}

export interface DiklitApplicationDetail extends DiklitApplication {
  research_background?: string | null
  research_objectives?: string | null
  research_methodology?: string | null
  data_collection_date?: string | null
  data_needed?: string | null
  purpose?: string | null
  person_responsible?: string | null
  parent_application_id?: string | null
  parent_application_number?: string | null
  screening?: DiklitScreening | null
  correspondence?: DiklitCorrespondence | null
  documents?: DiklitDocument[]
}

export interface DiklitCorrespondence {
  incoming_letter_number: string
  incoming_letter_subject: string
  signatory_position: string
  recipient_institution?: string | null
  incoming_letter_date?: string | null
}


export interface DiklitDocument {
  id: string
  document_type?: string | null
  original_name?: string | null
  stored_name?: string | null
  file_path?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_at?: string
  uploaded_by_name?: string | null
}

export interface Letter {
  id: string
  application_id: string
  letter_number: string
  letter_type: string
  file_path?: string | null
  generated_file_path?: string | null
  issued_by_user_role_id?: string | null
  letter_status: 'GENERATED' | 'SIGNED_UPLOADED' | string
  created_at?: string
  updated_at?: string
}

export interface DiklitRevision {
  id: string
  revision_number: number
  note?: string | null
  requested_by_name?: string | null
  created_at?: string | null
  submitted_at?: string | null
}

export interface DiklitRevision {
  id: string
  revision_number: number
  note?: string | null
  requested_by_name?: string | null
  created_at?: string | null
  submitted_at?: string | null
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export async function getDiklitApplications() {
  const response = await apiClient.get<ApiResponse<DiklitApplication[]>>('/applications/')
  return response.data
}

export async function getDiklitApplication(id: string) {
  const response = await apiClient.get<ApiResponse<DiklitApplicationDetail>>('/admin/applications/' + id)
  return response.data
}

export async function getDiklitRevisions(id: string) {
  const response = await apiClient.get<ApiResponse<DiklitRevision[]>>('/applications/' + id + '/revisions')
  return response.data
}

export async function openDiklitApplication(id: string) {
  const response = await apiClient.post<ApiResponse<DiklitApplication>>('/admin/applications/' + id + '/open')
  return response.data
}

export async function approveWithoutEthics(id: string) {
  const response = await apiClient.post<ApiResponse<DiklitApplication>>('/admin/applications/' + id + '/approve-without-ethics')
  return response.data
}

export async function approveWithEthics(id: string) {
  const response = await apiClient.post<ApiResponse<DiklitApplication>>('/admin/applications/' + id + '/approve-with-ethics')
  return response.data
}

export async function requestRevision(id: string, note: string) {
  const response = await apiClient.post<ApiResponse<DiklitApplication>>('/admin/applications/' + id + '/revision', { note })
  return response.data
}

export async function rejectApplication(id: string, note: string) {
  const response = await apiClient.post<ApiResponse<DiklitApplication>>('/admin/applications/' + id + '/reject', { note })
  return response.data
}

export async function getApplicationLetter(applicationId: string) {
  const response = await apiClient.get<ApiResponse<Letter>>('/applications/' + applicationId + '/letter')
  return response.data
}

export async function generateApplicationLetter(applicationId: string, letterType: string, manualNumber?: string) {
  const response = await apiClient.post<ApiResponse<Letter>>(
    '/applications/' + applicationId + '/letter/generate',
    { letter_type: letterType, manual_number: manualNumber },
  )
  return response.data
}

export async function uploadSignedLetter(applicationId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file, file.name)

  const response = await apiClient.post<ApiResponse<Letter>>(
    '/applications/' + applicationId + '/letter/upload-signed',
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return response.data
}

export async function downloadLetter(letterId: string): Promise<Blob> {
  const response = await apiClient.get('/letters/' + letterId + '/download', { responseType: 'blob' })
  return response.data
}

export async function downloadDocument(documentId: string): Promise<Blob> {
  const response = await apiClient.get('/documents/' + documentId + '/download', { responseType: 'blob' })
  return response.data
}
