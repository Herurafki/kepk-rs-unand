<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileText,
  History,
  Info,
  LoaderCircle,
  XCircle,
} from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import {
  assignReviewer,
  closeForum,
  decideFinal,
  getApplicationReviewData,
  getAvailableReviewers,
  getChiefApplication,
  getChiefRevisions,
  getReviewResult,
  setReviewType,
  type ChiefApplication,
  type ChiefRevision,
  type Review,
  type Reviewer,
} from '../../services/chief/application.service'
import { downloadDocument } from '../../services/diklit/application.service'
import { getApiErrorMessage } from '../../services/api/error'
import { displayDocumentInTab, openDocumentTab } from '../../utils/document-preview'
import { sanitizeResearcherRichText } from '../../utils/researcher-rich-text'

/* ============================================================
 * State
 * ============================================================ */
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const app = ref<ChiefApplication | null>(null)
const reviews = ref<Review[]>([])
const currentCycleReviews = ref<Review[]>([])
const reviewers = ref<Reviewer[]>([])
const result = ref<any>(null)
const selectedReview = ref<any | null>(null)
const reviewerParticipation = ref<any[]>([])
const reviewerSummary = ref<any | null>(null)
const expeditedReviewerStates = ref<any[]>([])
const expeditedRevisionRequests = ref<any[]>([])
const revisions = ref<ChiefRevision[]>([])

const loading = ref(true)
const busy = ref('')
const error = ref('')
const success = ref('')

const activeTab = ref<'info' | 'screening' | 'documents' | 'reviews'>('info')
const selectedType = ref('')
const selectedReviewers = ref<string[]>([])
const reviewerToAdd = ref('')
const forumDate = ref('')
const decisionNote = ref('')
const selectedFinalDecision = ref<'APPROVED' | 'APPROVED_MINOR' | 'MAJOR_REVISION' | 'REJECTED' | 'NOT_ASSESSABLE'>('APPROVED')
const typeModal = ref<'EXEMPTED' | 'EXPEDITED' | 'FULLBOARD' | null>(null)
type ConfirmationAction = 'exempted-final-decision' | 'expedited-assign' | 'fullboard-set' | 'final-decision'
const confirmationAction = ref<ConfirmationAction | null>(null)

/* ============================================================
 * Konstanta
 * ============================================================ */
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

const finalDecisionOptions = [
  { value: 'APPROVED', label: 'Disetujui', description: 'Protokol dinilai layak secara etik tanpa revisi. Ethical Clearance dapat diterbitkan.' },
  { value: 'APPROVED_MINOR', label: 'Disetujui dengan perbaikan Minor', description: 'Perubahan kecil/editorial/administratif yang diverifikasi Ketua atau Sekretaris tanpa penilaian ulang reviewer.' },
  { value: 'MAJOR_REVISION', label: 'Perbaikan Mayor', description: 'Kekurangan ilmiah atau etik yang substansial; setelah revisi perlu dinilai kembali oleh reviewer atau forum.' },
  { value: 'REJECTED', label: 'Ditolak', description: 'Protokol tidak dapat diterima secara etik atau memiliki kelemahan mendasar.' },
  { value: 'NOT_ASSESSABLE', label: 'Tidak dapat dinilai', description: 'Di luar kewenangan KEPK RS UNAND; diarahkan ke KEP UNAND atau KEPK terkait.' },
] as const

const typeOptions = [
  { value: 'EXEMPTED', label: 'Exempted', description: 'Tanpa reviewer. Ketua langsung memutuskan.' },
  { value: 'EXPEDITED', label: 'Expedited', description: 'Dinilai reviewer yang ditugaskan, tanpa forum.' },
  { value: 'FULLBOARD', label: 'Full Board', description: 'Dibahas dalam forum KEPK pada jadwal tertentu.' },
] as const

const typeLabels: Record<string, string> = { IZIN_ETIK: 'Kaji Etik' }
const reviewTypeLabel = (t?: string | null) =>
  ({ EXEMPTED: 'Exempted', EXPEDITED: 'Expedited', FULLBOARD: 'Full Board', FULL_BOARD: 'Full Board' }[String(t || '').toUpperCase()] || '—')

const statusLabel = (s?: string) =>
({
  SEKRETARIS_REVIEW: 'Pemeriksaan Sekretariat',
  WAITING_REVIEWER: 'Menunggu Reviewer',
  UNDER_REVIEW: 'Sedang Direview',
  REVIEW_COMPLETED: 'Review Selesai',
  APPROVED: 'Disetujui',
  REVISION_REQUIRED: 'Perlu Revisi',
  REJECTED: 'Ditolak',
  NOT_ASSESSABLE: 'Tidak dapat dinilai',
}[s || ''] || s || '—')

const finalDecisionLabel = (decision?: string) =>
({
  APPROVED: 'Disetujui',
  APPROVED_MINOR: 'Perbaikan Minor',
  MAJOR_REVISION: 'Perbaikan Mayor',
  REJECTED: 'Ditolak',
  NOT_ASSESSABLE: 'Tidak dapat dinilai',
  REVISION_REQUIRED: 'Perlu Revisi (lama)',
}[decision || ''] || decision || '—')

const formatForumDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

/* ============================================================
 * Peneliti & screening
 * ============================================================ */
const researcher = computed(() => ({
  name: app.value?.researcher_name || '—',
  email: app.value?.researcher_email || '—',
  category: String(app.value?.researcher_category || '').toLowerCase(),
  nim: app.value?.researcher_nim || '—',
  nip: app.value?.researcher_nip || '—',
  nik: app.value?.researcher_nik || '—',
  phone: app.value?.researcher_phone || '—',
  address: app.value?.researcher_address || '—',
  institution: app.value?.researcher_institution || '—',
  faculty: app.value?.researcher_faculty || '—',
  program: app.value?.researcher_program_study || '—',
  department: app.value?.researcher_department || '—',
}))

const categoryLabel = computed(
  () => ({ mahasiswa: 'Mahasiswa', dosen: 'Dosen', staff: 'Staff', umum: 'Umum' }[researcher.value.category] || 'Peneliti'),
)

const screeningQuestionLabel = (key: string) =>
({
  question1: 'Data atau informasi telah dianonimkan sepenuhnya sehingga subjek tidak dapat diidentifikasi?',
  question2: 'Melibatkan interaksi, wawancara, kuesioner, observasi, pemeriksaan, pengukuran, pengujian, atau intervensi langsung terhadap manusia?',
  question3: 'Melibatkan kelompok rentan seperti anak, ibu hamil, lansia, penyandang disabilitas, pasien dengan gangguan kesadaran/kejiwaan, atau kelompok dengan keterbatasan memberikan persetujuan?',
  question4: 'Berpotensi menimbulkan risiko atau ketidaknyamanan bagi subjek, baik secara fisik, psikologis, sosial, maupun ekonomi?',
  question5: 'Melibatkan spesimen biologis seperti darah, jaringan, urin, saliva, cairan tubuh, sel, atau bahan biologis lain dari manusia?',
  question6: 'Melibatkan tindakan, perlakuan, atau prosedur terhadap organisme hidup selain manusia yang berpotensi menyebabkan rasa sakit, cedera, penderitaan, perubahan kondisi, atau kematian?',
}[key] || key.replace('question', 'Pertanyaan '))

function parseObject(value: unknown): Record<string, any> {
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

const recommendation = computed(() => {
  const screening = app.value?.screening as any
  return screening?.recommendation || screening?.result || (app.value as any)?.screening_recommendation || (app.value as any)?.recommendation || '—'
})

const screeningAnswers = computed(() => {
  const screening = parseObject(app.value?.screening)
  return parseObject(screening.answers ?? screening)
})

const screeningAnswerLabel = (answer: unknown) => {
  const value = String(answer ?? '').trim().toLowerCase()
  if (['yes', 'ya', 'true'].includes(value)) return 'Ya'
  if (['no', 'tidak', 'false'].includes(value)) return 'Tidak'
  return String(answer ?? '—')
}

const screeningItems = computed(() =>
  Object.entries(screeningAnswers.value)
    .filter(([key]) => key.startsWith('question'))
    .map(([key, answer]) => ({
      key,
      number: key.replace('question', ''),
      label: screeningQuestionLabel(key),
      answer: screeningAnswerLabel(answer),
    })),
)

/* ============================================================
 * Review & reviewer
 * ============================================================ */
function reviewDecisionLabel(value?: string) {
  const normalized = String(value || '').toUpperCase()
  if (['APPROVE', 'AGREE', 'AGREED', 'SETUJU'].includes(normalized)) return 'Setuju'
  if (['REJECT', 'REJECTED', 'DISAGREE', 'TOLAK'].includes(normalized)) return 'Tolak'
  if (['REVISION', 'REVISION_REQUIRED'].includes(normalized)) return 'Setuju dengan Perbaikan'
  return value || 'Belum memberikan hasil'
}

function reviewComments(review: any): string[] {
  const raw = review?.comments
  if (Array.isArray(raw)) return raw.map((item: any) => (typeof item === 'string' ? item : item?.comment)).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) return [raw]
  return []
}

