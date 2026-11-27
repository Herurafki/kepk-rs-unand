<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileCheck2, FileText, Info, LoaderCircle, Upload, XCircle } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import {
  approveWithoutEthics, approveWithEthics, downloadDocument, downloadLetter, generateApplicationLetter,
  getApplicationLetter, getDiklitApplication, getDiklitRevisions, openDiklitApplication, rejectApplication, requestRevision,
  uploadSignedLetter, type DiklitApplicationDetail, type DiklitRevision, type Letter
} from '../../services/diklit/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { displayDocumentInTab, openDocumentTab } from '../../utils/document-preview'
import { sanitizeResearcherRichText } from "../../utils/researcher-rich-text";

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const app = ref<DiklitApplicationDetail | null>(null)
const letter = ref<Letter | null>(null)
const loading = ref(true)
const busy = ref('')
const error = ref('')
const success = ref('')
const revision = ref('')
const rejection = ref('')
const manualLetterNumber = ref('')
const showLetterNumberModal = ref(false)
const revisions = ref<DiklitRevision[]>([])
const file = ref<File | null>(null)
const input = ref<HTMLInputElement | null>(null)
const activeTab = ref<'info' | 'screening' | 'documents'>('info')

const typeLabels: Record<string, string> = {
  DATA_AWAL: 'Pengambilan Data Awal', IZIN_PENELITIAN: 'Izin Penelitian'
}
const isResearchApplication = computed(() => app.value?.application_type === 'IZIN_PENELITIAN')
const isDataAwal = computed(() => app.value?.application_type === 'DATA_AWAL')
const letterType = computed(() => {
  if (!app.value || !['APPROVED', 'REQUIRED_ETHICS'].includes(app.value.status)) return null
  // Research applications continued to ethics must not generate a research permit letter.
  if (app.value.application_type === 'IZIN_PENELITIAN' && app.value.requires_ethics) return null
  if (app.value.application_type === 'DATA_AWAL') return 'DATA_AWAL'
  if (app.value.application_type === 'IZIN_PENELITIAN') return 'IZIN_PENELITIAN'
  return null
})

const isAction = computed(() => ['REVISION_REQUIRED', 'PERMIT_ISSUED','REQUIRED_ETHICS','APPROVED','REJECTED'].includes(app.value?.status || ''))
const isVerifier = computed(() => Boolean(app.value?.can_verify))
const canOpen = computed(() => app.value?.status === 'SUBMITTED')
const canApprove = computed(() => app.value?.status === 'ADMIN_REVIEW' && isVerifier.value)
const canGenerate = computed(() => !!letterType.value && !letter.value && /^\d{1,12}$/.test(manualLetterNumber.value))
const canManageLetter = computed(() => !!letterType.value || !!letter.value || app.value?.status === 'PERMIT_ISSUED')
const canUpload = computed(() => letter.value?.letter_status === 'GENERATED')
const status = (s?: string) => {
  if (s === 'REQUIRED_ETHICS' || (s === 'ADMIN_APPROVED' && app.value?.application_type === 'IZIN_PENELITIAN' && app.value.requires_ethics)) return 'Dilanjutkan ke Etik'
  return ({ SUBMITTED: 'Menunggu Verifikasi', ADMIN_REVIEW: 'Sedang Diverifikasi', REVISION_REQUIRED: 'Perlu Revisi', ADMIN_APPROVED: 'Disetujui Administrasi', APPROVED: 'Disetujui', PERMIT_ISSUED: 'Surat Diterbitkan', REJECTED: 'Ditolak' }[s || ''] || s || '—')
}
const fmt = (v?: string | null) => v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

const researcher = computed(() => {
  if (!app.value) return null

  const data = app.value as DiklitApplicationDetail & {
    researcher_category?: string | null
    researcher_email?: string | null
    researcher_nim?: string | null
    researcher_nip?: string | null
    researcher_nik?: string | null
    researcher_phone?: string | null
    researcher_address?: string | null
    researcher_institution?: string | null
    researcher_faculty?: string | null
    researcher_program_study?: string | null
    researcher_department?: string | null
  }

  return {
    name: app.value.researcher_name || '—',
    email: data.researcher_email || '—',
    category: data.researcher_category?.toLowerCase() || '',
    nim: data.researcher_nim || '—',
    nip: data.researcher_nip || '—',
    nik: data.researcher_nik || '—',
    phone: data.researcher_phone || '—',
    address: data.researcher_address || '—',
    institution:
      data.researcher_institution ||
      app.value.research_institution ||
      '—',
    faculty: data.researcher_faculty || '—',
    programStudy: data.researcher_program_study || '—',
    department: data.researcher_department || '—'
  }
})

const researcherCategoryLabel = computed(() => {
  const category = researcher.value?.category

  return {
    mahasiswa: 'Mahasiswa',
    dosen: 'Dosen',
    staff: 'Staff',
    umum: 'Umum'
  }[category || ''] || 'Peneliti'
})

