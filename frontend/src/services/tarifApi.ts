import type { TarifGroup } from '../data/tarifKomisiEtik'

// Atur di .env:
//   VITE_USE_TARIF_API=true
//   VITE_TARIF_API_URL=https://api.example.com/tarif
const API_URL = import.meta.env.VITE_TARIF_API_URL as string | undefined

export const useTarifApi = import.meta.env.VITE_USE_TARIF_API === 'true'

export async function fetchTarif(signal?: AbortSignal): Promise<TarifGroup[]> {
  if (!API_URL) throw new Error('VITE_TARIF_API_URL belum diatur')

  const res = await fetch(API_URL, { headers: { Accept: 'application/json' }, signal })
  if (!res.ok) throw new Error(`Gagal memuat tarif (${res.status})`)

  const json = await res.json()
  // Sesuaikan jika response dibungkus, misalnya { data: [...] }
  return (Array.isArray(json) ? json : json.data) as TarifGroup[]
}