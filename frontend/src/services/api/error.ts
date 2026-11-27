import axios from 'axios'

interface ApiErrorResponse {
  message?: string
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Terjadi kesalahan. Silakan coba lagi.',
): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallback
  }

  const status = error.response?.status
  const serverMessage = error.response?.data?.message

  if (!status) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
  }

  if (status === 400) {
    return serverMessage ?? 'Data yang dikirim tidak valid.'
  }

  if (status === 401) {
    return serverMessage ?? 'Sesi login tidak valid atau sudah berakhir.'
  }

  if (status === 403) {
    return serverMessage ?? 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
  }

  if (status === 404) {
    return serverMessage ?? 'Data atau halaman yang diminta tidak ditemukan.'
  }

  if (status >= 500) {
    return 'Terjadi kesalahan pada server. Silakan coba lagi nanti.'
  }

  return fallback
}