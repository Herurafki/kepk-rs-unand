<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileCheck2, FileText, Info, LoaderCircle, XCircle } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import {
  getSecretariatApplication,
  forwardSecretariatApplication,
  requestSecretariatRevision,
  rejectSecretariatApplication,
  type SecretariatApplication,
  getSecretariatRevisions,
  type SecretariatRevision,
} from '../../services/secretariat/application.service'
import { downloadDocument } from '../../services/diklit/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { displayDocumentInTab, openDocumentTab } from '../../utils/document-preview'
import { sanitizeResearcherRichText } from "../../utils/researcher-rich-text";

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const app = ref<SecretariatApplication | null>(null)
const loading = ref(true)
const busy = ref('')
const error = ref('')
const success = ref('')
const revision = ref('')
const rejection = ref('')
const revisions = ref<SecretariatRevision[]>([])
const activeTab = ref<'info' | 'screening' | 'documents'>('info')
const showAllRevisions = ref(false)
const reviewResults = computed(() => Array.isArray((app.value as any)?.review_results) ? (app.value as any).review_results : [])

// ===== Hasil Reviewer =====
const indicatorLabels = [
  'Apakah kriteria inklusi dan ekslusi sampel penelitian jelas?',
  'Adakah penjelasan rinci tentang tindakan yang akan dilakukan terhadap subjek/objek penelitian?',
  'Apakah perlakuan terhadap subjek/objek penelitian aman?',
  'Apakah rasio risiko-keuntungan baik bagi ilmu pengetahuan atau bagi subjek/objek penelitian ini sepadan?',
  'Adakah prosedur penghentian studi?',
  'Apakah peneliti menggunakan subjek rentan (anak, wanita hamil, pasien peneliti, tentara, polisi, tahanan, narapidana, murid, dll) ?',
  'Apakah ada potensi conflict of interest (pertentangan kepentingan) ?',
  'Apakah spesimen darah/jaringan dikirim ke luar negeri?',
  'Adakah informasi tentang efikasi dan keamanan obat bahan coba (product information)?',
  'Adakah asuransi bagi subjek penelitian?',
  'Apakah peneliti menyiapkan tindakan medis yang sesuai untuk kecelakaan yang berkaitan dengan penelitian?',
  'Apakah proses mendapatkan persetujuan setelah penjelasan (psp, informed consent) dari subjek tepat?',
  'Apakah animal house yang digunakan layak?',
  'Apakah hewan coba berada dalam rasa nyeri/kesakitan yang amat sangat atau kematian karena perlakuan penelitian?',
  'Apabila diperkirakan akan menimbulkan rasa sakit pada hewan coba, apakah dilakukan sedasi, analgesi atau anestesi yang sesuai standar prosedur kedokteran hewan?',
  'Apakah hewan coba dipelihara sebaik mungkin sesuai tingkah laku dan kebutuhan biologis spesies hewan tersebut?',
  'Apakah ada deskripsi penelitian disertai manfaatnya pada lembar informasi?',
  'Apakah bahasa yang digunakan pada lembar informasi dapat dipahami awam?',
  'Apakah pada lembar informasi ada deskripsi perlakuan yang akan diterima subjek penelitian?',
  'Apakah pada lembar informasi ada deskripsi periode keikutsertaan sebagai subjek?',
  'Apakah pada lembar informasi ada deskripsi risiko penelitian terhadap kesehatan subjek?',
  'Apakah pada lembar informasi ada deskripsi tindakan medis/psikososial atau ganti rugi untuk efek samping/kerugian terkait penelitian, termasuk pilihan pengobatan apabila diperlukan?',
  'Apakah pada lembar informasi ada deskripsi jaminan kerahasiaan data?',
  'Apakah pada lembar informasi ada deskripsi bahwa partisipasi subjek bersifat sukarela?',
  'Apakah pada lembar informasi ada deskripsi hak subjek mengundurkan diri sewaktu-waktu tanpa ada sanksi/kriteria pengunduran diri?',
  'Apakah pada lembar informasi ada nama jelas, alamat dan nomor telepon penanggung jawab penelitian?',
]

const selectedReview = ref<any | null>(null)

function parseReviewObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function reviewDecisionLabel(value?: string) {
  const normalized = String(value || '').toUpperCase()
  if (['APPROVE', 'AGREE', 'AGREED', 'SETUJU'].includes(normalized)) return 'Setuju'
  if (['REJECT', 'REJECTED', 'DISAGREE', 'TOLAK'].includes(normalized)) return 'Tolak'
  if (['REVISION', 'REVISION_REQUIRED'].includes(normalized)) return 'Rekomendasi revisi (data lama)'
  return value || 'Belum memberikan hasil'
}

function reviewComments(review: any): string[] {
  const raw = review?.comments
  if (Array.isArray(raw)) return raw.map((item: any) => (typeof item === 'string' ? item : item?.comment)).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) return [raw]
  return []
}

const reviewerKey = (review: any) => String(review?.reviewer_id ?? review?.reviewer_name ?? review?.id)
const reviewTime = (review: any) => new Date(review?.reviewed_at || review?.created_at || 0).getTime()

// Satu baris per reviewer (penilaian terbaru)
const latestReviewResults = computed(() => {
  const map = new Map<string, any>()
  for (const review of reviewResults.value) {
    const key = reviewerKey(review)
    const current = map.get(key)
    const newer =
      !current ||
      Number(review.review_cycle || 1) > Number(current.review_cycle || 1) ||
      (Number(review.review_cycle || 1) === Number(current.review_cycle || 1) && reviewTime(review) >= reviewTime(current))
    if (newer) map.set(key, review)
  }
  return [...map.values()]
})

const selectedReviewRounds = computed(() => {
  if (!selectedReview.value) return []
  const key = reviewerKey(selectedReview.value)
  return reviewResults.value
    .filter((review: any) => reviewerKey(review) === key)
    .slice()
    .sort((a: any, b: any) => Number(a.review_cycle || 1) - Number(b.review_cycle || 1) || reviewTime(a) - reviewTime(b))
})