const isFullBoard = computed(() => ['FULLBOARD', 'FULL_BOARD'].includes(selectedType.value))

/* ---- lama pengerjaan reviewer (SLA Expedited: 7 hari) ---- */
const SLA_EXPECTED_DAYS = 7
const SLA_GREEN_MAX_DAY = 4

function slaReviewerInfo(r: any) {
  if (selectedType.value !== 'EXPEDITED' || isFinished.value) return null
  if (r?.participation_status === 'SUBMITTED') return null
  const assignmentStatus = String(r?.assignment_status || '').toUpperCase()
  // Lama pengerjaan hanya dihitung setelah reviewer mengonfirmasi penugasan (bukan saat masih pending).
  if (['PENDING', 'ASSIGNMENT_PENDING', 'REJECTED', 'ASSIGNMENT_REJECTED', 'NOT_ASSIGNED'].includes(assignmentStatus)) return null
  const start = r?.accepted_at || (assignmentStatus === 'ACCEPTED' ? r?.assigned_at : null)
  if (!start) return null
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) return null
  const day = Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1

  const tone: 'success' | 'warning' | 'danger' = day >= SLA_EXPECTED_DAYS ? 'danger' : day > SLA_GREEN_MAX_DAY ? 'warning' : 'success'
  return {
    day,
    expected: SLA_EXPECTED_DAYS,
    percent: Math.min(100, Math.round((day / SLA_EXPECTED_DAYS) * 100)),
    tone,
    canChange: tone !== 'success',
  }
}

const reviewerRows = computed(() => {
  const cycleReviews = currentCycleReviews.value
  const reviewByReviewer = new Map<string, any>(cycleReviews.map((review: any) => [String(review.reviewer_id), review] as [string, any]))
  const stateByReviewer = new Map<string, any>(expeditedReviewerStates.value.map((state: any) => [String(state.reviewer_id), state] as [string, any]))
  const rows = !reviewerParticipation.value.length
    ? cycleReviews.map((review: any) => ({ ...review, participation_status: 'SUBMITTED' }))
    : reviewerParticipation.value.map((participant: any) => {
        const submitted = reviewByReviewer.get(String(participant.reviewer_id))
        const state = stateByReviewer.get(String(participant.reviewer_id))
        const reviewerState = String(state?.state || participant.reviewer_state || '').toUpperCase()
        let participationStatus = submitted ? 'SUBMITTED' : participant.participation_status
        if (selectedType.value === 'EXPEDITED') {
          if (reviewerState === 'NEEDS_REVISION') participationStatus = 'REVISION_REQUIRED'
          else if (reviewerState === 'IN_REVIEW') participationStatus = 'REVISION_RESUBMITTED'
          else if (reviewerState === 'FINAL') participationStatus = 'SUBMITTED'
          else if (reviewerState === 'WAITING') participationStatus = 'AWAITING_REVIEW'
        }
        return { ...participant, ...(submitted || {}), reviewer_state: reviewerState, participation_status: participationStatus }
      })
  return rows.map((row: any) => ({ ...row, sla: slaReviewerInfo(row) }))
})

const participationStatusLabel = (status?: string) =>
({
  SUBMITTED: 'Keputusan final diberikan',
  REVISION_REQUIRED: 'Meminta perbaikan dokumen',
  REVISION_RESUBMITTED: 'Dokumen diterima · menunggu review ulang',
  AWAITING_REVIEW: 'Belum memberikan keputusan',
  ASSIGNMENT_PENDING: 'Menunggu konfirmasi penugasan',
  ASSIGNMENT_REJECTED: 'Menolak penugasan',
  NOT_ASSIGNED: 'Belum ditugaskan',
}[status || ''] || 'Status belum tersedia')

const reviewerName = (r: any) =>
  r?.reviewer_name || reviewers.value.find((reviewer: any) => String(reviewer.id) === String(r?.reviewer_id))?.name || 'Reviewer'

const reviewerTone = (r: any) => {
  if (r.participation_status === 'SUBMITTED') return reviewDecisionLabel(r.recommendation) === 'Setuju' ? 'agree' : 'reject'
  if (['REVISION_REQUIRED', 'REVISION_RESUBMITTED'].includes(r.participation_status)) return 'revise'
  return 'pending'
}

const reviewerPendingCount = computed(() => {
  if (selectedType.value === 'EXPEDITED') {
    return reviewerRows.value.filter((reviewer: any) => reviewer.participation_status !== 'SUBMITTED').length
  }
  if (reviewerSummary.value?.pending_decisions != null) return Number(reviewerSummary.value.pending_decisions)
  return reviewerRows.value.filter((reviewer: any) => reviewer.participation_status === 'AWAITING_REVIEW').length
})

const votes = computed(() => {
  const voting = result.value?.voting || result.value?.data?.voting || {}
  return { approve: Number(voting.approve_votes || 0), reject: Number(voting.reject_votes || 0) }
})

const reviewResult = computed(() => {
  const { approve, reject } = votes.value
  if (approve + reject === 0) return 'Belum ada keputusan Setuju/Tolak'
  if (approve === reject) return 'Hasil seimbang'
  return approve > reject ? 'Mayoritas: Setuju' : 'Mayoritas: Tolak'
})

const voteSegments = computed(() => {
  const total = votes.value.approve + votes.value.reject + reviewerPendingCount.value
  const pct = (n: number) => (total ? (n / total) * 100 : 0) + '%'
  return { approve: pct(votes.value.approve), reject: pct(votes.value.reject), pending: pct(reviewerPendingCount.value), total }
})

const revisionRequestsForReviewer = (reviewerId: string | number) =>
  expeditedRevisionRequests.value.filter((request) => String(request.reviewer_id) === String(reviewerId))

const selectedReviewRounds = computed(() => {
  const reviewerId = selectedReview.value?.reviewer_id
  if (reviewerId == null) return []
  return reviews.value
    .filter((review: any) => String(review.reviewer_id) === String(reviewerId))
    .slice()
    .sort(
      (a: any, b: any) =>
        Number(a.review_cycle || 1) - Number(b.review_cycle || 1) ||
        new Date(a.reviewed_at || a.created_at).getTime() - new Date(b.reviewed_at || b.created_at).getTime(),
    )
})

const openReviewDetail = (review: any) => { selectedReview.value = review }
const selectReviewRound = (review: any) => { selectedReview.value = review }

const selectedReviewSla = computed<any | null>(() => (selectedReview.value ? slaReviewerInfo(selectedReview.value) : null))


