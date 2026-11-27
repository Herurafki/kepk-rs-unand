<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  History,
  Info,
  Lock,
  LoaderCircle,
  RefreshCw,
  Send,
  XCircle,
  CalendarClock,
  Clock,
} from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import {
  getReviewerApplication,
  getReviewerAssignmentRecords,
  getApplicationReviewSummary,
  getReviewerReviews,
  getReviewComments,
  submitReviewerAssessment,
  downloadReviewerDocument,
  type ReviewerApplication,
  type ReviewerDocument,
  type ReviewAssessment,
  type ReviewRecommendation,
} from '../../services/reviewer/review.service'
import { getApiErrorMessage } from '../../services/api/error'
import { displayDocumentInTab, openDocumentTab } from '../../utils/document-preview'
import { sanitizeResearcherRichText } from '../../utils/researcher-rich-text'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const app = ref<ReviewerApplication | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const recommendation = ref<ReviewRecommendation | ''>('')
const generalComment = ref('')
const submittedReview = ref<Record<string, unknown> | null>(null)
const reviewerReviews = ref<Record<string, unknown>[]>([])
const assignmentStatus = ref('')
const reviewerState = ref('')
const reviewerId = ref('')
const assignmentRef = ref<Record<string, any> | null>(null)
const activeTab = ref<'info' | 'assessment'>('info')
const showMissing = ref(false)

const isReadOnly = computed(() => Boolean(submittedReview.value))
const assignmentPending = computed(() => assignmentStatus.value === 'PENDING' && !submittedReview.value)
const assignmentRejected = computed(() => assignmentStatus.value === 'REJECTED' && !submittedReview.value)
const isExpedited = computed(() => app.value?.review_type === 'EXPEDITED')
const waitingForResearcher = computed(() => isExpedited.value && reviewerState.value === 'NEEDS_REVISION')
const canAssess = computed(() => !assignmentPending.value && !assignmentRejected.value)

const previousReviews = computed(() => {
  if (app.value?.review_type === 'EXPEDITED') {
    return reviewerReviews.value
      .filter(review => !submittedReview.value || String(review.id) !== String(submittedReview.value.id))
      .sort((a, b) => Number(b.review_cycle || 1) - Number(a.review_cycle || 1))
  }
  return reviewerReviews.value
    .filter(review => Number(review.review_cycle || 1) < Number(review.current_review_cycle || 1))
    .sort((a, b) => Number(b.review_cycle || 1) - Number(a.review_cycle || 1))
})

/* ===== Riwayat revisi dokumen ===== */
type RevisionItem = {
  id?: string | number
  document_id?: string | number
  document_type?: string | null
  document_name?: string | null
  note?: string | null
  revised_document_id?: string | number | null
}
type RevisionRequest = {
  id?: string | number
  reviewer_id?: string | number | null
  cycle_number?: number | string | null
  status?: string
  created_at?: string | null
  resubmitted_at?: string | null
  resolved_at?: string | null
  updated_at?: string | null
  items?: RevisionItem[]
}
const revisionRequests = ref<RevisionRequest[]>([])

const revisionHistory = computed(() =>
  [...revisionRequests.value]
    .sort((a, b) => Number(a.cycle_number || 1) - Number(b.cycle_number || 1))
    .map((request) => ({ ...request, items: request.items || [], isOpen: request.status === 'OPEN' })),
)
const hasRevisionHistory = computed(() => revisionHistory.value.length > 0)
const totalRequestedItems = computed(() => revisionHistory.value.reduce((n, r) => n + r.items.length, 0))
const resubmittedCount = computed(() =>
  revisionHistory.value.reduce((n, r) => n + r.items.filter((i) => i.revised_document_id).length, 0),
)
const showResubmitNotice = computed(
  () => reviewerState.value === 'IN_REVIEW' && resubmittedCount.value > 0 && !isReadOnly.value,
)

const revisionItemsForCycle = (cycle: unknown): RevisionItem[] =>
  revisionHistory.value.find((r) => Number(r.cycle_number || 1) === Number(cycle || 1))?.items || []

// Status tiap dokumen: diminta diperbaiki, sudah diganti, atau dokumen pengganti
const documentRevisionState = computed(() => {
  const map = new Map<string, 'REQUESTED' | 'REPLACED' | 'REPLACEMENT'>()
  for (const request of revisionHistory.value) {
    for (const item of request.items) {
      if (item.document_id != null) map.set(String(item.document_id), item.revised_document_id ? 'REPLACED' : 'REQUESTED')
      if (item.revised_document_id != null) map.set(String(item.revised_document_id), 'REPLACEMENT')
    }
  }
  return map
})
const documentFlagLabel = { REQUESTED: 'Diminta diperbaiki', REPLACED: 'Sudah diganti', REPLACEMENT: 'Dokumen pengganti' }

/* ===== Lama pengerjaan ===== */
// Ambang batas (hari). Sesuaikan dengan kebijakan KEPK.
const WARNING_AFTER_DAYS = 7
const DANGER_AFTER_DAYS = 14
const DAY_MS = 86_400_000

// Awal putaran kerja saat ini: penugasan diterima, atau dokumen pengganti terakhir diterima
const workStart = computed<Date | null>(() => {
  const times: number[] = []
  const base = assignmentRef.value?.accepted_at || assignmentRef.value?.assigned_at
  if (base) times.push(new Date(base).getTime())
  for (const request of revisionRequests.value) {
    if (request.status === 'OPEN') continue
    const t = request.resubmitted_at || request.resolved_at || request.updated_at
    if (t) times.push(new Date(t).getTime())
  }
  const valid = times.filter((n) => !Number.isNaN(n))
  return valid.length ? new Date(Math.max(...valid)) : null
})

const elapsedDays = computed(() =>
  workStart.value ? Math.max(0, Math.floor((Date.now() - workStart.value.getTime()) / DAY_MS)) : null,
)

const SLA_EXPECTED_DAYS = 7
const SLA_GREEN_MAX_DAY = 4

const durationAlert = computed<{
  tone: 'success' | 'warning' | 'danger'
  day: number
  expected: number
  percent: number
  round: string
  since: string
} | null>(() => {
  // Samakan indikator SLA dengan dashboard Ketua: hanya untuk review Expedited.
  if (!isExpedited.value || !workStart.value) return null
  // Hitung setelah reviewer menerima penugasan dan selama tugas masih aktif.
  if (isReadOnly.value || assignmentPending.value || assignmentRejected.value || waitingForResearcher.value) return null

  const elapsed = Math.max(0, Math.floor((Date.now() - workStart.value.getTime()) / DAY_MS))
  const day = elapsed + 1
  const tone: 'success' | 'warning' | 'danger' =
    day >= SLA_EXPECTED_DAYS ? 'danger' : day > SLA_GREEN_MAX_DAY ? 'warning' : 'success'

  return {
    tone,
    day,
    expected: SLA_EXPECTED_DAYS,
    percent: Math.min(100, Math.round((day / SLA_EXPECTED_DAYS) * 100)),
    round: revisionRequests.value.some((r) => r.status !== 'OPEN') ? 'Review ulang' : 'Penilaian',
    since: workStart.value.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
  }
})

async function goToRevisions() {
  activeTab.value = 'info'
  await scrollToId('revision-history')
}

