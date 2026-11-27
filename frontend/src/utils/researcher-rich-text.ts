const sanitize = (html: string) => {
  const template = document.createElement('template')
  template.innerHTML = html
  template.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((node) => node.remove())
  template.content.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on')) node.removeAttribute(attribute.name)
    })
  })
  return template.innerHTML
}

const DISPLAY_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'DIV', 'OL', 'UL', 'LI', 'SPAN'])

export const sanitizeResearcherRichText = (html?: string | null) => {
  if (!html) return ''
  const template = document.createElement('template')
  template.innerHTML = html

  template.content.querySelectorAll('script,style,iframe,object,embed,link,meta,svg,math').forEach((node) => node.remove())
  template.content.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name))

    if (!DISPLAY_TAGS.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes))
    }
  })

  return template.innerHTML
}

const enhance = (textarea: HTMLTextAreaElement) => {
  if (textarea.dataset.richTextEnhanced === 'true') return
  textarea.dataset.richTextEnhanced = 'true'

  const wrapper = document.createElement('div')
  wrapper.className = 'researcher-rich-text'

  const toolbar = document.createElement('div')
  toolbar.className = 'researcher-rich-text__toolbar'

  const editor = document.createElement('div')
  editor.className = 'researcher-rich-text__editor'
  editor.contentEditable = 'true'
  editor.innerHTML = sanitize(textarea.value || '')
  editor.setAttribute('data-placeholder', textarea.getAttribute('placeholder') || 'Tulis deskripsi...')

  const buttons: Array<[string, string]> = [
    ['bold', 'B'], ['italic', 'I'], ['underline', 'U'],
    ['insertUnorderedList', '•'], ['insertOrderedList', '1.'],
    ['justifyLeft', '≡'], ['justifyCenter', '≡'], ['removeFormat', 'Tx'],
  ]

  buttons.forEach(([command, label]) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.className = 'researcher-rich-text__button'
    if (command === 'bold') button.innerHTML = '<strong>B</strong>'
    if (command === 'italic') button.innerHTML = '<em>I</em>'
    if (command === 'underline') button.innerHTML = '<u>U</u>'
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      editor.focus()
      document.execCommand(command, false)
      sync()
    })
    toolbar.appendChild(button)
  })

  let lastValue = textarea.value || ''

  const sync = () => {
    const value = sanitize(editor.innerHTML)
    //editor.innerHTML = value
    textarea.value = value
    lastValue = value
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }

  editor.addEventListener('input', sync)
  editor.addEventListener('blur',() => {
    editor.innerHTML = sanitize(editor.innerHTML) 
    sync()
  })

  textarea.style.display = 'none'
  textarea.parentElement?.insertBefore(wrapper, textarea)
  wrapper.append(toolbar, editor)

  
  window.setInterval(() => {
    if (document.activeElement === editor) return
    if (textarea.value !== lastValue) {
      lastValue = textarea.value
      editor.innerHTML = sanitize(lastValue || '')
    }
  }, 350)
}

export const installResearcherRichText = () => {
  const scan = () => {
    document.querySelectorAll<HTMLTextAreaElement>('.form-textarea, textarea.textarea').forEach(enhance)
  }

  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })
  scan()
}