function reviewAnswer(index: number): boolean | null {
  const value = parseObject(selectedReview.value?.indicator_answers)[String(index)]
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

function reviewIndicatorComment(index: number): string {
  const value = parseObject(selectedReview.value?.indicator_comments)[String(index)]
  return typeof value === 'string' ? value.trim() : ''
}

const answeredReviewIndicators = computed(() => indicatorLabels.filter((_, index) => reviewAnswer(index + 1) !== null).length)

const chiefRevisionHistory = computed(() =>
  revisions.value.filter((revision) => Array.isArray(revision.requested_by_roles) && revision.requested_by_roles.includes('KETUA')),
)

const assignableReviewers = computed(() => {
  const alreadyActive = new Set(
    reviewerRows.value
      .filter((row: any) => ['PENDING', 'ACCEPTED'].includes(String(row.assignment_status || '').toUpperCase()))
      .map((row: any) => String(row.reviewer_id)),
  )
  return reviewers.value.filter((reviewer) => !alreadyActive.has(String(reviewer.id)))
})

const canReplaceRejectedAssignment = computed(
  () =>
    selectedType.value === 'EXPEDITED' &&
    ['WAITING_REVIEWER', 'UNDER_REVIEW'].includes(String(app.value?.status || '')) &&
    reviewerRows.value.some(
      (row: any) => String(row.assignment_status || '').toUpperCase() === 'REJECTED' || row.participation_status === 'ASSIGNMENT_REJECTED',
    ),
)

/* ============================================================
 * Alur & keputusan
 * ============================================================ */
const forumClosed = computed(() => !!app.value?.forum_closed_at)

const canDecide = computed(
  () =>
    !!app.value?.review_type &&
    (String(app.value.review_type).toUpperCase() === 'EXEMPTED'
      ? ['WAITING_REVIEWER', 'SEKRETARIS_REVIEW', 'REVIEW_COMPLETED'].includes(app.value?.status || '')
      : ['REVIEW_COMPLETED'].includes(app.value?.status || '')),
)

const availableFinalDecisionOptions = computed(() =>
  selectedType.value === 'EXPEDITED'
    ? finalDecisionOptions.filter((option) => option.value === 'APPROVED' || option.value === 'REJECTED')
    : finalDecisionOptions,
)

const noteRequired = computed(() => selectedFinalDecision.value !== 'APPROVED')

const isFinished = computed(
  () => !!app.value?.final_decision || ['APPROVED', 'REJECTED', 'NOT_ASSESSABLE', 'PERMIT_ISSUED'].includes(app.value?.status || ''),
)

// 0 = tetapkan telaah, 1 = proses review, 2 = keputusan akhir, 3 = selesai
const currentPhase = computed(() => {
  if (!app.value?.review_type) return 0
  if (isFinished.value) return 3
  if (canDecide.value) return 2
  return 1
})
const phases = ['Tetapkan telaah', 'Proses review', 'Keputusan akhir']

type NextStep = { tone: 'warning' | 'info' | 'success'; title: string; text: string; cta?: string; target?: string }
const nextStep = computed<NextStep | null>(() => {
  const a = app.value
  if (!a) return null
  if (!a.review_type) {
    return {
      tone: 'warning',
      title: 'Tentukan jenis telaah',
      text: 'Tinjau informasi penelitian dan hasil screening, lalu pilih Exempted, Expedited, atau Full Board.',
      cta: 'Pilih jenis telaah',
      target: 'action-panel',
    }
  }
  if (isFinished.value) {
    return {
      tone: 'success',
      title: 'Keputusan sudah ditetapkan',
      text: a.final_decision ? `Keputusan Ketua: ${finalDecisionLabel(a.final_decision)}.` : `Status pengajuan: ${statusLabel(a.status)}.`,
    }
  }
  if (canDecide.value) {
    return {
      tone: 'warning',
      title: 'Ambil keputusan akhir',
      text: reviewerPendingCount.value
        ? `${reviewerPendingCount.value} reviewer belum memberikan keputusan. Anda tetap dapat memutuskan.`
        : 'Seluruh reviewer telah selesai. Tinjau hasilnya, lalu tetapkan keputusan.',
      cta: 'Buka form keputusan',
      target: 'decision-form',
    }
  }
  if (a.status === 'REVISION_REQUIRED') {
    return { tone: 'info', title: 'Menunggu perbaikan peneliti', text: 'Pengajuan akan kembali setelah peneliti mengirim dokumen perbaikan.' }
  }
  if (isFullBoard.value && a.status === 'UNDER_REVIEW' && !forumClosed.value) {
    return {
      tone: 'info',
      title: 'Forum berlangsung',
      text: `Jadwal forum: ${formatForumDate(a.forum_date)}. Tutup forum setelah pembahasan selesai.`,
      cta: 'Ke tindakan forum',
      target: 'action-panel',
    }
  }
  return {
    tone: 'info',
    title: 'Menunggu hasil review',
    text: reviewerPendingCount.value
      ? `${reviewerPendingCount.value} reviewer belum memberikan keputusan.`
      : 'Review sedang berjalan.',
    cta: 'Lihat hasil reviewer',
    target: 'reviews-tab',
  }
})

function goToTarget(target?: string) {
  if (!target) return
  if (target === 'reviews-tab') {
    activeTab.value = 'reviews'
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/* ============================================================
 * Modal & konfirmasi
 * ============================================================ */
function openTypeModal(type: 'EXEMPTED' | 'EXPEDITED' | 'FULLBOARD') {
  selectedType.value = type
  typeModal.value = type
  error.value = ''
  reviewerToAdd.value = ''
  if (type === 'EXPEDITED') selectedReviewers.value = []
  if (type === 'EXPEDITED' && !reviewers.value.length) {
    getAvailableReviewers()
      .then((list) => { reviewers.value = list || [] })
      .catch((e) => { error.value = getApiErrorMessage(e, 'Daftar reviewer gagal dimuat.') })
  }
}

function closeTypeModal() {
  if (busy.value) return
  typeModal.value = null
  selectedType.value = app.value?.review_type || ''
}

function addSelectedReviewer() {
  const reviewerId = reviewerToAdd.value
  if (!reviewerId || selectedReviewers.value.includes(reviewerId)) return
  selectedReviewers.value = [...selectedReviewers.value, reviewerId]
  reviewerToAdd.value = ''
}

function requestConfirmation(action: ConfirmationAction) {
  error.value = ''
  if (['final-decision', 'exempted-final-decision'].includes(action) && noteRequired.value && !decisionNote.value.trim()) {
    error.value = 'Catatan atau alasan keputusan wajib diisi untuk pilihan ini.'
    return
  }
  if (action === 'expedited-assign' && !selectedReviewers.value.length) { error.value = 'Pilih minimal satu reviewer.'; return }
  if (action === 'fullboard-set') {
    if (!forumDate.value) { error.value = 'Tanggal dan jam forum wajib diisi.'; return }
    if (new Date(forumDate.value) <= new Date()) { error.value = 'Jadwal forum harus berada di masa depan.'; return }
  }
  confirmationAction.value = action
}

const confirmationCopy = computed(() => {
  const action = confirmationAction.value
  if (!action) return null
  if (action === 'final-decision' || action === 'exempted-final-decision') {
    const option = finalDecisionOptions.find((o) => o.value === selectedFinalDecision.value)
    return {
      title: 'Simpan keputusan akhir?',
      headline: option?.label || '',
      detail: decisionNote.value.trim() || 'Tanpa catatan.',
      confirm: 'Ya, simpan keputusan',
    }
  }
  if (action === 'expedited-assign') {
    const names = selectedReviewers.value.map((rid) => reviewers.value.find((r) => String(r.id) === rid)?.name || 'Reviewer')
    return {
      title: `Tugaskan ${names.length} reviewer?`,
      headline: names.join(', '),
      detail: 'Reviewer perlu mengonfirmasi penugasan sebelum mulai menilai.',
      confirm: 'Ya, tugaskan',
    }
  }
  return {
    title: 'Tetapkan Full Board?',
    headline: formatForumDate(forumDate.value),
    detail: 'Pengajuan dijadwalkan untuk dibahas pada forum KEPK di waktu tersebut.',
    confirm: 'Ya, tetapkan',
  }
})

async function executeConfirmedAction() {
  const action = confirmationAction.value
  if (!action) return
  confirmationAction.value = null
  if (action === 'exempted-final-decision') {
    await run('type', async () => {
      await setReviewType(id.value, 'EXEMPTED')
      await decideFinal(id.value, selectedFinalDecision.value, decisionNote.value.trim() || undefined)
    })
    typeModal.value = null
  } else if (action === 'expedited-assign') {
    await run('type', async () => {
      if (app.value?.review_type !== 'EXPEDITED') await setReviewType(id.value, 'EXPEDITED')
      for (const reviewerId of selectedReviewers.value) await assignReviewer(id.value, reviewerId, 'EXPEDITED')
    })
    typeModal.value = null
  } else if (action === 'fullboard-set') {
    await run('type', () => setReviewType(id.value, 'FULLBOARD', forumDate.value))
    typeModal.value = null
  } else if (action === 'final-decision') {
    await run('final-decision', () => decideFinal(id.value, selectedFinalDecision.value, decisionNote.value.trim() || undefined))
  }
}

/* ============================================================
 * Data
 * ============================================================ */
async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    const [a, revisionRows] = await Promise.all([getChiefApplication(id.value), getChiefRevisions(id.value).catch(() => [])])
    app.value = a
    revisions.value = revisionRows
    selectedType.value = a.review_type || ''
    if (selectedType.value) {
      const [reviewDataResult, resultResult] = await Promise.allSettled([getApplicationReviewData(id.value), getReviewResult(id.value)])
      const reviewData = reviewDataResult.status === 'fulfilled' ? reviewDataResult.value : null
      reviews.value = reviewData?.reviews || []
      currentCycleReviews.value = reviewData?.current_cycle_reviews || reviewData?.reviews || []
      reviewerParticipation.value = reviewData?.reviewer_participation || []
      reviewerSummary.value = reviewData?.reviewer_summary || null
      expeditedReviewerStates.value = reviewData?.expedited_reviewer_states || []
      expeditedRevisionRequests.value = reviewData?.expedited_revision_requests || []
      result.value = resultResult.status === 'fulfilled' ? resultResult.value : null
    } else {
      reviews.value = []
      currentCycleReviews.value = []
      reviewerParticipation.value = []
      reviewerSummary.value = null
      expeditedReviewerStates.value = []
      expeditedRevisionRequests.value = []
      result.value = null
    }
    if (selectedType.value === 'EXPEDITED') {
      reviewers.value = (await getAvailableReviewers()) || []
    } else {
      reviewers.value = []
    }
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Gagal memuat detail pengajuan.')
  } finally {
    loading.value = false
  }
}

async function run(key: string, fn: () => Promise<any>) {
  busy.value = key
  error.value = ''
  success.value = ''
  try {
    await fn()
    success.value = 'Perubahan berhasil disimpan.'
    decisionNote.value = ''
    await load(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Aksi gagal diproses.')
  } finally {
    busy.value = ''
  }
}

async function doc(d: any) {
  const tab = openDocumentTab()
  if (!tab) { error.value = 'Browser memblokir tab dokumen. Izinkan pop-up, lalu coba lagi.'; return }
  try {
    const blob = await downloadDocument(d.id)
    displayDocumentInTab(tab, blob, d.original_name || 'dokumen')
  } catch (e) {
    tab.close()
    error.value = getApiErrorMessage(e, 'Dokumen tidak dapat dibuka.')
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (confirmationAction.value) confirmationAction.value = null
  else if (selectedReview.value) selectedReview.value = null
  else if (typeModal.value) closeTypeModal()
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <main class="detail-page">
    <div class="topbar">
      <button class="btn btn--ghost" type="button" @click="router.go(-1)">
        <ArrowLeft :size="17" /> Kembali
      </button>
      <div v-if="app" class="reference">
        <span>No. Registrasi</span>
        <code>{{ app.application_number }}</code>
      </div>
    </div>

    <div v-if="loading" class="state">
      <LoaderCircle :size="32" class="spin" />
      Memuat detail pengajuan...
    </div>

    <template v-else-if="app">
      <!-- ===== Ringkasan ===== -->
      <header class="hero">
        <div class="hero-main">
          <p class="hero-kicker">{{ typeLabels[app.application_type] || app.application_type }}</p>
          <h1>{{ app.research_title || 'Tanpa Judul Penelitian' }}</h1>
          <p class="hero-researcher">
            <strong>{{ researcher.name }}</strong>
            <span class="chip">{{ categoryLabel }}</span>
            <span>{{ researcher.institution }}</span>
          </p>
          <div class="hero-meta">
            <span><b>Diajukan</b> {{ fmt(app.created_at) }}</span>
            <span v-if="app.review_type"><b>Telaah</b> {{ reviewTypeLabel(app.review_type) }}</span>
            <span v-if="isFullBoard"><b>Forum</b> {{ formatForumDate(app.forum_date) }}</span>
          </div>
          <details class="researcher-details">
            <summary>Data lengkap peneliti</summary>
            <dl class="researcher-grid">
              <div>
                <dt>Email</dt>
                <dd>{{ researcher.email }}</dd>
              </div>
              <div>
                <dt>No. HP</dt>
                <dd>{{ researcher.phone }}</dd>
              </div>
              <div v-if="researcher.category === 'mahasiswa'">
                <dt>NIM</dt>
                <dd>{{ researcher.nim }}</dd>
              </div>
              <div v-if="researcher.category === 'dosen' || researcher.category === 'staff'">
                <dt>NIP</dt>
                <dd>{{ researcher.nip }}</dd>
              </div>
              <div v-if="researcher.category === 'umum'">
                <dt>NIK</dt>
                <dd>{{ researcher.nik }}</dd>
              </div>
              <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'">
                <dt>Fakultas</dt>
                <dd>{{ researcher.faculty }}</dd>
              </div>
              <div v-if="researcher.category === 'mahasiswa' || researcher.category === 'dosen'">
                <dt>Program Studi</dt>
                <dd>{{ researcher.program }}</dd>
              </div>
              <div v-if="researcher.category === 'staff'">
                <dt>Departemen</dt>
                <dd>{{ researcher.department }}</dd>
              </div>
              <div class="researcher-grid__wide">
                <dt>Alamat</dt>
                <dd>{{ researcher.address }}</dd>
              </div>
            </dl>
          </details>
        </div>
        <div class="hero-status">
          <span class="badge">{{ statusLabel(app.status) }}</span>
          <span v-if="app.final_decision" class="badge badge--decision">Keputusan: {{
            finalDecisionLabel(app.final_decision) }}</span>
        </div>
      </header>

      <!-- ===== Langkah berikutnya ===== -->
      <section v-if="nextStep" class="next-step" :class="`next-step--${nextStep.tone}`" aria-live="polite">
        <div class="next-step-icon">
          <CheckCircle2 v-if="nextStep.tone === 'success'" :size="22" />
          <AlertCircle v-else-if="nextStep.tone === 'warning'" :size="22" />
          <Info v-else :size="22" />
        </div>
        <div class="next-step-body">
          <strong>{{ nextStep.title }}</strong>
          <p>{{ nextStep.text }}</p>
        </div>
        <button v-if="nextStep.cta" type="button" class="btn btn--primary" @click="goToTarget(nextStep.target)">
          {{ nextStep.cta }}
        </button>
      </section>

      <div v-if="error && !typeModal && !confirmationAction" class="alert alert--error" role="alert">
        <XCircle :size="18" /> {{ error }}
      </div>
      <div v-if="success" class="alert alert--success" role="status">
        <CheckCircle2 :size="18" /> {{ success }}
      </div>

      <div class="layout">
        <!-- ===== Kolom utama: tab ===== -->
        <section class="main-column">
          <nav class="tabs" role="tablist" aria-label="Bagian detail pengajuan">
            <button type="button" role="tab" :aria-selected="activeTab === 'info'"
              :class="{ active: activeTab === 'info' }" @click="activeTab = 'info'">
              Penelitian
            </button>
            <button type="button" role="tab" :aria-selected="activeTab === 'screening'"
              :class="{ active: activeTab === 'screening' }" @click="activeTab = 'screening'">
              Screening
            </button>
            <button type="button" role="tab" :aria-selected="activeTab === 'documents'"
              :class="{ active: activeTab === 'documents' }" @click="activeTab = 'documents'">
              Dokumen <span class="tab-count">{{ app.documents?.length || 0 }}</span>
            </button>
            <button type="button" role="tab" :aria-selected="activeTab === 'reviews'"
              :class="{ active: activeTab === 'reviews' }" @click="activeTab = 'reviews'">
              Hasil Review
              <span v-if="app.review_type && reviewerPendingCount" class="tab-count tab-count--alert">{{
                reviewerPendingCount }} menunggu</span>
            </button>
          </nav>

          <!-- Penelitian -->
          <article v-if="activeTab === 'info'" class="card">
            <div class="info-grid">
              <div class="info-item info-item--full">
                <span>Latar Belakang</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_background || '')" />
              </div>
              <div class="info-item info-item--full">
                <span>Tujuan Penelitian</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_objectives || '')" />
              </div>
              <div class="info-item info-item--full">
                <span>Metodologi</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.research_methodology || '')" />
              </div>
              <div class="info-item info-item--full">
                <span>Kebutuhan Data</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(app.data_needed || '')" />
              </div>
              <div class="info-item"><span>Lokasi Penelitian</span>
                <div class="rich-text-content">{{ app.research_location || '—' }}</div>
              </div>
              <div class="info-item"><span>Penanggung Jawab</span>
                <div class="rich-text-content">{{ app.person_responsible || '—' }}</div>
              </div>
              <div class="info-item"><span>Durasi Penelitian</span>
                <div class="rich-text-content">{{ app.research_duration || '—' }}</div>
              </div>
            </div>
          </article>

          <!-- Screening -->
          <article v-else-if="activeTab === 'screening'" class="card">
            <div class="screening-recommendation">
              <span>Rekomendasi sistem</span>
              <strong>{{ recommendation }}</strong>
              <small>Rekomendasi ini menjadi bahan pertimbangan dan tidak otomatis menentukan tipe review.</small>
            </div>
            <div v-if="screeningItems.length" class="screening-list">
              <div v-for="item in screeningItems" :key="item.key" class="screening-item">
                <span class="screening-number">{{ item.number }}</span>
                <p>{{ item.label }}</p>
                <strong class="answer-chip">{{ item.answer }}</strong>
              </div>
            </div>
            <p v-else class="empty-text">Jawaban screening belum tersedia pada pengajuan ini.</p>
          </article>

          <!-- Dokumen -->
          <article v-else-if="activeTab === 'documents'" class="card">
            <div v-if="app.documents?.length" class="documents">
              <div v-for="d in app.documents" :key="d.id" class="document">
                <div class="document-icon">
                  <FileText :size="18" />
                </div>
                <div class="document-info">
                  <strong>{{ d.document_type || 'Dokumen pendukung' }}</strong>
                  <span>{{ d.original_name || d.stored_name || 'Dokumen' }}</span>
                </div>
                <button class="btn btn--ghost btn--sm" type="button" @click="doc(d)">
                  <FileText :size="16" /> Buka
                </button>
              </div>
            </div>
            <p v-else class="empty-text">Tidak ada dokumen pendukung.</p>
          </article>

          <!-- Hasil review -->
          <article v-else class="card">
            <p v-if="!app.review_type" class="empty-text">Hasil review tersedia setelah jenis telaah ditetapkan.</p>
            <template v-else>
              <section class="vote-summary">
                <div class="vote-verdict">
                  <span>Hasil sementara</span>
                  <strong>{{ reviewResult }}</strong>
                </div>
                <div class="vote-bar" role="img"
                  :aria-label="`Setuju ${votes.approve}, Tolak ${votes.reject}, Belum memutuskan ${reviewerPendingCount}`">
                  <span class="vote-bar__agree" :style="{ width: voteSegments.approve }" />
                  <span class="vote-bar__reject" :style="{ width: voteSegments.reject }" />
                  <span class="vote-bar__pending" :style="{ width: voteSegments.pending }" />
                </div>
                <ul class="vote-legend">
                  <li class="vote-legend__agree">Setuju <b>{{ votes.approve }}</b></li>
                  <li class="vote-legend__reject">Tolak <b>{{ votes.reject }}</b></li>
                  <li class="vote-legend__pending">Belum memutuskan <b>{{ reviewerPendingCount }}</b></li>
                </ul>
              </section>

              <div class="reviewer-list">
                <article v-for="r in reviewerRows" :key="r.reviewer_id || r.id" class="reviewer-card">
                  <div class="reviewer-card__head">
                    <strong>{{ reviewerName(r) }}</strong>
                    <span class="status-chip" :class="`status-chip--${reviewerTone(r)}`">
                      {{ r.participation_status === 'SUBMITTED' ? reviewDecisionLabel(r.recommendation) :
                        participationStatusLabel(r.participation_status) }}
                    </span>
                  </div>
                  <div v-if="r.sla" class="sla" :class="`sla--${r.sla.tone}`">
                    <div class="sla-head">
                      <span><Clock :size="13" /> Lama pengerjaan</span>
                      <strong>Hari ke-{{ r.sla.day }} dari {{ r.sla.expected }} hari</strong>
                    </div>
                    <div class="sla-bar" role="img"
                      :aria-label="`Lama pengerjaan hari ke-${r.sla.day} dari ${r.sla.expected} hari`">
                      <span class="sla-bar__fill" :style="{ width: r.sla.percent + '%' }" />
                    </div>
                    <small v-if="r.sla.tone === 'warning'">Sudah memasuki masa kuning. Pertimbangkan mengganti
                      reviewer bila tak kunjung selesai.</small>
                    <small v-else-if="r.sla.tone === 'danger'">Melewati batas 7 hari. Segera ganti reviewer.</small>
                  </div>
                  <p v-if="r.participation_status === 'SUBMITTED' || r.participation_status === 'REVISION_REQUIRED'">
                    {{ reviewComments(r).join(' · ') || (r.recommendation === 'REVISION' ? 'Reviewer meminta perbaikan dokumen.' : 'Reviewer tidak menambahkan komentar.') }}
                  </p>
                  <p v-else-if="r.participation_status === 'REVISION_RESUBMITTED'">Dokumen pengganti telah dikirim
                    peneliti. Reviewer akan menilai ulang.</p>
                  <p v-else-if="r.participation_status === 'NOT_ASSIGNED'">Belum ditugaskan pada pengajuan ini.</p>
                  <p v-else-if="r.participation_status === 'ASSIGNMENT_PENDING'">Penugasan menunggu konfirmasi reviewer.
                  </p>
                  <p v-else-if="r.participation_status === 'ASSIGNMENT_REJECTED'">Reviewer menolak penugasan.</p>
                  <p v-else>Reviewer belum mengirimkan hasil penilaian.</p>

                  <div class="reviewer-card__foot">

                    <small>{{ r.reviewed_at ? 'Dikirim ' + formatForumDate(r.reviewed_at) : r.assignment_status ?
                      'Status penugasan: ' + r.assignment_status : 'Belum ada penugasan' }}</small>
                    <button
                      v-if="r.participation_status === 'SUBMITTED' || r.participation_status === 'REVISION_REQUIRED'"
                      type="button" class="btn btn--ghost btn--sm" @click="openReviewDetail(r)">
                      Detail penilaian
                    </button>
                    <button
                      v-if="(canReplaceRejectedAssignment && (String(r.assignment_status || '').toUpperCase() === 'REJECTED' || r.participation_status === 'ASSIGNMENT_REJECTED')) || (r.sla && r.sla.canChange)"
                      type="button" class="btn btn--warning btn--sm" :disabled="!!busy"
                      @click="openTypeModal('EXPEDITED')">
                      Ganti reviewer
                    </button>
                  </div>
                </article>
                <p v-if="!reviewerRows.length" class="empty-text">Belum ada reviewer untuk pengajuan ini.</p>
              </div>
            </template>
          </article>
        </section>

        <!-- ===== Kolom samping: tindakan ===== -->
        <aside class="side-column">
          <article id="action-panel" class="card action-card">
            <header class="card-header">
              <h2>Tindakan Ketua KEPK</h2>
            </header>

            <ol class="phases" aria-label="Tahapan penanganan">
              <li v-for="(label, index) in phases" :key="label" class="phase"
                :class="{ 'phase--done': index < currentPhase, 'phase--current': index === currentPhase }">
                <span class="phase-dot">
                  <Check v-if="index < currentPhase" :size="13" /><template v-else>{{ index + 1 }}</template>
                </span>
                <span>{{ label }}</span>
              </li>
            </ol>

            <div class="card-body">
              <!-- Tahap 1: pilih jenis telaah -->
              <template v-if="!app.review_type">
                <p class="muted">Pilih jenis telaah sesuai tingkat risiko penelitian.</p>
                <div class="type-actions">
                  <button v-for="option in typeOptions" :key="option.value" type="button" class="type-button"
                    @click="openTypeModal(option.value)">
                    <strong>{{ option.label }}</strong>
                    <span>{{ option.description }}</span>
                  </button>
                </div>
              </template>

              <template v-else>
                <div class="current-type">
                  <span>Jenis telaah</span>
                  <strong>{{ reviewTypeLabel(selectedType) }}</strong>
                  <small v-if="isFullBoard">Forum: {{ formatForumDate(app.forum_date) }}</small>
                </div>

                <div v-if="isFullBoard && app.status === 'UNDER_REVIEW'" class="forum-control">
                  <button v-if="!forumClosed" type="button" class="btn btn--ghost" :disabled="!!busy"
                    @click="run('forum', () => closeForum(id))">Tutup forum</button>
                  <p v-else class="muted">Forum telah ditutup oleh Ketua KEPK.</p>
                </div>

                <!-- Tahap 3: keputusan -->
                <form v-if="canDecide" id="decision-form" class="decision-form"
                  @submit.prevent="requestConfirmation('final-decision')">
                  <fieldset>
                    <legend>Keputusan akhir</legend>
                    <label v-for="option in availableFinalDecisionOptions" :key="option.value" class="decision-option"
                      :class="{ selected: selectedFinalDecision === option.value }">
                      <input v-model="selectedFinalDecision" type="radio" name="final-decision" :value="option.value" />
                      <span>
                        <strong>{{ option.label }}</strong>
                        <small>{{ option.description }}</small>
                      </span>
                    </label>
                  </fieldset>
                  <label for="chief-final-decision-note" class="field-label">
                    Catatan / alasan <em>{{ noteRequired ? '(wajib)' : '(opsional)' }}</em>
                  </label>
                  <textarea id="chief-final-decision-note" v-model="decisionNote" rows="4"
                    placeholder="Tuliskan alasan atau catatan keputusan..." />
                  <button class="btn btn--primary btn--block" type="submit" :disabled="!!busy">Simpan keputusan
                    akhir</button>
                </form>

                <p v-else-if="isFinished" class="muted">Keputusan akhir sudah disimpan. Lihat ringkasan di bagian atas
                  halaman.</p>
                <p v-else-if="app.status === 'REVISION_REQUIRED'" class="muted">Form keputusan terbuka kembali setelah
                  peneliti mengirim perbaikan dan review selesai.</p>
                <p v-else class="muted">
                  Form keputusan terbuka setelah review selesai.
                  <template v-if="reviewerPendingCount"> Masih ada {{ reviewerPendingCount }} reviewer yang belum
                    memutuskan.</template>
                </p>
              </template>
            </div>
          </article>

          <article v-if="chiefRevisionHistory.length" class="card">
            <header class="card-header">
              <History :size="18" />
              <h2>Riwayat revisi Ketua</h2>
            </header>
            <div class="chief-revision-list">
              <div v-for="(revision, index) in chiefRevisionHistory" :key="revision.id" class="chief-revision-item">
                <div class="chief-revision-meta">
                  <strong>Revisi {{ index + 1 }}</strong>
                  <time>{{ revision.created_at ? formatForumDate(revision.created_at) : 'Tanggal tidak tersedia'
                    }}</time>
                </div>
                <p>{{ revision.note || 'Tidak ada catatan revisi.' }}</p>
                <small>{{ revision.requested_by_name || 'Ketua KEPK' }}</small>
              </div>
            </div>
          </article>
        </aside>
      </div>

      <!-- ===== Modal detail penilaian reviewer ===== -->
      <div v-if="selectedReview" class="modal-backdrop" @click.self="selectedReview = null">
        <section class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="review-detail-title">
          <header class="modal-header">
            <div>
              <p class="hero-kicker">Penilaian reviewer</p>
              <h3 id="review-detail-title">{{ reviewerName(selectedReview) }}</h3>
              <div v-if="selectedReviewRounds.length > 1" class="round-tabs" role="tablist"
                aria-label="Riwayat penilaian reviewer">
                <button v-for="(round, index) in selectedReviewRounds" :key="round.id" type="button" role="tab"
                  :aria-selected="String(selectedReview?.id) === String(round.id)"
                  :class="{ active: String(selectedReview?.id) === String(round.id) }"
                  @click="selectReviewRound(round)">
                  Penilaian {{ round.review_cycle || index + 1 }}
                </button>
              </div>
              <p class="muted">{{ answeredReviewIndicators }} dari {{ indicatorLabels.length }} indikator terjawab</p>
            </div>
            <button type="button" class="modal-close" aria-label="Tutup detail penilaian"
              @click="selectedReview = null">×</button>
          </header>
          <div class="modal-body modal-body--scroll">
            <div class="review-meta">
              <span>Rekomendasi · Penilaian {{ selectedReview.review_cycle || 1 }}</span>
              <strong>{{ reviewDecisionLabel(selectedReview.recommendation) }}</strong>
              <small v-if="selectedReview.reviewed_at">Dikirim {{ formatForumDate(selectedReview.reviewed_at) }}</small>
            </div>

            <div v-if="selectedReviewSla" class="sla" :class="`sla--${selectedReviewSla.tone}`">
              <div class="sla-head">
                <span><Clock :size="13" /> Lama pengerjaan reviewer</span>
                <strong>Hari ke-{{ selectedReviewSla.day }} dari {{ selectedReviewSla.expected }} hari</strong>
              </div>
              <div class="sla-bar" role="img"
                :aria-label="`Lama pengerjaan hari ke-${selectedReviewSla.day} dari ${selectedReviewSla.expected} hari`">
                <span class="sla-bar__fill" :style="{ width: selectedReviewSla.percent + '%' }" />
              </div>
              <small v-if="selectedReviewSla.tone === 'success'">Pengerjaan masih dalam batas waktu wajar (&le; 4
                hari).</small>
              <small v-else-if="selectedReviewSla.tone === 'warning'">Sudah memasuki masa kuning (hari ke-5 s.d. 6).
                Pertimbangkan mengganti reviewer bila tak kunjung selesai.</small>
              <small v-else>Melewati batas 7 hari (merah). Segera ganti reviewer.</small>
            </div>

            <details v-if="selectedType === 'EXPEDITED' && revisionRequestsForReviewer(selectedReview.reviewer_id).length"
              class="revision-trail">
              <summary>Riwayat permintaan perbaikan ({{ revisionRequestsForReviewer(selectedReview.reviewer_id).length }})
              </summary>
              <article v-for="request in revisionRequestsForReviewer(selectedReview.reviewer_id)" :key="request.id">
                <small>Siklus {{ request.cycle_number }} · {{ request.status === 'OPEN' ? 'Menunggu peneliti' :
                  'Dokumen dikirim' }}</small>
                <div v-for="item in request.items || []" :key="item.id" class="revision-trail__item">
                  <b>{{ item.document_type || item.document_name || 'Dokumen' }}</b>
                  <p>{{ item.note }}</p>
                  <small v-if="item.revised_document_id">Dokumen pengganti telah diunggah</small>
                </div>
              </article>
            </details>

            <h4>Indikator penilaian</h4>

            <div class="indicator-list">
              <article v-for="(label, index) in indicatorLabels" :key="index" class="indicator">
                <span class="indicator-number">{{ index + 1 }}</span>
                <div>
                  <strong>{{ label }}</strong>
                  <span class="answer-pill"
                    :class="reviewAnswer(index + 1) === true ? 'answer-yes' : reviewAnswer(index + 1) === false ? 'answer-no' : 'answer-empty'">
                    {{ reviewAnswer(index + 1) === true ? 'Ya' : reviewAnswer(index + 1) === false ? 'Tidak' : 'Belum dijawab'
                    }}
                  </span>
                  <p v-if="reviewIndicatorComment(index + 1)">{{ reviewIndicatorComment(index + 1) }}</p>
                </div>
              </article>
            </div>
            <section class="suggestions">
              <h4>Saran reviewer</h4>
              <div><strong>Saran untuk menghindari informasi yang tidak tepat</strong>
                <p>{{ selectedReview.suggestion_information_accuracy || 'Tidak ada saran.' }}</p>
              </div>
              <div><strong>Saran terkait aspek etik lainnya</strong>
                <p>{{ selectedReview.suggestion_other_ethics || 'Tidak ada saran.' }}</p>
              </div>
            </section>
            <section class="suggestions">
              <h4>Komentar reviewer</h4>
              <p v-for="(comment, index) in reviewComments(selectedReview)" :key="index">{{ comment }}</p>
              <p v-if="!reviewComments(selectedReview).length">Tidak ada komentar umum dari reviewer.</p>
            </section>
          </div>
          <footer class="modal-footer">
            <button type="button" class="btn btn--primary" @click="selectedReview = null">Tutup</button>
          </footer>
        </section>
      </div>

      <!-- ===== Modal penetapan jenis telaah ===== -->
      <div v-if="typeModal" class="modal-backdrop" @click.self="closeTypeModal">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="type-modal-title">
          <header class="modal-header">
            <div>
              <p class="hero-kicker">{{ reviewTypeLabel(typeModal) }}</p>
              <h3 id="type-modal-title">{{ app.research_title || 'Tanpa Judul Penelitian' }}</h3>
              <p class="muted">Nomor pengajuan: {{ app.application_number || '—' }} · Peneliti: {{ researcher.name }}
              </p>
            </div>
            <button type="button" class="modal-close" aria-label="Tutup" @click="closeTypeModal">×</button>
          </header>

          <div class="modal-body">
            <template v-if="typeModal === 'EXEMPTED'">
              <p class="muted">Exempted tidak memerlukan reviewer. Tetapkan keputusan akhir sekarang.</p>
              <div class="decision-options">
                <label v-for="option in finalDecisionOptions" :key="option.value" class="decision-option"
                  :class="{ selected: selectedFinalDecision === option.value }">
                  <input v-model="selectedFinalDecision" type="radio" name="exempted-decision" :value="option.value" />
                  <span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
                </label>
              </div>
              <label for="exempted-final-note" class="field-label">Catatan / alasan <em>{{ noteRequired ? '(wajib)' :
                  '(opsional)' }}</em></label>
              <textarea id="exempted-final-note" v-model="decisionNote" rows="4"
                placeholder="Tuliskan alasan atau catatan keputusan..." />
            </template>

            <template v-else-if="typeModal === 'EXPEDITED'">
              <label for="reviewer-dropdown" class="field-label">Pilih reviewer</label>
              <select id="reviewer-dropdown" v-model="reviewerToAdd" class="field" @change="addSelectedReviewer">
                <option value="">Pilih reviewer...</option>
                <option v-for="r in assignableReviewers" :key="r.id" :value="String(r.id)"
                  :disabled="selectedReviewers.includes(String(r.id))">{{ r.name }}</option>
              </select>
              <div class="selected-reviewers">
                <span v-for="reviewerId in selectedReviewers" :key="reviewerId" class="selected-reviewer">
                  {{reviewers.find((r) => String(r.id) === reviewerId)?.name || 'Reviewer'}}
                  <button type="button" aria-label="Hapus reviewer"
                    @click="selectedReviewers = selectedReviewers.filter((rid) => rid !== reviewerId)">×</button>
                </span>
                <p v-if="!selectedReviewers.length" class="muted">Belum ada reviewer yang dipilih.</p>
              </div>
              <p v-if="!assignableReviewers.length" class="muted">Tidak ada reviewer aktif lain yang bisa ditugaskan.
              </p>
            </template>

            <template v-else>
              <label for="forum-date" class="field-label">Tanggal dan jam forum</label>
              <input id="forum-date" v-model="forumDate" class="field" type="datetime-local" />
              <small class="muted">Jadwal forum harus berada di masa depan.</small>
            </template>

            <div v-if="error" class="alert alert--error" role="alert">
              <XCircle :size="17" /><span>{{ error }}</span>
            </div>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn btn--ghost" :disabled="!!busy" @click="closeTypeModal">Batal</button>
            <button v-if="typeModal === 'EXEMPTED'" type="button" class="btn btn--primary" :disabled="!!busy"
              @click="requestConfirmation('exempted-final-decision')">Simpan keputusan</button>
            <button v-else-if="typeModal === 'EXPEDITED'" type="button" class="btn btn--primary"
              :disabled="!!busy || !selectedReviewers.length" @click="requestConfirmation('expedited-assign')">Simpan
              penugasan</button>
            <button v-else type="button" class="btn btn--primary" :disabled="!!busy"
              @click="requestConfirmation('fullboard-set')">Tetapkan Full Board</button>
          </footer>
        </section>
      </div>

      <!-- ===== Modal konfirmasi ===== -->
      <div v-if="confirmationAction && confirmationCopy" class="modal-backdrop modal-backdrop--top"
        @click.self="confirmationAction = null">
        <section class="modal modal--small" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="confirm-icon">
            <FileCheck2 :size="24" />
          </div>
          <h2 id="confirm-title">{{ confirmationCopy.title }}</h2>
          <p class="confirm-headline">{{ confirmationCopy.headline }}</p>
          <p class="muted confirm-detail">{{ confirmationCopy.detail }}</p>
          <footer class="modal-footer modal-footer--center">
            <button class="btn btn--ghost" :disabled="!!busy" @click="confirmationAction = null">Periksa lagi</button>
            <button class="btn btn--primary" :disabled="!!busy" @click="executeConfirmedAction">{{ busy ? 'Memproses...'
              :
              confirmationCopy.confirm }}</button>
          </footer>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.detail-page {
  width: 100%;
  max-width: 1226px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
  color: var(--foreground);
}

.muted {
  margin: 0;
  color: var(--muted-foreground);
  font-size: .8rem;
  line-height: 1.55;
}

.empty-text {
  margin: 0;
  padding: 28px 16px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: .84rem;
}

/* ---- tombol ---- */
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
  cursor: pointer;
  white-space: nowrap;
}

