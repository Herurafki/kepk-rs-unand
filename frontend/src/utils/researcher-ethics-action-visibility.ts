import apiClient from '../services/api/client'

export const installResearcherEthicsActionVisibility = () => {
  const scan = async () => {
    if (!window.location.pathname.includes('/dashboard/research/status')) return

    const card = document.querySelector<HTMLElement>('.ethics-action-card')
    if (!card) return

    try {
      const response = await apiClient.get<{ success: boolean; data: Array<{ application_number?: string; application_type?: string; id: string | number; parent_application_id?: string | number | null }> }>('/applications/')
      const applications = response.data.data || []
      const parentIds = new Set(
        applications
          .filter((application) => application.application_type === 'IZIN_ETIK' && application.parent_application_id != null)
          .map((application) => String(application.parent_application_id)),
      )

      document.querySelectorAll<HTMLElement>('.ethics-action-card').forEach((element) => {
        const button = element.querySelector<HTMLButtonElement>('.ethics-action-button')
        const text = element.textContent || ''
        const match = text.match(/APP-\d{4}-\d+/)
        if (match) {
          const parent = applications.find((application) => application.application_number === match[0])
          if (parent && parentIds.has(String(parent.id))) element.remove()
        }
        if (!button) return
      })
    } catch {
      // Existing Vue logic remains the fallback when the supplementary check fails.
    }
  }

  const observer = new MutationObserver(() => void scan())
  observer.observe(document.body, { childList: true, subtree: true })
  scan()
}
