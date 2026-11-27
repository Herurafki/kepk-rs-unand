<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  AlertCircle, ArrowUpDown, Ban, Check, CheckCircle2, Clock, Copy, FileText, Info, ListFilter,
  MoreVertical, Plus, Printer, RefreshCw, Save, Search, Trash2, Wallet, X,
} from 'lucide-vue-next'
import { getApiErrorMessage } from '../../services/api/error'
import {
  cancelPaymentInvoice, createPaymentInvoice, getApplicationInvoices, verifyPayment, inspectTransmedikPayment, decideInvalidRefPayment,
  getTransmedikTariffs,
  type InvoiceItem, type PaymentInvoice, type PaymentItemPayload, type TransmedikTariff, type TransmedikInspection,
} from '../../services/payment.service'
import { buildInvoiceA6Html } from '../../templates/invoiceA6'
import { getAllApplications } from '../../services/researcher/data-collection.service'
import { getDiklitApplications } from '../../services/diklit/application.service'
import { getSecretariatApplications } from '../../services/secretariat/application.service'
import { useAuthStore } from '../../stores/routes/auth'

type ApplicationOption = {
  id: string
  application_number?: string
  application_type?: string
  research_title?: string
  researcher_name?: string
  status?: string
  created_at?: string
}

// Invoice + data penelitian yang memilikinya (dipakai di daftar dan detail).
type ListedInvoice = PaymentInvoice & { application?: ApplicationOption }

type InvoiceDraftItem = {
  uid: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_percent: number
}

type RowSearch = { products: TransmedikTariff[]; loading: boolean; loaded: boolean }

const PAYMENT_STEPS = ['Invoice terbit', 'Bayar di kasir', 'Isi nomor struk', 'Terverifikasi']
const TYPE_LABELS: Record<string, string> = {
  DATA_AWAL: 'Pengambilan data awal',
  IZIN_PENELITIAN: 'Izin penelitian',
  IZIN_ETIK: 'Izin etik',
}
const STATUS_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'unpaid', label: 'Belum dibayar' },
  { key: 'pending', label: 'Menunggu verifikasi' },
  { key: 'paid', label: 'Lunas' },
  { key: 'cancelled', label: 'Dibatalkan' },
]
const PAGE_SIZE = 10
const FETCH_CONCURRENCY = 5
const MIN_SEARCH_LENGTH = 3
const SEARCH_DELAY = 350

const route = useRoute()
const auth = useAuthStore()
const isResearcher = computed(() => auth.hasRole('peneliti'))
const isDiklit = computed(() => auth.hasRole('diklit'))
const isSecretariat = computed(() => auth.hasRole('sekretariat'))
const invoiceType = computed<'RESEARCH' | 'ETHICS'>(() => isSecretariat.value ? 'ETHICS' : 'RESEARCH')
const pageTitle = computed(() => isResearcher.value ? 'Pembayaran pengajuan' : 'Kelola invoice')

// Subtotal detail: jumlah item setelah diskon per item, sebelum diskon invoice.
function subtotalAfterItemDiscount(invoice: PaymentInvoice): number {
  if (Array.isArray(invoice.items) && invoice.items.length) {
    return invoice.items.reduce((sum, item) => sum + Number(item.total || 0), 0)
  }
  // Fallback untuk respons lama yang belum menyertakan item.
  return Math.max(0, Number(invoice.subtotal || 0)
    - (Number(invoice.discount_total || 0) - Number(invoice.invoice_discount_amount || 0)))
}
const canCreateInvoice = computed(() => !isResearcher.value && (isDiklit.value || isSecretariat.value))

const applications = ref<ApplicationOption[]>([])
const invoices = ref<ListedInvoice[]>([])
const loading = ref(false)
const saving = ref(false)
const verifyingId = ref('')
const cancellingId = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const copiedId = ref('')
const receiptInputs = ref<Record<string, { nostruk: string; nosbm: string }>>({})
const inspectingInvoiceId = ref('')
const inspectionInvoiceId = ref('')
const inspectionResult = ref<TransmedikInspection | null>(null)
const inspectionError = ref('')
const showInspectionModal = ref(false)
const invalidRefDecisionLoading = ref(false)

// Daftar: filter, urutan, halaman
const statusTab = ref('all')
const typeFilter = ref('all')
const sortOrder = ref<'newest' | 'oldest'>('newest')
const listSearch = ref('')
const applicationFilterId = ref(String(route.params.applicationId || ''))
const page = ref(1)
const menuOpenId = ref('')

// Detail invoice
const detailInvoiceId = ref('')
const pendingAction = ref<'' | 'cancel' | 'pay'>('')

// Pop up terbitkan invoice
const showCreateModal = ref(false)
const createApplicationId = ref('')
const replacementInvoiceId = ref('')
const appSearch = ref('')
const appSearchInput = ref<HTMLInputElement | null>(null)
const invoiceDiscountPercent = ref(0)

// Pencarian tarif per baris
let rowSeq = 0 // harus dideklarasikan SEBELUM draftItems
const searchState = ref<Record<string, RowSearch>>({})
const activeRowUid = ref('')
const dropdownStyle = ref<Record<string, string>>({})
const searchTimers = new Map<string, number>()
const searchRequestIds = new Map<string, number>()

const draftItems = ref<InvoiceDraftItem[]>([emptyItem()])

function emptyItem(): InvoiceDraftItem {
  return { uid: `row-${++rowSeq}`, product_id: '', product_name: '', quantity: 1, unit_price: 0, discount_percent: 0 }
}

// Penelitian yang boleh ditagih sesuai peran.
const eligibleApplications = computed(() => applications.value.filter((item) => {
  if (isSecretariat.value) return item.application_type === 'IZIN_ETIK' && item.status === 'SEKRETARIS_REVIEW'
  if (isDiklit.value) {
    return ['DATA_AWAL', 'IZIN_PENELITIAN'].includes(String(item.application_type))
      && ['APPROVED', 'REQUIRED_ETHICS', 'ADMIN_APPROVED'].includes(String(item.status))
  }
  return true
}))
const visibleApplications = computed(() => {
  const query = appSearch.value.trim().toLowerCase()
  return eligibleApplications.value.filter((item) => !query || [
    item.application_number, item.research_title, item.researcher_name,
  ].some((value) => String(value || '').toLowerCase().includes(query)))
})
const createApplication = computed(() =>
  applications.value.find((item) => String(item.id) === createApplicationId.value),
)
const activeApplicationIds = computed(() => new Set(
  invoices.value.filter((invoice) => invoice.status === 'ISSUED').map((invoice) => String(invoice.application?.id)),
))
const filterApplication = computed(() =>
  applications.value.find((item) => String(item.id) === applicationFilterId.value),
)

const tabCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = { all: invoices.value.length, unpaid: 0, pending: 0, paid: 0, cancelled: 0 }
  for (const invoice of invoices.value) counts[paymentStatus(invoice).key]++
  return counts
})
const filteredInvoices = computed(() => {
  const query = listSearch.value.trim().toLowerCase()
  const time = (value?: string | null) => new Date(value || 0).getTime() || 0
  return invoices.value
    .filter((invoice) => !applicationFilterId.value || String(invoice.application?.id) === applicationFilterId.value)
    .filter((invoice) => statusTab.value === 'all' || paymentStatus(invoice).key === statusTab.value)
    .filter((invoice) => typeFilter.value === 'all' || invoice.invoice_type === typeFilter.value)
    .filter((invoice) => !query || [
      invoice.invoice_number, invoice.ref_number, invoice.application?.application_number,
      invoice.application?.research_title, invoice.application?.researcher_name,
    ].some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((x, y) => sortOrder.value === 'newest'
      ? time(y.issued_at) - time(x.issued_at)
      : time(x.issued_at) - time(y.issued_at))
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredInvoices.value.length / PAGE_SIZE)))
const pagedInvoices = computed(() => filteredInvoices.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const pageRange = computed(() => {
  const total = filteredInvoices.value.length
  return { from: total ? (page.value - 1) * PAGE_SIZE + 1 : 0, to: Math.min(total, page.value * PAGE_SIZE), total }
})
const pageNumbers = computed<(number | '…')[]>(() => {
  const last = totalPages.value
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const keep = [...new Set([1, last, page.value - 1, page.value, page.value + 1])]
    .filter((n) => n >= 1 && n <= last).sort((m, n) => m - n)
  const out: (number | '…')[] = []
  keep.forEach((n, i) => { if (i && n - keep[i - 1] > 1) out.push('…'); out.push(n) })
  return out
})

const detailInvoice = computed(() => invoices.value.find((invoice) => invoice.id === detailInvoiceId.value))
const detailList = computed(() => detailInvoice.value ? [detailInvoice.value] : [])

const draftSubtotal = computed(() => draftItems.value.reduce(
  (sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0), 0,
))
const draftItemDiscount = computed(() => draftItems.value.reduce((sum, item) => {
  const gross = Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0)
  return sum + gross * Math.min(100, Math.max(0, Number(item.discount_percent) || 0)) / 100
}, 0))
const draftInvoiceDiscount = computed(() =>
  Math.max(0, draftSubtotal.value - draftItemDiscount.value) *
  Math.min(100, Math.max(0, Number(invoiceDiscountPercent.value) || 0)) / 100,
)
const draftTotal = computed(() =>
  Math.max(0, draftSubtotal.value - draftItemDiscount.value - draftInvoiceDiscount.value),
)

// Dropdown hasil pencarian produk (baris yang sedang aktif)
const activeItem = computed(() => draftItems.value.find((item) => item.uid === activeRowUid.value))
const activeSearch = computed(() => activeItem.value ? searchState.value[activeItem.value.uid] : undefined)
const activeKeyword = computed(() => activeItem.value?.product_name.trim() ?? '')

function unwrapList<T>(response: any): T[] {
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response)) return response
  return []
}

async function loadApplications() {
  if (isResearcher.value) {
    applications.value = unwrapList<ApplicationOption>(await getAllApplications())
  } else if (isDiklit.value) {
    applications.value = unwrapList<ApplicationOption>(await getDiklitApplications())
  } else if (isSecretariat.value) {
    applications.value = unwrapList<ApplicationOption>(await getSecretariatApplications())
  }
}

// Mengumpulkan invoice dari semua penelitian. Bila backend punya endpoint
// "semua invoice", ganti isi fungsi ini dengan satu pemanggilan saja.
async function loadInvoices() {
  const targets = eligibleApplications.value
  const collected: ListedInvoice[] = []
  let failed = 0
  let cursor = 0
  async function worker() {
    while (cursor < targets.length) {
      const application = targets[cursor++]
      try {
        const response = await getApplicationInvoices(String(application.id))
        for (const invoice of response.data || []) collected.push({ ...invoice, application })
      } catch {
        failed++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, targets.length) }, worker))
  invoices.value = collected
  for (const invoice of collected) {
    if (!receiptInputs.value[invoice.id]) receiptInputs.value[invoice.id] = { nostruk: '', nosbm: '' }
  }
  if (failed) errorMessage.value = `Invoice dari ${failed} pengajuan gagal dimuat. Muat ulang untuk mencoba lagi.`
}