.btn:focus-visible,
.type-button:focus-visible,
.tabs button:focus-visible,
.decision-option:has(input:focus-visible) {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn--ghost {
  background: var(--card);
  border-color: var(--border);
  color: var(--primary);
}

.btn--ghost:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--color-primary-soft);
}

.btn--warning {
  background: var(--color-warning);
  color: var(--primary-foreground);
}

.btn--sm {
  min-height: 34px;
  padding: 0 11px;
  font-size: .74rem;
}

.btn--block {
  width: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.reference {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--muted);
  font-size: .74rem;
}

.reference span {
  color: var(--muted-foreground);
}

.reference code {
  font-family: monospace;
  font-weight: 700;
}

/* ---- hero ---- */
.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--gradient-primary-soft);
  box-shadow: var(--shadow-sm);
}

.hero-main {
  min-width: 0;
  flex: 1;
}

.hero-kicker {
  margin: 0 0 6px;
  color: var(--primary);
  font-size: .74rem;
  font-weight: 700;
}

.hero h1 {
  margin: 0;
  max-width: 900px;
  font-size: clamp(1.2rem, 2vw, 1.6rem);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.hero-researcher {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 12px 0 0;
  font-size: .85rem;
}

.hero-researcher>span:last-child {
  color: var(--muted-foreground);
}

.chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--primary);
  font-size: .7rem;
  font-weight: 700;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  margin-top: 12px;
  color: var(--muted-foreground);
  font-size: .78rem;
}