const reviewVotes = computed(() => {
  let approve = 0
  let reject = 0
  for (const review of latestReviewResults.value) {
    const label = reviewDecisionLabel(review.recommendation)
    if (label === 'Setuju') approve++
    else if (label === 'Tolak') reject++
  }
  return { approve, reject }
})

const reviewSummaryLabel = computed(() => {
  const { approve, reject } = reviewVotes.value
  if (approve + reject === 0) return 'Belum ada keputusan Setuju/Tolak'
  if (approve === reject) return 'Hasil seimbang'
  return approve > reject ? 'Mayoritas: Setuju' : 'Mayoritas: Tolak'
})

const reviewVerdict = computed<'agree' | 'reject' | 'neutral'>(() => {
  const { approve, reject } = reviewVotes.value
  if (approve + reject === 0 || approve === reject) return 'neutral'
  return approve > reject ? 'agree' : 'reject'
})

function reviewAnswer(index: number): boolean | null {
  const value = parseReviewObject(selectedReview.value?.indicator_answers)[String(index)]
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

function reviewIndicatorComment(index: number): string {
  const value = parseReviewObject(selectedReview.value?.indicator_comments)[String(index)]
  return typeof value === 'string' ? value.trim() : ''
}

const answeredReviewIndicators = computed(
  () => indicatorLabels.filter((_, index) => reviewAnswer(index + 1) !== null).length,
)

const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

const typeLabels: Record<string, string> = {
  DATA_AWAL: 'Pengambilan Data Awal',
  IZIN_PENELITIAN: 'Izin Penelitian',
  IZIN_ETIK: 'Kaji Etik',
}
const isResearchApplication = computed(() =>
  app.value?.application_type === 'IZIN_PENELITIAN' || app.value?.application_type === 'IZIN_ETIK',
)
const status = (s?: string) => ({
  SUBMITTED: 'Menunggu Verifikasi',
  ADMIN_REVIEW: 'Sedang Diverifikasi',
  ADMIN_APPROVED: 'Menunggu Verifikasi',
  SEKRETARIS_REVIEW: 'Belum Diverifikasi',
  WAITING_REVIEWER: 'Menunggu Reviewer',
  UNDER_REVIEW: 'Sedang Direview',
  REVIEW_COMPLETED: 'Review Selesai',
  REVISION_REQUIRED: 'Revisi',
  APPROVED: 'Disetujui KEPK',
  PERMIT_ISSUED: 'Surat Diterbitkan',
  REJECTED: 'Ditolak',
}[s || ''] || s || '—')
const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

const researcher = computed(() => {
  if (!app.value) return null
  return {
    name: app.value.researcher_name || '—',
    email: app.value.researcher_email || '—',
    category: app.value.researcher_category?.toLowerCase() || '',
    nim: app.value.researcher_nim || '—',
    nip: app.value.researcher_nip || '—',
    nik: app.value.researcher_nik || '—',
    phone: app.value.researcher_phone || '—',
    address: app.value.researcher_address || '—',
    institution: app.value.researcher_institution || '—',
    faculty: app.value.researcher_faculty || '—',
    programStudy: app.value.researcher_program_study || '—',
    department: app.value.researcher_department || '—',
  }
})

const researcherCategoryLabel = computed(() => ({
  mahasiswa: 'Mahasiswa',
  dosen: 'Dosen',
  staff: 'Staff',
  umum: 'Umum',
}[researcher.value?.category || ''] || 'Peneliti'))


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

function parseScreening(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }

  return {}
}

const screening = computed(() => parseScreening((app.value as any)?.screening))

const screeningAnswers = computed(() => {
  const answers = screening.value.answers
  return parseScreening(answers ?? screening.value)
})

const hasScreening = computed(() => Object.keys(screening.value).length > 0)

const screeningQuestions = computed(() => {
  if (!hasScreening.value) return []

  const type = app.value?.application_type === 'IZIN_ETIK' ? 'ethics' : 'research'
  const labels = screeningQuestionLabels[type]

  return Object.entries(screeningAnswers.value)
    .filter(([key]) => /^question\d+$/.test(key))
    .sort(([left], [right]) => Number(left.replace('question', '')) - Number(right.replace('question', '')))
    .map(([key, answer]) => ({
      key,
      label: labels[key] || key.replace('question', 'Pertanyaan '),
      answer
    }))
})

const screeningRecommendation = computed(() =>
  screening.value.recommendation ?? screening.value.result ?? (app.value as any)?.screening_recommendation ?? null,
)

const screeningAnswerLabel = (answer: unknown) => {
  const value = String(answer ?? '').trim().toLowerCase()
  if (['yes', 'ya', 'true'].includes(value)) return 'Ya'
  if (['no', 'tidak', 'false'].includes(value)) return 'Tidak'
  return answer ?? '—'
}

const canVerify = computed(() =>
  ['ADMIN_APPROVED', 'SEKRETARIS_REVIEW'].includes(app.value?.status || ''),
)
const canAct = computed(() => canVerify.value)
const isWaitingForChief = computed(() =>
  ['WAITING_REVIEWER', 'UNDER_REVIEW', 'REVIEW_COMPLETED'].includes(app.value?.status || ''),
)
const isApproved = computed(() =>
  ['APPROVED', 'PERMIT_ISSUED'].includes(app.value?.status || ''),
)
const showReviewResults = computed(() => isWaitingForChief.value || isApproved.value)
const hasActions = computed(() => canAct.value)
// Panel samping hanya ditampilkan bila ada isinya.
const hasRevisions = computed(() => revisions.value.length > 0)
const sortedRevisions = computed(() =>
  [...revisions.value].sort((a, b) => Number(b.revision_number) - Number(a.revision_number)),
)
const visibleRevisions = computed(() => (showAllRevisions.value ? sortedRevisions.value : sortedRevisions.value.slice(0, 1)))
const hasSideContent = computed(() => hasActions.value || hasRevisions.value || showReviewResults.value)

// Sesuaikan nama route menu Surat Sekretariat dengan router Anda
const LETTER_ROUTE_NAME = 'secretariat-letters'
function goToLetters() {
  router.push({ name: LETTER_ROUTE_NAME })
}

