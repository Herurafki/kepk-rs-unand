// Data alur/flowchart untuk halaman Informasi > Alur Proses Pengajuan.
//
// CATATAN: langkah-langkah di bawah ini adalah draft alur administratif umum
// berdasarkan tahapan yang sudah ada di sistem (form pengajuan, verifikasi,
// review, status). Sesuaikan urutan/label dengan SOP resmi sebelum dipakai
// sebagai acuan final.

export type FlowchartType = 'data-awal' | 'penelitian' | 'etik'

export interface FlowchartStep {
  title: string
  description: string
}

export interface FlowchartOption {
  key: FlowchartType
  label: string
  image: string
  steps: FlowchartStep[]
}

export const submissionFlowcharts: FlowchartOption[] = [
  {
    key: 'data-awal',
    label: 'Pengambilan Data Awal',
    image: '/images/informasi/flowchart-pengambilan-data-awal.png',
    steps: [
      { title: 'Peneliti Mengisi Form Pengajuan', description: 'Peneliti mengisi data profil, informasi penelitian, dan mengunggah dokumen pendukung berupa surat pengantar dari instansi.' },
      { title: 'Verifikasi Dokumen oleh Tim Diklit', description: 'Tim Diklit memeriksa data dan dokumen yang telah diajukan untuk memastikan pengajuan sudah lengkap dan sesuai.' },
      { title: 'Pengajuan Dikembalikan untuk Perbaikan (Jika Tidak Lengkap)', description: 'Peneliti melakukan perbaikan dan mengirimkan kembali pengajuan untuk diverifikasi ulang.' },
      { title: 'Pengajuan Disetujui (ACC) oleh Tim Diklit (Jika Lengkap)', description: 'Tim Diklit menyetujui pengajuan dan melanjutkan proses penerbitan surat izin pengambilan data awal.' },
      { title: 'Proses Penerbitan Surat', description: 'Penerbitan surat izin pengambilan data awal dilakukan setelah pengajuan disetujui oleh Tim Diklit.' },
      { title: 'Surat Izin Pengambilan Data Awal Terbit', description: 'Surat dapat dilihat dan diunduh oleh peneliti melalui halaman pengajuan.' },
    ],
  },
  {
    key: 'penelitian',
    label: 'Penelitian',
    image: '/images/informasi/flowchart-penelitian.png',
    steps: [
      { title: 'Peneliti Mengisi Form Pengajuan Penelitian', description: 'Peneliti melengkapi data pengajuan, dokumen pendukung, serta formulir screening.' },
      { title: 'Verifikasi Dokumen oleh Tim Diklit', description: 'Tim Diklit memeriksa data, dokumen, dan formulir screening yang telah diajukan untuk memastikan pengajuan sudah lengkap dan sesuai.' },
      { title: 'Pengajuan Dikembalikan untuk Perbaikan (Jika Tidak Lengkap)', description: 'Peneliti melakukan perbaikan dan mengirimkan kembali pengajuan untuk diverifikasi ulang.' },
      { title: 'Pengajuan Disetujui (ACC) oleh Tim Diklit (Jika Lengkap)', description: 'Tim Diklit menyetujui pengajuan dan melanjutkan proses penerbitan surat izin penelitian.' },
      { title: 'Penelitian Tidak Memerlukan Kaji Etik', description: 'Penelitian dapat dilanjutkan ke proses penerbitan surat izin penelitian tanpa melalui kaji etik.' },
      { title: 'Proses Penerbitan Surat', description: 'Penerbitan surat izin penelitian dilakukan setelah pengajuan disetujui oleh Tim Diklit.' },
      { title: 'Surat Izin Penelitian Terbit', description: 'Surat dapat dilihat dan diunduh oleh peneliti melalui halaman pengajuan.' },
    ],
  },
  {
    key: 'etik',
    label: 'Pengajuan Etik',
    image: '/images/informasi/flowchart-pengajuan-etik.png',
    steps: [
      { title: 'Pengisian Form Pengajuan Etik', description: 'Peneliti melengkapi data pengajuan, dokumen pendukung, dan formulir screening etik.' },
      { title: 'Verifikasi Dokumen oleh Sekretariat KEPK', description: 'Sekretariat KEPK memeriksa data, dokumen, dan formulir screening untuk memastikan pengajuan sudah lengkap dan sesuai.' },
      { title: 'Perbaikan Dokumen (Jika Tidak Lengkap)', description: 'Jika pengajuan belum lengkap, peneliti melakukan perbaikan dan mengirimkan kembali pengajuan untuk diverifikasi ulang.' },
      { title: 'Penentuan Jenis Telaah oleh Ketua KEPK', description: 'Jika pengajuan lengkap, Ketua KEPK menentukan jenis telaah berdasarkan karakteristik dan risiko penelitian.' },
      { title: 'Proses Kaji Etik', description: 'Pengajuan diproses sesuai jenis telaah yang ditetapkan, yaitu Exempted, Expedited, atau Full Board.' },
      { title: 'Hasil Kaji Etik', description: 'Hasil kaji etik dapat berupa perbaikan, disetujui (Ethical Approval), atau ditolak sesuai hasil kajian komisi.' },
    ],
  },
]