.hero-meta b {
  margin-right: 5px;
  color: var(--foreground);
  font-weight: 650;
}

.hero-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--color-success-soft);
  color: var(--color-success);
  font-size: .74rem;
  font-weight: 700;
  white-space: nowrap;
}

.badge--decision {
  max-width: 260px;
  white-space: normal;
  text-align: center;
  background: var(--primary-muted);
  color: var(--primary);
}

.researcher-details {
  margin-top: 14px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.researcher-details summary {
  width: fit-content;
  color: var(--primary);
  font-size: .78rem;
  font-weight: 700;
  cursor: pointer;
}

.researcher-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 18px;
  margin: 12px 0 0;
}

.researcher-grid div {
  min-width: 0;
}

.researcher-grid dt {
  margin-bottom: 3px;
  color: var(--muted-foreground);
  font-size: .7rem;
  font-weight: 700;
}

.researcher-grid dd {
  margin: 0;
  font-size: .8rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.researcher-grid__wide {
  grid-column: 1 / -1;
}

/* ---- langkah berikutnya ---- */
.next-step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
}

.next-step-icon {
  display: grid;
  place-items: center;
  flex: 0 0 42px;
  height: 42px;
  border-radius: 11px;
  background: var(--color-info-soft);
  color: var(--color-info);
}

