import apiClient from '../api/client';

export type ChiefApplication = {
  id: string | number;
  application_number: string;
  application_type: string;
  status: string;
  review_type?: string | null;
  requires_ethics?: boolean;
  research_title?: string | null;
  researcher_name?: string | null;
  researcher_email?: string | null;
  researcher_category?: string | null;
  researcher_nim?: string | null;
  researcher_nip?: string | null;
  researcher_nik?: string | null;
  researcher_phone?: string | null;
  researcher_address?: string | null;
  researcher_institution?: string | null;
  researcher_faculty?: string | null;
  researcher_program_study?: string | null;
  researcher_department?: string | null;
  created_at: string;
  updated_at?: string;
  parent_application_id?: string | number | null;
  screening?: Record<string, any> | null;
  documents?: any[];
  [key: string]: any;
};

export type Reviewer = {
  id: string | number;
  name: string;
  email?: string;
  is_active?: boolean;
};

export type Review = {
  id: string | number;
  application_id: string | number;
  reviewer_id: string | number;
  recommendation?: string | undefined;
  status?: string;
  comments?: Array<string | { comment?: string }> | string;
  indicator_answers?: Record<string, boolean | string> | string | null;
  indicator_comments?: Record<string, string> | string | null;
  suggestion_information_accuracy?: string | null;
  suggestion_other_ethics?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
  review_cycle?: number;
  current_review_cycle?: number;
  reviewer_state?: string;
}

const unwrap = <T>(response: any): T => response.data?.data ?? response.data;

export async function getChiefApplications() {
  return unwrap<ChiefApplication[]>(await apiClient.get('/applications'));
}

export async function getChiefApplication(id: string) {
  return unwrap<ChiefApplication>(await apiClient.get(`/applications/${id}`));
}

export type ChiefRevision = {
  id: string | number;
  revision_number: number;
  note?: string | null;
  requested_by_name?: string | null;
  requested_by_roles?: string[];
  created_at?: string | null;
  submitted_at?: string | null;
};

export async function getChiefRevisions(id: string) {
  return unwrap<ChiefRevision[]>(await apiClient.get(`/applications/${id}/revisions`));
}

export async function getApplicationReviewData(id: string) {
  const response = unwrap<any>(await apiClient.get(`/applications/${id}/reviews`));
  if (Array.isArray(response)) return { reviews: response as Review[], current_cycle_reviews: response as Review[], reviewer_participation: [], expedited_reviewer_states: [], expedited_revision_requests: [], reviewer_summary: null };
  return {
    reviews: Array.isArray(response?.reviews) ? response.reviews as Review[] : [],
    current_cycle_reviews: Array.isArray(response?.current_cycle_reviews) ? response.current_cycle_reviews as Review[] : (Array.isArray(response?.reviews) ? response.reviews as Review[] : []),
    reviewer_participation: Array.isArray(response?.reviewer_participation) ? response.reviewer_participation : [],
    expedited_reviewer_states: Array.isArray(response?.expedited_reviewer_states) ? response.expedited_reviewer_states : [],
    expedited_revision_requests: Array.isArray(response?.expedited_revision_requests) ? response.expedited_revision_requests : [],
    reviewer_summary: response?.reviewer_summary ?? null,
  };
}

export async function getApplicationReviews(id: string): Promise<Review[]> {
  return (await getApplicationReviewData(id)).reviews;
}

export async function getReviewResult(id: string) {
  return unwrap<any>(await apiClient.get(`/applications/${id}/review-result`));
}

export async function getReviewComment(id: string) {
  return unwrap<any[]>(await apiClient.get(`/reviews/${id}/comments`));
}

export async function getAssignments() {
  return unwrap<any[]>(await apiClient.get('/assignments'));
}

export async function getAvailableReviewers() {
  return unwrap<Reviewer[]>(await apiClient.get('/assignments/reviewers'));
}

export async function setReviewType(id: string, reviewType: string, forumDate?: string) {
  return unwrap<ChiefApplication>(
    await apiClient.put(`/applications/${id}/review-type`, {
      review_type: reviewType,
      ...(forumDate ? { forum_date: forumDate } : {}),
    })
  );
}

export async function assignReviewer(applicationId: string, reviewerId: string, reviewType: string) {
  return unwrap<any>(
    await apiClient.post('/assignments', {
      application_id: applicationId,
      reviewer_id: reviewerId,
      review_type: reviewType,
    })
  );
}

export async function closeForum(id: string, note?: string) {
  return unwrap<any>(await apiClient.post(`/applications/${id}/close-forum`, { note }));
}

export async function decideApprove(id: string, note?: string) {
  return unwrap<any>(await apiClient.post(`/applications/${id}/decision/approve`, { note }));
}

export async function decideRevision(id: string, note: string) {
  return unwrap<any>(await apiClient.post(`/applications/${id}/decision/revision`, { note }));
}

export async function decideReject(id: string, note?: string) {
  return unwrap<any>(await apiClient.post(`/applications/${id}/decision/reject`, { note }));
}

export type ChiefFinalDecision = 'APPROVED' | 'APPROVED_MINOR' | 'MAJOR_REVISION' | 'REJECTED' | 'NOT_ASSESSABLE';

export async function decideFinal(id: string, decision: ChiefFinalDecision, note?: string) {
  return unwrap<any>(await apiClient.post(`/applications/${id}/decision/final`, { decision, note }));
}