const recommendationLabel = computed(() => ({
  APPROVE: 'Setuju',
  REVISION: 'Setuju dengan Perbaikan',
  REJECT: 'Tolak',
}[String(recommendation.value)] || '—'))

const recommendationChoices = computed(() => {
  const list: Array<{ value: ReviewRecommendation; label: string; desc: string; tone: string }> = [
    { value: 'APPROVE' as ReviewRecommendation, label: 'Setuju', desc: 'Protokol layak secara etik tanpa perbaikan.', tone: 'agree' },
  ]
  if (isExpedited.value) {
    list.push({
      value: 'REVISION' as ReviewRecommendation,
      label: 'Setuju dengan Perbaikan',
      desc: 'Dapat disetujui setelah peneliti memperbaiki dokumen tertentu.',
      tone: 'revise',
    })
  }
  list.push({ value: 'REJECT' as ReviewRecommendation, label: 'Tolak', desc: 'Protokol tidak layak secara etik.', tone: 'reject' })
  return list
})

const revisionDocuments = computed(() => app.value?.documents || [])
const selectedRevisionItems = ref<Record<string, boolean>>({})
const revisionItemNotes = ref<Record<string, string>>({})

function formatForumDate(value?: string | null) {
  if (!value) return 'Jadwal belum ditentukan'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(date)
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : {} } catch { return {} } }
  return {}
}

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
const TOTAL = indicatorLabels.length

const assessment = reactive<ReviewAssessment>({
  indicator_answers: {},
  indicator_comments: {},
  suggestion_information_accuracy: '',
  suggestion_other_ethics: '',
})

const researcher = computed(() => ({
  category: String(app.value?.researcher_category || '').toLowerCase(),
  nim: app.value?.researcher_nim || '—',
  nip: app.value?.researcher_nip || '—',
  nik: app.value?.researcher_nik || '—',
  faculty: app.value?.researcher_faculty || '—',
  program: app.value?.researcher_program_study || '—',
  department: app.value?.researcher_department || '—',
}))

const isAnswered = (n: number) => typeof assessment.indicator_answers[String(n)] === 'boolean'
const answeredCount = computed(() => indicatorLabels.filter((_, index) => isAnswered(index + 1)).length)
const remainingCount = computed(() => TOTAL - answeredCount.value)
const progress = computed(() => Math.round((answeredCount.value / TOTAL) * 100))
const firstUnanswered = computed(() => {
  const index = indicatorLabels.findIndex((_, i) => !isAnswered(i + 1))
  return index === -1 ? null : index + 1
})

const statusLabel = computed(() => ({
  UNDER_REVIEW: 'Sedang Direview',
  WAITING_REVIEWER: 'Menunggu Reviewer',
  REVIEW_COMPLETED: 'Review Selesai',
  REVISION_REQUIRED: 'Menunggu dokumen perbaikan peneliti',
}[app.value?.status || ''] || app.value?.status || '—'))

const researcherCategoryLabels: Record<string, string> = { mahasiswa: 'Mahasiswa', dosen: 'Dosen', staff: 'Staf', umum: 'Umum' }
const researcherCategoryLabel = computed(() => researcherCategoryLabels[researcher.value.category] || app.value?.researcher_category || '—')

/* ===== Alur kerja reviewer ===== */
const workflowSteps = computed(() => [
  { label: 'Terima penugasan', hint: 'Dikonfirmasi di Daftar Tugas' },
  { label: 'Pelajari berkas', hint: 'Informasi & dokumen peneliti' },
  { label: 'Isi indikator', hint: `${answeredCount.value} dari ${TOTAL} terjawab` },
  { label: 'Kirim rekomendasi', hint: 'Setuju, perbaikan, atau tolak' },
])
const workflowCurrent = computed(() => {
  if (submittedReview.value) return 4
  if (assignmentRejected.value) return -1
  if (assignmentPending.value) return 0
  if (waitingForResearcher.value) return 1
  if (activeTab.value === 'info') return 1
  return answeredCount.value < TOTAL ? 2 : 3
})

type BannerTone = 'info' | 'warning' | 'success' | 'danger'
const banner = computed<{ tone: BannerTone; title: string; text: string; action?: 'tasks' | 'revisions' } | null>(() => {
  if (assignmentRejected.value) {
    return { tone: 'danger', title: 'Penugasan ini telah Anda tolak', text: 'Formulir indikator penilaian tidak tersedia untuk penugasan ini.' }
  }
  if (assignmentPending.value) {
    return {
      tone: 'warning',
      title: 'Terima penugasan untuk mulai menilai',
      text: 'Penugasan masih menunggu respons Anda. Terima atau tolak penugasan di Daftar Tugas Review. Indikator penilaian terbuka setelah penugasan diterima.',
      action: 'tasks',
    }
  }
  if (waitingForResearcher.value) {
    return {
      tone: 'info',
      title: 'Menunggu dokumen perbaikan dari peneliti',
      text: 'Permintaan perbaikan sudah dikirim kepada peneliti. Penilaian baru dapat dilakukan setelah dokumen pengganti dikirim dan tugas diaktifkan kembali.',
    }
  }
  if (showResubmitNotice.value) {
    return {
      tone: 'info',
      title: 'Peneliti telah mengirim dokumen perbaikan',
      text: `${resubmittedCount.value} dokumen pengganti menunggu penilaian ulang Anda. Periksa riwayat revisi sebelum menilai kembali.`,
      action: 'revisions',
    }
  }
  if (submittedReview.value) {
    return { tone: 'success', title: 'Penilaian sudah dikirim', text: 'Hasil penilaian Anda tersimpan dan hanya dapat dilihat, tidak dapat diubah.' }
  }
  return null
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    app.value = await getReviewerApplication(id.value)
    const [assignments, reviews, reviewSummary] = await Promise.all([
      getReviewerAssignmentRecords(),
      getReviewerReviews(),
      getApplicationReviewSummary(id.value).catch(() => null),
    ])
    const assignment = assignments.find(item => String(item.application_id) === id.value && String(item.status || '').toUpperCase() !== 'REJECTED')
    const rejectedAssignment = assignments.find(item => String(item.application_id) === id.value && String(item.status || '').toUpperCase() === 'REJECTED')
    assignmentStatus.value = String(assignment?.status || (rejectedAssignment ? 'REJECTED' : '')).toUpperCase()
    assignmentRef.value = (assignment as unknown as Record<string, any> | undefined) ?? null
    reviewerId.value = String(assignment?.reviewer_id || '')
    reviewerState.value = String(reviewSummary?.expedited_reviewer_states?.find(
      state => String(state.reviewer_id) === reviewerId.value,
    )?.state || '').toUpperCase()
    const summaryRequests =
      (reviewSummary as unknown as { expedited_revision_requests?: RevisionRequest[] } | null)?.expedited_revision_requests ??
      (app.value as unknown as { expedited_revision_requests?: RevisionRequest[] }).expedited_revision_requests ??
      []
    revisionRequests.value = summaryRequests.filter((r) => !reviewerId.value || String(r.reviewer_id) === reviewerId.value)
    if (assignmentRejected.value || waitingForResearcher.value) activeTab.value = 'info'
    reviewerReviews.value = reviews.filter(item => String(item.application_id || '') === id.value)
    const ownReview = reviewerState.value === 'IN_REVIEW' && app.value.review_type === 'EXPEDITED'
      ? null
      : reviewerReviews.value.find(item => Number(item.review_cycle || 1) >= Number(item.current_review_cycle || 1)) || null
    submittedReview.value = ownReview
    if (ownReview) {
      recommendation.value = String(ownReview.recommendation || '') as ReviewRecommendation
      assessment.indicator_answers = Object.fromEntries(Object.entries(parseObject(ownReview.indicator_answers)).map(([key, value]) => [key, Boolean(value)]))
      assessment.indicator_comments = Object.fromEntries(Object.entries(parseObject(ownReview.indicator_comments)).map(([key, value]) => [key, String(value ?? '')]))
      assessment.suggestion_information_accuracy = String(ownReview.suggestion_information_accuracy || '')
      assessment.suggestion_other_ethics = String(ownReview.suggestion_other_ethics || '')
      try {
        const comments = await getReviewComments(String(ownReview.id))
        generalComment.value = comments.map(comment => String(comment.comment || '')).filter(Boolean).join('\n\n')
      } catch {
        generalComment.value = ''
      }
    } else {
      recommendation.value = ''
      generalComment.value = ''
      assessment.indicator_answers = {}
      assessment.indicator_comments = {}
      assessment.suggestion_information_accuracy = ''
      assessment.suggestion_other_ethics = ''
    }
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Gagal memuat detail pengajuan.')
  } finally {
    loading.value = false
  }
}