.next-step-body {
  flex: 1;
  min-width: 0;
}

.next-step-body strong {
  display: block;
  font-size: .95rem;
}

.next-step-body p {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: .83rem;
  line-height: 1.5;
}

.next-step--warning {
  border-color: var(--color-warning-border);
  background: var(--color-warning-soft);
}

.next-step--warning .next-step-icon {
  background: var(--card);
  color: var(--color-warning);
}

.next-step--success {
  border-color: var(--color-success-border);
  background: var(--color-success-soft);
}

.next-step--success .next-step-icon {
  background: var(--card);
  color: var(--color-success);
}

.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: .82rem;
}

.alert--error {
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
}

.alert--success {
  background: var(--color-success-soft);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
}

/* ---- layout ---- */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(330px, .85fr);
  gap: 20px;
  align-items: start;
}

.main-column,
.side-column {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.side-column {
  position: sticky;
  top: 16px;
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--color-overlay-subtle);
}

.card-header h2 {
  margin: 0;
  font-size: .92rem;
  font-weight: 700;
}

.card-header svg {
  color: var(--primary);
}

.card-body {
  display: grid;
  gap: 12px;
  padding: 16px 20px 20px;
}

/* ---- tab ---- */
.tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
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
  cursor: pointer;
}

.tabs button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 800;
}