const screeningQuestionLabels: Record<'research' | 'ethics', Record<string, string>> = {
  research: {
    question1: 'Melibatkan manusia sebagai subjek/responden, atau menggunakan data, informasi, rekam medis, maupun spesimen biologis dari manusia?',
    question2: 'Melibatkan organisme hidup selain manusia?',
    question3: 'Melibatkan obat, produk herbal/tradisional, sel punca, alat kesehatan, prosedur/tindakan baru, atau teknologi AI di bidang kesehatan?',
    question4: 'Merupakan audit medik, evaluasi mutu pelayanan rutin, atau studi kasus untuk pendidikan tanpa publikasi dan tanpa intervensi tambahan?'
  },
  ethics: {
    question1: 'Data atau informasi telah dianonimkan sepenuhnya sehingga subjek tidak dapat diidentifikasi?',
    question2: 'Melibatkan interaksi, wawancara, kuesioner, observasi, pemeriksaan, pengukuran, pengujian, atau intervensi langsung terhadap manusia?',
    question3: 'Melibatkan kelompok rentan seperti anak, ibu hamil, lansia, penyandang disabilitas, pasien dengan gangguan kesadaran/kejiwaan, atau kelompok dengan keterbatasan memberikan persetujuan?',
    question4: 'Berpotensi menimbulkan risiko atau ketidaknyamanan bagi subjek, baik secara fisik, psikologis, sosial, maupun ekonomi?',
    question5: 'Melibatkan spesimen biologis seperti darah, jaringan, urin, saliva, cairan tubuh, sel, atau bahan biologis lain dari manusia?',
    question6: 'Melibatkan tindakan, perlakuan, atau prosedur terhadap organisme hidup selain manusia yang berpotensi menyebabkan rasa sakit, cedera, penderitaan, perubahan kondisi, atau kematian?'
  }
}

function parseScreeningPayload(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
  }
  return {}
}
const screeningPayload = computed(() => parseScreeningPayload((app.value as any)?.screening ?? (app.value as any)?.screening_answers ?? (app.value as any)?.screening_data))
const screeningAnswers = computed(() => {
  const nested = screeningPayload.value.answers ?? screeningPayload.value.responses ?? screeningPayload.value.screening_answers ?? screeningPayload.value.screening_data ?? screeningPayload.value
  return parseScreeningPayload(nested)
})
const screeningQuestions = computed(() => {
  const type = app.value?.application_type === 'IZIN_PENELITIAN' ? 'ethics' : 'research'
  const labels = screeningQuestionLabels[type]
  return Object.entries(screeningAnswers.value)
    .filter(([key, answer]) => /^question\d+$/.test(key) && answer !== null && String(answer).trim() !== '')
    .sort(([a], [b]) => Number(a.replace('question', '')) - Number(b.replace('question', '')))
    .map(([key, answer]) => ({ key, label: labels[key] || key.replace('question', 'Pertanyaan '), answer }))
})
const screeningRecommendation = computed(() =>
  screeningPayload.value.recommendation ?? screeningPayload.value.result ?? (app.value as any)?.screening_recommendation ?? null
)
const hasScreening = computed(() => !!app.value?.screening)

/* ---- langkah berikutnya ---- */
type NextStep = { tone: 'info' | 'warning' | 'success' | 'danger'; title: string; text: string; cta?: string; target?: string }
const nextStep = computed<NextStep | null>(() => {
  const a = app.value
  if (!a) return null
  const s = a.status
  if (s === 'SUBMITTED') {
    return { tone: 'warning', title: 'Mulai verifikasi pengajuan', text: 'Pengajuan ini menunggu diperiksa. Mulai verifikasi agar pengajuan ditangani atas nama Anda.', cta: 'Tindakan verifikasi', target: 'action-panel' }
  }
  if (s === 'ADMIN_REVIEW') {
    return isVerifier.value
      ? { tone: 'warning', title: 'Selesaikan verifikasi', text: 'Periksa informasi, screening, dan dokumen, lalu setujui, minta revisi, atau tolak pengajuan.', cta: 'Tindakan verifikasi', target: 'action-panel' }
      : { tone: 'info', title: 'Sedang diverifikasi petugas lain', text: `Pengajuan ditangani oleh ${a.verifier_name || 'DIKLAT lain'}. Anda hanya dapat melihat detailnya.` }
  }
  if (s === 'REVISION_REQUIRED') {
    return { tone: 'info', title: 'Menunggu perbaikan peneliti', text: 'Pengajuan kembali untuk diverifikasi setelah peneliti mengirim perbaikan.', cta: revisions.value.length ? 'Lihat catatan revisi' : undefined, target: 'revision-panel' }
  }
  if (s === 'REJECTED') return { tone: 'danger', title: 'Pengajuan ditolak', text: 'Pengajuan ini tidak dapat dilanjutkan.' }
  if (s === 'PERMIT_ISSUED') {
    return { tone: 'success', title: 'Surat izin telah diterbitkan', text: 'Surat final bertanda tangan dapat diunduh pada panel Kelola Surat Izin.', cta: 'Kelola surat', target: 'letter-panel' }
  }
  if (letterType.value) {
    if (!letter.value) return { tone: 'warning', title: 'Terbitkan surat izin', text: 'Pengajuan telah disetujui. Generate surat izin untuk diunduh dan ditandatangani.', cta: 'Kelola surat', target: 'letter-panel' }
    if (letter.value.letter_status === 'GENERATED') return { tone: 'warning', title: 'Unggah surat bertanda tangan', text: 'Unduh draft surat, tandatangani secara offline, lalu unggah kembali dalam format PDF.', cta: 'Kelola surat', target: 'letter-panel' }
    return { tone: 'success', title: 'Surat final sudah diunggah', text: 'Surat bertanda tangan telah tersimpan dan dapat diunduh.', cta: 'Kelola surat', target: 'letter-panel' }
  }
  if (a.application_type === 'IZIN_PENELITIAN' && a.requires_ethics) {
    return { tone: 'info', title: 'Dilanjutkan ke jalur etik', text: 'Pengajuan diteruskan ke proses kaji etik. Tidak ada surat izin yang diterbitkan pada tahap ini.' }
  }
  return null
})
function goToTarget(target?: string) {
  if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const [applicationResponse, revisionsResponse, letterResponse] = await Promise.all([
      getDiklitApplication(id.value),
      getDiklitRevisions(id.value),
      getApplicationLetter(id.value).catch(() => null),
    ])
    app.value = applicationResponse.data
    revisions.value = revisionsResponse.data || []
    letter.value = letterResponse?.data ?? null
  } catch (e) { error.value = getApiErrorMessage(e, 'Gagal memuat detail pengajuan.') }
  finally { loading.value = false }
}
async function action(key: string, fn: () => Promise<unknown>) {
  busy.value = key; error.value = ''; success.value = ''
  try { await fn(); success.value = 'Perubahan berhasil disimpan.'; revision.value = ''; rejection.value = ''; await load() }
  catch (e) { error.value = getApiErrorMessage(e, 'Aksi gagal diproses.') }
  finally { busy.value = '' }
}
function openLetterNumberModal() {
  manualLetterNumber.value = ''
  showLetterNumberModal.value = true
}
function closeLetterNumberModal() {
  if (busy.value === 'generate') return
  showLetterNumberModal.value = false
}
async function confirmGenerateLetter() {
  if (!/^\d{1,12}$/.test(manualLetterNumber.value) || !letterType.value) return
  await action('generate', async () => {
    letter.value = (await generateApplicationLetter(id.value, letterType.value!, manualLetterNumber.value)).data
    showLetterNumberModal.value = false
  })
}
async function revisionAction() { if (revision.value.trim()) await action('revision', () => requestRevision(id.value, revision.value.trim())) }
async function rejectAction() { if (rejection.value.trim()) await action('reject', () => rejectApplication(id.value, rejection.value.trim())) }
function pick() { input.value?.click() }
function changed(e: Event) { file.value = (e.target as HTMLInputElement).files?.[0] ?? null }
async function upload() {
  if (file.value?.type !== 'application/pdf') { error.value = 'File surat harus berformat PDF.'; return }
  if (file.value) await action('upload', () => uploadSignedLetter(id.value, file.value!))
}
async function dl(letterId: string, name: string) {
  const tab = openDocumentTab()
  if (!tab) { error.value = 'Browser memblokir tab dokumen. Izinkan pop-up, lalu coba lagi.'; return }
  try { const blob = await downloadLetter(letterId); displayDocumentInTab(tab, blob, name) }
  catch (e) { tab.close(); error.value = getApiErrorMessage(e, 'Surat tidak dapat dibuka.') }
}
async function doc(documentId: string, name: string) {
  const tab = openDocumentTab()
  if (!tab) { error.value = 'Browser memblokir tab dokumen. Izinkan pop-up, lalu coba lagi.'; return }
  try { const blob = await downloadDocument(documentId); displayDocumentInTab(tab, blob, name) }
  catch (e) { tab.close(); error.value = getApiErrorMessage(e, 'Dokumen tidak dapat dibuka.') }
}
onMounted(load)
</script>

