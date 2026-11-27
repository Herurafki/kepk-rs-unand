import apiClient from '../services/api/client'

type ParentApplication = {
  application_type?: string
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
}

type ApiResponse<T> = { success: boolean; data: T }

const setField = (id: string, value: string | null | undefined) => {
  const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  if (!element || value == null) return

  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

const loadParent = async (parentId: string) => {
  try {
    const response = await apiClient.get<ApiResponse<ParentApplication>>(`/applications/${parentId}`)
    const application = response.data.data
    if (!application || application.application_type !== 'IZIN_PENELITIAN') return

    setField('research-title', application.research_title)
    setField('research-summary', application.research_background)
    setField('research-purpose', application.research_objectives ?? application.purpose)
    setField('supervisor', application.person_responsible)
    setField('research-duration', application.research_duration)
    setField('target-unit', application.research_location)
    setField('research-method', application.research_methodology)
    setField('data-requirements', application.data_needed)
  } catch {
    // The form remains usable when parent data cannot be loaded.
  }
}

export const installEthicsParentAutofill = () => {
  let loadedFor = ''

  const scan = () => {
    if (!window.location.pathname.endsWith('/research/ethics')) return

    const raw = new URLSearchParams(window.location.search).get('applicationId')?.trim() || ''
    if (!/^\d+$/.test(raw) || raw === loadedFor) return
    if (!document.getElementById('research-title')) return

    loadedFor = raw
    void loadParent(raw)
  }

  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('popstate', scan)
  scan()
}