/* ---- langkah berikutnya ---- */
type NextStep = { tone: 'info' | 'warning' | 'success' | 'danger'; title: string; text: string; cta?: string; target?: string }
const nextStep = computed<NextStep | null>(() => {
  const a = app.value
  if (!a) return null
  if (canVerify.value) {
    return { tone: 'warning', title: 'Verifikasi pengajuan', text: 'Periksa informasi, screening, dan dokumen, lalu teruskan ke Ketua KEPK, minta revisi, atau tolak pengajuan.', cta: 'Ke tindakan verifikasi', target: 'action-panel' }
  }
  if (isWaitingForChief.value) {
    return { tone: 'info', title: 'Menunggu proses Ketua KEPK', text: 'Pengajuan sedang direview atau menunggu keputusan akhir Ketua KEPK.', cta: 'Lihat hasil reviewer', target: 'review-panel' }
  }
  if (isApproved.value) {
    const issued = a.status === 'PERMIT_ISSUED'
    return {
      tone: 'success',
      title: issued ? 'Surat izin telah diterbitkan' : 'Pengajuan telah disetujui',
      text: issued ? 'Surat dapat dilihat dan diunduh pada menu Surat.' : 'Silakan proses penerbitan surat pada menu Surat.',
      cta: 'Buka Menu Surat',
      target: 'letters',
    }
  }
  if (a.status === 'REVISION_REQUIRED') return { tone: 'info', title: 'Menunggu perbaikan peneliti', text: 'Pengajuan kembali untuk diverifikasi setelah peneliti mengirim perbaikan.', cta: revisions.value.length ? 'Lihat catatan revisi' : undefined, target: 'revision-panel' }
  if (a.status === 'REJECTED') return { tone: 'danger', title: 'Pengajuan ditolak', text: 'Pengajuan ini tidak dapat dilanjutkan.' }
  return { tone: 'info', title: 'Belum masuk pemeriksaan Sekretariat', text: `Status saat ini: ${status(a.status)}. Tindakan verifikasi tersedia ketika pengajuan masuk ke pemeriksaan Sekretariat.` }
})
function goToTarget(target?: string) {
  if (!target) return
  if (target === 'letters') { goToLetters(); return }
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [applicationResponse, revisionsResponse] = await Promise.all([
      getSecretariatApplication(id.value),
      getSecretariatRevisions(id.value),
    ])
    app.value = applicationResponse.data
    revisions.value = revisionsResponse.data || []
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Gagal memuat detail pengajuan.')
  } finally {
    loading.value = false
  }
}

async function action(key: string, fn: () => Promise<unknown>) {
  busy.value = key
  error.value = ''
  success.value = ''
  try {
    await fn()
    success.value = 'Perubahan berhasil disimpan.'
    revision.value = ''
    rejection.value = ''
    await load()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Aksi gagal diproses.')
  } finally {
    busy.value = ''
  }
}