<template>
  <main class="detail-page">
    <div class="topbar">
      <button class="back-button" type="button" @click="router.go(-1)">
        <ArrowLeft :size="17" /> Kembali
      </button>
      <div v-if="app" class="reference"><span>No. Registrasi</span><code>{{ app.application_number }}</code></div>
    </div>

    <div v-if="loading" class="state">
      <LoaderCircle :size="32" class="spin" /><span>Memuat detail pengajuan...</span>
    </div>

    <template v-else-if="app">
      <!-- Hero (tidak diubah) -->
      <header class="hero">
        <div class="hero-content">
          <span class="eyebrow">{{ typeLabels[app.application_type] || app.application_type }}</span>
          <h1>{{ app.research_title || 'Tanpa Judul Penelitian' }}</h1>

          <div v-if="researcher" class="researcher-summary">
            <div class="researcher-summary-header">
              <div class="researcher-name">
                <strong>{{ researcher.name }}</strong>
                <span class="researcher-category">{{ researcherCategoryLabel }}</span>
              </div>
            </div>

            <div class="researcher-details">
              <div class="researcher-detail"><span>Email</span><strong>{{ researcher.email }}</strong></div>
              <div v-if="researcher.category === 'mahasiswa'" class="researcher-detail"><span>NIM</span><strong>{{
                  researcher.nim }}</strong></div>
              <div v-if="researcher.category === 'dosen' || researcher.category === 'staff'" class="researcher-detail">
                <span>NIP</span><strong>{{ researcher.nip }}</strong></div>
              <div v-if="researcher.category === 'umum'" class="researcher-detail"><span>NIK</span><strong>{{
                  researcher.nik }}</strong></div>
              <div class="researcher-detail"><span>No. HP</span><strong>{{ researcher.phone }}</strong></div>
              <div class="researcher-detail"><span>Institusi</span><strong>{{ researcher.institution }}</strong></div>
              <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'"
                class="researcher-detail"><span>Fakultas</span><strong>{{ researcher.faculty }}</strong></div>
              <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'"
                class="researcher-detail"><span>Program Studi</span><strong>{{ researcher.programStudy }}</strong></div>
              <div v-if="researcher.category === 'staff'" class="researcher-detail"><span>Departemen</span><strong>{{
                researcher.department }}</strong></div>
              <div class="researcher-detail"><span>Alamat</span><strong>{{ researcher.address }}</strong></div>
            </div>
          </div>
        </div>

        <span class="status-badge" :class="`status-badge--${app.status?.toLowerCase()}`">{{ status(app.status) }}</span>
      </header>

      <!-- Langkah berikutnya -->
      <section v-if="nextStep" class="next-step" :class="`next-step--${nextStep.tone}`" aria-live="polite">
        <div class="next-step-icon">
          <CheckCircle2 v-if="nextStep.tone === 'success'" :size="22" />
          <XCircle v-else-if="nextStep.tone === 'danger'" :size="22" />
          <AlertCircle v-else-if="nextStep.tone === 'warning'" :size="22" />
          <Info v-else :size="22" />
        </div>
        <div class="next-step-body">
          <strong>{{ nextStep.title }}</strong>
          <p>{{ nextStep.text }}</p>
        </div>
        <button v-if="nextStep.cta" class="btn btn-primary" type="button" @click="goToTarget(nextStep.target)">{{
          nextStep.cta }}</button>
      </section>

      <div v-if="error" class="alert alert--error" role="alert">
        <XCircle :size="18" /><span>{{ error }}</span>
      </div>
      <div v-if="success" class="alert alert--success" role="status">
        <CheckCircle2 :size="18" /><span>{{ success }}</span>
      </div>

      <div class="layout">
        <!-- ===== Kolom utama: tab ===== -->
        <section class="main-column">
          <nav class="tabs" role="tablist" aria-label="Bagian detail pengajuan">
            <button type="button" role="tab" :aria-selected="activeTab === 'info'"
              :class="{ active: activeTab === 'info' }" @click="activeTab = 'info'">Informasi Penelitian</button>
            <button v-if="hasScreening" type="button" role="tab" :aria-selected="activeTab === 'screening'"
              :class="{ active: activeTab === 'screening' }" @click="activeTab = 'screening'">Screening</button>
            <button type="button" role="tab" :aria-selected="activeTab === 'documents'"
              :class="{ active: activeTab === 'documents' }" @click="activeTab = 'documents'">
              Dokumen <span class="tab-count">{{ app.documents?.length || 0 }}</span>
            </button>
          </nav>

          <!-- Informasi -->
          <article v-if="activeTab === 'info'" class="card">
            <div class="section-title">Data Penelitian</div>
            <div class="info-grid">
              <div class="info-item"><span>Lokasi Penelitian</span>
                <p>{{ app.research_location || '—' }}</p>
              </div>
              <div class="info-item"><span>Institusi</span>
                <p>{{ app.research_institution || '—' }}</p>
              </div>
              <div class="info-item"><span>Penanggung Jawab</span>
                <p>{{ app.person_responsible || '—' }}</p>
              </div>
              <div v-if="isResearchApplication" class="info-item"><span>Durasi Penelitian</span>
                <p>{{ app.research_duration || '—' }}</p>
              </div>
              <div v-if="isDataAwal" class="info-item"><span>Waktu Pengambilan Data</span>
                <p>{{ fmt(app.data_collection_date) }}</p>
              </div>
              <div v-if="isResearchApplication" class="info-item info-item--full"><span>Ringkasan Penelitian</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_background || '')" />
              </div>
              <div v-if="isResearchApplication" class="info-item info-item--full"><span>Subjek/Objek Penelitian</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_objectives || '')" />
              </div>
              <div class="info-item info-item--full"><span>Tujuan</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.purpose || '')" />
              </div>
              <div v-if="isResearchApplication" class="info-item info-item--full"><span>Metode Penelitian</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_methodology || '')" />
              </div>
              <div class="info-item info-item--full"><span>Kebutuhan Data</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.data_needed || '')" />
              </div>
            </div>
          </article>

          <article v-if="activeTab === 'info'" class="card">
            <template v-if="app.application_type !== 'IZIN_ETIK' && app.correspondence">
              <div class="section-title">Surat Pengantar Institusi</div>
              <div class="info-grid">
                <div class="info-item info-item--full"><span>Jabatan Penandatangan / Tujuan Surat</span>
                  <p>{{ app.correspondence.signatory_position || '—' }}</p>
                </div>
                <div class="info-item"><span>Institusi Tujuan</span>
                  <p>{{ app.correspondence.recipient_institution || researcher?.institution || '—' }}</p>
                </div>
                <div class="info-item"><span>Tanggal Pengajuan</span>
                  <p>{{ fmt(app.correspondence.incoming_letter_date) }}</p>
                </div>
                <div class="info-item info-item--full"><span>Nomor Surat Pengantar</span>
                  <p>{{ app.correspondence.incoming_letter_number || '—' }}</p>
                </div>
                <div class="info-item info-item--full"><span>Perihal Surat Pengantar</span>
                  <p>{{ app.correspondence.incoming_letter_subject || '—' }}</p>
                </div>
              </div>
            </template>
          </article>

          <!-- Screening -->
          <article v-else-if="activeTab === 'screening'" class="card">
            <div v-if="screeningRecommendation" class="screening-recommendation">
              <span>Rekomendasi untuk keputusan</span>
              <strong>{{ screeningRecommendation }}</strong>
            </div>
            <div v-if="screeningQuestions.length" class="screening-list">
              <div v-for="item in screeningQuestions" :key="item.key" class="screening-item">
                <div class="screening-question">
                  <span class="screening-number">{{ item.key.replace('question', '') }}.</span>
                  <span>{{ item.label }}</span>
                </div>
                <strong>{{ item.answer === 'yes' ? 'Ya' : item.answer === 'no' ? 'Tidak' : item.answer }}</strong>
              </div>
            </div>
            <p v-else class="empty-text">Jawaban screening belum tersedia pada pengajuan ini.</p>
          </article>

          <!-- Dokumen -->
          <article v-else class="card">
            <div v-if="app.documents?.length" class="documents">
              <div v-for="d in app.documents" :key="d.id" class="document">
                <div class="document-icon">
                  <FileText :size="19" />
                </div>
                <div class="document-info">
                  <strong>{{ d.document_type || 'Dokumen pendukung' }}</strong>
                  <span :title="d.original_name ?? d.stored_name ?? 'Dokumen'">{{ d.original_name || d.stored_name ||
                    'Dokumen'
                    }}</span>
                </div>
                <button class="download-button" type="button" @click="doc(d.id, d.original_name || 'dokumen')">
                  <FileText :size="16" /><span>Buka</span>
                </button>
              </div>
            </div>
            <p v-else class="empty-text">Tidak ada dokumen pendukung yang diunggah.</p>
          </article>
        </section>

        <!-- ===== Kolom samping ===== -->
        <aside class="side-column">
          <article v-if="!isAction" id="action-panel" class="card">
            <header class="card-header">
              <CheckCircle2 :size="19" />
              <h2>Tindakan Verifikasi</h2>
            </header>
            <div class="card-body">
              <button v-if="canOpen" class="btn btn-primary btn-block" :disabled="!!busy" type="button"
                @click="action('open', () => openDiklitApplication(id))">Mulai Verifikasi</button>
              <div v-if="app.status === 'ADMIN_REVIEW' && !isVerifier" class="verification-lock">
                <div class="lock-icon">
                  <FileCheck2 :size="18" />
                </div>
                <div>
                  <strong>Pengajuan sedang diverifikasi</strong>
                  <p>Ditangani oleh <strong>{{ app.verifier_name || 'DIKLAT lain' }}</strong><span
                      v-if="app.verifier_email">
                      ({{ app.verifier_email }})</span>.</p>
                  <small>Anda hanya dapat melihat detail pengajuan.</small>
                </div>
              </div>
              <template v-if="canApprove">
                <div class="action-group">
                  <button class="btn btn-success btn-block" :disabled="!!busy" type="button"
                    @click="action('without', () => approveWithoutEthics(id))">Setujui Tanpa Etik</button>
                  <button v-if="isResearchApplication" class="btn btn-outline btn-block" :disabled="!!busy"
                    type="button" @click="action('with', () => approveWithEthics(id))">Teruskan ke Jalur Etik</button>
                </div>
                <div class="divider" />
                <div class="form-group">
                  <label for="revision-note">Catatan revisi</label>
                  <textarea id="revision-note" v-model="revision" rows="3"
                    placeholder="Tuliskan catatan jika perlu revisi..." />
                  <button class="btn btn-warning btn-block" :disabled="!!busy || !revision.trim()" type="button"
                    @click="revisionAction">Minta Revisi</button>
                </div>
                <div class="form-group">
                  <label for="rejection-note">Catatan penolakan</label>
                  <textarea id="rejection-note" v-model="rejection" rows="3"
                    placeholder="Tuliskan alasan penolakan..." />
                  <button class="btn btn-danger btn-block" :disabled="!!busy || !rejection.trim()" type="button"
                    @click="rejectAction">
                    <XCircle :size="16" /> Tolak Pengajuan
                  </button>
                </div>
              </template>
            </div>
          </article>

          <article id="revision-panel" class="card">
            <header class="card-header">
              <FileCheck2 :size="19" />
              <h2>Catatan &amp; Riwayat Revisi</h2>
            </header>
            <div class="revision-body">
              <div v-if="revisions.length" class="revision-list">
                <div v-for="revisionItem in revisions" :key="revisionItem.id" class="revision-item">
                  <div class="revision-top">
                    <div>
                      <strong>Revisi #{{ revisionItem.revision_number }}</strong>
                      <span>{{ revisionItem.requested_by_name || 'Petugas DIKLIT' }}</span>
                    </div>
                    <span class="revision-status" :class="{ 'revision-status--done': !!revisionItem.submitted_at }">{{
                      revisionItem.submitted_at ? 'Sudah diperbaiki' : 'Belum diperbaiki' }}</span>
                  </div>
                  <p>{{ revisionItem.note || 'Tidak ada catatan revisi.' }}</p>
                  <div class="revision-meta">
                    <span>Diminta {{ fmt(revisionItem.created_at) }}</span>
                    <span v-if="revisionItem.submitted_at">Dikirim ulang {{ fmt(revisionItem.submitted_at) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="empty-text">Belum ada catatan revisi untuk pengajuan ini.</div>
            </div>
          </article>

          <article v-if="canManageLetter" id="letter-panel" class="card">
            <header class="card-header">
              <FileCheck2 :size="19" />
              <h2>Kelola Surat Izin</h2>
            </header>
            <div class="card-body">
              <div v-if="letter" class="letter-info"><strong>{{ letter.letter_number }}</strong><span>{{
                letter.letter_status
                  === 'GENERATED' ? 'Draft Surat' : 'Surat Bertanda Tangan' }}</span></div>
              <p v-if="app.status === 'PERMIT_ISSUED' && !letter" class="empty-text">Status surat sudah diterbitkan,
                tetapi
                detail surat belum berhasil dimuat. Muat ulang halaman untuk mencoba kembali.</p>
              <button v-if="letterType && !letter" class="btn btn-primary btn-block" :disabled="!!busy" type="button"
                @click="openLetterNumberModal">Generate Surat</button>
              <button v-if="letter?.letter_status === 'GENERATED'" class="btn btn-outline btn-block" type="button"
                @click="dl(letter.id, 'Surat-' + letter.letter_number + '.pdf')">
                <FileText :size="16" /> Buka Draft PDF
              </button>
              <div v-if="canUpload" class="upload-box">
                <p>Unggah kembali dokumen PDF setelah ditandatangani secara offline.</p>
                <input ref="input" class="hidden-input" type="file" accept="application/pdf,.pdf" @change="changed" />
                <button class="btn btn-outline btn-block" type="button" @click="pick">
                  <Upload :size="16" /> {{ file ? 'Ganti File PDF' : 'Pilih File PDF' }}
                </button>
                <div v-if="file" class="selected-file">{{ file.name }}</div>
                <button v-if="file" class="btn btn-primary btn-block" :disabled="!!busy" type="button"
                  @click="upload">Upload
                  Surat Final TTD</button>
              </div>
              <button v-if="letter?.letter_status === 'SIGNED_UPLOADED'" class="btn btn-success btn-block" type="button"
                @click="dl(letter.id, 'Surat-Final-' + letter.letter_number + '.pdf')">
                <FileText :size="16" /> Buka Surat Final
              </button>
            </div>
          </article>
        </aside>
      </div>
    </template>

    <div v-else class="state">
      <XCircle :size="44" /><strong>Data pengajuan tidak ditemukan.</strong>
    </div>

    <div v-if="showLetterNumberModal" class="number-modal-backdrop" @click.self="closeLetterNumberModal">
      <section class="number-modal" role="dialog" aria-modal="true" aria-labelledby="number-modal-title">
        <header class="number-modal__header">
          <div><span class="number-modal__eyebrow">PENERBITAN SURAT</span><h2 id="number-modal-title">Masukkan Nomor Surat</h2></div>
          <button class="number-modal__close" type="button" aria-label="Tutup" :disabled="busy === 'generate'" @click="closeLetterNumberModal">×</button>
        </header>
        <p>Masukkan nomor urut yang akan digunakan pada surat {{ typeLabels[app?.application_type || ''] || 'ini' }}.</p>
        <div class="number-modal__preview">
          <span>Format nomor</span>
          <strong>{{ letterType === 'DATA_AWAL' ? 'B/XXXX/UN16.34/PT.01.04/TAHUN' : 'B/XXXX/UN16.34/PK.01.06/TAHUN' }}</strong>
        </div>
        <div class="number-modal__field">
          <label for="manual-letter-number">Nomor urut</label>
          <input id="manual-letter-number" v-model="manualLetterNumber" type="text" inputmode="numeric" maxlength="12" placeholder="Contoh: 0123" autofocus @keyup.enter="confirmGenerateLetter" />
          <small>Masukkan angka saja, tanpa huruf atau tanda baca.</small>
        </div>
        <footer class="number-modal__actions">
          <button class="number-modal__cancel" type="button" :disabled="busy === 'generate'" @click="closeLetterNumberModal">Batal</button>
          <button class="number-modal__submit" type="button" :disabled="busy === 'generate' || !/^\d{1,12}$/.test(manualLetterNumber)" @click="confirmGenerateLetter">
            {{ busy === 'generate' ? 'Membuat surat...' : 'Generate Surat' }}
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* ===== Halaman ===== */
.detail-page {
  width: 100%;
  max-width: 1226px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
  color: var(--foreground)
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px
}

.back-button,
.download-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--card);
  color: var(--primary);
  font: inherit;
  font-size: .84rem;
  font-weight: 600;
  cursor: pointer
}

