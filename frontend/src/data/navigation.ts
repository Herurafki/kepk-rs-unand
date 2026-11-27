// Konfigurasi menu header publik. Dipisah dari UnifiedHeader.vue supaya
// struktur menu mudah diubah tanpa menyentuh logic/markup header.

export interface HeaderSubNavItem {
  label: string
  to: string
}

export interface HeaderNavItem {
  /** Dicocokkan dengan route.meta.navSection untuk active state. */
  key: string
  label: string
  /** Beranda: link langsung, tanpa dropdown. */
  to?: string
  /** Menu lain: dropdown berisi submenu. */
  items?: HeaderSubNavItem[]
}

export const primaryNavigation: HeaderNavItem[] = [
  {
    key: 'beranda',
    label: 'BERANDA',
    to: '/',
  },
  {
    key: 'profil',
    label: 'PROFIL',
    items: [
      { label: 'Tentang Kami', to: '/profil/tentang-kami' },
      { label: 'Struktur Organisasi', to: '/profil/struktur-organisasi' },
    ],
  },
  {
    key: 'informasi',
    label: 'INFORMASI',
    items: [
      { label: 'Alur Proses Pengajuan', to: '/informasi/alur-pengajuan' },
      { label: 'Tarif Komisi Etik Penelitian', to: '/informasi/tarif-komisi-etik' },
      { label: 'Estimasi Waktu', to: '/informasi/estimasi-waktu' },
    ],
  },
  {
    key: 'dokumen',
    label: 'DOKUMEN PERSYARATAN',
    items: [
      { label: 'Formulir Permohonan Kaji Etik', to: '/dokumen/kaji-etik' },
      { label: 'PSP & Formulir Informed Consent', to: '/dokumen/informed-consent' },
      { label: 'Surat Pernyataan Kerahasiaan Data', to: '/dokumen/menjaga-kerahasiaan' },
    ],
  },
  {
    key: 'pengajuan',
    label: 'PENGAJUAN LAYANAN',
    items: [
      { label: 'Permohonan Pengambilan Data Awal', to: '/dashboard/research/data-collection' },
      { label: 'Permohonan Pengajuan Penelitian', to: '/dashboard/research/permission' },
      { label: 'Permohonan Pengajuan Kaji Etik', to: '/dashboard/research/ethics' },
      { label: 'Status Pengajuan', to: '/dashboard/research/status' },
    ],
  },
]