function formatFileSize(size?: number | null) {
  if (size == null || Number.isNaN(Number(size))) return 'Ukuran tidak diketahui'
  const bytes = Number(size)
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function downloadDocument(doc: ReviewerDocument) {
  error.value = ''
  const tab = openDocumentTab()
  if (!tab) { error.value = 'Browser memblokir tab dokumen. Izinkan pop-up, lalu coba lagi.'; return }
  try {
    const blob = await downloadReviewerDocument(doc.id)
    displayDocumentInTab(tab, blob, doc.original_name || ('dokumen-' + doc.id))
  } catch (e) {
    tab.close()
    error.value = getApiErrorMessage(e, 'Dokumen tidak dapat dibuka.')
  }
}

/* ===== Navigasi ===== */
const goToTasks = () => router.push({ name: 'reviewer-tasks', query: { tab: 'PENDING' } })

function openTab(tab: 'info' | 'assessment') {
  if (tab === 'assessment' && !canAssess.value) return
  activeTab.value = tab
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function scrollToIndicator(n: number | null) {
  if (!n) return
  await nextTick()
  const el = window.document.getElementById('indicator-' + n)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function scrollToId(elementId: string) {
  await nextTick()
  window.document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/* ===== Kirim ===== */
function validate() {
  if (answeredCount.value !== TOTAL) {
    showMissing.value = true
    error.value = `Masih ada ${remainingCount.value} indikator yang belum dijawab. Indikator yang kosong ditandai merah.`
    scrollToIndicator(firstUnanswered.value)
    return false
  }
  if (!recommendation.value) {
    error.value = 'Pilih rekomendasi reviewer sebelum mengirim penilaian.'
    scrollToId('recommendation-card')
    return false
  }
  if (isExpedited.value && recommendation.value === 'REVISION') {
    const selected = revisionDocuments.value.filter(item => selectedRevisionItems.value[String(item.id)])
    if (!selected.length) {
      error.value = 'Pilih minimal satu dokumen yang perlu diperbaiki.'
      scrollToId('recommendation-card')
      return false
    }
    if (selected.some(item => !String(revisionItemNotes.value[String(item.id)] || '').trim())) {
      error.value = 'Catatan perbaikan wajib diisi untuk setiap dokumen yang dipilih.'
      scrollToId('recommendation-card')
      return false
    }
  }
  return true
}

async function submit() {
  error.value = ''
  success.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    await submitReviewerAssessment(id.value, {
      recommendation: recommendation.value as ReviewRecommendation,
      comment: generalComment.value.trim(),
      assessment: {
        indicator_answers: { ...assessment.indicator_answers },
        indicator_comments: { ...assessment.indicator_comments },
        suggestion_information_accuracy: assessment.suggestion_information_accuracy.trim(),
        suggestion_other_ethics: assessment.suggestion_other_ethics.trim(),
      },
      ...(isExpedited.value && recommendation.value === 'REVISION' ? {
        document_revisions: revisionDocuments.value
          .filter(item => selectedRevisionItems.value[String(item.id)])
          .map(item => ({
            document_id: item.id,
            note: String(revisionItemNotes.value[String(item.id)] || '').trim(),
          })),
      } : {}),
    })
    success.value = 'Penilaian berhasil dikirim.'
    showMissing.value = false
    await load()
    activeTab.value = 'assessment'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Penilaian gagal dikirim. Periksa kembali data dan akses reviewer.')
  } finally {
    submitting.value = false
  }
}

function historicalRecommendationLabel(value: unknown): string {
  return ({ APPROVE: 'Setuju', REJECT: 'Tolak', REVISION: 'Setuju dengan Perbaikan' } as Record<string, string>)[String(value || '')] || String(value || '—')
}

function historicalAnswer(review: Record<string, unknown>, index: number): string {
  const value = parseObject(review.indicator_answers)[String(index)]
  if (value === true || value === 'true') return 'Ya'
  if (value === false || value === 'false') return 'Tidak'
  return 'Belum dijawab'
}

function historicalComment(review: Record<string, unknown>, index: number): string {
  return String(parseObject(review.indicator_comments)[String(index)] || '').trim()
}

onMounted(load)
</script>

<template>
  <main class="review-page">
    <header class="page-header">
      <button class="back-button" type="button" @click="router.back()">
        <ArrowLeft :size="17" /> Kembali
      </button>
      <button class="refresh-button" type="button" :disabled="loading" @click="load">
        <RefreshCw :size="16" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="loading" class="state">
      <LoaderCircle :size="30" class="spin" /> Memuat detail pengajuan...
    </div>

    <template v-else-if="app">
      <!-- Ringkasan pengajuan -->
      <section class="hero">
        <span class="eyebrow">FORMULIR PENILAIAN REVIEWER</span>
        <div class="hero-title-row">
          <div>
            <h1>{{ app.research_title || 'Judul penelitian belum tersedia' }}</h1>
            <p>{{ app.application_number || ('ID Pengajuan ' + app.id) }}</p>
          </div>
          <span class="status-pill">{{ statusLabel }}</span>
        </div>

        <div v-if="app.review_type === 'FULLBOARD'" class="forum-schedule">
          <div class="forum-icon"><CalendarClock :size="18" /></div>
          <div><span>Jadwal Forum Fullboard</span><strong>{{ formatForumDate(app.forum_date) }}</strong></div>
        </div>

        <div class="researcher-grid">
          <div><span>Nama Lengkap</span><strong>{{ app.researcher_name || '—' }}</strong></div>
          <div><span>Kategori Peneliti</span><strong>{{ researcherCategoryLabel }}</strong></div>
          <div><span>Email</span><strong>{{ app.researcher_email || '—' }}</strong></div>
          <div><span>Nomor Telepon</span><strong>{{ app.researcher_phone || '—' }}</strong></div>
          <div v-if="researcher.category === 'mahasiswa'"><span>NIM</span><strong>{{ researcher.nim }}</strong></div>
          <div v-if="researcher.category === 'dosen' || researcher.category === 'staff'"><span>NIP</span><strong>{{ researcher.nip }}</strong></div>
          <div v-if="researcher.category === 'umum'"><span>NIK</span><strong>{{ researcher.nik }}</strong></div>
          <div><span>Institusi Peneliti</span><strong>{{ app.researcher_institution || app.research_institution || '—' }}</strong></div>
          <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'"><span>Fakultas</span><strong>{{ researcher.faculty }}</strong></div>
          <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'"><span>Program Studi</span><strong>{{ researcher.program }}</strong></div>
          <div v-if="researcher.category === 'staff'"><span>Jurusan/Departemen</span><strong>{{ researcher.department }}</strong></div>
          <div><span>Tanggal Pengajuan</span><strong>{{ app.created_at ? new Date(app.created_at).toLocaleDateString('id-ID') : '—' }}</strong></div>
          <div class="researcher-address"><span>Alamat</span><strong>{{ app.researcher_address || '—' }}</strong></div>
        </div>
      </section>

      <!-- Alur kerja -->
      <ol class="workflow" aria-label="Alur penilaian">
        <li
          v-for="(step, index) in workflowSteps"
          :key="step.label"
          class="workflow-step"
          :class="{
            'workflow-step--done': index < workflowCurrent,
            'workflow-step--current': index === workflowCurrent,
            'workflow-step--locked': workflowCurrent === -1,
          }">
          <span class="workflow-marker">
            <Check v-if="index < workflowCurrent" :size="14" />
            <Lock v-else-if="workflowCurrent === -1" :size="13" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <div>
            <strong>{{ step.label }}</strong>
            <small>{{ step.hint }}</small>
          </div>
        </li>
      </ol>

      <!-- SLA review Expedited: mengikuti indikator pada dashboard Ketua -->
      <section v-if="durationAlert" class="sla" :class="`sla--${durationAlert.tone}`" role="status">
        <div class="sla-head">
          <span><Clock :size="15" /> {{ durationAlert.round }} · Lama pengerjaan</span>
          <strong>Hari ke-{{ durationAlert.day }} dari {{ durationAlert.expected }} hari</strong>
        </div>
        <div
          class="sla-bar"
          role="img"
          :aria-label="`Lama pengerjaan hari ke-${durationAlert.day} dari ${durationAlert.expected} hari`"
        >
          <span class="sla-bar__fill" :style="{ width: durationAlert.percent + '%' }" />
        </div>
        <small v-if="durationAlert.tone === 'success'">
          Dimulai {{ durationAlert.since }}. Selesaikan penilaian sebelum melewati batas waktu 7 hari.
        </small>
        <small v-else-if="durationAlert.tone === 'warning'">
          Dimulai {{ durationAlert.since }}. Waktu penilaian mulai mendekati batas 7 hari. Segera kirim hasil review.
        </small>
        <small v-else>
          Sudah melewati batas waktu 7 hari sejak {{ durationAlert.since }}. Mohon segera kirim hasil review agar proses KEPK tidak tertunda.
        </small>
      </section>

      <!-- Banner status -->
      <section v-if="banner" class="banner" :class="`banner--${banner.tone}`">
        <div class="banner-icon">
          <CheckCircle2 v-if="banner.tone === 'success'" :size="20" />
          <XCircle v-else-if="banner.tone === 'danger'" :size="20" />
          <AlertCircle v-else-if="banner.tone === 'warning'" :size="20" />
          <Info v-else :size="20" />
        </div>
        <div class="banner-body">
          <strong>{{ banner.title }}</strong>
          <p>{{ banner.text }}</p>
        </div>
        <button v-if="banner.action === 'tasks'" class="banner-action" type="button" @click="goToTasks">
          Buka Daftar Tugas <ArrowRight :size="15" />
        </button>
        <button v-else-if="banner.action === 'revisions'" class="banner-action banner-action--info" type="button" @click="goToRevisions">
          Lihat riwayat revisi <ArrowRight :size="15" />
        </button>
      </section>

      <div v-if="error" class="alert alert-error">
        <XCircle :size="18" /><span>{{ error }}</span>
      </div>
      <div v-if="success" class="alert alert-success">
        <CheckCircle2 :size="18" /><span>{{ success }}</span>
      </div>

      <nav class="detail-tabs" aria-label="Bagian detail reviewer">
        <button type="button" :class="{ active: activeTab === 'info' }" @click="openTab('info')">
          1. Informasi &amp; Dokumen
          <span v-if="hasRevisionHistory" class="tab-count tab-count--alert">{{ revisionHistory.length }}x revisi</span>
        </button>
        <button
          type="button"
          :class="{ active: activeTab === 'assessment', 'is-locked': !canAssess }"
          :disabled="!canAssess"
          :title="canAssess ? '' : 'Terima penugasan terlebih dahulu'"
          @click="openTab('assessment')">
          <Lock v-if="!canAssess" :size="13" />
          2. Indikator &amp; Rekomendasi
          <span v-if="canAssess && !isReadOnly" class="tab-count">{{ answeredCount }}/{{ TOTAL }}</span>
        </button>
      </nav>

      <!-- TAB 1: Informasi -->
      <template v-if="activeTab === 'info'">
        <section class="card">
          <header class="section-header">
            <div class="section-icon"><FileText :size="19" /></div>
            <div>
              <h2>Informasi Penelitian</h2>
              <p>Pahami protokol penelitian sebelum menilai.</p>
            </div>
          </header>
          <div class="info-grid">
            <div class="info-item full"><span>Latar Belakang</span>
              <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_background || '')" />
            </div>
            <div class="info-item full"><span>Subjek/Objek Penelitian</span>
              <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_objectives || '')" />
            </div>
            <div class="info-item full"><span>Metode Penelitian</span>
              <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_methodology || '')" />
            </div>
            <div class="info-item full"><span>Tujuan Penelitian</span>
              <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.purpose || '')" />
            </div>
            <div class="info-item full"><span>Kebutuhan Data</span>
              <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.data_needed || '')" />
            </div>
            <div class="info-item"><span>Lokasi Penelitian</span><p>{{ app.research_location || '—' }}</p></div>
            <div class="info-item"><span>Durasi Penelitian</span><p>{{ app.research_duration || '—' }}</p></div>
            <div class="info-item"><span>Penanggung Jawab</span><p>{{ app.person_responsible || '—' }}</p></div>
            <div class="info-item"><span>Kategori/Kelompok</span><p>{{ app.group_category || '—' }}</p></div>
          </div>
        </section>

        <section class="card">
          <header class="section-header">
            <div class="section-icon"><Download :size="19" /></div>
            <div>
              <h2>Dokumen Peneliti</h2>
              <p>Unduh dan periksa dokumen yang dilampirkan peneliti.</p>
            </div>
          </header>
          <div v-if="!app.documents?.length" class="documents-empty">Belum ada dokumen yang tercatat pada pengajuan ini.</div>
          <div v-else class="document-list">
            <article v-for="doc in app.documents" :key="doc.id" class="document-item">
              <div class="document-icon"><FileText :size="20" /></div>
              <div class="document-info">
                <strong>{{ String(doc.document_type || 'GENERAL').replaceAll('_', ' ') }}</strong>
                <span v-if="documentRevisionState.get(String(doc.id))" class="doc-flag" :class="`doc-flag--${documentRevisionState.get(String(doc.id))!.toLowerCase()}`">
                  {{ documentFlagLabel[documentRevisionState.get(String(doc.id))!] }}
                </span>
                <span>{{ doc.original_name || ('Dokumen #' + doc.id) }} · {{ formatFileSize(doc.file_size) }}</span>
                <small>{{ doc.created_at ? new Date(doc.created_at).toLocaleDateString('id-ID') : 'Tanggal unggah tidak tersedia' }}</small>
              </div>
              <button class="document-download" type="button" @click="downloadDocument(doc)">
                <FileText :size="15" /> Buka
              </button>
            </article>
          </div>
        </section>

        <!-- Riwayat revisi dokumen -->
        <section v-if="hasRevisionHistory" id="revision-history" class="card revision-history">
          <header class="section-header">
            <div class="section-icon section-icon--warn"><History :size="19" /></div>
            <div>
              <h2>Riwayat Revisi Dokumen</h2>
              <p>Dokumen yang pernah Anda minta untuk diperbaiki, beserta catatan dan statusnya.</p>
            </div>
            <span class="rev-summary">{{ resubmittedCount }} dari {{ totalRequestedItems }} sudah diganti</span>
          </header>
          <ol class="rev-timeline">
            <li v-for="(round, index) in revisionHistory" :key="String(round.id ?? index)" class="rev-round" :class="{ 'rev-round--open': round.isOpen }">
              <span class="rev-dot">{{ round.cycle_number || index + 1 }}</span>
              <div class="rev-body">
                <div class="rev-head">
                  <strong>Permintaan perbaikan, siklus {{ round.cycle_number || index + 1 }}</strong>
                  <span class="rev-state" :class="round.isOpen ? 'rev-state--wait' : 'rev-state--done'">
                    {{ round.isOpen ? 'Menunggu peneliti' : 'Dokumen diterima' }}
                  </span>
                </div>
                <small v-if="round.created_at">{{ new Date(round.created_at).toLocaleString('id-ID') }}</small>
                <ul class="rev-files">
                  <li v-for="item in round.items" :key="String(item.id)">
                    <FileText :size="17" />
                    <div>
                      <strong>{{ item.document_type || item.document_name || 'Dokumen' }}</strong>
                      <span v-if="item.document_name && item.document_type">{{ item.document_name }}</span>
                      <p>{{ item.note }}</p>
                    </div>
                    <span class="file-chip" :class="item.revised_document_id ? 'file-chip--done' : 'file-chip--wait'">
                      {{ item.revised_document_id ? 'Sudah diganti' : 'Belum diganti' }}
                    </span>
                  </li>
                </ul>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="canAssess && !waitingForResearcher" class="next-card">
          <div>
            <strong>{{ isReadOnly ? 'Penilaian Anda sudah terkirim' : 'Sudah selesai mempelajari berkas?' }}</strong>
            <p>{{ isReadOnly ? 'Buka hasil penilaian untuk melihat kembali jawaban Anda.' : 'Lanjutkan dengan mengisi 26 indikator penilaian dan memilih rekomendasi.' }}</p>
          </div>
          <button class="submit-button" type="button" @click="openTab('assessment')">
            {{ isReadOnly ? 'Lihat Hasil Penilaian' : 'Mulai Penilaian' }} <ArrowRight :size="16" />
          </button>
        </section>
      </template>

      <!-- TAB 2: Penilaian -->
      <form v-if="activeTab === 'assessment' && canAssess" class="assessment-form" @submit.prevent="submit">
        <section class="card">
          <div class="assessment-heading">
            <div>
              <span class="eyebrow">LANGKAH 3 · CHECKLIST ETIK</span>
              <h2>Indikator Penilaian</h2>
              <p v-if="!isReadOnly">Jawab Ya atau Tidak untuk setiap indikator. Catatan bersifat opsional.</p>
            </div>
            <div class="progress-box">
              <strong>{{ answeredCount }}/{{ TOTAL }}</strong><span>terjawab</span>
              <div class="progress-track"><span :style="{ width: progress + '%' }"></span></div>
            </div>
          </div>

          <div class="overview" role="group" aria-label="Ringkasan indikator">
            <button
              v-for="n in TOTAL"
              :key="n"
              type="button"
              class="overview-chip"
              :class="{
                'overview-chip--done': isAnswered(n),
                'overview-chip--missing': showMissing && !isAnswered(n) && !isReadOnly,
              }"
              :title="'Indikator ' + n"
              @click="scrollToIndicator(n)">
              {{ n }}
            </button>
          </div>

          <div class="indicator-list">
            <article
              v-for="(label, index) in indicatorLabels"
              :id="'indicator-' + (index + 1)"
              :key="index"
              class="indicator"
              :class="{ 'indicator--missing': showMissing && !isAnswered(index + 1) && !isReadOnly }">
              <div class="indicator-main">
                <span class="indicator-number">{{ index + 1 }}</span>
                <div class="indicator-content">
                  <p class="indicator-label">{{ label }}</p>
                  <div class="answer-options">
                    <label class="answer-option" :class="{ selected: assessment.indicator_answers[String(index + 1)] === true }">
                      <input v-model="assessment.indicator_answers[String(index + 1)]" type="radio"
                        :name="'indicator-' + (index + 1)" :value="true" :disabled="isReadOnly" />
                      Ya
                    </label>
                    <label class="answer-option" :class="{ selected: assessment.indicator_answers[String(index + 1)] === false }">
                      <input v-model="assessment.indicator_answers[String(index + 1)]" type="radio"
                        :name="'indicator-' + (index + 1)" :value="false" :disabled="isReadOnly" />
                      Tidak
                    </label>
                    <span v-if="showMissing && !isAnswered(index + 1) && !isReadOnly" class="missing-note">Belum dijawab</span>
                  </div>
                  <label class="field-label" :for="'comment-' + (index + 1)">Catatan reviewer (opsional)</label>
                  <textarea :id="'comment-' + (index + 1)" v-model="assessment.indicator_comments[String(index + 1)]"
                    rows="2" :placeholder="'Tambahkan catatan untuk indikator ' + (index + 1) + ' bila diperlukan'"
                    :readonly="isReadOnly"></textarea>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="card">
          <div class="section-header">
            <div class="section-icon"><FileText :size="19" /></div>
            <div>
              <h2>Saran Umum Reviewer</h2>
              <p>Opsional. Masukan tambahan untuk peneliti.</p>
            </div>
          </div>
          <div class="field-group">
            <label for="suggestion-accuracy">Saran untuk menghindari informasi yang tidak tepat</label>
            <textarea id="suggestion-accuracy" v-model="assessment.suggestion_information_accuracy" rows="4"
              :readonly="isReadOnly"
              placeholder="Contoh: pastikan informasi pada lembar penjelasan konsisten dengan protokol penelitian..." />
          </div>
          <div class="field-group">
            <label for="suggestion-ethics">Saran terkait aspek etik lainnya</label>
            <textarea id="suggestion-ethics" v-model="assessment.suggestion_other_ethics" rows="4"
              :readonly="isReadOnly" placeholder="Contoh: dampak etik yang mungkin muncul dan langkah mitigasinya..." />
          </div>
        </section>

        <section id="recommendation-card" class="card recommendation-card">
          <div class="section-header">
            <div class="section-icon"><CheckCircle2 :size="19" /></div>
            <div>
              <h2>Rekomendasi Reviewer</h2>
              <p>{{ isReadOnly ? 'Rekomendasi yang telah Anda kirim.' : 'Langkah terakhir: pilih satu rekomendasi.' }}</p>
            </div>
          </div>

          <div class="recommendation-options">
            <label
              v-for="choice in recommendationChoices"
              :key="choice.value"
              class="recommendation-option"
              :class="[`recommendation-option--${choice.tone}`, { selected: recommendation === choice.value }]">
              <input v-model="recommendation" type="radio" :value="choice.value" :disabled="isReadOnly" />
              <span><strong>{{ choice.label }}</strong><small>{{ choice.desc }}</small></span>
            </label>
          </div>

          <section v-if="isExpedited && recommendation === 'REVISION' && !isReadOnly" class="revision-request-panel">
            <div class="section-header">
              <div class="section-icon"><FileText :size="19" /></div>
              <div><h2>Dokumen yang Perlu Diperbaiki</h2><p>Pilih dokumen dan berikan catatan spesifik untuk setiap dokumen.</p></div>
            </div>
            <div v-if="!revisionDocuments.length" class="documents-empty">
              Dokumen revisi sebelumnya tidak tersedia. Muat ulang halaman atau periksa data pengajuan.
            </div>
            <article v-for="doc in revisionDocuments" :key="doc.id" class="revision-document-option">
              <label class="revision-document-check">
                <input v-model="selectedRevisionItems[String(doc.id)]" type="checkbox" />
                <span><strong>{{ doc.document_type || 'Dokumen' }}</strong><small>{{ doc.original_name || ('Dokumen #' + doc.id) }}</small></span>
              </label>
              <textarea v-if="selectedRevisionItems[String(doc.id)]"
                v-model="revisionItemNotes[String(doc.id)]" rows="3"
                placeholder="Jelaskan bagian yang harus diperbaiki..." />
            </article>
          </section>

          <div class="field-group">
            <label for="general-comment">Catatan umum untuk rekomendasi (opsional)</label>
            <textarea id="general-comment" v-model="generalComment" rows="4" :readonly="isReadOnly"
              placeholder="Tuliskan ringkasan alasan rekomendasi..." />
          </div>

          <div v-if="isReadOnly" class="submitted-summary">
            <div><span>Rekomendasi tersimpan</span><strong>{{ recommendationLabel }}</strong></div>
            <div><span>Waktu penilaian</span><strong>{{ submittedReview?.reviewed_at ? new Date(String(submittedReview.reviewed_at)).toLocaleString('id-ID') : '—' }}</strong></div>
            <div v-if="generalComment"><span>Catatan umum reviewer</span><p>{{ generalComment }}</p></div>
          </div>
        </section>

        <!-- Bar kirim yang selalu terlihat -->
        <div v-if="!isReadOnly" class="submit-bar">
          <div class="submit-bar-info">
            <strong>{{ answeredCount === TOTAL ? 'Seluruh indikator terjawab' : `${remainingCount} indikator belum dijawab` }}</strong>
            <span class="progress-track"><span :style="{ width: progress + '%' }"></span></span>
          </div>
          <button v-if="firstUnanswered" class="ghost-button" type="button" @click="showMissing = true; scrollToIndicator(firstUnanswered)">
            Ke indikator berikutnya
          </button>
          <button class="submit-button" type="submit" :disabled="submitting">
            <LoaderCircle v-if="submitting" :size="17" class="spin" />
            <Send v-else :size="17" /> {{ submitting ? 'Mengirim...' : 'Kirim Penilaian' }}
          </button>
        </div>
      </form>

      <section v-if="activeTab === 'assessment' && !assignmentRejected && previousReviews.length" class="card previous-review-history">
        <header class="section-header">
          <div class="section-icon"><RefreshCw :size="19" /></div>
          <div>
            <h2>Riwayat Penilaian Sebelumnya</h2>
            <p>Penilaian pada siklus sebelumnya tetap tersimpan sebagai riwayat dan tidak dapat diubah.</p>
          </div>
        </header>
        <details v-for="review in previousReviews" :key="String(review.id)" class="previous-review-round">
          <summary>
            <strong>Penilaian {{ review.review_cycle || 1 }}</strong>
            <span>{{ historicalRecommendationLabel(review.recommendation) }}</span>
            <span v-if="revisionItemsForCycle(review.review_cycle).length" class="file-chip file-chip--wait">
              {{ revisionItemsForCycle(review.review_cycle).length }} dokumen diminta diperbaiki
            </span>
            <small>{{ review.reviewed_at ? new Date(String(review.reviewed_at)).toLocaleString('id-ID') : 'Tanggal tidak tersedia' }}</small>
          </summary>
          <div class="previous-review-answers">
            <div v-if="revisionItemsForCycle(review.review_cycle).length" class="previous-review-files">
              <strong>Dokumen yang Anda minta diperbaiki</strong>
              <ul>
                <li v-for="item in revisionItemsForCycle(review.review_cycle)" :key="String(item.id)">
                  <b>{{ item.document_type || item.document_name || 'Dokumen' }}</b>
                  <span class="file-chip" :class="item.revised_document_id ? 'file-chip--done' : 'file-chip--wait'">
                    {{ item.revised_document_id ? 'Sudah diganti' : 'Belum diganti' }}
                  </span>
                  <p>{{ item.note }}</p>
                </li>
              </ul>
            </div>
            <article v-for="(label, index) in indicatorLabels" :key="index">
              <strong>{{ index + 1 }}. {{ label }}</strong>
              <span>{{ historicalAnswer(review, index + 1) }}</span>
              <p v-if="historicalComment(review, index + 1)">{{ historicalComment(review, index + 1) }}</p>
            </article>
            <div><strong>Saran informasi</strong><p>{{ review.suggestion_information_accuracy || 'Tidak ada saran.' }}</p></div>
            <div><strong>Saran aspek etik lainnya</strong><p>{{ review.suggestion_other_ethics || 'Tidak ada saran.' }}</p></div>
          </div>
        </details>
      </section>
    </template>

    <div v-else class="empty-state">Detail pengajuan tidak tersedia.</div>
  </main>
