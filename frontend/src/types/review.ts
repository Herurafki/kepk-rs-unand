import type { ReviewAssessment, ReviewRecommendation } from '../services/reviewer/review.service'

export interface ReviewerReviewDraft {
  recommendation: ReviewRecommendation | ''
  comment: string
  assessment: ReviewAssessment
}
