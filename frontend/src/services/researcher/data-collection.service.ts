import apiClient from '../../services/api/client';

export interface ApplicationCorrespondenceSubmission { incoming_letter_number: string; incoming_letter_subject: string; signatory_position: string; }

export interface DataCollectionSubmission {
  application_type: 'DATA_AWAL';
  group_category: string;
  research_title: string;
  research_location: string;
  research_institution: string;
  data_collection_date: string;
  data_needed: string;
  purpose: string;
  person_responsible: string;
  correspondence: ApplicationCorrespondenceSubmission;
  documents: File[];
  document_types: string[];
}

export interface ResearchApplicationSubmission {
  application_type: 'IZIN_PENELITIAN';
  group_category: string;
  research_title: string;
  research_background: string;
  research_objectives: string;
  research_methodology: string;
  research_location: string;
  research_institution: string;
  research_duration: string;
  data_needed: string;
  purpose: string;
  person_responsible: string;
  correspondence: ApplicationCorrespondenceSubmission;
  screening: {
    question1: string;
    question2: string;
    question3: string;
    question4: string;
  };
  documents: File[];
  document_types: string[];
}

export interface EthicsApplicationSubmission {
  application_type: 'IZIN_ETIK';
  parent_application_id?: string;
  group_category: string;
  research_title: string;
  research_background: string;
  research_objectives: string;
  research_methodology: string;
  research_location: string;
  research_institution: string;
  research_duration: string;
  data_needed: string;
  purpose: string;
  person_responsible: string;
  screening: {
    question1: string;
    question2: string;
    question3: string;
    question4: string;
    question5: string;
    question6: string;
  };
  documents: File[];
  document_types: string[];
}

export interface ResearchApplicationResponse {
  success: boolean;
  data: { id: string };
}

export interface DocumentUpload {
  file: File;
  document_type?: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  file_name?: string;
  original_name?: string;
  file_path?: string;
  mime_type?: string;
  file_size?: number;
  document_type?: string;
  uploaded_at?: string;
  created_at?: string;
}

export interface ApplicationScreeningAnswers {
  question1?: string;
  question2?: string;
  question3?: string;
  question4?: string;
  question5?: string;
  question6?: string;
}

export interface ApplicationScreening {
  id?: string;
  application_id?: string;
  screening_type?: string;
  answers?: ApplicationScreeningAnswers;
  recommendation?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApplicationData {
  id: string;
  researcher_id: string;
  application_number: string;
  application_type: string;
  parent_application_id?: string | null;
  parent_application_number?: string | null;
  group_category: string;
  research_title: string;
  research_location?: string;
  research_institution?: string;
  data_collection_date?: string;
  data_needed?: string;
  purpose?: string;
  person_responsible: string;
  status: string;
  requires_ethics?: boolean;
  has_ethics_application?: boolean;
  created_at: string;
  updated_at: string;
  research_background?: string;
  research_subject?: string;
  research_objectives?: string;
  research_methodology?: string;
  research_duration?: string;
  screening?: ApplicationScreening;
  documents?: ApplicationDocument[];
}

export interface DataCollectionResponse {
  success: boolean;
  data: ApplicationData;
}

export interface DocumentResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    application_id: string;
    file_name: string;
    file_path: string;
    document_type?: string;
    uploaded_at: string;
  };
}

export interface ApplicationHistory {
  id: string;
  application_id: string;
  previous_status?: string | null;
  new_status: string;
  changed_by: string;
  changed_by_name?: string | null;
  changed_by_roles?: string[];
  note?: string | null;
  created_at: string;
}

export interface ApplicationHistoryResponse {
  success: boolean;
  message?: string;
  data: ApplicationHistory[];
}

export interface ApplicationRevisionPayload {
  group_category?: string;
  research_title?: string;
  research_background?: string;
  research_objectives?: string;
  research_methodology?: string;
  research_location?: string;
  research_institution?: string;
  research_duration?: string;
  data_collection_date?: string;
  data_needed?: string;
  purpose?: string;
  person_responsible?: string;
  revised_documents?: Array<{ item_id: string | number; document_id: string | number }>;
}

const postMultipart = async <T>(url: string, formData: FormData): Promise<T> =>
  (await apiClient.post<T>(url, formData, { headers: { 'Content-Type': undefined } })).data;

export async function submitDataCollection(
  submission: DataCollectionSubmission
): Promise<DataCollectionResponse> {
  const formData = new FormData();
  Object.entries(submission).forEach(([key, value]) => {
    if (key !== 'documents' && key !== 'document_types') {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  });
  submission.documents.forEach((d) => formData.append('documents', d, d.name));
  formData.append('document_types', JSON.stringify(submission.document_types));
  return postMultipart('/applications', formData);
}

export async function createResearchApplication(
  submission: ResearchApplicationSubmission
): Promise<ResearchApplicationResponse> {
  const formData = new FormData();
  Object.entries(submission).forEach(([key, value]) => {
    if (key !== 'documents' && key !== 'document_types') {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  });
  submission.documents.forEach((d) => formData.append('documents', d, d.name));
  formData.append('document_types', JSON.stringify(submission.document_types));
  return postMultipart('/applications', formData);
}

export async function submitEthicsApplication(
  submission: EthicsApplicationSubmission
): Promise<ResearchApplicationResponse> {
  const formData = new FormData();
  Object.entries(submission).forEach(([key, value]) => {
    if (key !== 'documents' && key !== 'document_types' && value !== undefined && value !== null) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  });
  submission.documents.forEach((d) => formData.append('documents', d, d.name));
  formData.append('document_types', JSON.stringify(submission.document_types));
  return postMultipart('/applications', formData);
}

export async function getApplicationDocuments(applicationId: string) {
  return (await apiClient.get(`/applications/${applicationId}/documents`)).data;
}

export async function downloadApplicationDocument(documentId: string): Promise<Blob> {
  return (await apiClient.get(`/documents/${documentId}/download`, { responseType: 'blob' })).data;
}

export async function deleteApplicationDocument(documentId: string) {
  return (await apiClient.delete(`/documents/${documentId}`)).data;
}

export async function uploadApplicationDocument(
  applicationId: string,
  document: DocumentUpload
): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append('file', document.file, document.file.name);
  if (document.document_type) {
    formData.append('document_type', document.document_type);
  }
  return postMultipart(`/applications/${applicationId}/documents`, formData);
}

export async function getDataCollectionSubmissions() {
  return (await apiClient.get('/applications?type=data-collection')).data;
}

export async function getAllApplications() {
  return (await apiClient.get('/applications')).data;
}

export async function getApplicationHistory(
  applicationId: string
): Promise<ApplicationHistoryResponse> {
  return (await apiClient.get<ApplicationHistoryResponse>(`/applications/${applicationId}/history`)).data;
}

export async function getDataCollectionDetail(
  applicationId: string
): Promise<DataCollectionResponse> {
  return (await apiClient.get<DataCollectionResponse>(`/applications/${applicationId}`)).data;
}

export async function reviseApplication(
  applicationId: string,
  payload: ApplicationRevisionPayload
): Promise<DataCollectionResponse> {
  return (await apiClient.post<DataCollectionResponse>(`/applications/${applicationId}/revise`, payload)).data;
}