async function forward() {
  await action('forward', () => forwardSecretariatApplication(id.value))
}
async function revisionAction() {
  if (revision.value.trim()) await action('revision', () => requestSecretariatRevision(id.value, revision.value.trim()))
}
async function rejectAction() {
  if (rejection.value.trim()) await action('reject', () => rejectSecretariatApplication(id.value, rejection.value.trim()))
}
async function doc(documentId: string, name: string) {
  const tab = openDocumentTab()
  if (!tab) { error.value = 'Browser memblokir tab dokumen. Izinkan pop-up, lalu coba lagi.'; return }
  try {
    const blob = await downloadDocument(documentId)
    displayDocumentInTab(tab, blob, name)
  } catch (e) {
    tab.close()
    error.value = getApiErrorMessage(e, 'Dokumen tidak dapat dibuka.')
  }
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
              <div v-if="researcher.category === 'mahasiswa'" class="researcher-detail"><span>NIM</span><strong>{{ researcher.nim }}</strong></div>
              <div v-if="researcher.category === 'dosen' || researcher.category === 'staff'" class="researcher-detail"><span>NIP</span><strong>{{ researcher.nip }}</strong></div>
              <div v-if="researcher.category === 'umum'" class="researcher-detail"><span>NIK</span><strong>{{ researcher.nik }}</strong></div>
              <div class="researcher-detail"><span>No. HP</span><strong>{{ researcher.phone }}</strong></div>
              <div class="researcher-detail"><span>Alamat</span><strong>{{ researcher.address }}</strong></div>
              <div class="researcher-detail"><span>Institusi</span><strong>{{ researcher.institution }}</strong></div>
              <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'" class="researcher-detail"><span>Fakultas</span><strong>{{ researcher.faculty }}</strong></div>
              <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'" class="researcher-detail"><span>Program Studi</span><strong>{{ researcher.programStudy }}</strong></div>
              <div v-if="researcher.category === 'staff'" class="researcher-detail"><span>Departemen</span><strong>{{ researcher.department }}</strong></div>
            </div>
          </div>
        </div>

        <span class="status-badge" :class="`status-badge--${app.status?.toLowerCase()}`">
          {{ status(app.status) }}
        </span>
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
        <button v-if="nextStep.cta" class="btn btn-primary" type="button" @click="goToTarget(nextStep.target)">{{ nextStep.cta }}</button>
      </section>

      <div v-if="error" class="alert alert--error" role="alert"><XCircle :size="18" /><span>{{ error }}</span></div>
      <div v-if="success" class="alert alert--success" role="status"><CheckCircle2 :size="18" /><span>{{ success }}</span></div>

      <div class="layout" :class="{ 'layout--single': !hasSideContent }">
        <!-- ===== Kolom utama: tab ===== -->
        <section class="main-column">
          <nav class="tabs" role="tablist" aria-label="Bagian detail pengajuan">
            <button type="button" role="tab" :aria-selected="activeTab === 'info'" :class="{ active: activeTab === 'info' }" @click="activeTab = 'info'">Informasi Penelitian</button>
            <button v-if="hasScreening" type="button" role="tab" :aria-selected="activeTab === 'screening'" :class="{ active: activeTab === 'screening' }" @click="activeTab = 'screening'">Screening</button>
            <button type="button" role="tab" :aria-selected="activeTab === 'documents'" :class="{ active: activeTab === 'documents' }" @click="activeTab = 'documents'">
              Dokumen <span class="tab-count">{{ (app as any).documents?.length || 0 }}</span>
            </button>
          </nav>

          <!-- Informasi -->
          <article v-if="activeTab === 'info'" class="card">
            <div class="info-grid">
              <div class="info-item info-item--full"><span>Judul Penelitian</span><p>{{ app.research_title || '—' }}</p></div>
              <div class="info-item"><span>Lokasi Penelitian</span><p>{{ (app as any).research_location || '—' }}</p></div>
              <div class="info-item"><span>Institusi</span><p>{{ app.researcher_institution || '—' }}</p></div>
              <div class="info-item"><span>Penanggung Jawab</span><p>{{ (app as any).person_responsible || '—' }}</p></div>
              <div v-if="isResearchApplication" class="info-item"><span>Durasi Penelitian</span><p>{{ (app as any).research_duration || '—' }}</p></div>
              <div class="info-item info-item--full"><span>Tanggal Pengajuan</span><p>{{ fmt(app.created_at) }}</p></div>
              <div v-if="isResearchApplication" class="info-item info-item--full"><span>Latar Belakang</span><div class="rich-text-content" v-html="sanitizeResearcherRichText((app as any).research_background || '')" /></div>
              <div v-if="isResearchApplication" class="info-item info-item--full"><span>Tujuan Penelitian</span><div class="rich-text-content" v-html="sanitizeResearcherRichText((app as any).purpose || '')" /></div>
              <div v-if="isResearchApplication" class="info-item info-item--full"><span>Metodologi</span><div class="rich-text-content" v-html="sanitizeResearcherRichText((app as any).research_methodology || '')" /></div>
              <div class="info-item info-item--full"><span>Kebutuhan Data</span><div class="rich-text-content" v-html="sanitizeResearcherRichText((app as any).data_needed || '')" /></div>
            </div>
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
                <strong>{{ screeningAnswerLabel(item.answer) }}</strong>
              </div>
            </div>
            <p v-else class="empty-text">Jawaban screening belum tersedia pada pengajuan ini.</p>
          </article>

          <!-- Dokumen -->
          <article v-else class="card">
            <div v-if="(app as any).documents?.length" class="documents">
              <div v-for="d in (app as any).documents" :key="d.id" class="document">
                <div class="document-icon"><FileText :size="19" /></div>
                <div class="document-info">
                  <strong :title="d.original_name ?? d.stored_name ?? 'Dokumen'">{{ d.original_name || d.stored_name || 'Dokumen' }}</strong>
                  <span>{{ d.document_type || 'Dokumen pendukung' }}</span>
                </div>
                <button class="download-button" type="button" @click="doc(d.id, d.original_name || 'dokumen')"><FileText :size="16" /><span>Buka</span></button>
              </div>
            </div>
            <p v-else class="empty-text">Tidak ada dokumen pendukung yang diunggah.</p>
          </article>
        </section>

        <!-- ===== Kolom samping ===== -->
        <aside v-if="hasSideContent" class="side-column" :class="{ 'side-column--first': hasActions }">
          <article v-if="hasActions" id="action-panel" class="card">
            <header class="card-header"><CheckCircle2 :size="19" /><h2>Tindakan Verifikasi</h2></header>
            <div class="card-body">
              <div class="action-group">
                <p class="group-label">Keputusan</p>
                <button class="btn btn-success btn-block" :disabled="!!busy" type="button" @click="forward"><CheckCircle2 :size="16" /> Verifikasi &amp; Teruskan</button>
              </div>
              <div class="divider" />
              <p class="group-label">Perlu tindak lanjut lain?</p>
                <details class="decision" :open="!!revision.trim()">
                  <summary>Minta revisi</summary>
                  <div class="decision-body form-group">
                    <label class="sr-only" for="revision-note">Catatan revisi</label>
                    <textarea id="revision-note" v-model="revision" rows="3" placeholder="Tuliskan apa yang perlu diperbaiki peneliti..." />
                    <button class="btn btn-warning btn-block" :disabled="!!busy || !revision.trim()" type="button" @click="revisionAction">Kirim permintaan revisi</button>
                  </div>
                </details>
                <details class="decision decision--danger" :open="!!rejection.trim()">
                  <summary>Tolak pengajuan</summary>
                  <div class="decision-body form-group">
                    <label class="sr-only" for="rejection-note">Alasan penolakan</label>
                    <textarea id="rejection-note" v-model="rejection" rows="3" placeholder="Tuliskan alasan penolakan..." />
                    <button class="btn btn-danger btn-block" :disabled="!!busy || !rejection.trim()" type="button" @click="rejectAction"><XCircle :size="16" /> Tolak pengajuan</button>
                  </div>
                </details>
            </div>
          </article>

          <article v-if="hasRevisions" id="revision-panel" class="card">
            <header class="card-header">
              <FileCheck2 :size="19" /><h2>Catatan &amp; Riwayat Revisi</h2>
              <span class="header-chip">{{ revisions.length }}</span>
            </header>
            <div class="revision-body">
              <div class="revision-list">
                <div v-for="(revisionItem, index) in visibleRevisions" :key="revisionItem.id" class="revision-item">
                  <div class="revision-top">
                    <div>
                      <strong>Revisi #{{ revisionItem.revision_number }}<em v-if="index === 0" class="revision-latest">Terbaru</em></strong>
                      <span>{{ revisionItem.requested_by_name || 'Petugas KEPK' }}</span>
                    </div>
                    <span class="revision-status" :class="{ 'revision-status--done': !!revisionItem.submitted_at }">{{ revisionItem.submitted_at ? 'Sudah diperbaiki' : 'Belum diperbaiki' }}</span>
                  </div>
                  <p>{{ revisionItem.note || 'Tidak ada catatan revisi.' }}</p>
                  <div class="revision-meta">
                    <span>Diminta {{ fmt(revisionItem.created_at) }}</span>
                    <span v-if="revisionItem.submitted_at">Dikirim ulang {{ fmt(revisionItem.submitted_at) }}</span>
                  </div>
                </div>
              </div>
              <button v-if="revisions.length > 1" class="revision-toggle" type="button" :aria-expanded="showAllRevisions" @click="showAllRevisions = !showAllRevisions">
                {{ showAllRevisions ? 'Tampilkan lebih sedikit' : `Lihat ${revisions.length - 1} revisi sebelumnya` }}
              </button>
            </div>
          </article>

          <!-- Hasil Reviewer -->
          <article v-if="showReviewResults" id="review-panel" class="card">
            <header class="card-header"><FileText :size="19" /><h2>Hasil Reviewer</h2></header>
            <div class="review-list">
              <div class="review-result-summary">
                <div class="summary-head">
                  <span class="summary-label">Ringkasan review</span>
                  <span class="summary-count">{{ latestReviewResults.length }} reviewer</span>
                </div>
                <strong class="summary-verdict" :class="`summary-verdict--${reviewVerdict}`">{{ reviewSummaryLabel }}</strong>
                <div class="summary-votes">
                  <div class="summary-vote summary-vote--agree"><b>{{ reviewVotes.approve }}</b><span>Setuju</span></div>
                  <div class="summary-vote summary-vote--reject"><b>{{ reviewVotes.reject }}</b><span>Tolak</span></div>
                </div>
                <small class="summary-note">Keputusan akhir tetap menjadi kewenangan Ketua KEPK.</small>
              </div>

              <div v-for="r in latestReviewResults" :key="r.id || r.reviewer_id || r.reviewer_name" class="review">
                <strong>{{ r.reviewer_name || 'Reviewer' }}</strong>
                <span class="review-decision" :class="reviewDecisionLabel(r.recommendation) === 'Setuju' ? 'decision-agree' : reviewDecisionLabel(r.recommendation) === 'Tolak' ? 'decision-reject' : 'decision-pending'">
                  {{ reviewDecisionLabel(r.recommendation) }}
                </span>
                <p>{{ reviewComments(r).join(' · ') || 'Reviewer tidak menambahkan komentar.' }}</p>
                <div class="review-actions">
                  <small>{{ r.reviewed_at ? 'Dikirim ' + fmtDateTime(r.reviewed_at) : 'Waktu pengiriman tidak tersedia' }}</small>
                  <button type="button" class="btn btn-outline review-detail-button" @click="selectedReview = r">Detail Penilaian</button>
                </div>
              </div>

              <div v-if="!latestReviewResults.length" class="empty-text">Hasil penilaian reviewer belum tersedia.</div>
            </div>
          </article>
        </aside>
      </div>

      <!-- Modal Detail Penilaian -->
      <div v-if="selectedReview" class="modal-backdrop" @click.self="selectedReview = null">
        <section class="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-detail-title">
          <header>
            <div>
              <span class="eyebrow">Penilaian Reviewer</span>
              <h3 id="review-detail-title">{{ selectedReview.reviewer_name || 'Reviewer' }}</h3>
              <p class="review-modal-subtitle">Riwayat penilaian reviewer untuk setiap siklus revisi.</p>
              <div v-if="selectedReviewRounds.length > 1" class="review-round-tabs" role="tablist">
                <button
                  v-for="(round, index) in selectedReviewRounds"
                  :key="round.id || index"
                  type="button"
                  role="tab"
                  :aria-selected="selectedReview?.id === round.id"
                  :class="{ 'is-active': selectedReview?.id === round.id }"
                  @click="selectedReview = round">
                  Penilaian {{ round.review_cycle || 1 }}
                </button>
              </div>
              <p class="review-modal-progress">{{ answeredReviewIndicators }} dari {{ indicatorLabels.length }} indikator terjawab</p>
            </div>
            <button type="button" class="modal-close" aria-label="Tutup detail penilaian" @click="selectedReview = null">×</button>
          </header>

          <div class="review-detail-body">
            <div class="review-detail-meta">
              <span>Rekomendasi · Penilaian {{ selectedReview.review_cycle || 1 }}</span>
              <strong>{{ reviewDecisionLabel(selectedReview.recommendation) }}</strong>
              <small v-if="selectedReview.reviewed_at">Dikirim {{ fmtDateTime(selectedReview.reviewed_at) }}</small>
            </div>

            <h4>Indikator Penilaian</h4>
            <div class="review-indicator-list">
              <article v-for="(label, index) in indicatorLabels" :key="index" class="review-indicator">
                <span class="review-indicator-number">{{ index + 1 }}</span>
                <div class="review-indicator-content">
                  <strong>{{ label }}</strong>
                  <span class="answer-pill" :class="reviewAnswer(index + 1) === true ? 'answer-yes' : reviewAnswer(index + 1) === false ? 'answer-no' : 'answer-empty'">
                    {{ reviewAnswer(index + 1) === true ? 'Ya' : reviewAnswer(index + 1) === false ? 'Tidak' : 'Belum dijawab' }}
                  </span>
                  <p v-if="reviewIndicatorComment(index + 1)">{{ reviewIndicatorComment(index + 1) }}</p>
                </div>
              </article>
            </div>

            <section class="review-suggestions">
              <h4>Saran Reviewer</h4>
              <div>
                <strong>Saran untuk menghindari informasi yang tidak tepat</strong>
                <p>{{ selectedReview.suggestion_information_accuracy || 'Tidak ada saran.' }}</p>
              </div>
              <div>
                <strong>Saran terkait aspek etik lainnya</strong>
                <p>{{ selectedReview.suggestion_other_ethics || 'Tidak ada saran.' }}</p>
              </div>
            </section>

            <section class="review-suggestions">
              <h4>Komentar Reviewer</h4>
              <p v-for="(comment, index) in reviewComments(selectedReview)" :key="index">{{ comment }}</p>
              <p v-if="!reviewComments(selectedReview).length">Tidak ada komentar umum dari reviewer.</p>
            </section>
          </div>

          <footer class="review-detail-footer">
            <button type="button" class="btn btn-primary" @click="selectedReview = null">Tutup</button>
          </footer>
        </section>
      </div>
    </template>

    <div v-else class="state">
      <XCircle :size="44" /><strong>Data pengajuan tidak ditemukan.</strong>
    </div>
  </main>
</template>

<style scoped>
/* ===== Halaman ===== */
.detail-page{width:100%;max-width:1226px;margin:0 auto;display:grid;gap:18px;color:var(--foreground)}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:14px}
.back-button,.download-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 12px;border:1px solid var(--border);border-radius:9px;background:var(--card);color:var(--primary);font:inherit;font-size:.84rem;font-weight:600;cursor:pointer}
.back-button:hover,.download-button:hover{border-color:var(--primary);background:var(--color-primary-soft)}
.reference{display:flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:var(--muted);font-size:.74rem}
.reference span{color:var(--muted-foreground)}
.reference code{color:var(--foreground);font-family:monospace;font-weight:700}
.back-button:focus-visible,.download-button:focus-visible,.btn:focus-visible,.tabs button:focus-visible,.form-group textarea:focus-visible{outline:2px solid var(--ring);outline-offset:2px}

