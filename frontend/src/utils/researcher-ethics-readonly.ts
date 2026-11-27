export const installResearcherEthicsReadonly = () => {
  const scan = () => {
    const form = document.querySelector('.ethics-form')
    if (!form) return

    const query = new URLSearchParams(window.location.search)
    const parentId = query.get('applicationId')
    const isContinuation = Boolean(parentId && /^\d+$/.test(parentId))
    if (!isContinuation) return

    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input.form-input, select.form-input, textarea.form-input').forEach((field) => {
      field.setAttribute('readonly', 'true')
      field.setAttribute('disabled', 'true')
      field.setAttribute('aria-readonly', 'true')
    })

    form.querySelectorAll<HTMLElement>('.researcher-rich-text__editor').forEach((editor) => {
      editor.contentEditable = 'false'
      editor.setAttribute('aria-readonly', 'true')
    })
  }

  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })
  scan()
}
