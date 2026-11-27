import apiClient from '../api/client'

export type ReviewRecommendation = 'APPROVE' | 'REVISION' | 'REJECT'
export type IndicatorAnswers = Record<string, boolean>
export type IndicatorComments = Record<string, string>

export interface ReviewerAssignment {
  id: string | number
  application_id: string | number
  reviewer_id?: string | number
  status?: string
  assigned_at?: string
  updated_at?: string
  rejected_at?: string
  application_number?: string
  application_type?: string
  research_title?: string | null
  researcher_name?: string | null
  review_type?: string | null
  forum_date?: string | null
  application_status?: string
  has_submitted_review?: boolean
  reviewer_state?: 'WAITING' | 'NEEDS_REVISION' | 'IN_REVIEW' | 'FINAL' | string
  review_id?: string | number
  [key: string]: unknown
}

export interface ReviewerApplication {
  id: string | number
  application_number?: string
  application_type?: string
  status?: string
  review_type?: string | null
  forum_date?: string | null
  research_title?: string | null
  research_background?: string | null
  research_objectives?: string | null
  research_methodology?: string | null
  research_location?: string | null
  research_institution?: string | null
  research_duration?: string | null
  data_needed?: string | null
  purpose?: string | null
  person_responsible?: string | null
  group_category?: string | null
  data_collection_date?: string | null
  updated_at?: string
  created_at?: string
  researcher_name?: string | null
  researcher_email?: string | null
  researcher_category?: string | null
  researcher_nim?: string | null
  researcher_nip?: string | null
  researcher_nik?: string | null
  researcher_phone?: string | null
  researcher_address?: string | null
  researcher_institution?: string | null
  researcher_faculty?: string | null
  researcher_program_study?: string | null
  researcher_department?: string | null
  documents?: ReviewerDocument[]
  expedited_revision_requests?: ExpeditedRevisionRequest[]
  expedited_reviewer_states?: ExpeditedReviewerState[]
  [key: string]: unknown
}

export interface ReviewerDocument {
  id: string | number
  document_type?: string | null
  original_name?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_at?: string
  uploaded_by_name?: string | null
}

export interface ExpeditedRevisionItem {
  id: string | number
  document_id: string | number
  document_name?: string | null
  document_type?: string | null
  note: string
  revised_document_id?: string | number | null
  revised_at?: string | null
}
export interface ExpeditedRevisionRequest {
  id: string | number
  reviewer_id: string | number
  reviewer_name?: string
  review_id: string | number
  cycle_number: number
  status: 'OPEN' | 'SUBMITTED' | string
  items: ExpeditedRevisionItem[]
}
export interface ExpeditedReviewerState {
  reviewer_id: string | number
  reviewer_name?: string
  state: 'WAITING' | 'NEEDS_REVISION' | 'IN_REVIEW' | 'FINAL' | string
  last_review_id?: string | number | null
}
export interface ApplicationReviewSummary {
  reviews: Array<Record<string, unknown>>
  current_cycle_reviews: Array<Record<string, unknown>>
  expedited_revision_requests: ExpeditedRevisionRequest[]
  expedited_reviewer_states: ExpeditedReviewerState[]
  reviewer_participation: Array<Record<string, unknown>>
}

export interface ReviewAssessment {
  indicator_answers: IndicatorAnswers
  indicator_comments: IndicatorComments
  suggestion_information_accuracy: string
  suggestion_other_ethics: string
}

export interface SubmitReviewPayload {
  recommendation: ReviewRecommendation
  comment: string
  assessment: ReviewAssessment
  document_revisions?: Array<{ document_id: string | number; note: string }>
}

interface ApiResponse<T> {
  success?: boolean
  message?: string
  data: T
}

function unwrap<T>(response: { data: ApiResponse<T> | T }): T {
  const body = response.data as ApiResponse<T>
  return body && typeof body === 'object' && 'data' in body ? body.data : response.data as T
}

// Tugas reviewer ditentukan oleh status pengajuan, bukan status penugasannya.
const REVIEWER_VISIBLE_APPLICATION_STATUSES = new Set([
  'WAITING_REVIEWER',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'REVIEW_COMPLETED',
])

function isReviewerVisibleApplication(assignment: ReviewerAssignment) {
  return REVIEWER_VISIBLE_APPLICATION_STATUSES.has(assignment.application_status || '')
    && assignment.review_type !== 'EXEMPTED'
}

export async function getReviewerAssignmentRecords() {
  return unwrap<ReviewerAssignment[]>(await apiClient.get('/assignments'))
}