.back-button:hover,
.download-button:hover {
  border-color: var(--primary);
  background: var(--color-primary-soft)
}

.reference {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--muted);
  font-size: .74rem
}

.reference span {
  color: var(--muted-foreground)
}

.reference code {
  color: var(--foreground);
  font-family: monospace;
  font-weight: 700
}

.back-button:focus-visible,
.download-button:focus-visible,
.btn:focus-visible,
.tabs button:focus-visible,
.form-group textarea:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px
}

/* ===== Hero (tidak diubah) ===== */
.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--gradient-primary-soft);
  box-shadow: var(--shadow-sm)
}

.hero-content {
  min-width: 0
}

.eyebrow {
  display: inline-block;
  margin-bottom: 7px;
  color: var(--primary);
  font-size: .73rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase
}

.hero h1 {
  max-width: 900px;
  margin: 0;
  color: var(--foreground);
  font-size: clamp(1.15rem, 2vw, 1.55rem);
  line-height: 1.4;
  overflow-wrap: anywhere
}

.hero p {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 8px 0 0;
  color: var(--muted-foreground);
  font-size: .82rem
}

.hero p strong {
  color: var(--foreground)
}

.researcher-summary {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border)
}

.researcher-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 13px
}

.researcher-name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px
}

.researcher-name strong {
  color: var(--foreground);
  font-size: .9rem
}