</template>

<style scoped>
.review-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
  color: var(--foreground);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.back-button,
.refresh-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 9px 12px;
  background: var(--card);
  color: var(--primary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.refresh-button:disabled { opacity: .6; cursor: wait; }

.refresh-button:hover,
.back-button:hover,
.ghost-button:hover,
.document-download:hover {
  border-color: var(--primary);
  background: var(--color-primary-soft);
}

.hero,
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: clamp(16px, 3vw, 26px);
  box-shadow: var(--shadow-sm);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--gradient-primary-soft);
}

.eyebrow {
  display: block;
  color: var(--primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .09em;
}

.hero-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

h1 {
  margin: 7px 0 9px;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.hero p,
.section-header p,
.assessment-heading p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.6;
}

.status-pill {
  flex: 0 0 auto;
  border-radius: var(--radius-full);
  padding: 6px 11px;
  background: var(--color-success-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.forum-schedule {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 15px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  background: var(--primary-muted);
}

.forum-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--primary);
}

.forum-schedule div:last-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.forum-schedule span { color: var(--muted-foreground); font-size: 12px; }
.forum-schedule strong { font-size: 14px; }

.researcher-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.researcher-grid div { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.researcher-address { grid-column: 1 / -1; }
.researcher-grid span { color: var(--primary); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.researcher-grid strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 650; }

/* ===== Alur kerja ===== */
.workflow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.workflow-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
}

.workflow-step strong { display: block; font-size: 13px; }
.workflow-step small { display: block; margin-top: 2px; color: var(--muted-foreground); font-size: 11px; }

.workflow-marker {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border: 2px solid var(--border);
  border-radius: 50%;
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 800;
}

.workflow-step--done .workflow-marker {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.workflow-step--current {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.workflow-step--current .workflow-marker {
  border-color: var(--primary);
  color: var(--primary);
}

.workflow-step--locked { opacity: .55; }

/* ---- lama pengerjaan (SLA): sama dengan dashboard Ketua ---- */
.sla {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface);
}

.sla-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  font-size: .74rem;
}

.sla-head span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted-foreground);
  font-weight: 600;
}

