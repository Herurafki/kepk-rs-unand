import { ref } from 'vue'

export function useAsyncState() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  function start() {
    loading.value = true
    error.value = null
  }

  function fail(message: string) {
    error.value = message
  }

  function finish() {
    loading.value = false
  }

  function reset() {
    loading.value = false
    error.value = null
  }

  return {
    loading,
    error,
    start,
    fail,
    finish,
    reset,
  }
}