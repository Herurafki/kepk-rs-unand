import { apiClient } from '../api'

export interface ResearcherProfileData {
  nik?: string | null
  nim?: string | null
  nip?: string | null
  phone?: string | null
  address?: string | null
  faculty?: string | null
  department?: string | null
  institution?: string | null
  program_study?: string | null
}

export interface ProfileResponse {
  success: boolean
  message: string
  data: {
    user: any
  }
}

/**
 * Update researcher profile
 * PUT /api/users/researchers/me
 */
export const updateResearcherProfile = async (
  profileData: ResearcherProfileData,
): Promise<ProfileResponse> => {
  const response = await apiClient.put<ProfileResponse>(
    '/users/researchers/me',
    profileData,
  )
  return response.data
}