.researcher-category {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--primary);
  font-size: .67rem;
  font-weight: 700;
  white-space: nowrap
}

.researcher-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 14px
}

.researcher-detail {
  min-width: 0;
  display: grid;
  gap: 3px
}

.researcher-detail span {
  color: var(--primary);
  font-size: .66rem;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase
}

.researcher-detail strong {
  min-width: 0;
  color: var(--foreground);
  font-size: .76rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 31px;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--color-neutral-soft);
  color: var(--muted-foreground);
  font-size: .75rem;
  font-weight: 700;
  white-space: nowrap
}

/* ===== Langkah berikutnya ===== */
.next-step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card)
}

.next-step-icon {
  display: grid;
  place-items: center;
  flex: 0 0 42px;
  height: 42px;
  border-radius: 11px;
  background: var(--color-info-soft);
  color: var(--color-info)
}

.next-step-body {
  flex: 1;
  min-width: 0
}

.next-step-body strong {
  display: block;
  font-size: .95rem
}

.next-step-body p {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: .83rem;
  line-height: 1.5;
  overflow-wrap: anywhere
}

.next-step--warning {
  border-color: var(--color-warning-border);
  background: var(--color-warning-soft)
}

.next-step--warning .next-step-icon {
  background: var(--card);
  color: var(--color-warning)
}

