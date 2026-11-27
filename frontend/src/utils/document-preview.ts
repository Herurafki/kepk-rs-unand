const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
}

export function openDocumentTab(): Window | null {
  const tab = window.open('about:blank', '_blank')
  if (tab) tab.opener = null
  return tab
}

export function displayDocumentInTab(tab: Window, blob: Blob, fileName: string): void {
  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  const type = MIME_BY_EXTENSION[extension] || blob.type || 'application/octet-stream'
  const preview = new Blob([blob], { type })
  const url = URL.createObjectURL(preview)
  tab.location.href = url
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
}