.tab-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--foreground);
  font-size: .68rem;
  font-weight: 700;
}

.tab-count--alert {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

/* ---- informasi ---- */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.info-item {
  min-width: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.info-item--full {
  grid-column: 1 / -1;
}

.info-item>span {
  display: block;
  margin-bottom: 6px;
  color: var(--primary);
  font-size: .74rem;
  font-weight: 700;
}

.rich-text-content {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: .9rem;
  line-height: 1.6;
}

/* ---- screening ---- */
.screening-recommendation {
  display: grid;
  gap: 4px;
  margin: 16px 20px 4px;
  padding: 14px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  background: var(--color-primary-soft);
}

.screening-recommendation span {
  font-size: .78rem;
  font-weight: 700;
}

.screening-recommendation strong {
  color: var(--primary);
  font-size: .9rem;
}

.screening-recommendation small {
  color: var(--muted-foreground);
  font-size: .72rem;
  line-height: 1.5;
}

.screening-list {
  display: grid;
  gap: 8px;
  padding: 12px 20px 20px;
}

.screening-item {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface);
}

.screening-number {
  color: var(--muted-foreground);
  font-size: .78rem;
  font-weight: 700;
}

.screening-item p {
  margin: 0;
  font-size: .8rem;
  line-height: 1.55;
}

.answer-chip {
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--foreground);
  font-size: .74rem;
}

/* ---- dokumen ---- */
.documents {
  display: grid;
  gap: 9px;
  padding: 16px 20px;
}