async function loadPage() {
  loading.value = true
  errorMessage.value = ''
  try {
    await loadApplications()
    await loadInvoices()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal memuat data pembayaran.')
  } finally {
    loading.value = false
  }
}

/* ---------- Pencarian tarif per baris ---------- */
function resetRowSearch(uid: string) {
  const timer = searchTimers.get(uid)
  if (timer) clearTimeout(timer)
  searchTimers.delete(uid)
  searchRequestIds.set(uid, (searchRequestIds.get(uid) || 0) + 1) // batalkan respons yang masih berjalan
  delete searchState.value[uid]
}

async function searchTariffs(uid: string, keyword: string) {
  const requestId = (searchRequestIds.get(uid) || 0) + 1
  searchRequestIds.set(uid, requestId)
  const previous = searchState.value[uid]
  searchState.value[uid] = { products: previous?.products || [], loading: true, loaded: false }
  try {
    const response = await getTransmedikTariffs({ namaproduk: keyword, take: 10 })
    if (searchRequestIds.get(uid) !== requestId) return
    searchState.value[uid] = { products: response.data?.products || [], loading: false, loaded: true }
  } catch (error) {
    if (searchRequestIds.get(uid) !== requestId) return
    searchState.value[uid] = { products: [], loading: false, loaded: true }
    errorMessage.value = getApiErrorMessage(error, 'Gagal mengambil katalog tarif Transmedik.')
  }
}

function scheduleSearch(item: InvoiceDraftItem) {
  const keyword = item.product_name.trim()
  const timer = searchTimers.get(item.uid)
  if (timer) clearTimeout(timer)
  searchTimers.delete(item.uid)

  if (keyword.length < MIN_SEARCH_LENGTH) {
    resetRowSearch(item.uid)
    return
  }
  searchTimers.set(item.uid, window.setTimeout(() => {
    searchTimers.delete(item.uid)
    searchTariffs(item.uid, keyword)
  }, SEARCH_DELAY))
}

function positionDropdown(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const width = Math.max(rect.width, 280)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  dropdownStyle.value = { top: `${rect.bottom + 4}px`, left: `${left}px`, width: `${width}px` }
}

function onProductInput(item: InvoiceDraftItem, event: Event) {
  const input = event.target as HTMLInputElement
  item.product_name = input.value
  item.product_id = '' // teks berubah, pilihan katalog sebelumnya tidak berlaku lagi
  activeRowUid.value = item.uid
  positionDropdown(input)
  scheduleSearch(item)
}

function onProductFocus(item: InvoiceDraftItem, event: Event) {
  if (item.product_id) return
  activeRowUid.value = item.uid
  positionDropdown(event.target as HTMLElement)
  const keyword = item.product_name.trim()
  if (keyword.length >= MIN_SEARCH_LENGTH && !searchState.value[item.uid]?.loaded) {
    searchTariffs(item.uid, keyword)
  }
}

function closeDropdown() {
  activeRowUid.value = ''
}

function selectProduct(item: InvoiceDraftItem, product: TransmedikTariff) {
  item.product_id = product.id
  item.product_name = product.name
  item.unit_price = product.price
  resetRowSearch(item.uid)
  closeDropdown()
}

function onScrollCapture(event: Event) {
  // Dropdown memakai posisi fixed, jadi tutup saat halaman/modal di-scroll (kecuali scroll di dalam dropdown).
  if ((event.target as HTMLElement)?.closest?.('.product-dropdown')) return
  if (activeRowUid.value) closeDropdown()
}

/* ---------- Pop up terbitkan invoice ---------- */
async function openCreate() {
  replacementInvoiceId.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  createApplicationId.value = ''
  appSearch.value = ''
  showCreateModal.value = true
  await nextTick()
  appSearchInput.value?.focus()
}

function resetDraft() {
  for (const item of draftItems.value) resetRowSearch(item.uid)
  closeDropdown()
  draftItems.value = [emptyItem()]
  invoiceDiscountPercent.value = 0
}

function closeCreate() {
  if (saving.value) return
  showCreateModal.value = false
  createApplicationId.value = ''
  replacementInvoiceId.value = ''
  resetDraft()
}

function chooseApplication(application: ApplicationOption) {
  if (activeApplicationIds.value.has(String(application.id))) return
  errorMessage.value = ''
  createApplicationId.value = String(application.id)
}

function changeApplication() {
  closeDropdown()
  createApplicationId.value = ''
}

function addDraftItem() {
  draftItems.value.push(emptyItem())
}

function removeDraftItem(index: number) {
  if (draftItems.value.length <= 1) return
  const [removed] = draftItems.value.splice(index, 1)
  if (removed) resetRowSearch(removed.uid)
}

function draftLineTotal(item: InvoiceDraftItem) {
  const gross = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
  return gross * (1 - Math.min(100, Math.max(0, Number(item.discount_percent) || 0)) / 100)
}

async function submitInvoice() {
  if (!createApplicationId.value) return
  const items: PaymentItemPayload[] = draftItems.value.map((item) => ({
    product_id: item.product_id.trim() || null,
    product_name: item.product_name.trim(),
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount_percent: Number(item.discount_percent || 0),
  }))
  if (items.some((item) => !item.product_id || !item.product_name || item.quantity < 1 || item.unit_price < 0)) {
    errorMessage.value = 'Cari dan pilih produk dari hasil pencarian, lalu isi jumlah serta harga di setiap baris sebelum menerbitkan invoice.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await createPaymentInvoice({
      application_id: createApplicationId.value,
      invoice_type: invoiceType.value,
      items,
      invoice_discount_percent: Number(invoiceDiscountPercent.value || 0),
      ...(replacementInvoiceId.value ? { replacement_invoice_id: replacementInvoiceId.value } : {}),
    })
    showCreateModal.value = false
    createApplicationId.value = ''
    replacementInvoiceId.value = ''
    resetDraft()
    successMessage.value = 'Invoice berhasil diterbitkan.'
    await loadInvoices()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Invoice gagal diterbitkan.')
  } finally {
    saving.value = false
  }
}

/* ---------- Tampilan ---------- */
function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number.isFinite(amount) ? amount : 0,
  )
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatShortDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function typeLabel(type?: string) {
  return (type && TYPE_LABELS[type]) || type || '—'
}

function paymentStatus(invoice: PaymentInvoice) {
  if (invoice.verification === 'verified') return { key: 'paid', label: 'Lunas', className: 'status status--success' }
  if (invoice.status === 'CANCELLED') return { key: 'cancelled', label: 'Dibatalkan', className: 'status status--muted' }
  if (invoice.nostruk || invoice.nosbm) return { key: 'pending', label: 'Menunggu verifikasi', className: 'status status--warning' }
  return { key: 'unpaid', label: 'Belum dibayar', className: 'status status--warning' }
}

function statusIcon(key: string) {
  return ({ paid: Check, pending: Info, unpaid: Clock, cancelled: X } as Record<string, any>)[key] || Info
}

// Jumlah langkah yang sudah selesai (0–4).
function stepProgress(invoice: PaymentInvoice) {
  if (invoice.verification === 'verified') return 4
  if (invoice.nostruk || invoice.nosbm) return 3
  return 1
}

function stepClass(invoice: PaymentInvoice, index: number) {
  const progress = stepProgress(invoice)
  return { 'step--done': index < progress, 'step--current': index === progress }
}

function nextStepText(invoice: PaymentInvoice) {
  if (invoice.status === 'CANCELLED' || invoice.verification === 'verified') return ''
  const hasReceipt = Boolean(invoice.nostruk || invoice.nosbm)
  if (isResearcher.value) {
    return hasReceipt
      ? 'Bukti pembayaran sudah dikirim. Jika belum terverifikasi, periksa kembali nomornya lalu kirim ulang.'
      : `Bayar ${formatMoney(invoice.total)} di kasir Transmedik, lalu isi nomor struk dan nomor bukti pembayaran di bawah.`
  }
  return hasReceipt
    ? 'Peneliti sudah mengirim bukti pembayaran. Menunggu verifikasi dari Transmedik.'
    : 'Menunggu peneliti membayar di kasir dan mengirim bukti pembayaran.'
}

// Invoice hanya bisa dibatalkan / diterbitkan ulang oleh petugas, selama belum ada bukti pembayaran.
function canCancel(invoice: PaymentInvoice) {
  return !isResearcher.value && invoice.status === 'ISSUED' &&
    invoice.verification !== 'verified' && !invoice.nostruk && !invoice.nosbm
}

function detailLabel(invoice: PaymentInvoice) {
  const needsPayment = isResearcher.value && invoice.status === 'ISSUED' && invoice.verification !== 'verified'
  return needsPayment ? 'Detail & bayar' : 'Detail'
}

function toggleMenu(id: string) {
  menuOpenId.value = menuOpenId.value === id ? '' : id
}

function closeMenu() {
  menuOpenId.value = ''
}

function resetFilters() {
  statusTab.value = 'all'
  typeFilter.value = 'all'
  listSearch.value = ''
  applicationFilterId.value = ''
}

function openDetail(id: string) {
  menuOpenId.value = ''
  pendingAction.value = ''
  detailInvoiceId.value = id
}

function closeDetail() {
  pendingAction.value = ''
  detailInvoiceId.value = ''
}

async function copyRef(invoice: PaymentInvoice) {
  try {
    await navigator.clipboard.writeText(String(invoice.ref_number))
    copiedId.value = invoice.id
    if (!detailInvoiceId.value) successMessage.value = 'Nomor referensi disalin.'
    setTimeout(() => { if (copiedId.value === invoice.id) copiedId.value = '' }, 1800)
  } catch {
    errorMessage.value = 'Tidak dapat menyalin. Salin nomor referensi secara manual.'
  }
}

/* ---------- Aksi pada invoice ---------- */
function askConfirmPay(invoice: PaymentInvoice) {
  const input = receiptInputs.value[invoice.id]
  if (!input?.nostruk.trim() || !input?.nosbm.trim()) {
    errorMessage.value = 'Isi nomor struk dan nomor bukti pembayaran terlebih dahulu.'
    return
  }
  errorMessage.value = ''
  pendingAction.value = 'pay'
}

