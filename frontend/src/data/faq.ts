export interface FaqItem {
  question: string
  answer: string
}

export const faqItems: FaqItem[] = [
  {
    question: 'Bagaimana cara melakukan pembayaran biaya pengajuan atau kaji etik?',
    answer:
      'Pembayaran dilakukan melalui kasir Rumah Sakit Universitas Andalas. Pemohon akan menerima invoice pembayaran pada detail pengajuan. Setelah melakukan pembayaran, pemohon perlu mengunggah bukti pembayaran ke dalam sistem untuk melanjutkan proses pengajuan.',
  },
  {
    question: 'Apakah bukti pembayaran perlu diunggah ke dalam sistem?',
    answer:
      'Ya. Jika pemohon telah melakukan pembayaran, bukti pembayaran harus diunggah ke dalam sistem agar proses pengajuan dapat dilanjutkan. Pastikan nomor pembayaran yang diunggah jelas dan dapat diverifikasi.',
  },
  {
    question: 'Apa yang harus dilakukan jika dokumen pengajuan dinyatakan tidak lengkap?',
    answer:
      'Pemohon dapat melihat keterangan dari petugas melalui sistem, kemudian melengkapi atau memperbaiki dokumen yang diminta. Pengajuan akan diproses kembali setelah persyaratan yang diperlukan dilengkapi.',
  },
  {
    question: 'Bagaimana jika terdapat kesalahan pada data setelah pengajuan dikirim?',
    answer:
      'Jika pengajuan masih dapat diperbaiki, pemohon akan memperoleh informasi mengenai data atau dokumen yang perlu diperbaiki melalui sistem. Pemohon kemudian dapat melakukan perbaikan sesuai instruksi yang diberikan.',
  },
  {
    question: 'Berapa lama proses verifikasi pengajuan berlangsung?',
    answer:
      'Waktu proses bergantung pada jenis pengajuan, kelengkapan dokumen, dan tahapan verifikasi yang diperlukan. Pemohon dapat memantau perkembangan pengajuan melalui menu Status Pengajuan.',
  },
]