.document {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface);
}

.document:hover {
  border-color: var(--primary);
}

.document-icon {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  height: 38px;
  border-radius: 9px;
  background: var(--color-primary-soft);
  color: var(--primary);
}

.document-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 3px;
}

.document-info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: .82rem;
}

.document-info span {
  color: var(--muted-foreground);
  font-size: .72rem;
  overflow-wrap: anywhere;
}

/* ---- hasil review ---- */
.vote-summary {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.vote-verdict span {
  display: block;
  color: var(--muted-foreground);
  font-size: .74rem;
}

.vote-verdict strong {
  font-size: 1rem;
}

.vote-bar {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--muted);
}

.vote-bar span {
  display: block;
  height: 100%;
}

.vote-bar__agree {
  background: var(--color-success);
}

.vote-bar__reject {
  background: var(--color-danger);
}

.vote-bar__pending {
  background: var(--border);
}

.vote-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: .78rem;
}

.vote-legend li::before {
  content: "";
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--border);
}

.vote-legend__agree::before {
  background: var(--color-success);
}

.vote-legend__reject::before {
  background: var(--color-danger);
}

.reviewer-list {
  display: grid;
  gap: 10px;
  padding: 16px 20px 20px;
}

.reviewer-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--color-surface);
}

.reviewer-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.reviewer-card__head strong {
  font-size: .86rem;
}

.reviewer-card p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: .78rem;
  line-height: 1.55;
}

.reviewer-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.reviewer-card__foot small {
  margin-right: auto;
  color: var(--muted-foreground);
  font-size: .7rem;
}

.status-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: .7rem;
  font-weight: 700;
}

.status-chip--agree {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status-chip--reject {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.status-chip--revise {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

/* ---- lama pengerjaan (SLA) ---- */
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

.revision-trail {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}

.revision-trail summary {
  color: var(--primary);
  font-size: .76rem;
  font-weight: 700;
  cursor: pointer;
}

.revision-trail article {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.revision-trail small {
  color: var(--muted-foreground);
  font-size: .7rem;
}

.revision-trail__item {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--muted);
}

.revision-trail__item b {
  font-size: .76rem;
}

.revision-trail__item p {
  margin: 3px 0 0;
}

/* ---- panel tindakan ---- */
.phases {
  display: flex;
  margin: 0;
  padding: 14px 16px 0;
  list-style: none;
}

.phase {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: .68rem;
  font-weight: 600;
}

.phase:not(:first-child)::before {
  content: "";
  position: absolute;
  top: 12px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--border);
}

.phase--done:not(:first-child)::before,
.phase--current:not(:first-child)::before {
  background: var(--primary);
}

.phase-dot {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 2px solid var(--border);
  border-radius: 50%;
  background: var(--card);
  font-size: .7rem;
  font-weight: 800;
}

.phase--done .phase-dot {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.phase--current {
  color: var(--foreground);
}

.phase--current .phase-dot {
  border-color: var(--primary);
  color: var(--primary);
  box-shadow: 0 0 0 4px var(--color-primary-soft);
}

.type-actions {
  display: grid;
  gap: 9px;
}

.type-button {
  display: grid;
  gap: 3px;
  padding: 13px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
}

.type-button:hover {
  border-color: var(--primary);
  background: var(--color-primary-soft);
}

.type-button strong {
  font-size: .86rem;
}

.type-button span {
  color: var(--muted-foreground);
  font-size: .75rem;
  line-height: 1.45;
}

.current-type {
  display: grid;
  gap: 3px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-primary-light);
}

.current-type span,
.current-type small {
  color: var(--muted-foreground);
  font-size: .72rem;
}

.current-type strong {
  font-size: .92rem;
}

.forum-control {
  display: grid;
  gap: 8px;
}

.decision-form {
  display: grid;
  gap: 12px;
  padding-top: 4px;
  scroll-margin-top: 80px;
}

.decision-form fieldset {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.decision-form legend {
  margin-bottom: 8px;
  padding: 0;
  font-size: .84rem;
  font-weight: 700;
}

.decision-options {
  display: grid;
  gap: 8px;
}

.decision-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  cursor: pointer;
}

.decision-option.selected {
  border-color: var(--primary);
  background: var(--color-primary-soft);
}

.decision-option input {
  margin-top: 3px;
  accent-color: var(--primary);
}

.decision-option span {
  display: grid;
  gap: 3px;
}

.decision-option strong {
  font-size: .82rem;
}

.decision-option small {
  color: var(--muted-foreground);
  font-size: .72rem;
  line-height: 1.45;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: .8rem;
  font-weight: 700;
}

.field-label em {
  color: var(--muted-foreground);
  font-style: normal;
  font-weight: 500;
}

textarea,
.field {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .82rem;
}

textarea:focus,
.field:focus {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.chief-revision-list {
  display: grid;
  gap: 10px;
  padding: 14px 20px;
}

.chief-revision-item {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface);
}

.chief-revision-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: .8rem;
}

.chief-revision-meta time,
.chief-revision-item small {
  color: var(--muted-foreground);
  font-size: .72rem;
}

.chief-revision-item p {
  margin: 8px 0 5px;
  font-size: .83rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

/* ---- modal ---- */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--color-overlay);
}

.modal-backdrop--top {
  z-index: 1100;
}

.modal {
  display: flex;
  flex-direction: column;
  width: min(680px, 100%);
  max-height: 90vh;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-lg);
}

.modal--wide {
  width: min(860px, 100%);
}

.modal--small {
  width: min(420px, 100%);
  align-items: center;
  padding: 26px 24px;
  text-align: center;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0 0 6px;
  font-size: 1.05rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.modal-close {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--foreground);
  font-size: 1.25rem;
  cursor: pointer;
}

.modal-body {
  display: grid;
  gap: 12px;
  padding: 20px;
  overflow-y: auto;
}

.modal-body--scroll {
  gap: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.modal-footer--center {
  justify-content: center;
  margin-top: 20px;
  padding: 0;
  border: 0;
}

.confirm-icon {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--primary);
}

.modal--small h2 {
  margin: 0;
  font-size: 1.05rem;
}

.confirm-headline {
  margin: 10px 0 0;
  padding: 8px 12px;
  border-radius: 9px;
  background: var(--muted);
  font-size: .88rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.confirm-detail {
  margin-top: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.selected-reviewers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-reviewer {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--color-primary-soft);
  font-size: .78rem;
}

.selected-reviewer button {
  border: 0;
  background: transparent;
  color: var(--foreground);
  font-size: 1rem;
  cursor: pointer;
}

.round-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}

.round-tabs button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .76rem;
  font-weight: 650;
  cursor: pointer;
}

.round-tabs button.active {
  border-color: var(--primary);
  background: var(--color-primary-soft);
  color: var(--primary);
}

.review-meta {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--muted);
}

.review-meta span,
.review-meta small {
  color: var(--muted-foreground);
  font-size: .74rem;
}

.modal-body h4 {
  margin: 0;
  font-size: .88rem;
}

.indicator-list {
  display: grid;
  gap: 10px;
}

.indicator {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface);
}

.indicator-number {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--muted);
  font-size: .74rem;
  font-weight: 700;
}

.indicator>div {
  display: grid;
  justify-items: start;
  gap: 8px;
  min-width: 0;
}

.indicator strong,
.suggestions strong {
  font-size: .78rem;
  line-height: 1.5;
}

.indicator p,
.suggestions p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: .76rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

.answer-pill {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: .7rem;
  font-weight: 700;
}

.answer-yes {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.answer-no {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.answer-empty {
  background: var(--muted);
  color: var(--muted-foreground);
}

.suggestions {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.suggestions>div {
  display: grid;
  gap: 5px;
}

.state {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: var(--muted-foreground);
  font-size: .84rem;
}

.spin {
  color: var(--primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }
}

/* ---- responsif ---- */
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side-column {
    position: static;
    order: -1;
  }

  .researcher-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .reference {
    justify-content: center;
  }

  .hero {
    flex-direction: column;
    padding: 18px;
    gap: 14px;
  }

  .hero-status {
    align-items: flex-start;
  }

  .next-step {
    flex-direction: column;
    align-items: stretch;
  }

  .info-grid,
  .researcher-grid {
    grid-template-columns: 1fr;
  }

  .info-item {
    padding: 14px 16px;
  }

  .screening-item {
    grid-template-columns: 22px minmax(0, 1fr);
  }

  .answer-chip {
    grid-column: 2;
    width: fit-content;
  }

  .document {
    flex-wrap: wrap;
  }

  .modal-backdrop {
    padding: 12px;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .modal-footer .btn {
    width: 100%;
  }
}
</style>