async function submitReceipt(invoice: PaymentInvoice) {
  const input = receiptInputs.value[invoice.id]
  if (!input?.nostruk.trim() || !input?.nosbm.trim()) {
    errorMessage.value = 'Isi nomor struk dan nomor bukti pembayaran terlebih dahulu.'
    return
  }
  verifyingId.value = invoice.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await verifyPayment(invoice.id, {
      nostruk: input.nostruk.trim(),
      nosbm: input.nosbm.trim(),
    })
    if (response.data?.verification === 'verified') {
      successMessage.value = 'Pembayaran berhasil diverifikasi oleh Transmedik.'
    } else {
      errorMessage.value = 'Pembayaran belum dapat diverifikasi. Periksa kembali nomor struk dan nomor bukti pembayaran.'
    }
    await loadInvoices()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Verifikasi pembayaran gagal.')
  } finally {
    verifyingId.value = ''
    pendingAction.value = ''
  }
}


async function inspectInvoiceWithTransmedik(invoice: PaymentInvoice) {
  inspectionInvoiceId.value = String(invoice.id)
  inspectingInvoiceId.value = invoice.id
  inspectionError.value = ''
  inspectionResult.value = null
  showInspectionModal.value = true
  try {
    const response = await inspectTransmedikPayment(invoice.id)
    inspectionResult.value = response.data
  } catch (error) {
    inspectionError.value = getApiErrorMessage(error, 'Gagal mengambil data pembayaran dari Transmedik.')
  } finally {
    inspectingInvoiceId.value = ''
  }
}


/* ---------- Verifikasi Transmedik: tampilan ---------- */
type CheckItem = { label: string; ok: boolean }

const verdict = computed(() => {
  const c = inspectionResult.value?.comparison
  if (!c) return null
  const refOk = Boolean(c.ref_number.matches)
  const totalOk = Boolean(c.total_tagihan.matches)
  if (refOk && totalOk) {
    return {
      tone: 'success' as const,
      title: 'Ref Number dan Total Tagihan cocok',
      text: 'Data dari Transmedik sesuai dengan invoice KEPK.',
    }
  }
  const diffs: string[] = []
  if (!refOk) diffs.push('Ref Number')
  if (!totalOk) diffs.push('Total Tagihan')
  return {
    tone: 'danger' as const,
    title: `${diffs.join(' dan ')} tidak cocok`,
    text: 'Periksa perbedaan di bawah sebelum mengambil keputusan.',
  }
})

const mainChecks = computed(() => {
  const c = inspectionResult.value?.comparison
  if (!c) return []
  return [
    {
      key: 'ref',
      label: 'Ref Number',
      hint: 'Nomor referensi yang disebutkan peneliti ke kasir',
      expected: String(c.ref_number.expected || '—'),
      received: String(c.ref_number.received || '—'),
      matches: Boolean(c.ref_number.matches),
    },
    {
      key: 'total',
      label: 'Total Tagihan',
      hint: 'Nilai tagihan dalam rupiah',
      expected: formatMoney(c.total_tagihan.expected),
      received: c.total_tagihan.received === null ? '—' : formatMoney(c.total_tagihan.received),
      matches: Boolean(c.total_tagihan.matches),
    },
  ]
})

const receiptChecks = computed(() => {
  const c = inspectionResult.value?.comparison
  if (!c) return []
  return [
    {
      key: 'nostruk', label: 'No. Struk',
      expected: String(c.nostruk.expected || '—'), received: String(c.nostruk.received || '—'),
      matches: Boolean(c.nostruk.matches),
    },
    {
      key: 'nosbm', label: 'No. Bukti Pembayaran',
      expected: String(c.nosbm.expected || '—'), received: String(c.nosbm.received || '—'),
      matches: Boolean(c.nosbm.matches),
    },
  ]
})

const remoteIsPaid = computed(() => {
  const v: any = inspectionResult.value?.comparison?.is_lunas
  return v === true || v === 'true' || v === 1 || v === '1'
})

// Syarat persetujuan manual oleh DIKLIT, sesuai status verifikasi terakhir.
const approvalChecks = computed<CheckItem[]>(() => {
  const c = inspectionResult.value?.comparison
  if (!c) return []
  const status = inspectionResult.value?.invoice.payment_status
  const hasRef = Boolean(c.ref_number.received)

  if (status === '01_INVALID_NOM') {
    return [
      { label: 'Transmedik mengirim Ref Number', ok: hasRef },
      { label: 'Ref Number Transmedik sama dengan invoice KEPK', ok: hasRef && Boolean(c.ref_number.matches) },
    ]
  }
  if (status === '01_INVALID_REF') {
    return [
      { label: 'Transmedik mengirim Ref Number', ok: hasRef },
      { label: 'Ref Number memang berbeda (penyebab status INVALID_REF)', ok: hasRef && !c.ref_number.matches },
      { label: 'Total tagihan cocok', ok: Boolean(c.total_tagihan.matches) },
      { label: 'Nomor struk cocok', ok: Boolean(c.nostruk.matches) },
      { label: 'Nomor bukti pembayaran cocok', ok: Boolean(c.nosbm.matches) },
      { label: 'Transaksi lunas di Transmedik', ok: remoteIsPaid.value },
      { label: 'Sisa tagihan Rp 0', ok: Number(c.sisa_tagihan) === 0 },
    ]
  }
  return []
})

const canApproveInvalidRefManually = computed(() =>
  approvalChecks.value.length > 0 && approvalChecks.value.every((item) => item.ok),
)

const approvalHint = computed(() => {
  const status = inspectionResult.value?.invoice.payment_status
  if (status === '01_INVALID_NOM') return 'Untuk INVALID_NOM, cukup pastikan Ref Number Transmedik sama dengan invoice KEPK.'
  if (status === '01_INVALID_REF') return 'Untuk INVALID_REF, semua syarat di bawah harus terpenuhi.'
  return ''
})

// Respons Transmedik dibuat daftar "label: nilai" agar mudah dibaca.
function humanizeKey(key: string) {
  const text = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  return String(value)
}

function flattenData(value: unknown, path: string[] = [], depth = 0): { label: string; value: string }[] {
  const label = path.join(' › ')
  if (Array.isArray(value)) {
    if (!value.length) return label ? [{ label, value: '—' }] : []
    if (value.every((v) => v === null || typeof v !== 'object')) {
      return [{ label, value: value.map(displayValue).join(', ') }]
    }
    return value.flatMap((v, i) => flattenData(v, [...path, `Item ${i + 1}`], depth + 1))
  }
  if (value && typeof value === 'object') {
    if (depth >= 4) return [{ label, value: JSON.stringify(value) }]
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, v]) => flattenData(v, [...path, humanizeKey(key)], depth + 1))
  }
  return [{ label: label || 'Nilai', value: displayValue(value) }]
}

const transmedikRows = computed(() => {
  const data = inspectionResult.value
  if (!data) return []
  return flattenData(data.transmedik)
})

const metadataRows = computed(() => {
  const data = inspectionResult.value
  if (!data?.metadata) return []
  return flattenData(data.metadata)
})

const rawJson = computed(() => JSON.stringify(
  { metadata: inspectionResult.value?.metadata, response: inspectionResult.value?.transmedik }, null, 2,
))

async function submitInvalidRefDecision(decision: 'APPROVE' | 'REJECT') {
  const invoiceId = inspectionInvoiceId.value
  if (!invoiceId) {
    inspectionError.value = 'Invoice tidak ditemukan. Tutup detail lalu buka kembali invoice ini.'
    return
  }
  invalidRefDecisionLoading.value = true
  inspectionError.value = ''
  try {
    const response = await decideInvalidRefPayment(invoiceId, { decision })
    showInspectionModal.value = false
    inspectionResult.value = null
    inspectionInvoiceId.value = ''
    await loadInvoices()
    successMessage.value = decision === 'APPROVE'
      ? 'Pembayaran disetujui secara manual oleh DIKLIT. Status invoice sekarang lunas.'
      : 'Bukti pembayaran ditolak. Status invoice dikembalikan menjadi belum dibayar dan peneliti dapat mengirim ulang bukti.'
    if (response.data?.decision) errorMessage.value = ''
  } catch (error) {
    inspectionError.value = getApiErrorMessage(error, 'Keputusan pembayaran gagal disimpan.')
  } finally {
    invalidRefDecisionLoading.value = false
  }
}

async function cancelInvoice(invoice: ListedInvoice) {
  cancellingId.value = invoice.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await cancelPaymentInvoice(invoice.id)
    const applicationId = invoice.application?.id || invoice.application_id
    closeDetail()
    await loadInvoices()
    if (applicationId) {
      replacementInvoiceId.value = invoice.id
      createApplicationId.value = String(applicationId)
      appSearch.value = ''
      resetDraft()
      showCreateModal.value = true
      successMessage.value = 'Invoice lama dibatalkan. Pilih produk baru untuk menerbitkan invoice pengganti.'
    } else {
      successMessage.value = 'Invoice berhasil dibatalkan.'
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Invoice gagal dibatalkan.')
  } finally {
    cancellingId.value = ''
  }
}

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function printInvoice(invoice: ListedInvoice) {
  const content = buildInvoiceA6Html(invoice, {
    formatMoney,
    fallbackResearcher: auth.user?.name || '-',
  })

  const printWindow = window.open('', '_blank', 'width=500,height=700')
  if (!printWindow) {
    errorMessage.value = 'Pop-up diblokir browser. Izinkan pop-up untuk mencetak invoice.'
    return
  }
  printWindow.document.open()
  printWindow.document.write(content)
  printWindow.document.close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (activeRowUid.value) closeDropdown()
  else if (menuOpenId.value) closeMenu()
  else if (showCreateModal.value) closeCreate()
  else if (detailInvoiceId.value) closeDetail()
}