/* ===== Hero (tidak diubah) ===== */
.hero{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:24px;border:1px solid var(--border);border-radius:16px;background:var(--gradient-primary-soft);box-shadow:var(--shadow-sm)}
.hero-content{min-width:0}
.eyebrow{display:inline-block;margin-bottom:7px;color:var(--primary);font-size:.73rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.hero h1{max-width:900px;margin:0;color:var(--foreground);font-size:clamp(1.15rem,2vw,1.55rem);line-height:1.4;overflow-wrap:anywhere}
.hero p{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 0;color:var(--muted-foreground);font-size:.82rem}
.hero p strong{color:var(--foreground)}
.researcher-summary{margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}
.researcher-summary-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}
.researcher-name{display:flex;align-items:center;flex-wrap:wrap;gap:9px}
.researcher-name strong{color:var(--foreground);font-size:.9rem}
.researcher-category{display:inline-flex;align-items:center;min-height:24px;padding:3px 9px;border-radius:999px;background:var(--color-primary-soft);color:var(--primary);font-size:.67rem;font-weight:700;white-space:nowrap}
.researcher-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px}
.researcher-detail{min-width:0;display:grid;gap:3px}
.researcher-detail span{color:var(--primary);font-size:.66rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.researcher-detail strong{min-width:0;color:var(--foreground);font-size:.76rem;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
.status-badge{display:inline-flex;align-items:center;justify-content:center;min-height:31px;padding:5px 10px;border-radius:8px;background:var(--color-neutral-soft);color:var(--muted-foreground);font-size:.75rem;font-weight:700;white-space:nowrap}

/* ===== Langkah berikutnya ===== */
.next-step{display:flex;align-items:center;gap:14px;padding:15px 18px;border:1px solid var(--border);border-radius:14px;background:var(--card)}
.next-step-icon{display:grid;place-items:center;flex:0 0 42px;height:42px;border-radius:11px;background:var(--color-info-soft);color:var(--color-info)}
.next-step-body{flex:1;min-width:0}
.next-step-body strong{display:block;font-size:.95rem}
.next-step-body p{margin:4px 0 0;color:var(--muted-foreground);font-size:.83rem;line-height:1.5;overflow-wrap:anywhere}
.next-step--warning{border-color:var(--color-warning-border);background:var(--color-warning-soft)}
.next-step--warning .next-step-icon{background:var(--card);color:var(--color-warning)}
.next-step--success{border-color:var(--color-success-border);background:var(--color-success-soft)}
.next-step--success .next-step-icon{background:var(--card);color:var(--color-success)}
.next-step--danger{border-color:var(--color-danger-border);background:var(--color-danger-soft)}
.next-step--danger .next-step-icon{background:var(--card);color:var(--color-danger)}

.alert{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;font-size:.82rem}
.alert--error{background:var(--color-danger-soft);border:1px solid var(--color-danger-border);color:var(--color-danger)}
.alert--success{background:var(--color-success-soft);border:1px solid var(--color-success-border);color:var(--color-success)}

/* ===== Layout ===== */
.layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(320px,.85fr);gap:20px;align-items:start}
.layout--single{grid-template-columns:minmax(0,1fr)}
.main-column,.side-column{display:grid;gap:16px;min-width:0}
.card{overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:var(--shadow-sm)}
.card-header{display:flex;align-items:center;gap:9px;padding:15px 20px;border-bottom:1px solid var(--border);background:var(--color-overlay-subtle)}
.card-header h2{margin:0;color:var(--foreground);font-size:.92rem;font-weight:700}
.card-header svg{color:var(--primary)}
.card-body{display:grid;gap:12px;padding:16px 20px 20px}
.empty-text{padding:22px;text-align:center;color:var(--muted-foreground);font-size:.82rem}

/* ===== Tab ===== */
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--border);overflow-x:auto}
.tabs button{display:inline-flex;align-items:center;gap:8px;padding:11px 14px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted-foreground);font:inherit;font-size:.84rem;white-space:nowrap;cursor:pointer}
.tabs button.active{color:var(--primary);border-bottom-color:var(--primary);font-weight:800}
.tab-count{padding:2px 8px;border-radius:999px;background:var(--muted);color:var(--foreground);font-size:.68rem;font-weight:700}