.sla-head strong {
  font-size: .74rem;
}

.sla-bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--muted);
}

.sla-bar__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width .3s ease;
}

.sla small {
  font-size: .7rem;
  line-height: 1.45;
}

.sla--success {
  border-color: var(--color-success-border);
  background: var(--color-success-soft);
}

.sla--success .sla-bar__fill {
  background: var(--color-success);
}

.sla--success .sla-head strong {
  color: var(--color-success);
}

.sla--warning {
  border-color: var(--color-warning-border);
  background: var(--color-warning-soft);
}

.sla--warning .sla-bar__fill {
  background: var(--color-warning);
}

.sla--warning .sla-head strong,
.sla--warning small {
  color: var(--color-warning);
}

.sla--danger {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
}

.sla--danger .sla-bar__fill {
  background: var(--color-danger);
}

.sla--danger .sla-head strong,
.sla--danger small {
  color: var(--color-danger);
}

/* ===== Banner ===== */
.banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--muted);
}

.banner-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 10px;
  background: var(--card);
  color: var(--color-info);
}

.banner--warning { border-color: var(--color-warning-border); background: var(--color-warning-soft); }
.banner--warning .banner-icon { color: var(--color-warning); }
.banner--success { border-color: var(--color-success-border); background: var(--color-success-soft); }
.banner--success .banner-icon { color: var(--color-success); }
.banner--danger { border-color: var(--color-danger-border); background: var(--color-danger-soft); }
.banner--danger .banner-icon { color: var(--color-danger); }