onMounted(() => {
  loadPage()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('click', closeMenu)
  window.addEventListener('scroll', onScrollCapture, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('click', closeMenu)
  window.removeEventListener('scroll', onScrollCapture, true)
  searchTimers.forEach((timer) => clearTimeout(timer))
  document.body.style.overflow = ''
})
watch([detailInvoiceId, showCreateModal], () => {
  document.body.style.overflow = detailInvoiceId.value || showCreateModal.value ? 'hidden' : ''
})
watch([statusTab, typeFilter, sortOrder, listSearch, applicationFilterId], () => { page.value = 1 })
watch(totalPages, (n) => { if (page.value > n) page.value = n })
</script>

<template>
  <main class="payments-page">
    <header class="page-heading">
      <div>
        <h1>{{ pageTitle }}</h1>
        <p class="subtitle">
          {{ isResearcher
            ? 'Lihat semua tagihan penelitianmu, bayar di kasir, lalu konfirmasi pembayarannya.'
            : 'Pantau semua invoice, terbitkan invoice baru, dan batalkan atau terbitkan ulang bila ada kesalahan.' }}
        </p>
      </div>
      <button class="button button--secondary" type="button" :disabled="loading" @click="loadPage">
        <RefreshCw :size="16" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="errorMessage && !showCreateModal && !detailInvoiceId" class="alert alert--error" role="alert">
      <AlertCircle :size="18" /><span>{{ errorMessage }}</span>
      <button class="alert-close" type="button" aria-label="Tutup pesan" @click="errorMessage = ''">
        <X :size="16" />
      </button>
    </div>
    <div v-if="successMessage && !showCreateModal && !detailInvoiceId" class="alert alert--success" role="status">
      <CheckCircle2 :size="18" /><span>{{ successMessage }}</span>
      <button class="alert-close" type="button" aria-label="Tutup pesan" @click="successMessage = ''">
        <X :size="16" />
      </button>
    </div>

    <!-- Daftar semua invoice -->
    <section class="invoice-section" aria-label="Daftar invoice">
      <div v-if="invoices.length" class="tabs" role="tablist">
        <button v-for="tab in STATUS_TABS" :key="tab.key" class="tab" type="button" role="tab"
          :aria-selected="statusTab === tab.key" @click="statusTab = tab.key">
          {{ tab.label }} <span class="tab-count">{{ tabCounts[tab.key] }}</span>
        </button>
      </div>

      <div v-if="invoices.length || canCreateInvoice" class="filter-row">
        <template v-if="invoices.length">
          <label class="chip chip--search">
            <Search :size="15" />
            <input v-model="listSearch" type="search" aria-label="Cari invoice"
              :placeholder="isResearcher ? 'Cari invoice atau judul penelitian' : 'Cari invoice, penelitian, atau peneliti'" />
          </label>
          <!-- <label :class="['chip', { 'is-active': typeFilter !== 'all' }]">
            <ListFilter :size="15" />
            <select v-model="typeFilter" aria-label="Filter jenis invoice">
              <option value="all">Semua jenis</option>
              <option value="RESEARCH">Penelitian</option>
              <option value="ETHICS">Etik</option>
            </select>
          </label> -->
          <label class="chip">
            <ArrowUpDown :size="15" />
            <select v-model="sortOrder" aria-label="Urutkan invoice">
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </label>
          <button v-if="filterApplication" class="chip is-active chip--button" type="button"
            @click="applicationFilterId = ''">
            Pengajuan {{ filterApplication.application_number || filterApplication.id }}
            <X :size="14" />
          </button>
        </template>
        <button v-if="canCreateInvoice" class="button button--primary" type="button" @click="openCreate">
          <Plus :size="16" /> Terbitkan invoice
        </button>
      </div>

      <div v-if="loading" class="state">
        <RefreshCw :size="24" class="spin" />Memuat invoice…
      </div>
      <div v-else-if="!invoices.length" class="state">
        <FileText :size="28" />
        <span>Belum ada invoice.</span>
        <small v-if="canCreateInvoice">Pilih Terbitkan invoice untuk membuat invoice pertama.</small>
        <small v-else-if="isResearcher">Invoice akan muncul di sini setelah diterbitkan oleh petugas.</small>
      </div>

      <template v-else>
        <div class="list-card">
          <table v-if="filteredInvoices.length" class="list-table">
            <thead>
              <tr>
                <th>Total tagihan</th>
                <th>Nomor invoice</th>
                <th>Penelitian</th>
                <th>Tanggal terbit</th>
                <th class="col-action">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="invoice in pagedInvoices" :key="invoice.id"
                :class="{ 'is-cancelled': invoice.status === 'CANCELLED' }" @click="openDetail(invoice.id)">
                <td data-label="Total tagihan">
                  <div class="cell-amount">
                    <strong>{{ formatMoney(invoice.total) }}</strong>
                    <span :class="paymentStatus(invoice).className">
                      <component :is="statusIcon(paymentStatus(invoice).key)" :size="14" /> {{
                        paymentStatus(invoice).label }}
                    </span>
                  </div>
                </td>
                <td data-label="Nomor invoice">
                  <div>
                    <button class="link-button" type="button" @click.stop="openDetail(invoice.id)">{{
                      invoice.invoice_number }}</button>
                    <small class="cell-sub">{{ invoice.invoice_type === 'RESEARCH' ? 'Invoice penelitian' : 'Invoice etik' }}</small>
                  </div>
                </td>
                <td data-label="Penelitian">
                  <div class="cell-research">
                    <span class="cell-title">{{ invoice.application?.research_title || 'Tanpa judul' }}</span>
                    <small class="cell-sub">
                      {{ invoice.application?.application_number || '—' }}<template
                        v-if="!isResearcher && invoice.application?.researcher_name"> · {{
                          invoice.application.researcher_name }}</template>
                    </small>
                  </div>
                </td>
                <td data-label="Tanggal terbit">{{ formatShortDate(invoice.issued_at) }}</td>
                <td class="col-action">
                  <div class="menu">
                    <button class="icon-button icon-button--ghost" type="button" aria-label="Aksi invoice"
                      aria-haspopup="menu" :aria-expanded="menuOpenId === invoice.id"
                      @click.stop="toggleMenu(invoice.id)">
                      <MoreVertical :size="18" />
                    </button>
                    <div v-if="menuOpenId === invoice.id" class="menu-list" role="menu">
                      <button type="button" role="menuitem" @click.stop="openDetail(invoice.id)">{{ detailLabel(invoice)
                        }}</button>
                      <button type="button" role="menuitem" @click.stop="printInvoice(invoice); closeMenu()">Cetak
                        invoice</button>
                      <button type="button" role="menuitem" @click.stop="copyRef(invoice); closeMenu()">Salin nomor
                        referensi</button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="list-empty">
            <span>Tidak ada invoice yang cocok dengan filter.</span>
            <button class="text-button" type="button" @click="resetFilters">Reset filter</button>
          </div>
          <div class="list-foot">{{ filteredInvoices.length }} hasil</div>
        </div>

        <nav v-if="totalPages > 1" class="pager" aria-label="Halaman">
          <span>Menampilkan hasil <strong>{{ pageRange.from }}–{{ pageRange.to }}</strong> dari {{ pageRange.total
            }}</span>
          <div class="pager-pages">
            <button class="pager-btn" type="button" aria-label="Halaman sebelumnya" :disabled="page === 1"
              @click="page--">‹</button>
            <template v-for="(n, i) in pageNumbers" :key="i">
              <span v-if="n === '…'" class="pager-gap">…</span>
              <button v-else class="pager-btn" type="button" :aria-current="n === page ? 'page' : undefined"
                @click="page = n">{{ n }}</button>
            </template>
            <button class="pager-btn" type="button" aria-label="Halaman berikutnya" :disabled="page === totalPages"
              @click="page++">›</button>
          </div>
        </nav>
      </template>
    </section>

    <!-- Pop up terbitkan invoice -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreate">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <header class="modal-head">
          <div>
            <h2 id="create-title">Terbitkan invoice</h2>
            <p>{{ createApplication ? 'Langkah 2 dari 2 · Isi rincian invoice' : 'Langkah 1 dari 2 · Pilih penelitian'
              }}
            </p>
          </div>
          <button class="icon-button" type="button" aria-label="Tutup" @click="closeCreate">
            <X :size="18" />
          </button>
        </header>

        <div class="modal-body">
          <div v-if="errorMessage" class="alert alert--error" role="alert">
            <AlertCircle :size="18" /><span>{{ errorMessage }}</span>
            <button class="alert-close" type="button" aria-label="Tutup pesan" @click="errorMessage = ''">
              <X :size="16" />
            </button>
          </div>
          <div v-if="successMessage" class="alert alert--success" role="status">
            <CheckCircle2 :size="18" /><span>{{ successMessage }}</span>
            <button class="alert-close" type="button" aria-label="Tutup pesan" @click="successMessage = ''">
              <X :size="16" />
            </button>
          </div>

          <!-- Langkah 1: cari penelitian -->
          <template v-if="!createApplication">
            <label class="search-field">
              <Search :size="16" />
              <input ref="appSearchInput" v-model="appSearch" type="search" aria-label="Cari penelitian"
                placeholder="Cari nomor pengajuan, judul, atau nama peneliti" />
            </label>
            <p class="hint">{{ visibleApplications.length }} penelitian ditemukan</p>
            <ul v-if="visibleApplications.length" class="app-results">
              <li v-for="application in visibleApplications" :key="application.id">
                <button class="app-option" type="button" :disabled="activeApplicationIds.has(String(application.id))"
                  @click="chooseApplication(application)">
                  <span class="app-option__title">{{ application.research_title || 'Tanpa judul' }}</span>
                  <span class="app-option__meta">
                    {{ application.application_number || ('Pengajuan #' + application.id) }} · {{
                      application.researcher_name || '—' }} · {{ typeLabel(application.application_type) }}
                  </span>
                  <span v-if="activeApplicationIds.has(String(application.id))" class="app-option__note">
                    Sudah punya invoice aktif. Batalkan atau terbitkan ulang dari daftar.
                  </span>
                </button>
              </li>
            </ul>
            <div v-else class="list-empty">Tidak ada penelitian yang cocok dengan pencarian.</div>
          </template>

          <!-- Langkah 2: rincian invoice -->
          <template v-else>
            <div class="chosen-app">
              <div>
                <strong>{{ createApplication.research_title || 'Tanpa judul' }}</strong>
                <small>
                  {{ createApplication.application_number || ('Pengajuan #' + createApplication.id) }} · {{
                    createApplication.researcher_name || '—' }} · {{ typeLabel(createApplication.application_type) }}
                </small>
              </div>
              <button v-if="!replacementInvoiceId" class="text-button" type="button" @click="changeApplication">Ganti penelitian</button>
            </div>

            <div class="items-table-wrap">
              <table class="items-table draft-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Jumlah</th>
                    <th>Harga satuan</th>
                    <th>Diskon (%)</th>
                    <th class="numeric">Total</th>
                    <th><span class="sr-only">Hapus</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in draftItems" :key="item.uid">
                    <td data-label="Produk" class="cell-product">
                      <div class="product-field">
                        <input :value="item.product_name" type="text" autocomplete="off"
                          aria-label="Cari produk" aria-autocomplete="list"
                          placeholder="Ketik min. 3 huruf nama produk"
                          :class="{ 'is-selected': item.product_id }"
                          @input="onProductInput(item, $event)" @focus="onProductFocus(item, $event)"
                          @blur="closeDropdown" />
                        <RefreshCw v-if="searchState[item.uid]?.loading" :size="14"
                          class="spin product-field__spinner" />
                        <Check v-else-if="item.product_id" :size="14" class="product-field__check" />
                      </div>
                    </td>
                    <td data-label="Jumlah"><input v-model.number="item.quantity" type="number" min="1"
                        aria-label="Jumlah" /></td>
                    <td data-label="Harga satuan"><input v-model.number="item.unit_price" type="number" min="0"
                        aria-label="Harga satuan" /></td>
                    <td data-label="Diskon (%)"><input v-model.number="item.discount_percent" type="number" min="0"
                        max="100" aria-label="Diskon persen" /></td>
                    <td data-label="Total" class="numeric">{{ formatMoney(draftLineTotal(item)) }}</td>
                    <td class="cell-action">
                      <button class="icon-button" type="button" title="Hapus baris" aria-label="Hapus baris"
                        :disabled="draftItems.length === 1" @click="removeDraftItem(index)">
                        <Trash2 :size="16" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button class="text-button" type="button" @click="addDraftItem">
              <Plus :size="15" /> Tambah baris
            </button>

            <div class="totals-row">
              <label class="discount-field">Diskon seluruh invoice (%)
                <input v-model.number="invoiceDiscountPercent" type="number" min="0" max="100" />
              </label>
              <dl class="summary-box">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{{ formatMoney(draftSubtotal) }}</dd>
                </div>
                <div>
                  <dt>Diskon</dt>
                  <dd>– {{ formatMoney(draftItemDiscount + draftInvoiceDiscount) }}</dd>
                </div>
                <div class="summary-box__total">
                  <dt>Total tagihan</dt>
                  <dd>{{ formatMoney(draftTotal) }}</dd>
                </div>
              </dl>
            </div>
          </template>
        </div>

        <footer class="modal-foot">
          <button class="button button--secondary" type="button" @click="closeCreate">Batal</button>
          <button v-if="createApplication" class="button button--primary" type="button" :disabled="saving"
            @click="submitInvoice">
            <Save :size="16" /> {{ saving ? 'Menerbitkan…' : 'Terbitkan invoice' }}
          </button>
        </footer>

        <!-- Dropdown hasil pencarian produk (satu untuk semua baris) -->
        <div v-if="showCreateModal && createApplication && activeItem && !activeItem.product_id"
          class="product-dropdown" :style="dropdownStyle" role="listbox" @mousedown.prevent>
          <p v-if="activeKeyword.length < MIN_SEARCH_LENGTH" class="product-dropdown__note">
            Ketik minimal 3 huruf untuk mencari produk.
          </p>
          <ul v-else-if="activeSearch?.products.length">
            <li v-for="product in activeSearch.products" :key="product.id">
              <button type="button" role="option" class="product-dropdown__option"
                @click="selectProduct(activeItem, product)">
                <span>{{ product.name }}</span>
                <strong>{{ formatMoney(product.price) }}</strong>
              </button>
            </li>
          </ul>
          <p v-else-if="activeSearch?.loading" class="product-dropdown__note">Mencari…</p>
          <p v-else-if="activeSearch?.loaded" class="product-dropdown__note">Tidak ada produk yang cocok.</p>
        </div>
      </div>
    </div>

    <!-- Detail invoice -->
    <div v-for="invoice in detailList" :key="invoice.id" class="drawer-overlay" @click.self="closeDetail">
      <aside class="drawer" role="dialog" aria-modal="true" :aria-label="'Detail invoice ' + invoice.invoice_number">
        <header class="drawer-head">
          <div class="invoice-title">
            <span class="icon-tile">
              <FileText :size="19" />
            </span>
            <div>
              <strong>{{ invoice.invoice_number }}</strong>
              <small>{{ invoice.invoice_type === 'RESEARCH' ? 'Invoice penelitian' : 'Invoice etik' }} · diterbitkan {{
                formatDate(invoice.issued_at) }}</small>
            </div>
          </div>
          <div class="drawer-head__side">
            <span :class="paymentStatus(invoice).className">
              <component :is="statusIcon(paymentStatus(invoice).key)" :size="14" /> {{ paymentStatus(invoice).label }}
            </span>
            <button class="icon-button" type="button" aria-label="Tutup detail" @click="closeDetail">
              <X :size="18" />
            </button>
          </div>
        </header>

        <div class="drawer-body">
          <div v-if="errorMessage" class="alert alert--error" role="alert">
            <AlertCircle :size="18" /><span>{{ errorMessage }}</span>
            <button class="alert-close" type="button" aria-label="Tutup pesan" @click="errorMessage = ''">
              <X :size="16" />
            </button>
          </div>
          <div v-if="successMessage" class="alert alert--success" role="status">
            <CheckCircle2 :size="18" /><span>{{ successMessage }}</span>
            <button class="alert-close" type="button" aria-label="Tutup pesan" @click="successMessage = ''">
              <X :size="16" />
            </button>
          </div>

          <div v-if="invoice.application" class="app-block">
            <span>Penelitian</span>
            <strong>{{ invoice.application.research_title || 'Tanpa judul' }}</strong>
            <small>
              {{ invoice.application.application_number || '—' }} · {{ invoice.application.researcher_name ||
                auth.user?.name || '—' }} · {{ typeLabel(invoice.application.application_type) }}
            </small>
          </div>

          <ol v-if="invoice.status !== 'CANCELLED'" class="steps" aria-label="Tahapan pembayaran">
            <li v-for="(label, index) in PAYMENT_STEPS" :key="label" class="step" :class="stepClass(invoice, index)">
              <span class="step__dot">
                <Check v-if="index < stepProgress(invoice)" :size="13" /><template v-else>{{ index + 1 }}</template>
              </span>
              <span class="step__label">{{ label }}</span>
            </li>
          </ol>

          <p v-if="nextStepText(invoice)" class="next-step">{{ nextStepText(invoice) }}</p>

          <aside class="summary-panel">
            <p class="summary-panel__label">Total tagihan</p>
            <p class="summary-panel__amount">{{ formatMoney(invoice.total) }}</p>
            
            <div class="ref-box">
              <div>
                <span>Nomor referensi</span>
                <strong>{{ invoice.ref_number }}</strong>
              </div>
              <button class="icon-button" type="button" aria-label="Salin nomor referensi" title="Salin nomor referensi"
                @click="copyRef(invoice)">
                <Check v-if="copiedId === invoice.id" :size="16" />
                <Copy v-else :size="16" />
              </button>
            </div>
            <small class="ref-hint">Sebutkan nomor ini ke kasir saat membayar.</small>
          </aside>

          <div class="items-table-wrap">
            <table class="items-table invoice-items">
              <thead>
                <tr>
                  <th>Produk / layanan</th>
                  <th>Jumlah</th>
                  <th>Harga satuan</th>
                  <th>Diskon</th>
                  <th class="numeric">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in invoice.items" :key="item.id">
                  <td data-label="Produk" class="cell-product">{{ item.product_name }}</td>
                  <td data-label="Jumlah">{{ item.quantity }}</td>
                  <td data-label="Harga satuan">{{ formatMoney(item.unit_price) }}</td>
                  <td data-label="Diskon">{{ Number(item.discount_percent || 0) }}%</td>
                  <td data-label="Total" class="numeric">{{ formatMoney(item.total) }}</td>
                </tr>
              </tbody>
            </table>
            <dl class="summary-lines">
              <div>
                <dt>Subtotal (setelah diskon item)</dt>
                <dd>{{ formatMoney(subtotalAfterItemDiscount(invoice)) }}</dd>
              </div>
              <div>
                <dt>Diskon invoice<template v-if="Number(invoice.invoice_discount_percent)"> ({{
                  invoice.invoice_discount_percent }}%)</template>
                </dt>
                <dd>– {{ formatMoney(invoice.invoice_discount_amount) }}</dd>
              </div>
              <div>
                <dt>Total tagihan</dt>
                <dd style="color: var(--primary);">{{ formatMoney(invoice.total) }}</dd>
              </div>
            </dl>
          </div>

          <div v-if="isResearcher && invoice.status === 'ISSUED' && invoice.verification !== 'verified'"
            class="payment-form">
            <div class="payment-form-heading">
              <Wallet :size="18" />
              <div>
                <strong>Konfirmasi pembayaran</strong>
                <p>Isi kedua nomor yang tercetak pada struk dari kasir Transmedik.</p>
              </div>
            </div>
            <div class="receipt-fields">
              <label>Nomor struk
                <input v-model="receiptInputs[invoice.id].nostruk" placeholder="Contoh: NL26100001"
                  autocomplete="off" />
              </label>
              <label>Nomor bukti pembayaran
                <input v-model="receiptInputs[invoice.id].nosbm" placeholder="Contoh: RV-26100001001"
                  autocomplete="off" />
              </label>
            </div>
            <button class="button button--primary" type="button" :disabled="verifyingId === invoice.id"
              @click="askConfirmPay(invoice)">
              <CheckCircle2 :size="16" /> Konfirmasi pembayaran
            </button>
          </div>

          <div v-if="invoice.verification === 'verified'" class="verified-details">
            <CheckCircle2 :size="18" />
            <div>
              <strong>Pembayaran terverifikasi</strong>
              <p>{{ invoice.status_pembayaran || 'LUNAS' }} · {{ formatDate(invoice.tgl_pembayaran) }}</p>
              <small>Struk: {{ invoice.nostruk || '—' }} · Bukti: {{ invoice.nosbm || '—' }}</small>
            </div>
          </div>
          <div v-else-if="invoice.payment_status" class="payment-result">
            <strong>Hasil verifikasi terakhir: {{ invoice.payment_status }}</strong>
            <span>{{ invoice.keterangan || 'Pembayaran belum berhasil diverifikasi.' }}</span>
          </div>

          <div v-if="isDiklit && invoice.status === 'ISSUED' && ['01_INVALID_REF', '01_INVALID_NOM'].includes(invoice.payment_status || '')"
            class="inspection-callout">
            <div>
              <strong>{{ invoice.payment_status === '01_INVALID_REF' ? 'Ref Number tidak cocok' : 'Nomor struk / bukti tidak cocok' }}</strong>
              <p>Bandingkan Ref Number, Total Tagihan, nomor struk, dan bukti pembayaran dengan data Transmedik.</p>
            </div>
            <button class="button button--primary" type="button"
              :disabled="inspectingInvoiceId === invoice.id"
              @click="inspectInvoiceWithTransmedik(invoice)">
              <RefreshCw :size="16" :class="{ spin: inspectingInvoiceId === invoice.id }" />
              {{ inspectingInvoiceId === invoice.id ? 'Memeriksa…' : 'Verifikasi Transmedik' }}
            </button>
          </div>
        </div>

        <footer class="drawer-foot">
          <div v-if="pendingAction" :class="['confirm-box', { 'confirm-box--pay': pendingAction === 'pay' }]"
            role="alertdialog">
            <p v-if="pendingAction === 'pay'">
              <strong>Kirim bukti pembayaran ini?</strong>
              Nomor struk <b>{{ receiptInputs[invoice.id]?.nostruk }}</b> dan nomor bukti <b>{{
                receiptInputs[invoice.id]?.nosbm }}</b>.
              Pastikan sama dengan struk dari kasir, lalu Transmedik akan memeriksanya.
            </p>
            <p v-else>
              <strong>Batalkan invoice ini?</strong>
              Peneliti tidak akan bisa membayarnya. Kamu masih bisa menerbitkan invoice baru setelahnya.
            </p>
            <div class="confirm-box__actions">
              <button class="button button--secondary" type="button" @click="pendingAction = ''">Kembali</button>
              <button v-if="pendingAction === 'pay'" class="button button--primary" type="button"
                :disabled="verifyingId === invoice.id" @click="submitReceipt(invoice)">
                {{ verifyingId === invoice.id ? 'Memverifikasi…' : 'Ya, kirim dan verifikasi' }}
              </button>
              <button class="button button--danger" type="button" :disabled="cancellingId === invoice.id"
                @click="cancelInvoice(invoice)">
                {{ cancellingId === invoice.id ? 'Memproses…' : 'Ya, batalkan invoice' }}
              </button>
            </div>
          </div>

          <template v-else>
            <button class="button button--secondary" type="button" @click="printInvoice(invoice)">
              <Printer :size="16" /> Cetak invoice
            </button>
            <template v-if="canCancel(invoice)">
              <button class="button button--danger spacer" type="button" @click="pendingAction = 'cancel'">
                <Ban :size="16" /> Batalkan invoice
              </button>
            </template>
          </template>
        </footer>
      </aside>
    </div>

    <div v-if="showInspectionModal" class="inspection-overlay" @click.self="showInspectionModal = false">
  <section class="inspection-modal" role="dialog" aria-modal="true" aria-labelledby="inspection-title">
    <header class="inspection-modal__head">
      <div>
        <h2 id="inspection-title">Verifikasi Transmedik</h2>
        <p>Cocokkan data invoice KEPK dengan data terbaru dari Transmedik.</p>
      </div>
      <button class="icon-button" type="button" aria-label="Tutup" @click="showInspectionModal = false">
        <X :size="18" />
      </button>
    </header>

    <div class="inspection-modal__body">
      <div v-if="inspectingInvoiceId" class="inspection-loading">
        <RefreshCw :size="22" class="spin" /> Mengambil data terbaru dari Transmedik…
      </div>
      <div v-else-if="inspectionError" class="alert alert--error" role="alert">
        <AlertCircle :size="18" /><span>{{ inspectionError }}</span>
      </div>

      <template v-else-if="inspectionResult && verdict">
        <!-- 1. Kesimpulan -->
        <div :class="['verdict', `verdict--${verdict.tone}`]" role="status">
          <component :is="verdict.tone === 'success' ? CheckCircle2 : AlertCircle" :size="24" />
          <div class="verdict__text">
            <strong>{{ verdict.title }}</strong>
            <p>{{ verdict.text }}</p>
          </div>
          <div class="verdict__invoice">
            <small>Invoice</small>
            <strong>{{ inspectionResult.invoice.invoice_number }}</strong>
          </div>
        </div>

        <!-- 2. Dua pengecekan utama -->
        <div class="check-grid">
          <article v-for="check in mainChecks" :key="check.key"
            :class="['check-card', check.matches ? 'is-match' : 'is-mismatch']">
            <header class="check-card__head">
              <div>
                <strong>{{ check.label }}</strong>
                <small>{{ check.hint }}</small>
              </div>
              <span :class="['inspection-match', check.matches ? 'is-match' : 'is-mismatch']">
                <Check v-if="check.matches" :size="13" /><X v-else :size="13" />
                {{ check.matches ? 'Cocok' : 'Berbeda' }}
              </span>
            </header>
            <dl class="compare">
              <div>
                <dt>Invoice KEPK</dt>
                <dd>{{ check.expected }}</dd>
              </div>
              <div>
                <dt>Transmedik</dt>
                <dd :class="{ 'is-diff': !check.matches }">{{ check.received }}</dd>
              </div>
            </dl>
          </article>
        </div>

        <!-- Detail bukti pembayaran -->
        <details class="panel">
          <summary>Nomor struk dan bukti pembayaran</summary>
          <div class="panel__body">
            <div v-for="check in receiptChecks" :key="check.key" class="receipt-row">
              <strong>{{ check.label }}</strong>
              <span class="receipt-row__value"><small>KEPK</small>{{ check.expected }}</span>
              <span :class="['receipt-row__value', { 'is-diff': !check.matches }]">
                <small>Transmedik</small>{{ check.received }}
              </span>
              <span :class="['inspection-match', check.matches ? 'is-match' : 'is-mismatch']">
                {{ check.matches ? 'Cocok' : 'Berbeda' }}
              </span>
            </div>
            <div class="inspection-remote-meta">
              <span>Status lunas di Transmedik:
                <strong :class="remoteIsPaid ? 'text-success' : 'text-danger'">{{ remoteIsPaid ? 'Lunas' : 'Belum lunas' }}</strong>
              </span>
              <span>Sisa tagihan:
                <strong>{{ inspectionResult.comparison.sisa_tagihan === null ? '—' : formatMoney(inspectionResult.comparison.sisa_tagihan) }}</strong>
              </span>
            </div>
          </div>
        </details>

        <!-- 3. Syarat persetujuan (khusus DIKLIT) -->
        <section v-if="isDiklit && approvalChecks.length" class="panel panel--static">
          <div class="panel__title">
            <strong>Syarat persetujuan manual</strong>
            <small>{{ approvalHint }}</small>
          </div>
          <ul class="checklist">
            <li v-for="item in approvalChecks" :key="item.label" :class="item.ok ? 'is-ok' : 'is-fail'">
              <Check v-if="item.ok" :size="15" /><X v-else :size="15" />
              <span>{{ item.label }}</span>
            </li>
          </ul>
          <p :class="['checklist-result', canApproveInvalidRefManually ? 'is-ok' : 'is-fail']">
            {{ canApproveInvalidRefManually
              ? 'Semua syarat terpenuhi. Pembayaran dapat disetujui.'
              : 'Ada syarat yang belum terpenuhi, jadi pembayaran belum bisa disetujui.' }}
          </p>
        </section>

        <!-- Respons Transmedik yang mudah dibaca -->
        <details class="panel" open>
          <summary>Respons Transmedik <span class="panel__count">{{ transmedikRows.length }} data</span></summary>
          <div class="panel__body">
            <dl v-if="transmedikRows.length" class="kv-list">
              <div v-for="(row, index) in transmedikRows" :key="index">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
            <p v-else class="panel__empty">Transmedik tidak mengirim data.</p>

            <template v-if="metadataRows.length">
              <p class="kv-heading">Informasi permintaan</p>
              <dl class="kv-list">
                <div v-for="(row, index) in metadataRows" :key="index">
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
              </dl>
            </template>

            <details class="raw-toggle">
              <summary>Lihat data mentah (JSON)</summary>
              <pre>{{ rawJson }}</pre>
            </details>
          </div>
        </details>

        <p class="inspection-note">
          Pemeriksaan ini hanya menampilkan dan membandingkan data. Status pembayaran baru berubah setelah kamu menyetujui atau menolak.
        </p>
      </template>
    </div>

    <footer class="inspection-modal__foot">
      <div v-if="inspectionResult && isDiklit" class="inspection-decision-actions">
        <button class="button button--danger" type="button" :disabled="invalidRefDecisionLoading"
          @click="submitInvalidRefDecision('REJECT')">
          {{ invalidRefDecisionLoading ? 'Memproses…' : 'Tolak · Kembalikan ke Belum Dibayar' }}
        </button>
        <button class="button button--primary" type="button"
          :disabled="invalidRefDecisionLoading || !canApproveInvalidRefManually"
          :title="canApproveInvalidRefManually ? '' : 'Syarat persetujuan belum terpenuhi'"
          @click="submitInvalidRefDecision('APPROVE')">
          {{ invalidRefDecisionLoading ? 'Memproses…' : 'Setujui Pembayaran Manual' }}
        </button>
      </div>
    </footer>
  </section>
</div>
  </main>
</template>

<style scoped>
.payments-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  color: var(--foreground);
  box-sizing: border-box;
}