/* ===== Informasi ===== */
.info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.info-item{min-width:0;padding:15px 20px;border-bottom:1px solid var(--border)}
.info-item--full{grid-column:1/-1}
.info-item>span{display:block;margin-bottom:6px;color:var(--primary);font-size:.74rem;font-weight:700}
.info-item p{margin:0;color:var(--foreground);font-size:.9rem;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.rich-text-content{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.9rem;line-height:1.6}
.section-title{padding:11px 20px;border-bottom:1px solid var(--border);background:var(--color-overlay-subtle);color:var(--primary);font-size:.8rem;font-weight:700}

/* ===== Screening ===== */
.screening-recommendation{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:16px 20px 4px;padding:13px;border:1px solid var(--primary);border-radius:10px;background:var(--color-primary-soft)}
.screening-recommendation span{color:var(--foreground);font-size:.84rem;font-weight:650}
.screening-recommendation strong{color:var(--primary);font-size:.84rem}
.screening-list,.documents{display:grid;gap:9px;padding:14px 20px}
.screening-item{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:11px 13px;border:1px solid var(--border);border-radius:10px;background:var(--color-surface)}
.screening-question{display:flex;gap:8px;min-width:0}
.screening-number{flex:0 0 auto;color:var(--primary);font-weight:700}
.screening-question>span:last-child{color:var(--foreground);font-size:.84rem;line-height:1.55}
.screening-item strong{padding:3px 11px;border-radius:999px;background:var(--muted);color:var(--foreground);font-size:.74rem;white-space:nowrap}

/* ===== Dokumen ===== */
.document{display:flex;align-items:center;gap:12px;padding:11px 12px;border:1px solid var(--border);border-radius:10px;background:var(--color-surface)}
.document:hover{border-color:var(--primary)}
.document-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:9px;background:var(--color-primary-soft);color:var(--primary)}
.document-info{min-width:0;flex:1;display:grid;gap:3px}
.document-info strong{color:var(--foreground);font-size:.83rem;overflow-wrap:anywhere}
.document-info span{color:var(--muted-foreground);font-size:.72rem;overflow-wrap:anywhere}
.download-button{min-height:34px;font-size:.76rem;white-space:nowrap}