.banner-body { flex: 1; min-width: 0; }
.banner-body strong { display: block; font-size: 14px; }
.banner-body p { margin: 4px 0 0; color: var(--muted-foreground); font-size: 12.5px; line-height: 1.55; }

.banner-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-warning);
  color: var(--primary-foreground);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.banner-action--info { background: var(--primary); }

/* ===== Tab ===== */
.detail-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.detail-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 15px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}

.detail-tabs button.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 800; }
.detail-tabs button.is-locked { opacity: .6; cursor: not-allowed; }

.tab-count {
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--muted);
  font-size: 10px;
  font-weight: 700;
}

.tab-count--alert { background: var(--color-warning-soft); color: var(--color-warning); }

/* ===== Kartu ===== */
.card { display: flex; flex-direction: column; gap: var(--space-5, 20px); }

.section-header { display: flex; align-items: flex-start; gap: 12px; }

.section-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: var(--radius-md);
  background: var(--background);
  color: var(--primary);
}

.section-icon--warn { background: var(--color-warning-soft); color: var(--color-warning); }

.section-header h2,
.assessment-heading h2 { margin: 2px 0 3px; font-size: 18px; }

.info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.info-item { min-width: 0; padding: 13px; border-bottom: 1px solid var(--border); }
.info-item.full { grid-column: 1 / -1; }