.payments-page *,
.payments-page *::before,
.payments-page *::after {
  box-sizing: border-box;
}

.payments-page :where(h1, h2, p, dl, dd, ol, ul) {
  margin: 0;
  padding: 0;
}

.payments-page :where(button, input, select):focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Heading */
.page-heading,
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-heading {
  align-items: flex-start;
}

h1 {
  font-size: clamp(1.5rem, 2.4vw, 1.9rem);
  color: var(--primary);
  line-height: 1.2;
}

h2 {
  font-size: 1.1rem;
}

.subtitle {
  margin-top: 5px;
  color: var(--muted-foreground);
  font-size: .86rem;
  line-height: 1.5;
  max-width: 62ch;
}

/* Buttons */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 9px;
  font: inherit;
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s, border-color .15s;
}

.button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.button--primary {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.button--primary:not(:disabled):hover {
  filter: brightness(.94);
}

.button--secondary {
  background: var(--card);
  color: var(--foreground);
}

.button--secondary:not(:disabled):hover {
  background: var(--muted);
}

.button--danger {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.icon-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--muted-foreground);
  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  color: var(--primary);
  border-color: var(--primary);
}

.icon-button:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.icon-button--ghost {
  border-color: transparent;
  background: transparent;
}

.text-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--primary);
  font: inherit;
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer;
}