/* ===== Tombol ===== */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 14px;border:1px solid transparent;border-radius:9px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn-block{width:100%}
.btn-primary{background:var(--primary);color:var(--primary-foreground)}
.btn-success{background:var(--color-success);color:var(--primary-foreground)}
.btn-outline{background:var(--card);border-color:var(--border);color:var(--foreground)}
.btn-outline:hover:not(:disabled){border-color:var(--primary);color:var(--primary);background:var(--color-primary-soft)}
.btn-warning{background:var(--color-warning);color:var(--primary-foreground)}
.btn-danger{background:var(--color-danger);color:var(--primary-foreground)}

/* ===== Panel tindakan ===== */
.action-group,.form-group{display:grid;gap:9px}
.form-group label{color:var(--foreground);font-size:.8rem;font-weight:700}
.form-group textarea{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid var(--border);border-radius:9px;background:var(--card);color:var(--foreground);font:inherit;font-size:.82rem;resize:vertical}
.form-group textarea:focus{border-color:var(--primary)}
.divider{height:1px;background:var(--border)}

/* ===== Catatan revisi ===== */
.revision-body{padding:14px 20px 18px}
.revision-list{display:grid;gap:10px}
.revision-item{padding:13px;border:1px solid var(--border);border-radius:11px;background:var(--color-surface)}
.revision-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.revision-top>div{display:grid;gap:3px}
.revision-top strong{color:var(--foreground);font-size:.82rem}
.revision-top span{color:var(--muted-foreground);font-size:.7rem}
.revision-status{flex:0 0 auto;padding:4px 8px;border-radius:999px;background:var(--color-warning-soft);color:var(--color-warning);font-size:.66rem;font-weight:700}
.revision-status--done{background:var(--color-success-soft);color:var(--color-success)}
.revision-item p{margin:10px 0;color:var(--foreground);font-size:.82rem;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.revision-meta{display:flex;flex-wrap:wrap;gap:8px 14px;color:var(--muted-foreground);font-size:.68rem}

.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.header-chip{margin-left:auto;padding:2px 9px;border-radius:999px;background:var(--muted);color:var(--foreground);font-size:.7rem;font-weight:700}
.hint{margin:0;color:var(--muted-foreground);font-size:.78rem;line-height:1.5}
.group-label{margin:0;color:var(--muted-foreground);font-size:.74rem;font-weight:700}
.decision{border:1px solid var(--border);border-radius:10px;background:var(--card)}
.decision summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;color:var(--foreground);font-size:.84rem;font-weight:650;cursor:pointer;list-style:none}
.decision summary::-webkit-details-marker{display:none}
.decision summary::after{content:"+";color:var(--muted-foreground);font-size:1.15rem;line-height:1}
.decision[open] summary{border-bottom:1px solid var(--border)}
.decision[open] summary::after{content:"\2212"}
.decision summary:focus-visible{outline:2px solid var(--ring);outline-offset:2px;border-radius:9px}
.decision--danger summary{color:var(--color-danger)}
.decision-body{padding:13px}
.revision-latest{margin-left:6px;padding:1px 7px;border-radius:6px;background:var(--color-primary-soft);color:var(--primary);font-size:.64rem;font-style:normal;font-weight:700}
.revision-toggle{width:100%;margin-top:10px;padding:9px 10px;border:1px dashed var(--border);border-radius:8px;background:var(--card);color:var(--primary);font:inherit;font-size:.78rem;font-weight:600;cursor:pointer}
.revision-toggle:hover{border-color:var(--primary);background:var(--color-primary-soft)}
.revision-toggle:focus-visible{outline:2px solid var(--ring);outline-offset:2px}

.state{min-height:320px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--muted-foreground);font-size:.84rem}
.spin{color:var(--primary);animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none}}

/* ===== Responsif ===== */
@media(max-width:900px){
  .layout{grid-template-columns:1fr}
  .side-column--first{order:-1}
  .hero{padding:20px}
}
@media(max-width:640px){
  .detail-page{gap:14px}
  .topbar{flex-direction:column;align-items:stretch}
  .back-button,.download-button{width:100%}
  .reference{justify-content:center}
  .hero{flex-direction:column;padding:18px;gap:14px}
  .hero h1{font-size:1.15rem}
  .status-badge{width:max-content}
  .next-step{flex-direction:column;align-items:stretch}
  .next-step .btn{width:100%}
  .info-grid{grid-template-columns:1fr}
  .info-item,.info-item--full{grid-column:auto;padding:13px 16px}
  .card-header{padding:15px 16px}
  .card-body{padding:15px 16px}
  .screening-list,.documents{padding:12px 16px}
  .screening-recommendation{flex-direction:column;align-items:flex-start;margin:12px 16px 4px}
  .screening-item{flex-direction:column;gap:7px}
  .screening-item strong{align-self:flex-start}
  .document{align-items:flex-start;flex-wrap:wrap}
  .document-info{width:calc(100% - 50px)}
  .alert{align-items:flex-start}
  .researcher-details{grid-template-columns:1fr}
  .researcher-summary{margin-top:15px;padding-top:14px;max-width:max-content;width:100%;border-top:1px solid var(--border)}
}