.info-item > span {
  display: block;
  margin-bottom: 6px;
  color: var(--primary);
  font-size: .68rem;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.info-item p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13.5px; line-height: 1.7; }

.rich-text-content {
  margin: 4px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.6;
}

.document-list { display: flex; flex-direction: column; gap: var(--space-3); }

.document-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.document-icon {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--primary-muted);
  color: var(--primary);
}

.document-info { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }
.document-info strong { overflow-wrap: anywhere; font-size: 13px; }
.document-info span,
.document-info small,
.documents-empty { color: var(--muted-foreground); font-size: 11.5px; overflow-wrap: anywhere; }

.doc-flag { width: fit-content; padding: 2px 8px; border-radius: var(--radius-full); font-size: 10.5px; font-weight: 700; }
.document-info .doc-flag--requested { background: var(--color-warning-soft); color: var(--color-warning); }
.document-info .doc-flag--replaced { background: var(--muted); color: var(--muted-foreground); }
.document-info .doc-flag--replacement { background: var(--color-success-soft); color: var(--color-success); }

.document-download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  background: var(--card);
  color: var(--primary);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.documents-empty { padding: 20px; text-align: center; border: 1px dashed var(--border); border-radius: var(--radius-md); }

/* ===== Riwayat revisi dokumen ===== */
.revision-history { border-color: var(--color-warning-border); }
.revision-history .section-header { flex-wrap: wrap; }
.rev-summary { margin-left: auto; padding: 5px 10px; border-radius: var(--radius-full); background: var(--color-warning-soft); color: var(--color-warning); font-size: 12px; font-weight: 700; }
.rev-timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.rev-round { position: relative; display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 12px; padding-bottom: 18px; }
.rev-round:not(:last-child)::before { content: ""; position: absolute; top: 32px; bottom: 0; left: 15px; width: 2px; background: var(--border); }
.rev-dot { display: grid; place-items: center; width: 32px; height: 32px; border: 2px solid var(--primary); border-radius: 50%; background: var(--card); color: var(--primary); font-size: 12px; font-weight: 800; }
.rev-round--open .rev-dot { border-color: var(--color-warning); color: var(--color-warning); }
.rev-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.rev-head strong { font-size: 13.5px; }
.rev-state { padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; }
.rev-state--wait { background: var(--color-warning-soft); color: var(--color-warning); }
.rev-state--done { background: var(--color-success-soft); color: var(--color-success); }
.rev-body > small { display: block; margin-top: 3px; color: var(--muted-foreground); font-size: 11.5px; }
.rev-files { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
.rev-files li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--muted); }
.rev-files li > svg { margin-top: 2px; color: var(--primary); }
.rev-files strong { display: block; font-size: 13px; }
.rev-files li span:not(.file-chip) { display: block; color: var(--muted-foreground); font-size: 11.5px; overflow-wrap: anywhere; }
.rev-files p { margin: 6px 0 0; font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; }