/* Alerts */
.alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: .85rem;
  line-height: 1.45;
}

.alert>span {
  flex: 1;
  min-width: 0;
}

.alert>svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-close {
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: .7;
}

.alert-close:hover {
  opacity: 1;
}

.alert--error {
  border: 1px solid var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.alert--success {
  border: 1px solid var(--color-success-border);
  background: var(--color-success-soft);
  color: var(--color-success);
}

.icon-tile {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-primary-soft);
  color: var(--primary);
}

.payments-page :where(input, select) {
  min-height: 40px;
  padding: 0 11px;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: .84rem;
  max-width: 100%;
}


.inspection-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--color-warning-border);
  border-radius: 10px;
  background: var(--color-warning-soft);
}
.inspection-callout strong { color: var(--foreground); font-size: .84rem; }
.inspection-callout p { margin-top: 4px; color: var(--muted-foreground); font-size: .76rem; }
/* ---------- Verifikasi Transmedik ---------- */
.inspection-overlay {
  position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center;
  padding: 20px; background: rgb(15 23 42 / 58%);
}
.inspection-modal {
  display: flex; flex-direction: column; width: min(760px, 100%); max-height: min(90vh, 900px);
  overflow: hidden; border: 1px solid var(--border); border-radius: 16px;
  background: var(--card); color: var(--foreground); box-shadow: var(--shadow-lg);
}
.inspection-modal__head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 14px;
  flex-shrink: 0; padding: 18px 20px; border-bottom: 1px solid var(--border);
}
.inspection-modal__head h2 { color: var(--foreground); font-size: 1.05rem; }
.inspection-modal__head p { margin-top: 5px; color: var(--muted-foreground); font-size: .78rem; }
.inspection-modal__body {
  flex: 1; display: grid; align-content: start; gap: 16px; padding: 20px; overflow-y: auto;
}
.inspection-modal__foot {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px;
  flex-shrink: 0; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--card);
}
.inspection-decision-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-right: auto; }
.inspection-decision-actions .button { min-height: 38px; font-size: .76rem; }
.inspection-loading {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  min-height: 160px; color: var(--muted-foreground); font-size: .86rem;
}