/* ===== Khusus Sekretariat ===== */
.status-badge--submitted,.status-badge--sekretaris_review,.status-badge--admin_approved{background:var(--color-warning-soft);color:var(--color-warning)}
.status-badge--revision_required,.status-badge--rejected{background:var(--color-danger-soft);color:var(--color-danger)}
.status-badge--approved,.status-badge--permit_issued{background:var(--color-success-soft);color:var(--color-success)}
.status-badge--waiting_reviewer,.status-badge--under_review,.status-badge--review_completed{background:var(--color-info-soft);color:var(--color-info)}


/* Hasil reviewer */
.review-list{display:grid;gap:9px;padding:14px 20px}
.review-result-summary{display:grid;gap:10px;padding:14px;border:1px solid var(--border);border-radius:11px;background:var(--muted)}
.summary-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.summary-label{color:var(--muted-foreground);font-size:.74rem;font-weight:700}
.summary-count{padding:3px 9px;border-radius:999px;background:var(--card);border:1px solid var(--border);color:var(--muted-foreground);font-size:.68rem;font-weight:600}
.summary-verdict{color:var(--foreground);font-size:1rem;line-height:1.3}
.summary-verdict--agree{color:var(--color-success)}
.summary-verdict--reject{color:var(--color-danger)}
.summary-votes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.summary-vote{display:flex;align-items:baseline;gap:7px;padding:9px 12px;border-radius:9px}
.summary-vote b{font-size:1.15rem;line-height:1}
.summary-vote span{font-size:.74rem;font-weight:600}
.summary-vote--agree{background:var(--color-success-soft);color:var(--color-success)}
.summary-vote--reject{background:var(--color-danger-soft);color:var(--color-danger)}
.summary-note{color:var(--muted-foreground);font-size:.7rem;line-height:1.5}
.review{display:grid;gap:4px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--color-surface)}
.review strong{font-size:.8rem;color:var(--foreground)}
.review .review-decision{width:fit-content;padding:4px 8px;border-radius:999px;background:var(--muted);font-size:.69rem;font-weight:700}
.review .decision-agree{color:var(--color-success)}
.review .decision-reject{color:var(--color-danger)}
.review .decision-pending{color:var(--muted-foreground)}
.review p{margin:0;color:var(--muted-foreground);font-size:.76rem;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.review-actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:4px}
.review-actions small{color:var(--muted-foreground);font-size:.7rem}
.review-detail-button{min-height:34px;padding:0 11px;font-size:.74rem;margin-left:auto}

/* Modal detail penilaian */
.modal-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:20px;background:var(--color-overlay)}
.review-modal{width:min(860px,100%);max-height:min(90vh,900px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:var(--shadow-lg)}
.review-modal>header{flex:0 0 auto;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px;border-bottom:1px solid var(--border)}
.review-modal>header>div{min-width:0}
.review-modal h3{margin:0;color:var(--foreground);font-size:1.05rem}
.review-modal-subtitle{margin:6px 0 0;color:var(--muted-foreground);font-size:.78rem}
.review-modal-progress{margin:8px 0 0;color:var(--primary);font-size:.74rem;font-weight:700}
.modal-close{flex:0 0 auto;width:34px;height:34px;border:1px solid var(--border);border-radius:8px;background:var(--color-surface);color:var(--foreground);font-size:1.25rem;cursor:pointer}
.review-round-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.review-round-tabs button{padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--foreground);font:inherit;font-size:.78rem;font-weight:650;cursor:pointer}
.review-round-tabs button.is-active{border-color:var(--primary);background:var(--color-primary-soft);color:var(--primary)}
.review-detail-body{overflow-y:auto;padding:16px 20px;display:grid;gap:16px}
.review-detail-body h4{margin:0;color:var(--foreground);font-size:.88rem}
.review-detail-meta{display:grid;gap:5px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--muted)}
.review-detail-meta span,.review-detail-meta small{color:var(--muted-foreground);font-size:.75rem}
.review-detail-meta strong{font-size:.9rem}
.review-indicator-list{display:grid;gap:10px}
.review-indicator{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--color-surface)}
.review-indicator-number{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--muted);color:var(--foreground);font-size:.75rem;font-weight:700}
.review-indicator-content{display:grid;justify-items:start;gap:8px;min-width:0}
.review-indicator-content>strong,.review-suggestions strong{color:var(--foreground);font-size:.78rem;line-height:1.5}
.answer-pill{padding:4px 9px;border-radius:999px;font-size:.7rem;font-weight:700}
.answer-yes{background:var(--color-success-soft);color:var(--color-success)}
.answer-no{background:var(--color-danger-soft);color:var(--color-danger)}
.answer-empty{background:var(--muted);color:var(--muted-foreground)}
.review-indicator-content p,.review-suggestions p{margin:0;color:var(--muted-foreground);font-size:.76rem;line-height:1.55;white-space:pre-wrap}
.review-suggestions{display:grid;gap:12px;padding:14px;border:1px solid var(--border);border-radius:10px}
.review-suggestions>div{display:grid;gap:5px}
.review-detail-footer{flex:0 0 auto;display:flex;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--border)}
@media(max-width:640px){
  .review-list{padding:12px 16px}
  .modal-backdrop{padding:12px}
  .review-modal{max-height:94vh}
  .review-detail-body{padding:12px}
  .review-actions{align-items:flex-start;flex-direction:column}
  .review-detail-button{margin-left:0}
}
</style>