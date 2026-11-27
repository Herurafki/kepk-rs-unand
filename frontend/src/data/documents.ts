// Metadata dokumen persyaratan. File fisiknya (PDF) diletakkan di
// frontend/public/documents/ — path di sini harus sama persis dengan nama
// filenya supaya iframe preview dan tombol download berfungsi.

export type DocumentKey = 'kaji-etik' | 'informed-consent' | 'menjaga-kerahasiaan'

export interface DocumentMeta {
  key: DocumentKey
  title: string
  description: string
  /** Path relatif ke public/, mis. "/documents/formulir-kaji-etik.pdf". */
  fileUrl: string
  fileName: string
  format: 'PDF' | 'DOCX'
}

export const documents: Record<DocumentKey, DocumentMeta> = {
  'kaji-etik': {
    key: 'kaji-etik',
    title: 'Formulir Permohonan Kaji Etik',
    description:
      'Formulir permohonan kaji etik penelitian yang diajukan ke Komisi Etik Penelitian Rumah Sakit Universitas Andalas.',
    fileUrl: '/documents/formulir-kaji-etik.pdf',
    fileName: 'formulir-kaji-etik.pdf',
    format: 'PDF',
  },
  'informed-consent': {
    key: 'informed-consent',
    title: 'Penjelasan Sebelum Persetujuan (PSP) & Formulir Informed Consent',
    description:
      'Dokumen Penjelasan Sebelum Persetujuan (PSP) beserta formulir Informed Consent yang harus dilengkapi subjek penelitian.',
    fileUrl: '/documents/psp-informed-consent.pdf',
    fileName: 'psp-informed-consent.pdf',
    format: 'PDF',
  },
  'menjaga-kerahasiaan': {
    key: 'menjaga-kerahasiaan',
    title: 'Surat Pernyataan Menjaga Kerahasiaan Data Penelitian',
    description:
      'Surat pernyataan yang harus ditandatangani oleh peneliti untuk menjaga kerahasiaan data penelitian yang diperoleh dari subjek penelitian.',
    fileUrl: '/documents/surat-pernyataan-menjaga-kerahasiaan.pdf',
    fileName: 'surat-pernyataan-menjaga-kerahasiaan.pdf',
    format: 'PDF',
  },
}