/* Kesimpulan */
.verdict {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  border: 1px solid; border-radius: 12px;
}
.verdict > svg { flex-shrink: 0; }
.verdict--success { border-color: var(--color-success-border); background: var(--color-success-soft); color: var(--color-success); }
.verdict--danger { border-color: var(--color-danger-border); background: var(--color-danger-soft); color: var(--color-danger); }
.verdict__text { flex: 1; min-width: 0; }
.verdict__text strong { display: block; font-size: .95rem; }
.verdict__text p { margin-top: 3px; color: var(--foreground); font-size: .8rem; opacity: .8; }
.verdict__invoice { text-align: right; }
.verdict__invoice small { display: block; color: var(--muted-foreground); font-size: .7rem; }
.verdict__invoice strong { color: var(--foreground); font-family: ui-monospace, Menlo, monospace; font-size: .8rem; overflow-wrap: anywhere; }

/* Kartu pengecekan */
.check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.check-card { border: 1px solid var(--border); border-top-width: 3px; border-radius: 12px; background: var(--card); }
.check-card.is-match { border-top-color: var(--color-success); }
.check-card.is-mismatch { border-top-color: var(--color-danger); }
.check-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 14px 14px 10px; }
.check-card__head strong { display: block; font-size: .9rem; }
.check-card__head small { display: block; margin-top: 3px; color: var(--muted-foreground); font-size: .72rem; line-height: 1.4; }
.compare { display: grid; gap: 8px; padding: 0 14px 14px; }
.compare > div { padding: 9px 11px; border-radius: 8px; background: var(--muted); }
.compare dt { color: var(--muted-foreground); font-size: .68rem; font-weight: 600; }
.compare dd { margin-top: 3px; font-size: .92rem; font-weight: 700; overflow-wrap: anywhere; }
.compare dd.is-diff { color: var(--color-danger); }

.inspection-match {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px;
  font-size: .7rem; font-weight: 700; white-space: nowrap;
}
.inspection-match.is-match { background: var(--color-success-soft); color: var(--color-success); }
.inspection-match.is-mismatch { background: var(--color-danger-soft); color: var(--color-danger); }

/* Panel lipat */
.panel { border: 1px solid var(--border); border-radius: 12px; background: var(--card); }
.panel > summary {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 13px 14px; color: var(--foreground); font-size: .84rem; font-weight: 700; cursor: pointer;
}
.panel[open] > summary { border-bottom: 1px solid var(--border); }
.panel__count { color: var(--muted-foreground); font-size: .72rem; font-weight: 600; }
.panel__body { display: grid; gap: 12px; padding: 14px; }
.panel__empty { color: var(--muted-foreground); font-size: .8rem; }
.panel--static { display: grid; gap: 12px; padding: 14px; }
.panel__title strong { display: block; font-size: .84rem; }
.panel__title small { display: block; margin-top: 3px; color: var(--muted-foreground); font-size: .74rem; line-height: 1.45; }

.receipt-row {
  display: grid; grid-template-columns: minmax(100px, .8fr) 1fr 1fr auto; align-items: center; gap: 12px;
  padding-bottom: 12px; border-bottom: 1px solid var(--border);
}
.receipt-row strong { font-size: .8rem; }
.receipt-row__value { display: grid; gap: 2px; font-size: .8rem; font-weight: 600; overflow-wrap: anywhere; }
.receipt-row__value small { color: var(--muted-foreground); font-size: .66rem; font-weight: 500; }
.receipt-row__value.is-diff { color: var(--color-danger); }
.inspection-remote-meta { display: flex; flex-wrap: wrap; gap: 6px 20px; color: var(--muted-foreground); font-size: .76rem; }
.inspection-remote-meta strong { color: var(--foreground); }
.text-success { color: var(--color-success) !important; }
.text-danger { color: var(--color-danger) !important; }

/* Checklist persetujuan */
.checklist { display: grid; gap: 6px; list-style: none; }
.checklist li { display: flex; align-items: center; gap: 8px; font-size: .8rem; }
.checklist li svg { flex-shrink: 0; padding: 2px; border-radius: 50%; box-sizing: content-box; width: 15px; height: 15px; }
.checklist li.is-ok svg { background: var(--color-success-soft); color: var(--color-success); }
.checklist li.is-fail { color: var(--foreground); }
.checklist li.is-fail svg { background: var(--color-danger-soft); color: var(--color-danger); }
.checklist-result { padding: 9px 12px; border-radius: 8px; font-size: .78rem; font-weight: 600; }
.checklist-result.is-ok { background: var(--color-success-soft); color: var(--color-success); }
.checklist-result.is-fail { background: var(--color-warning-soft); color: var(--color-warning); }

/* Respons Transmedik */
.kv-list { display: grid; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
.kv-list > div {
  display: grid; grid-template-columns: minmax(120px, 220px) 1fr; gap: 12px;
  padding: 9px 12px; border-bottom: 1px solid var(--border); font-size: .78rem;
}
.kv-list > div:last-child { border-bottom: 0; }
.kv-list > div:nth-child(even) { background: var(--background); }
.kv-list dt { color: var(--muted-foreground); }
.kv-list dd { font-weight: 600; overflow-wrap: anywhere; }
.kv-heading { color: var(--muted-foreground); font-size: .74rem; font-weight: 700; }
.raw-toggle summary { color: var(--primary); font-size: .76rem; font-weight: 700; cursor: pointer; }
.raw-toggle pre {
  max-height: 220px; overflow: auto; margin: 8px 0 0; padding: 12px;
  border: 1px solid var(--border); border-radius: 9px; background: var(--background);
  font: .72rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere;
}

.inspection-note {
  padding: 11px 13px; border-radius: 9px; background: var(--muted);
  color: var(--muted-foreground); font-size: .75rem; line-height: 1.5;
}

@media (max-width: 640px) {
  .inspection-overlay { padding: 0; place-items: stretch; }
  .inspection-modal { width: 100%; max-height: 100%; height: 100%; border-radius: 0; }
  .inspection-modal__head, .inspection-modal__body, .inspection-modal__foot { padding: 14px; }
  .inspection-modal__foot { flex-direction: column-reverse; align-items: stretch; }
  .inspection-decision-actions { flex-direction: column; width: 100%; margin-right: 0; }
  .inspection-decision-actions .button, .inspection-modal__foot > .button { width: 100%; }
  .verdict { flex-wrap: wrap; }
  .verdict__invoice { width: 100%; text-align: left; }
  .check-grid { grid-template-columns: 1fr; }
  .receipt-row { grid-template-columns: 1fr 1fr; }
  .receipt-row > strong { grid-column: 1 / -1; }
  .kv-list > div { grid-template-columns: 1fr; gap: 2px; }
}

/* Status */
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: .78rem;
  font-weight: 600;
  white-space: nowrap;
}

.status--success {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status--muted {
  background: var(--color-neutral-soft);
  color: var(--muted-foreground);
}

/* Tab status */
.invoice-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  scrollbar-width: none;
}

.tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 2px 12px;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: .88rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.tab:hover {
  color: var(--foreground);
}

.tab[aria-selected='true'] {
  color: var(--primary);
}

.tab[aria-selected='true']::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--primary);
}

.tab-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: .72rem;
  font-weight: 700;
}

.tab[aria-selected='true'] .tab-count {
  background: var(--color-primary-soft);
  color: var(--primary);
}

/* Filter */
.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.filter-row>.button {
  margin-left: auto;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: .82rem;
  font-weight: 600;
}

.chip.is-active {
  border-style: solid;
  border-color: var(--primary);
  background: var(--color-primary-softer);
  color: var(--primary);
}

.chip--button {
  cursor: pointer;
}

.chip select,
.chip input {
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.chip--search {
  border-style: solid;
}

.chip--search input {
  width: 250px;
  cursor: text;
  font-weight: 500;
}

.chip--search:focus-within {
  border-color: var(--primary);
}

.chip input:focus-visible {
  outline: none;
}

/* Tabel invoice */
.list-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.list-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.list-table th {
  padding: 13px 16px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: .8rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

.list-table th:first-child {
  border-top-left-radius: 11px;
}

.list-table th:last-child {
  border-top-right-radius: 11px;
}

.list-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-size: .86rem;
  vertical-align: middle;
}

.list-table tbody tr {
  cursor: pointer;
  transition: background .12s;
}

.list-table tbody tr:hover {
  background: var(--background);
}

.list-table .is-cancelled td {
  color: var(--muted-foreground);
}

.cell-amount {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.cell-amount strong {
  font-size: .95rem;
}

.is-cancelled .cell-amount strong {
  color: var(--muted-foreground);
  font-weight: 600;
}

.cell-research {
  max-width: 320px;
}

.cell-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.cell-sub {
  display: block;
  margin-top: 3px;
  color: var(--muted-foreground);
  font-size: .76rem;
}

.col-action {
  width: 64px;
  text-align: right !important;
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.link-button:hover {
  text-decoration: underline;
}

.menu {
  position: relative;
  display: inline-block;
  text-align: left;
}

.menu-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 210px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .15);
}

.menu-list button {
  display: block;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: .84rem;
  text-align: left;
  cursor: pointer;
}

.menu-list button:hover {
  background: var(--muted);
}

.list-foot {
  padding: 14px 16px;
  color: var(--muted-foreground);
  font-size: .84rem;
}

.list-empty {
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 36px 16px;
  color: var(--muted-foreground);
  font-size: .86rem;
  text-align: center;
}

.state {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 160px;
  padding: 20px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--muted-foreground);
  font-size: .86rem;
  text-align: center;
}

.state small {
  font-size: .78rem;
}

.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 16px;
  color: var(--muted-foreground);
  font-size: .8rem;
}

.pager strong {
  color: var(--foreground);
}

.pager-pages {
  display: flex;
  align-items: center;
  gap: 2px;
}

.pager-btn {
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: .82rem;
  cursor: pointer;
}

.pager-btn:hover:not(:disabled) {
  background: var(--muted);
}

.pager-btn[aria-current='page'] {
  border-color: var(--border);
  background: var(--card);
  color: var(--foreground);
  font-weight: 800;
}

.pager-btn:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.pager-gap {
  padding: 0 6px;
}

/* Tabel item */
.items-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.items-table th,
.items-table td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
  font-size: .84rem;
}

.items-table th {
  background: var(--background);
  color: var(--muted-foreground);
  font-size: .76rem;
  font-weight: 700;
  white-space: nowrap;
}

.items-table td input,
.items-table td select {
  width: 100%;
  min-width: 80px;
}

.draft-table {
  min-width: 720px;
}

.draft-table .cell-product {
  min-width: 260px;
}

.invoice-items {
  margin-top: 0;
}