.next-step--success {
  border-color: var(--color-success-border);
  background: var(--color-success-soft)
}

.next-step--success .next-step-icon {
  background: var(--card);
  color: var(--color-success)
}

.next-step--danger {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft)
}

.next-step--danger .next-step-icon {
  background: var(--card);
  color: var(--color-danger)
}

.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: .82rem
}

.alert--error {
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger)
}

.alert--success {
  background: var(--color-success-soft);
  border: 1px solid var(--color-success-border);
  color: var(--color-success)
}

/* ===== Layout ===== */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, .85fr);
  gap: 20px;
  align-items: start
}

.main-column,
.side-column {
  display: grid;
  gap: 16px;
  min-width: 0
}

.side-column {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding-bottom: 2px;
  scrollbar-width: thin
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.card-header {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--color-overlay-subtle)
}

.card-header h2 {
  margin: 0;
  color: var(--foreground);
  font-size: .92rem;
  font-weight: 700
}

.card-header svg {
  color: var(--primary)
}

.card-body {
  display: grid;
  gap: 12px;
  padding: 16px 20px 20px
}

.empty-text {
  padding: 22px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: .82rem
}

/* ===== Tab ===== */
.tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: .84rem;
  white-space: nowrap;
  cursor: pointer
}

.tabs button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 800
}

