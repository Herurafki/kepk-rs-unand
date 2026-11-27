import { readonly, ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'
export interface ToastMessage {
  id: number
  type: ToastType
  title: string
  message: string
}

const items = ref<ToastMessage[]>([])
let nextId = 0

export function useToast() {
  function dismiss(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function show(type: ToastType, message: string, title?: string, duration = 4500) {
    const id = ++nextId
    const defaultTitles: Record<ToastType, string> = {
      success: 'Berhasil',
      error: 'Gagal',
      info: 'Informasi',
      warning: 'Peringatan',
    }
    items.value.push({ id, type, title: title || defaultTitles[type], message })
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  return {
    items: readonly(items),
    show,
    success: (message: string, title?: string) => show('success', message, title),
    error: (message: string, title?: string) => show('error', message, title),
    info: (message: string, title?: string) => show('info', message, title),
    warning: (message: string, title?: string) => show('warning', message, title),
    dismiss,
  }
}