export async function getReviewerAssignments(includeRejected = false) {
  const assignments = await getReviewerAssignmentRecords()
  const enriched = await Promise.all(assignments.map(async (assignment) => {
    try {
      const [application, reviewSummary] = await Promise.all([
        getReviewerApplication(assignment.application_id),
        getApplicationReviewSummary(assignment.application_id).catch(() => null),
      ])
      const ownState = reviewSummary?.expedited_reviewer_states?.find(
        state => String(state.reviewer_id) === String(assignment.reviewer_id),
      )
      return {
        ...assignment,
        application_number: application.application_number,
        application_type: application.application_type,
        research_title: application.research_title || assignment.research_title,
        researcher_name: application.researcher_name,
        review_type: application.review_type,
        forum_date: application.forum_date,
        application_status: application.status || assignment.application_status,
        reviewer_state: ownState?.state,
      }
    } catch {
      // API assignments also expose applications.status as application_status.
      return assignment
    }
  }))
  const reviews = await getReviewerReviews().catch(() => [])
  const visibleAssignments = enriched.filter((assignment) => {
    const rejected = String(assignment.status || '').toUpperCase() === 'REJECTED'
    if (includeRejected && rejected) return assignment.review_type !== 'EXEMPTED'
    if (!isReviewerVisibleApplication(assignment) || rejected) return false
    if (assignment.review_type === 'EXPEDITED') {
      return !['NEEDS_REVISION', 'FINAL'].includes(String(assignment.reviewer_state || '').toUpperCase())
    }
    return true
  })

  // FULLBOARD review is open to active reviewers and does not require assignments.
  try {
    const applications = unwrap<ReviewerApplication[]>(await apiClient.get('/applications'))
    const fullboardTasks: ReviewerAssignment[] = applications
      .filter((application) => application.review_type === 'FULLBOARD'
        && (application.status === 'UNDER_REVIEW' || application.status === 'REVIEW_COMPLETED'))
      .map((application) => ({
        id: 'fullboard-' + application.id,
        application_id: application.id,
        status: 'ACCEPTED',
        assigned_at: application.updated_at || application.created_at,
        application_number: application.application_number,
        application_type: application.application_type,
        research_title: application.research_title,
        researcher_name: application.researcher_name,
        review_type: application.review_type,
        forum_date: application.forum_date,
        application_status: application.status,
      }))
    const knownApplicationIds = new Set(visibleAssignments.map((item) => String(item.application_id)))
    const combined = [...visibleAssignments, ...fullboardTasks.filter((item) => !knownApplicationIds.has(String(item.application_id)))]
    return combined.map((item) => {
      const ownReview = reviews.find(review => String(review.application_id || '') === String(item.application_id) && Number(review.review_cycle || 1) >= Number(review.current_review_cycle || 1))
      return {
        ...item,
        has_submitted_review: item.review_type === 'EXPEDITED' && item.reviewer_state === 'IN_REVIEW'
          ? false : Boolean(ownReview),
        review_id: ownReview?.id as string | number | undefined,
      }
    })
  } catch {
    return visibleAssignments.map((item) => {
      const ownReview = reviews.find(review => String(review.application_id || '') === String(item.application_id) && Number(review.review_cycle || 1) >= Number(review.current_review_cycle || 1))
      return {
        ...item,
        has_submitted_review: item.review_type === 'EXPEDITED' && item.reviewer_state === 'IN_REVIEW'
          ? false : Boolean(ownReview),
        review_id: ownReview?.id as string | number | undefined,
      }
    })
  }
}

export async function getReviewerApplication(id: string | number) {
  // The application detail endpoint already includes own and inherited documents.
  return unwrap<ReviewerApplication>(await apiClient.get('/applications/' + id))
}

export async function downloadReviewerDocument(documentId: string | number): Promise<Blob> {
  const response = await apiClient.get('/documents/' + documentId + '/download', { responseType: 'blob' })
  return response.data
}

export async function submitReviewerAssessment(applicationId: string | number, payload: SubmitReviewPayload) {
  return unwrap<Record<string, unknown>>(
    await apiClient.post('/applications/' + applicationId + '/reviews', payload),
  )
}

export async function getReviewerReviews() {
  return unwrap<Array<Record<string, unknown>>>(await apiClient.get('/reviews'))
}

export async function getReviewComments(reviewId: string | number) {
  return unwrap<Array<Record<string, unknown>>>(await apiClient.get('/reviews/' + reviewId + '/comments'))
}

export async function getApplicationReviews(applicationId: string | number) {
  const response = unwrap<ApplicationReviewSummary | Array<Record<string, unknown>>>(
    await apiClient.get('/applications/' + applicationId + '/reviews'),
  )
  return Array.isArray(response) ? response : response.reviews || []
}

export async function getApplicationReviewSummary(applicationId: string | number): Promise<ApplicationReviewSummary | null> {
  const response = unwrap<ApplicationReviewSummary | Array<Record<string, unknown>>>(
    await apiClient.get('/applications/' + applicationId + '/reviews'),
  )
  if (Array.isArray(response)) return null
  return response
}

export async function acceptReviewerAssignment(assignmentId: string | number) {
  return unwrap<Record<string, unknown>>(
    await apiClient.post('/assignments/' + assignmentId + '/accept'),
  )
}

export async function rejectReviewerAssignment(assignmentId: string | number) {
  return unwrap<Record<string, unknown>>(
    await apiClient.post('/assignments/' + assignmentId + '/reject'),
  )
}