.tab-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--foreground);
  font-size: .68rem;
  font-weight: 700
}

/* ===== Informasi ===== */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr))
}

.info-item {
  min-width: 0;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border)
}

.info-item--full {
  grid-column: 1/-1
}

.info-item>span {
  display: block;
  margin-bottom: 6px;
  color: var(--primary);
  font-size: .74rem;
  font-weight: 700
}

.info-item p {
  margin: 0;
  color: var(--foreground);
  font-size: .9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere
}

.rich-text-content {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: .9rem;
  line-height: 1.6
}

.section-title {
  padding: 11px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--color-overlay-subtle);
  color: var(--primary);
  font-size: .8rem;
  font-weight: 700
}

/* ===== Screening ===== */
.screening-recommendation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 16px 20px 4px;
  padding: 13px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  background: var(--color-primary-soft)
}

.screening-recommendation span {
  color: var(--foreground);
  font-size: .84rem;
  font-weight: 650
}

.screening-recommendation strong {
  color: var(--primary);
  font-size: .84rem
}

.screening-list,
.documents {
  display: grid;
  gap: 9px;
  padding: 14px 20px
}

.screening-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface)
}

.screening-question {
  display: flex;
  gap: 8px;
  min-width: 0
}

.screening-number {
  flex: 0 0 auto;
  color: var(--primary);
  font-weight: 700
}

.screening-question>span:last-child {
  color: var(--foreground);
  font-size: .84rem;
  line-height: 1.55
}

.screening-item strong {
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--foreground);
  font-size: .74rem;
  white-space: nowrap
}

/* ===== Dokumen ===== */
.document {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface)
}

.document:hover {
  border-color: var(--primary)
}

.document-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 9px;
  background: var(--color-primary-soft);
  color: var(--primary)
}

.document-info {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px
}

.document-info strong {
  color: var(--foreground);
  font-size: .83rem;
  overflow-wrap: anywhere
}

.document-info span {
  color: var(--muted-foreground);
  font-size: .72rem;
  overflow-wrap: anywhere
}

.download-button {
  min-height: 34px;
  font-size: .76rem;
  white-space: nowrap
}

/* ===== Tombol ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 9px;
  font: inherit;
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer
}

.btn:disabled {
  opacity: .55;
  cursor: not-allowed
}

.btn-block {
  width: 100%
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground)
}

.btn-success {
  background: var(--color-success);
  color: var(--primary-foreground)
}

.btn-outline {
  background: var(--card);
  border-color: var(--border);
  color: var(--foreground)
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--color-primary-soft)
}

.btn-warning {
  background: var(--color-warning);
  color: var(--primary-foreground)
}

.btn-danger {
  background: var(--color-danger);
  color: var(--primary-foreground)
}

/* ===== Panel tindakan ===== */
.verification-lock {
  display: flex;
  gap: 11px;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--muted)
}

.lock-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 9px;
  background: var(--color-warning-soft);
  color: var(--color-warning)
}

.verification-lock strong {
  font-size: .82rem
}

.verification-lock p {
  margin: 4px 0;
  color: var(--muted-foreground);
  font-size: .76rem;
  line-height: 1.5
}

.verification-lock small {
  display: block;
  color: var(--muted-foreground);
  font-size: .7rem
}

.action-group,
.form-group {
  display: grid;
  gap: 9px
}

.form-group label {
  color: var(--foreground);
  font-size: .8rem;
  font-weight: 700
}

.form-group textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .82rem;
  resize: vertical
}

.form-group textarea:focus {
  border-color: var(--primary)
}

.divider {
  height: 1px;
  background: var(--border)
}

/* ===== Catatan revisi ===== */
.revision-body {
  padding: 14px 20px 18px
}

.revision-list {
  display: grid;
  gap: 10px
}

.revision-item {
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--color-surface)
}

.revision-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px
}

.revision-top>div {
  display: grid;
  gap: 3px
}

.revision-top strong {
  color: var(--foreground);
  font-size: .82rem
}

.revision-top span {
  color: var(--muted-foreground);
  font-size: .7rem
}

.revision-status {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: .66rem;
  font-weight: 700
}

.revision-status--done {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.revision-item p {
  margin: 10px 0;
  color: var(--foreground);
  font-size: .82rem;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere
}

.revision-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--muted-foreground);
  font-size: .68rem
}

.state {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: var(--muted-foreground);
  font-size: .84rem
}