.numeric {
  text-align: right !important;
  white-space: nowrap;
  font-weight: 700;
}

.cell-action {
  width: 44px;
}

/* Pencarian produk per baris */
.product-field {
  position: relative;
  width: 100%;
}

.product-field input {
  width: 100%;
  padding-right: 32px;
}

.product-field input.is-selected {
  border-color: var(--color-success-border);
}

.product-field__spinner,
.product-field__check {
  position: absolute;
  top: 50%;
  right: 10px;
  margin-top: -7px;
  pointer-events: none;
  color: var(--muted-foreground);
}

.product-field__check {
  color: var(--color-success);
}

.product-dropdown {
  position: fixed;
  z-index: 10000;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .18);
}

.product-dropdown ul {
  list-style: none;
}

.product-dropdown__note {
  padding: 10px;
  color: var(--muted-foreground);
  font-size: .8rem;
}

.product-dropdown__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: .84rem;
  text-align: left;
  cursor: pointer;
}

.product-dropdown__option:hover {
  background: var(--muted);
}

.product-dropdown__option strong {
  flex-shrink: 0;
  color: var(--primary);
  font-size: .8rem;
}

/* Pop up terbitkan invoice */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  justify-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, .45);
}

.modal {
  display: flex;
  flex-direction: column;
  width: min(900px, 100%);
  max-height: min(90vh, 100%);
  border-radius: 14px;
  background: var(--card);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .3);
  animation: modal-in .18s ease-out;
}

@keyframes modal-in {
  from {
    transform: translateY(10px);
    opacity: 0;
  }
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.modal-head p {
  margin-top: 4px;
  color: var(--muted-foreground);
  font-size: .82rem;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px;
  overflow-y: auto;
}

.modal-body>* {
  flex-shrink: 0;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
}

.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--input);
  border-radius: 9px;
  background: var(--background);
  color: var(--muted-foreground);
}

.search-field:focus-within {
  border-color: var(--primary);
  color: var(--primary);
}

.search-field input {
  flex: 1;
  min-width: 0;
  min-height: 42px;
  padding: 0;
  border: 0;
  background: transparent;
}

.search-field input:focus-visible {
  outline: none;
}

.hint {
  color: var(--muted-foreground);
  font-size: .78rem;
}

.app-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

.app-option {
  display: grid;
  gap: 3px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.app-option:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--color-primary-softer);
}

.app-option:disabled {
  opacity: .65;
  cursor: not-allowed;
}

.app-option__title {
  font-size: .88rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.app-option__meta {
  color: var(--muted-foreground);
  font-size: .78rem;
}

.app-option__note {
  color: var(--color-warning);
  font-size: .76rem;
  font-weight: 600;
}

.chosen-app {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--background);
}

.chosen-app strong,
.chosen-app small {
  display: block;
  overflow-wrap: anywhere;
}

.chosen-app strong {
  font-size: .88rem;
}

.chosen-app small {
  margin-top: 3px;
  color: var(--muted-foreground);
  font-size: .78rem;
}

.totals-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-top: 6px;
}

.discount-field {
  display: grid;
  gap: 6px;
  width: min(100%, 240px);
  color: var(--muted-foreground);
  font-size: .8rem;
  font-weight: 700;
}

.summary-box {
  width: min(100%, 340px);
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 10px;
  background: var(--muted);
  font-size: .84rem;
}

.summary-box>div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.summary-box dt {
  color: var(--muted-foreground);
}

.summary-box dd {
  font-weight: 700;
}

.summary-box__total {
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.summary-box__total dt {
  color: var(--foreground) !important;
  font-weight: 700;
}

.summary-box__total dd {
  color: var(--primary);
  font-size: 1.05rem;
}

/* Panel detail */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, .45);
}

.drawer {
  display: flex;
  flex-direction: column;
  width: min(720px, 100%);
  height: 100%;
  background: var(--card);
  box-shadow: -8px 0 30px rgba(0, 0, 0, .2);
  animation: drawer-in .2s ease-out;
}

@keyframes drawer-in {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.drawer-head__side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  overflow-y: auto;
}

.drawer-body>* {
  margin: 0;
  flex-shrink: 0;
}

.drawer-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--card);
}

.drawer-foot .spacer {
  margin-left: auto;
}

.drawer-foot .confirm-box {
  flex: 1 1 100%;
  margin: 0;
}

.invoice-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.invoice-title strong,
.invoice-title small {
  display: block;
  overflow-wrap: anywhere;
}

.invoice-title small {
  margin-top: 4px;
  color: var(--muted-foreground);
  font-size: .78rem;
}

.app-block {
  display: grid;
  gap: 3px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--background);
}

.app-block span {
  color: var(--muted-foreground);
  font-size: .76rem;
}

.app-block strong {
  font-size: .9rem;
  overflow-wrap: anywhere;
}

.app-block small {
  color: var(--muted-foreground);
  font-size: .78rem;
}

/* Tahapan pembayaran */
.steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  list-style: none;
}

.step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: .76rem;
}

.step::before {
  content: '';
  position: absolute;
  top: 12px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--border);
  z-index: 0;
}

.step:first-child::before {
  display: none;
}

.step__dot {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 2px solid var(--border);
  border-radius: 50%;
  background: var(--card);
  font-size: .72rem;
  font-weight: 800;
}

.step--done {
  color: var(--foreground);
}

.step--done::before {
  background: var(--primary);
}

.step--done .step__dot {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.step--current {
  color: var(--foreground);
  font-weight: 700;
}

.step--current::before {
  background: var(--primary);
}

.step--current .step__dot {
  border-color: var(--primary);
  color: var(--primary);
}

.next-step {
  padding: 11px 14px;
  border-radius: 9px;
  background: var(--color-info-softer);
  color: var(--foreground);
  font-size: .84rem;
  line-height: 1.5;
}

/* Ringkasan tagihan */
.summary-panel {
  padding: 16px;
  border-radius: 10px;
  background: var(--muted);
}

.summary-panel__label {
  color: var(--muted-foreground);
  font-size: .78rem;
}

.summary-panel__amount {
  margin: 4px 0 12px;
  color: var(--primary);
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.summary-lines {
  display: grid;
  gap: 6px;
  padding: 12px 0;
  border-block: 1px solid var(--border);
  font-size: .8rem;
}

.summary-lines>div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.summary-lines dt {
  color: var(--muted-foreground);
}

.summary-lines dd {
  font-weight: 700;
  white-space: nowrap;
}

.ref-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--card);
}

.ref-box span {
  display: block;
  color: var(--muted-foreground);
  font-size: .72rem;
}

.ref-box strong {
  display: block;
  margin-top: 2px;
  font-size: .92rem;
  letter-spacing: .02em;
  overflow-wrap: anywhere;
}

.ref-hint {
  display: block;
  margin-top: 8px;
  color: var(--muted-foreground);
  font-size: .74rem;
}

/* Bukti pembayaran */
.payment-form {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  background: var(--color-primary-softer);
}

.payment-form-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--primary);
}

.payment-form-heading strong {
  color: var(--foreground);
}

.payment-form-heading p {
  margin-top: 3px;
  color: var(--muted-foreground);
  font-size: .8rem;
}

.receipt-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.receipt-fields label {
  display: grid;
  gap: 6px;
  font-size: .8rem;
  font-weight: 700;
}

.receipt-fields input {
  width: 100%;
}

.payment-form .button {
  justify-self: start;
}

.verified-details {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: 10px;
  background: var(--color-success-soft);
  color: var(--color-success);
}

.verified-details p,
.verified-details small {
  display: block;
  margin-top: 4px;
  color: var(--muted-foreground);
  font-size: .8rem;
}

.payment-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: .82rem;
}

.payment-result span {
  color: var(--muted-foreground);
}

.confirm-box {
  padding: 14px;
  border: 1px solid var(--color-danger-border);
  border-radius: 10px;
  background: var(--color-danger-soft);
  font-size: .84rem;
  line-height: 1.5;
}

.confirm-box--pay {
  border-color: var(--primary);
  background: var(--color-primary-softer);
}

.confirm-box__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {

  .spin,
  .drawer,
  .modal {
    animation: none;
  }
}

@media (max-width: 800px) {

  .list-table,
  .list-table tbody,
  .list-table tr,
  .list-table td {
    display: block;
    width: 100%;
  }

  .list-table thead {
    display: none;
  }

  .list-table tr {
    position: relative;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }

  .list-table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
    border: 0;
    text-align: right;
  }

  .list-table td::before {
    content: attr(data-label);
    flex-shrink: 0;
    color: var(--muted-foreground);
    font-size: .76rem;
  }

  .list-table td:first-child {
    padding-right: 44px;
  }

  .list-table td.col-action {
    position: absolute;
    top: 8px;
    right: 8px;
    width: auto;
    padding: 0;
  }

  .list-table td.col-action::before {
    content: none;
  }

  .cell-research {
    max-width: none;
  }

  .filter-row>.button {
    width: 100%;
    margin-left: 0;
    order: -1;
  }

  .chip--search {
    flex: 1 1 100%;
  }

  .chip--search input {
    width: 100%;
  }
}

@media (max-width: 700px) {

  .page-heading,
  .totals-row {
    align-items: stretch;
    flex-direction: column;
  }

  .page-heading .button {
    width: 100%;
  }

  .receipt-fields {
    grid-template-columns: minmax(0, 1fr);
  }

  .discount-field,
  .summary-box {
    width: 100%;
  }

  .modal-overlay {
    padding: 0;
    place-items: stretch;
  }

  .modal {
    width: 100%;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .modal-head,
  .modal-body,
  .modal-foot {
    padding-inline: 16px;
  }

  .modal-foot {
    flex-direction: column-reverse;
  }

  .modal-foot .button,
  .drawer-foot .button,
  .payment-form .button,
  .confirm-box__actions .button {
    width: 100%;
  }

  .drawer-foot .spacer {
    margin-left: 0;
  }

  .status {
    align-self: flex-start;
  }

  .steps {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .step {
    flex-direction: row;
    gap: 10px;
    text-align: left;
  }

  .step::before {
    display: none;
  }

  /* Tabel item menjadi kartu di layar kecil */
  .items-table,
  .items-table tbody,
  .items-table tr,
  .items-table td {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .items-table thead {
    display: none;
  }

  .items-table tr {
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .items-table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border: 0;
    text-align: right;
  }

  .items-table td::before {
    content: attr(data-label);
    flex-shrink: 0;
    color: var(--muted-foreground);
    font-size: .76rem;
    font-weight: 600;
    text-align: left;
  }

  .items-table td input {
    width: 55%;
  }

  .items-table .cell-product {
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    min-width: 0;
  }

  .items-table .cell-product select,
  .items-table .cell-product .product-field {
    width: 100%;
  }

  .items-table td .product-field input {
    width: 100%;
  }

  .items-table .cell-action {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }
}
</style>