.file-chip { width: fit-content; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; white-space: nowrap; }
.file-chip--done { background: var(--color-success-soft); color: var(--color-success); }
.file-chip--wait { background: var(--color-warning-soft); color: var(--color-warning); }

.next-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-lg);
  background: var(--primary-muted);
}

.next-card strong { display: block; font-size: 15px; }
.next-card p { margin: 4px 0 0; color: var(--muted-foreground); font-size: 13px; }

/* ===== Penilaian ===== */
.assessment-form { display: flex; flex-direction: column; gap: 20px; }

.assessment-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); }

.progress-box { flex: 0 0 120px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-md); }
.progress-box strong { font-size: 18px; }
.progress-box > span { margin-left: 5px; color: var(--muted-foreground); font-size: 12px; }

.progress-track { display: block; height: 5px; margin-top: 8px; overflow: hidden; border-radius: var(--radius-full); background: var(--muted); }
.progress-track span { display: block; height: 100%; background: var(--primary); transition: width var(--transition-base); }

.overview { display: flex; flex-wrap: wrap; gap: 6px; }

.overview-chip {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.overview-chip--done { border-color: var(--primary); background: var(--primary); color: var(--primary-foreground); }
.overview-chip--missing { border-color: var(--color-danger); background: var(--color-danger-soft); color: var(--color-danger); }

.indicator-list { display: flex; flex-direction: column; gap: var(--space-3); }

.indicator { padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); scroll-margin-top: 90px; }
.indicator--missing { border-color: var(--color-danger); background: var(--color-danger-soft); }

.indicator-main { display: flex; align-items: flex-start; gap: var(--space-3); }

.indicator-number {
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  height: 30px;
  border-radius: var(--radius-full);
  background: var(--primary-muted);
  color: var(--primary);
  font-size: 12px;
  font-weight: 800;
}

.indicator-content { flex: 1; min-width: 0; }
.indicator-label { margin: 4px 0 12px; font-size: 14px; font-weight: 700; line-height: 1.5; }

.answer-options { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }

.answer-option {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 95px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  cursor: pointer;
  font-size: 13px;
}

.answer-option.selected { border-color: var(--primary); background: var(--color-success-soft); color: var(--primary); font-weight: 700; }
.answer-option:has(input:disabled),
.recommendation-option:has(input:disabled) { cursor: default; }
.missing-note { color: var(--color-danger); font-size: 12px; font-weight: 700; }

input[type="radio"],
input[type="checkbox"] { accent-color: var(--primary); }

.field-label,
.field-group > label { display: block; margin-bottom: 7px; font-size: 13px; font-weight: 700; }

textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 11px 12px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
}

textarea:focus { outline: 2px solid var(--ring); outline-offset: 1px; }
textarea[readonly] { background: var(--muted); cursor: default; }

.field-group { display: flex; flex-direction: column; gap: 2px; }

.recommendation-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--space-2); }

.recommendation-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.recommendation-option input { margin-top: 3px; }
.recommendation-option.selected { border-color: var(--primary); background: var(--color-success-soft); }
.recommendation-option--revise.selected { border-color: var(--color-warning); background: var(--color-warning-soft); }
.recommendation-option--reject.selected { border-color: var(--color-danger); background: var(--color-danger-soft); }
.recommendation-option span { display: flex; flex-direction: column; gap: 4px; }
.recommendation-option strong { font-size: 13px; }
.recommendation-option small { color: var(--muted-foreground); font-size: 11.5px; line-height: 1.45; }

.submitted-summary { display: flex; flex-direction: column; gap: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.submitted-summary div { display: flex; flex-direction: column; gap: 5px; }
.submitted-summary span { color: var(--muted-foreground); font-size: 12px; }
.submitted-summary strong { font-size: 14px; }
.submitted-summary p { margin: 0; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }

/* ===== Bar kirim ===== */
.submit-bar {
  position: sticky;
  bottom: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-lg);
}

.submit-bar-info { flex: 1; min-width: 0; }
.submit-bar-info strong { font-size: 13px; }

.submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: var(--radius-md);
  padding: 12px 16px;
  background: var(--primary);
  color: var(--primary-foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  white-space: nowrap;
  cursor: pointer;
}

.submit-button:disabled { opacity: .55; cursor: not-allowed; }

/* ===== Pesan ===== */
.alert { display: flex; align-items: flex-start; gap: 9px; padding: 12px 14px; border-radius: var(--radius-md); font-size: 13px; }
.alert-error { border: 1px solid var(--color-danger-border); background: var(--color-danger-soft); color: var(--destructive); }
.alert-success { border: 1px solid var(--color-success-border); background: var(--color-success-soft); color: var(--color-success); }

.state,
.empty-state { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 50px 20px; color: var(--muted-foreground); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== Riwayat penilaian ===== */
.previous-review-round { border-top: 1px solid var(--border); padding: 13px 0; }
.previous-review-round summary { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; cursor: pointer; }
.previous-review-round summary span { color: var(--primary); font-weight: 650; }
.previous-review-round summary .file-chip { color: var(--color-warning); font-weight: 700; }
.previous-review-round summary small { margin-left: auto; color: var(--muted-foreground); }
.previous-review-answers { display: grid; gap: 12px; padding: 16px 0 4px; }

.previous-review-answers article,
.previous-review-answers > div { display: grid; gap: 6px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); }

.previous-review-answers article strong,
.previous-review-answers > div strong { font-size: .86rem; }
.previous-review-answers article span { color: var(--primary); font-weight: 700; }
.previous-review-answers p { margin: 0; color: var(--muted-foreground); white-space: pre-wrap; }

.previous-review-answers .previous-review-files { border-color: var(--color-warning-border); background: var(--color-warning-soft); }
.previous-review-files ul { display: grid; gap: 8px; margin: 8px 0 0; padding: 0; list-style: none; }
.previous-review-files li { display: grid; gap: 4px; padding: 10px; border-radius: var(--radius-md); background: var(--card); }

/* ===== Revisi dokumen ===== */
.revision-request-panel { display: flex; flex-direction: column; gap: var(--space-3); padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--muted); }
.revision-document-option { display: flex; flex-direction: column; gap: 10px; padding: 13px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--card); }
.revision-document-check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.revision-document-check span { display: flex; flex-direction: column; gap: 4px; }
.revision-document-check small { color: var(--muted-foreground); }

/* ===== Responsif ===== */
@media (max-width: 900px) {
  .researcher-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workflow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .hero-title-row,
  .assessment-heading,
  .banner,
  .next-card,
  .submit-bar { flex-direction: column; align-items: stretch; }

  .researcher-grid,
  .info-grid,
  .workflow { grid-template-columns: 1fr; }

  .info-item.full,
  .researcher-address { grid-column: auto; }

  .document-item { align-items: flex-start; flex-wrap: wrap; }
  .document-info { flex-basis: calc(100% - 60px); }
  .document-download { margin-left: 52px; }
  .status-pill { align-self: flex-start; }
  .progress-box { flex: initial; }
  .submit-button,
  .banner-action,
  .ghost-button { width: 100%; justify-content: center; }

  .rev-files li { grid-template-columns: 20px minmax(0, 1fr); }
  .rev-files .file-chip { grid-column: 2; }
  .rev-summary { margin-left: 0; }
}
</style>