.spin {
  color: var(--primary);
  animation: spin 1s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media (prefers-reduced-motion:reduce) {
  .spin {
    animation: none
  }
}

/* ===== Responsif ===== */
@media(max-width:900px) {
  .layout {
    grid-template-columns: 1fr
  }

  .side-column {
    position: static;
    max-height: none;
    overflow: visible;
    order: -1
  }

  .hero {
    padding: 20px
  }
}

@media(max-width:640px) {
  .detail-page {
    gap: 14px
  }

  .topbar {
    flex-direction: column;
    align-items: stretch
  }

  .back-button,
  .download-button {
    width: 100%
  }

  .reference {
    justify-content: center
  }

  .hero {
    flex-direction: column;
    padding: 18px;
    gap: 14px
  }

  .hero h1 {
    font-size: 1.15rem
  }

  .status-badge {
    width: max-content
  }

  .next-step {
    flex-direction: column;
    align-items: stretch
  }

  .next-step .btn {
    width: 100%
  }

  .info-grid {
    grid-template-columns: 1fr
  }

  .info-item,
  .info-item--full {
    grid-column: auto;
    padding: 13px 16px
  }

  .card-header {
    padding: 15px 16px
  }

  .card-body {
    padding: 15px 16px
  }

  .screening-list,
  .documents {
    padding: 12px 16px
  }

  .screening-recommendation {
    flex-direction: column;
    align-items: flex-start;
    margin: 12px 16px 4px
  }

  .screening-item {
    flex-direction: column;
    gap: 7px
  }

  .screening-item strong {
    align-self: flex-start
  }

  .document {
    align-items: flex-start;
    flex-wrap: wrap
  }

  .document-info {
    width: calc(100% - 50px)
  }

  .verification-lock,
  .alert {
    align-items: flex-start
  }

  .researcher-details {
    grid-template-columns: 1fr
  }

  .researcher-summary {
    margin-top: 15px;
    padding-top: 14px;
    max-width: max-content;
    width: 100%;
    border-top: 1px solid var(--border)
  }
}

/* ===== Khusus Diklit ===== */

.status-badge--submitted{
  background: var(--color-info-soft);
  color: var(--color-info)
}

.status-badge--required_ethics,
.status-badge--admin_review {
  background: var(--color-warning-soft);
  color: var(--color-warning)
}

.status-badge--revision_required,
.status-badge--rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger)
}


.status-badge--approved,
.status-badge--permit_issued {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.letter-info {
  display: grid;
  gap: 4px;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--muted)
}

.letter-info strong {
  font-family: monospace;
  font-size: .8rem;
  overflow-wrap: anywhere
}

.letter-info span {
  color: var(--muted-foreground);
  font-size: .7rem
}

.upload-box {
  display: grid;
  gap: 9px
}

.upload-box p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: .75rem;
  line-height: 1.5
}

.hidden-input {
  display: none
}

.selected-file {
  padding: 8px 10px;
  border-radius: 7px;
  background: var(--color-primary-soft);
  color: var(--primary);
  font-size: .74rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.number-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(15 23 42 / 58%);
  backdrop-filter: blur(3px);
  animation: number-modal-fade .18s ease-out
}
.number-modal {
  width: min(100%, 460px);
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
  color: var(--foreground);
  box-shadow: 0 24px 70px rgb(0 0 0 / 24%);
  animation: number-modal-rise .2s ease-out
}
.number-modal__header,.number-modal__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px
}
.number-modal__eyebrow {
  color: var(--primary);
  font-size: .65rem;
  font-weight: 800;
  letter-spacing: .1em
}
.number-modal h2 { margin: 5px 0 0; font-size: 1.2rem }
.number-modal__close {
  width: 34px; height: 34px; border: 0; border-radius: 9px;
  background: var(--muted); color: var(--muted-foreground);
  font-size: 1.5rem; line-height: 1; cursor: pointer
}
.number-modal p { margin: 16px 0; color: var(--muted-foreground); font-size: .82rem; line-height: 1.55 }
.number-modal__preview {
  display: grid; gap: 5px; padding: 12px 14px; margin-bottom: 18px;
  border: 1px solid var(--border); border-radius: 11px; background: var(--muted)
}
.number-modal__preview span,.number-modal__field small { color: var(--muted-foreground); font-size: .7rem }
.number-modal__preview strong { font-family: monospace; font-size: .78rem; overflow-wrap: anywhere }
.number-modal__field { display: grid; gap: 7px; margin-bottom: 22px }
.number-modal__field label { font-size: .8rem; font-weight: 700 }
.number-modal__field input {
  width: 100%; box-sizing: border-box; padding: 12px 13px;
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--background); color: var(--foreground);
  font: inherit; font-size: 1rem; letter-spacing: .04em
}
.number-modal__field input:focus { outline: 2px solid var(--ring); outline-offset: 1px; border-color: var(--primary) }
.number-modal__actions { justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--border) }
.number-modal__cancel,.number-modal__submit {
  min-height: 40px; padding: 0 15px; border-radius: 9px;
  font: inherit; font-size: .8rem; font-weight: 700; cursor: pointer
}
.number-modal__cancel { border: 1px solid var(--border); background: var(--card); color: var(--foreground) }
.number-modal__submit { border: 0; background: var(--primary); color: var(--primary-foreground) }
.number-modal__submit:disabled,.number-modal__cancel:disabled,.number-modal__close:disabled { opacity: .55; cursor: not-allowed }
@keyframes number-modal-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes number-modal-rise { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
@media(max-width:480px) { .number-modal { padding: 19px; border-radius: 15px } .number-modal__actions>* { flex: 1 } }
@media(prefers-reduced-motion:reduce) { .number-modal-backdrop,.number-modal { animation: none } }
</style>