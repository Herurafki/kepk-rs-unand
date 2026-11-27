// Data tarif penelitian per tahapan layanan.
// SEMUA DATA DI BAWAH ADALAH DUMMY. `price: null` tampil sebagai "Menunggu data tarif".

export interface TarifItem {
  label: string
  price: number | null
  note?: string
}

export interface PaymentStep {
  title: string
  description: string
}

export interface TarifGroup {
  id: string
  name: string
  description: string
  items: TarifItem[]
  steps: PaymentStep[]
}

export const tarifGroups: TarifGroup[] = [
  {
    id: 'pengambilan-data-awal',
    name: 'Pengambilan Data Awal',
    description: 'Tarif pengambilan data awal (studi pendahuluan) sebelum penelitian dimulai.',
    items: [
      { label: 'Pengambilan Data Awal D3', price: 150000, note: '' },
      { label: 'Pengambilan Data Awal S2/S3', price: 300000, note: '' },
    ],
    steps: [
      { title: 'Ajukan permohonan', description: 'Isi formulir pengambilan data awal dan unggah surat pengantar.' },
      { title: 'Verifikasi berkas', description: 'Petugas memeriksa kelengkapan berkas Anda.' },
      { title: 'Terima tagihan', description: 'Nomor tagihan dikirim melalui akun dan email terdaftar.' },
      { title: 'Bayar & unggah bukti', description: 'Lakukan pembayaran, lalu unggah bukti pada halaman permohonan.' },
      { title: 'Data diproses', description: 'Setelah terkonfirmasi, pengambilan data dapat dijadwalkan.' },
    ],
  },
  {
    id: 'penelitian',
    name: 'Penelitian',
    description: 'Tarif pelaksanaan penelitian di lingkungan Rumah Sakit Universitas Andalas. Jika menggunakan bahan dan alat milik rumah sakit, maka akan dikenakan biaya tambahan sesuai ketentuan.',
    items: [
      { label: 'Biaya Penelitian D3', price: 300000, note: 'Per penelitian' },
      { label: 'Biaya Penelitian D4/S1', price: 350000, note: 'Per penelitian' },
      { label: 'Pengambilan Data Penelitian diluar eksperimen  D3', price: 300000, note: 'Satu kali penelitian' },
      { label: 'Pengambilan Data Penelitian diluar eksperimen  DIV/S1', price: 350000, note: 'Satu kali penelitian' },
      { label: 'Pengambilan Data Penelitian diluar eksperimen  S2/S3', price: 500000, note: 'Satu kali penelitian' },
      { label: 'Penelitian Intervensi D3', price: 450000, note: 'Satu kali penelitian, tidak termasuk bahan' },
      { label: 'Penelitian Intervensi DIV/S1', price: 650000, note: 'Satu kali penelitian, tidak termasuk bahan' },
      { label: 'Penelitian Intervensi S2/S3', price: 800000, note: 'Satu kali penelitian, tidak termasuk bahan' },
      { label: 'Penelitian Intervensi Non akademi (Umum)', price: 800000, note: 'Satu kali penelitian, tidak termasuk bahan' },
      { label: 'Penelitian Intervensi Sponsorship', price: 500000, note: 'Satu kali penelitian, tidak termasuk bahan' },
    ],
    steps: [
      { title: 'Ajukan izin penelitian', description: 'Lengkapi proposal dan dokumen persetujuan.' },
      { title: 'Telaah administrasi', description: 'Tim memeriksa kesesuaian proposal dan kelengkapan dokumen.' },
      { title: 'Terima tagihan', description: 'Tagihan terbit setelah proposal dinyatakan memenuhi syarat.' },
      { title: 'Bayar & unggah bukti', description: 'Bayar sesuai nominal dan unggah bukti pembayaran.' },
      { title: 'Penelitian dimulai', description: 'Surat izin diterbitkan dan penelitian dapat dilaksanakan.' },
    ],
  },
  {
    id: 'kaji-etik',
    name: 'Kaji Etik',
    description: 'Tarif telaah etik protokol penelitian oleh Komisi Etik Penelitian.',
    items: [
      { label: 'Etik Penelitian D3', price: 250000, note: 'Per protokol' },
      { label: 'Etik Penelitian DIV/S1', price: 300000, note: 'Per protokol' },
      { label: 'Etik Penelitian S2/S3', price: 400000, note: 'Per protokol' },
      { label: 'D3 Pengurusan Uji Etik Penelitian (UNAND)', price: 50000, note: '' },
      { label: 'S1 Pengurusan Uji Etik Penelitian (UNAND)', price: 50000, note: '' },
      { label: 'S2/S3 Pengurusan Uji Etik Penelitian (UNAND)', price: 400000, note: '' },
      { label: 'D3 Pengurusan Uji Etik Penelitian (NON UNAND)', price: 250000, note: '' },
      { label: 'S1 Pengurusan Uji Etik Penelitian (NON UNAND)', price: 300000, note: '' },
      { label: 'S2/S3 Pengurusan Uji Etik Penelitian (NON UNAND)', price: 400000, note: '' },
    ],
    steps: [
      { title: 'Unggah protokol', description: 'Kirim protokol penelitian dan formulir telaah etik.' },
      { title: 'Verifikasi berkas', description: 'Sekretariat Komisi Etik memeriksa kelengkapan protokol.' },
      { title: 'Terima tagihan', description: 'Tagihan kaji etik dikirim ke akun dan email Anda.' },
      { title: 'Bayar & unggah bukti', description: 'Lakukan pembayaran dan unggah bukti untuk dikonfirmasi.' },
      { title: 'Telaah oleh reviewer', description: 'Protokol ditelaah dan keputusan etik diterbitkan.' },
    ],
  },
]