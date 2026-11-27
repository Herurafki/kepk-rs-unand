import apiClient from '../services/api/client'

type RevisionItem = {
  id: string | number
  revision_number: number
  note?: string | null
  requested_by_name?: string | null
  created_at?: string | null
  submitted_at?: string | null
}

type ApplicationDetail = {
  application_type?: string
  status?: string
  requires_ethics?: boolean | null
}

export const statusLabel = (value?: string | null) => ({
  SUBMITTED: 'Menunggu Verifikasi',
  ADMIN_REVIEW: 'Sedang Diverifikasi',
  REVISION_REQUIRED: 'Perlu Revisi',
  ADMIN_APPROVED: 'Disetujui Administrasi',
  APPROVED: 'Disetujui KEPK',
  REJECTED: 'Ditolak',
  PERMIT_ISSUED: 'Surat Diterbitkan',
}[value || ''] || value || '—')

const fmt = (value?: string | null) => value
  ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) => {
  const element = document.createElement(tag)
  if (className) element.className = className
  return element
}

const installRevisionStyles = () => {
  if (document.querySelector('[data-diklit-revision-styles]')) return
  const style = document.createElement('style')
  style.dataset.diklitRevisionStyles = 'true'
  style.textContent = `
    .diklit-revision-card .revision-body { padding: 14px 20px 18px; }
    .diklit-revision-list { display: grid; gap: 10px; }
    .diklit-revision-item { padding: 13px; border: 1px solid var(--border); border-radius: 11px; background: var(--color-surface); }
    .diklit-revision-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .diklit-revision-top > div { display: grid; gap: 3px; }
    .diklit-revision-top strong { color: var(--foreground); font-size: .82rem; }
    .diklit-revision-top span { color: var(--muted-foreground); font-size: .7rem; }
    .diklit-revision-status { flex: 0 0 auto; padding: 4px 8px; border-radius: 999px; background: var(--color-warning-soft); color: var(--color-warning); font-size: .66rem; font-weight: 700; }
    .diklit-revision-status--done { background: var(--color-success-soft); color: var(--color-success); }
    .diklit-revision-item p { margin: 10px 0; color: var(--foreground); font-size: .8rem; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
    .diklit-revision-meta { display: flex; flex-wrap: wrap; gap: 8px 14px; color: var(--muted-foreground); font-size: .67rem; }
  `
  document.head.appendChild(style)
}

export const addRevisionCard = async (id: string) => {
  const side = document.querySelector('.detail-page .side-column')
  if (!side || document.querySelector('[data-diklit-revisions]')) return

  try {
    const response = await apiClient.get<{ success: boolean; data: RevisionItem[] }>(`/applications/${id}/revisions`)
    const revisions = response.data.data || []
    installRevisionStyles()

    const card = make('article', 'card revision-card diklit-revision-card')
    card.dataset.diklitRevisions = 'true'

    const header = make('header', 'card-header')
    const icon = make('span')
    icon.textContent = '↺'
    const title = make('h2')
    title.textContent = 'Catatan & Riwayat Revisi'
    header.append(icon, title)

    const body = make('div', 'revision-body')

    if (!revisions.length) {
      const empty = make('div', 'empty-text')
      empty.textContent = 'Belum ada catatan revisi untuk pengajuan ini.'
      body.append(empty)
    } else {
      const list = make('div', 'diklit-revision-list')
      revisions.forEach((item) => {
        const row = make('div', 'diklit-revision-item')
        const top = make('div', 'diklit-revision-top')
        const identity = make('div')
        const number = make('strong')
        number.textContent = `Revisi #${item.revision_number}`
        const requester = make('span')
        requester.textContent = item.requested_by_name || 'Petugas KEPK'
        identity.append(number, requester)

        const state = make('span', `diklit-revision-status${item.submitted_at ? ' diklit-revision-status--done' : ''}`)
        state.textContent = item.submitted_at ? 'Sudah diperbaiki' : 'Belum diperbaiki'
        top.append(identity, state)
        row.append(top)

        const note = make('p')
        note.textContent = item.note || 'Tidak ada catatan revisi.'
        row.append(note)

        const meta = make('div', 'diklit-revision-meta')
        const requested = make('span')
        requested.textContent = `Diminta ${fmt(item.created_at)}`
        meta.append(requested)
        if (item.submitted_at) {
          const submitted = make('span')
          submitted.textContent = `Dikirim ulang ${fmt(item.submitted_at)}`
          meta.append(submitted)
        }
        row.append(meta)
        list.append(row)
      })
      body.append(list)
    }

    card.append(header, body)

    const actionCard = Array.from(side.querySelectorAll<HTMLElement>('.action-card'))
      .find((item) => item.textContent?.includes('Tindakan Verifikasi'))
    if (actionCard) actionCard.insertAdjacentElement('afterend', card)
    else side.append(card)
  } catch {
    // Riwayat revisi bersifat tambahan; kegagalannya tidak memblokir detail.
  }
}

const enforceLetterActions = async (id: string) => {
  try {
    const response = await apiClient.get<{ success: boolean; data: ApplicationDetail }>(`/admin/applications/${id}`)
    const app = response.data.data
    const side = document.querySelector('.detail-page .side-column')
    if (!side) return

    const cards = Array.from(side.querySelectorAll<HTMLElement>('.action-card'))
    const letterCard = cards.find((card) => card.textContent?.includes('Kelola Surat Izin'))

    if (app.application_type === 'IZIN_PENELITIAN' && app.requires_ethics) {
      letterCard?.remove()
      return
    }

    if (app.application_type !== 'DATA_AWAL' || app.status !== 'ADMIN_APPROVED' || letterCard) return

    const card = make('article', 'card action-card')
    const header = make('header', 'card-header')
    const icon = make('span')
    icon.textContent = '✓'
    const title = make('h2')
    title.textContent = 'Kelola Surat Izin'
    header.append(icon, title)

    const body = make('div', 'card-body')
    const button = make('button', 'btn btn-primary btn-block')
    button.type = 'button'
    button.textContent = 'Generate Surat Data Awal'
    button.addEventListener('click', async () => {
      button.disabled = true
      button.textContent = 'Memproses...'
      try {
        await apiClient.post(`/applications/${id}/letter/generate`, { letter_type: 'DATA_AWAL' })
        window.location.reload()
      } catch {
        button.disabled = false
        button.textContent = 'Generate Surat Data Awal'
      }
    })
    body.append(button)
    card.append(header, body)
    side.append(card)
  } catch {
    // Existing detail actions remain usable if the supplementary check fails.
  }
}

export const installDiklitDetailEnhancements = () => {
  let initializedPath = ''
  const scan = () => {
    const path = window.location.pathname
    const detail = document.querySelector('.detail-page')
    if (!detail) return
    const match = path.match(/\/diklit\/applications?\/(\d+)/)
    if (!match) return
    if (path === initializedPath) return
    initializedPath = path

    const id = match[1]
    void enforceLetterActions(id)
  }

  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('popstate', scan)
  scan()
}
