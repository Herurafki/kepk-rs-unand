<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  History,
  Info,
  Pencil,
  Printer,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet,
  X,
  XCircle,
} from "lucide-vue-next";
import {
  downloadApplicationDocument,
  getApplicationHistory,
  getDataCollectionDetail,
  uploadApplicationDocument,
  reviseApplication,
  type ApplicationData,
  type ApplicationHistory,
} from "../../services/researcher/data-collection.service";
import { getApiErrorMessage } from "../../services/api/error";
import { useToast } from "../../composables/useToast";
import { sanitizeResearcherRichText } from "../../utils/researcher-rich-text";
import { getApplicationInvoices, verifyPayment, type PaymentInvoice } from "../../services/payment.service";
import { buildInvoiceA6Html } from "../../templates/invoiceA6";
import { useAuthStore } from "../../stores/routes/auth";
import { displayDocumentInTab, openDocumentTab } from "../../utils/document-preview";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();

// Field tambahan yang dikirim backend tetapi belum ada di tipe ApplicationData
type RevisionItem = {
  id: string | number;
  document_id: string | number;
  document_type?: string | null;
  document_name?: string | null;
  note?: string | null;
  cycle_number?: number | string | null;
  reviewer_id?: string | number | null;
  reviewer_name?: string | null;
  reviewer?: { name?: string | null } | null;
};
type RevisionItemView = RevisionItem & { reviewer_name: string };
type RevisionRequest = {
  id?: string | number;
  status?: string;
  cycle_number?: number | string | null;
  reviewer_id?: string | number | null;
  reviewer_name?: string | null;
  reviewer?: { name?: string | null } | null;
  items?: RevisionItem[];
};
type ApplicationDetail = ApplicationData & {
  review_type?: string | null;
  expedited_revision_ready?: boolean;
  expedited_revision_requests?: RevisionRequest[];
};


const applicationData = ref<ApplicationDetail | null>(null);
const applicationInvoices = ref<PaymentInvoice[]>([]);
const showPaymentDrawer = ref(false);
const activeInvoice = computed(() => {
  const sorted = [...applicationInvoices.value].sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
  // Peneliti hanya melihat invoice yang masih aktif. Invoice CANCELLED
  // tetap tersimpan di backend untuk kebutuhan audit, tetapi tidak ditampilkan.
  return sorted.find((invoice) => invoice.status === "ISSUED") || null;
});
const paymentReceipt = ref({ nostruk: "", nosbm: "" });
const paymentSubmitting = ref(false);
const paymentConfirming = ref(false);
const invoiceRefCopied = ref(false);
const history = ref<ApplicationHistory[]>([]);
const loading = ref(false);
const historyLoading = ref(false);
const errorMessage = ref("");
const revisionFiles = ref<Record<string, File | null>>({});
const revisionSubmitting = ref(false);
const revisionError = ref("");
const confirmingRevision = ref(false);
const openingDocId = ref("");
const activeTab = ref<"info" | "documents">("info");

/* ============================================================
 * Revisi reviewer (Expedited)
 * Satu kartu per dokumen. Jika beberapa reviewer meminta perbaikan
 * pada dokumen yang sama, catatannya digabung dalam satu kartu.
 * ============================================================ */
const openExpeditedRevisionRequests = computed(() =>
  (applicationData.value?.expedited_revision_requests || []).filter((request) => request.status === "OPEN"),
);

// Nama reviewer selalu disamarkan: Reviewer 1, 2, 3, ... (konsisten per reviewer)
const reviewerAlias = new Map<string, string>();
const reviewerDisplayName = (request: RevisionRequest, item: RevisionItem) => {
  const key = String(item?.reviewer_id ?? request?.reviewer_id ?? request?.id ?? item?.id);
  if (!reviewerAlias.has(key)) reviewerAlias.set(key, `Reviewer ${reviewerAlias.size + 1}`);
  return reviewerAlias.get(key) as string;
};

const openExpeditedRevisionItems = computed<RevisionItemView[]>(() =>
  openExpeditedRevisionRequests.value.flatMap((request) =>
    (request.items || []).map((item) => ({
      ...item,
      reviewer_name: reviewerDisplayName(request, item),
      cycle_number: item.cycle_number ?? request.cycle_number,
    })),
  ),
);

const expeditedRevisionGroups = computed(() => {
  const groups = new Map<
    string,
    {
      document_id: string | number;
      document_type?: string | null;
      document_name?: string | null;
      items: RevisionItemView[];
      reviewers: string[];
    }
  >();
  for (const item of openExpeditedRevisionItems.value) {
    const key = String(item.document_id);
    const group = groups.get(key) || {
      document_id: item.document_id,
      document_type: item.document_type,
      document_name: item.document_name,
      items: [],
      reviewers: [],
    };
    group.items.push(item);
    if (!group.reviewers.includes(item.reviewer_name)) group.reviewers.push(item.reviewer_name);
    groups.set(key, group);
  }
  return Array.from(groups.values());
});

const showExpeditedRevisionPanel = computed(
  () =>
    applicationData.value?.review_type === "EXPEDITED" &&
    applicationData.value?.status === "REVISION_REQUIRED" &&
    openExpeditedRevisionItems.value.length > 0,
);
const canSubmitExpeditedRevision = computed(
  () => showExpeditedRevisionPanel.value && applicationData.value?.expedited_revision_ready === true,
);
const selectedFileCount = computed(
  () => expeditedRevisionGroups.value.filter((group) => revisionFiles.value[String(group.document_id)]).length,
);
const allRevisionFilesSelected = computed(
  () => expeditedRevisionGroups.value.length > 0 && selectedFileCount.value === expeditedRevisionGroups.value.length,
);
const missingRevisionFiles = computed(() => expeditedRevisionGroups.value.length - selectedFileCount.value);
const revisionReadyPercent = computed(() =>
  expeditedRevisionGroups.value.length
    ? Math.round((selectedFileCount.value / expeditedRevisionGroups.value.length) * 100)
    : 0,
);

const originalDocumentOf = (documentId: string | number) =>
  applicationData.value?.documents?.find((doc) => String(doc.id) === String(documentId));

const reviewerNumber = (name: string) => name.replace(/\D/g, "") || "R";

/* ---- unggah dokumen pengganti: klik atau seret, dengan validasi format ---- */
const ALLOWED_REVISION_EXT = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
const dragKey = ref("");
const revisionFileErrors = reactive<Record<string, string>>({});
const revisionInputKeys = reactive<Record<string, number>>({});

const openRevisionPicker = (documentId: string | number) =>
  document.getElementById("revision-file-" + documentId)?.click();

function acceptRevisionFile(documentId: string | number, file?: File | null) {
  const key = String(documentId);
  if (!file) return;
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_REVISION_EXT.includes(ext)) {
    revisionFileErrors[key] = "Format tidak didukung. Gunakan PDF, DOC, DOCX, JPG, atau PNG.";
    revisionInputKeys[key] = (revisionInputKeys[key] || 0) + 1;
    return;
  }
  revisionFileErrors[key] = "";
  revisionFiles.value[key] = file;
}

const onRevisionFilePick = (documentId: string | number, event: Event) =>
  acceptRevisionFile(documentId, (event.target as HTMLInputElement).files?.[0]);

const onRevisionDrop = (documentId: string | number, event: DragEvent) => {
  dragKey.value = "";
  acceptRevisionFile(documentId, event.dataTransfer?.files?.[0]);
};

function removeRevisionFile(documentId: string | number) {
  const key = String(documentId);
  revisionFileErrors[key] = "";
  revisionInputKeys[key] = (revisionInputKeys[key] || 0) + 1;
  revisionFiles.value[key] = null;
}

/* ============================================================
 * Label status & tipe
 * ============================================================ */
const statusMeta: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "status status--draft" },
  SUBMITTED: { label: "Diajukan", className: "status status--submitted" },
  ADMIN_REVIEW: { label: "Verifikasi", className: "status status--review" },
  REVISION_REQUIRED: { label: "Revisi", className: "status status--revision" },
  ADMIN_APPROVED: { label: "Disetujui", className: "status status--approved" },
  REQUIRED_ETHICS: { label: "Dilanjutkan ke Etik", className: "status status--review" },
  SEKRETARIS_REVIEW: { label: "Review Sekretaris", className: "status status--review" },
  WAITING_REVIEWER: { label: "Menunggu Reviewer", className: "status status--waiting" },
  UNDER_REVIEW: { label: "Sedang Direview", className: "status status--review" },
  REVIEW_COMPLETED: { label: "Review Selesai", className: "status status--completed" },
  APPROVED: { label: "Disetujui", className: "status status--approved" },
  REJECTED: { label: "Ditolak", className: "status status--rejected" },
  PERMIT_ISSUED: { label: "Surat Diterbitkan", className: "status status--issued" },
};

const applicationTypeLabels: Record<string, string> = {
  DATA_AWAL: "Pengambilan Data Awal",
  IZIN_PENELITIAN: "Pengajuan Penelitian",
  IZIN_ETIK: "Pengajuan Kaji Etik",
};

const isDataCollection = computed(() => applicationData.value?.application_type === "DATA_AWAL");

const needsEthics = computed(
  () =>
    applicationData.value?.application_type === "IZIN_PENELITIAN" &&
    ["REQUIRED_ETHICS", "ADMIN_APPROVED"].includes(applicationData.value?.status || "") &&
    applicationData.value?.requires_ethics === true,
);

const getStatusMeta = (status?: string | null, application = applicationData.value) => {
  if (
    ["REQUIRED_ETHICS", "ADMIN_APPROVED"].includes(status || "") &&
    application?.application_type === "IZIN_PENELITIAN" &&
    application.requires_ethics === true
  ) {
    return { label: "Dilanjutkan ke Etik", className: "status status--review" };
  }
  // Pada kaji etik, ADMIN_APPROVED berarti masih menunggu verifikasi Sekretariat
  if (status === "ADMIN_APPROVED" && application?.application_type === "IZIN_ETIK") {
    return { label: "Menunggu Sekretariat", className: "status status--waiting" };
  }
  return (
    statusMeta[status || ""] ?? {
      label: (status || "UNKNOWN").replaceAll("_", " "),
      className: "status status--default",
    }
  );
};

const getApplicationTypeLabel = (type?: string) =>
  applicationTypeLabels[type || ""] ?? (type || "").replaceAll("_", " ");

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (size?: number | null) => {
  if (size == null || Number.isNaN(Number(size))) return "";
  const bytes = Number(size);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const historyStatusLabel = (status?: string | null) => {
  if (!status) return "Pengajuan dibuat";
  return getStatusMeta(status).label;
};

const historyActorLabel = (item: ApplicationHistory) => {
  const roles = Array.isArray(item.changed_by_roles) ? item.changed_by_roles : [];
  const roleLabels: Record<string, string> = {
    PENELITI: "Peneliti",
    RESEARCHER: "Peneliti",
    DIKLIT: "DIKLIT",
    DIKLAT: "DIKLIT",
    SEKRETARIAT: "Sekretariat",
    SEKRETARIS_KEPK: "Sekretariat",
    KETUA: "Ketua KEPK",
    CHIEF_KEPK: "Ketua KEPK",
    REVIEWER: "Reviewer",
    SUPERADMIN: "Superadmin",
  };
  const priority = ["KETUA", "SEKRETARIAT", "DIKLIT", "REVIEWER", "PENELITI", "SUPERADMIN"];
  const role = priority.find((candidate) => roles.includes(candidate)) || roles[0];
  return role ? roleLabels[role] || role.replaceAll("_", " ") : "Sistem";
};

/* ============================================================
 * Riwayat status: satu langkah per status. Bila sebuah status terulang
 * (mis. revisi, kirim ulang, revisi lagi) hanya tampil sekali dengan
 * tanggal terbaru. Urutan mengikuti tanggal terbaru tiap status.
 * ============================================================ */
const historySorted = computed(() =>
  [...history.value].sort((a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()),
);

const historyTone = (status?: string | null) => {
  if (["APPROVED", "ADMIN_APPROVED", "PERMIT_ISSUED"].includes(status || "")) return "good";
  if (status === "REJECTED") return "bad";
  if (status === "REVISION_REQUIRED") return "warn";
  return "neutral";
};

const historySteps = computed(() => {
  const byStatus = new Map<string, ApplicationHistory>();
  for (const item of historySorted.value) {
    const key = String(item.new_status ?? "CREATED");
    byStatus.delete(key); // pindahkan ke akhir agar urutan mengikuti kejadian terbaru
    byStatus.set(key, item);
  }
  const entries = Array.from(byStatus.entries());
  return entries.map(([key, item], index) => ({
    key,
    label: historyStatusLabel(item.new_status),
    date: item.created_at,
    tone: historyTone(item.new_status),
    current: index === entries.length - 1,
  }));
});

/* ---- catatan petugas (revisi / penolakan) untuk kontainer catatan ---- */
const officerNote = computed(() => {
  const status = applicationData.value?.status;
  if (!["REVISION_REQUIRED", "REJECTED"].includes(status || "")) return null;
  const entry = [...historySorted.value].reverse().find((item) => item.new_status === status);
  return {
    note: entry?.note?.trim() || "",
    date: entry?.created_at || null,
    actor: entry ? historyActorLabel(entry) : "Petugas",
  };
});
const showNotesCard = computed(() => showExpeditedRevisionPanel.value || !!officerNote.value);

/* ============================================================
 * Panduan "Apa yang terjadi sekarang?"
 * Catatan petugas tidak diulang di sini; cukup di Riwayat Status.
 * ============================================================ */
type GuideTone = "info" | "warning" | "success" | "danger";
const guide = computed<{
  tone: GuideTone;
  title: string;
  text: string;
  cta?: "ethics" | "revision" | "edit" | "note";
} | null>(() => {
  const app = applicationData.value;
  if (!app) return null;
  const status = app.status || "";
  const isEthicsApp = app.application_type === "IZIN_ETIK";
  const officer = isEthicsApp ? "Sekretariat KEPK" : "admin";

  switch (status) {
    case "DRAFT":
      return { tone: "info", title: "Pengajuan masih berupa draft", text: "Lengkapi data dan kirim pengajuan agar dapat mulai diproses." };
    case "SUBMITTED":
      return {
        tone: "info",
        title: `Menunggu verifikasi ${officer}`,
        text: "Pengajuan Anda sudah diterima dan menunggu giliran diperiksa. Tidak ada tindakan yang perlu Anda lakukan saat ini.",
      };
    case "ADMIN_REVIEW":
      return {
        tone: "info",
        title: `Sedang diverifikasi ${officer}`,
        text: "Petugas sedang memeriksa kelengkapan data dan dokumen. Anda akan diberi tahu jika ada yang perlu diperbaiki.",
      };
    case "REVISION_REQUIRED":
      if (showExpeditedRevisionPanel.value) {
        return {
          tone: "warning",
          title: "Reviewer meminta perbaikan dokumen",
          text: `Ada ${expeditedRevisionGroups.value.length} dokumen yang perlu diganti.`,
          cta: "revision",
        };
      }
      return {
        tone: "warning",
        title: "Pengajuan perlu direvisi",
        text: "Perbaiki data atau dokumen sesuai catatan petugas, lalu kirim ulang pengajuan.",
        cta: "edit",
      };
    case "REQUIRED_ETHICS":
    case "ADMIN_APPROVED":
      if (needsEthics.value) {
        return app.has_ethics_application === true
          ? { tone: "info", title: "Formulir etik sudah dibuat", text: "Formulir kaji etik untuk pengajuan ini sudah dikirim. Pantau prosesnya pada pengajuan kaji etik." }
          : {
              tone: "warning",
              title: "Lengkapi formulir kaji etik",
              text: "Pengajuan Anda dilanjutkan ke alur etik. Lengkapi formulir kaji etik agar diteruskan untuk telaah etik.",
              cta: "ethics",
            };
      }
      if (isEthicsApp) {
        return {
          tone: "info",
          title: "Menunggu verifikasi Sekretariat KEPK",
          text: "Berkas Anda sudah lolos pemeriksaan awal dan menunggu diteruskan ke komisi etik",
        };
      }
      return {
        tone: "success",
        title: "Pengajuan disetujui",
        text: "Pengajuan Anda telah disetujui. Surat sedang disiapkan oleh petugas dan akan diterbitkan segera.",
      };
    case "SEKRETARIS_REVIEW":
      return { tone: "info", title: "Menunggu pemeriksaan Sekretariat KEPK", text: "Silahkan lengkapi pembayaran telaah etik sebelum pengajuan dilanjutkan ke komisi etik." };
    case "WAITING_REVIEWER":
      return {
        tone: "info",
        title: "Menunggu penetapan reviewer",
        text: "Ketua KEPK sedang menentukan jenis telaah dan reviewer yang akan menilai protokol Anda.",
      };
    case "UNDER_REVIEW":
      return { tone: "info", title: "Protokol sedang direview", text: "Reviewer sedang menilai protokol penelitian Anda. Jika perlu perbaikan, Anda akan diminta mengunggah dokumen pengganti." };
    case "REVIEW_COMPLETED":
      return { tone: "info", title: "Review selesai", text: "Seluruh reviewer telah memberikan penilaian. Ketua KEPK akan menetapkan keputusan akhir." };
    case "APPROVED":
      return { tone: "success", title: "Disetujui", text: "Protokol Anda dinyatakan layak etik. Sekretariat akan menerbitkan surat persetujuan etik." };
    case "REJECTED":
      return {
        tone: "danger",
        title: "Pengajuan ditolak",
        text: "Pengajuan ini tidak dapat dilanjutkan. Alasannya dapat dilihat pada catatan di bawah.",
        cta: "note",
      };
    case "PERMIT_ISSUED":
      return {
        tone: "success",
        title: "Surat telah diterbitkan",
        text: "Surat dapat diambil di bagian Diklit Rumah Sakit Universitas Andalas dengan membawa kartu identitas.",
      };
    default:
      return null;
  }
});

/* ============================================================
 * Aksi
 * ============================================================ */
const goBack = () => router.push({ name: "researcher-status" });

const formatMoney = (value: unknown) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    .format(Number.isFinite(Number(value)) ? Number(value) : 0);
const paymentStatusLabel = (invoice: PaymentInvoice) => {
  if (invoice.verification === "verified") return "Lunas";
  if (invoice.status === "CANCELLED") return "Dibatalkan";
  if (invoice.nostruk || invoice.nosbm) return "Menunggu verifikasi";
  return "Belum dibayar";
};

/* ---------- Pembayaran ---------- */
// navigator.clipboard hanya tersedia di HTTPS/localhost dan bisa ditolak browser.
// Bila gagal, pakai cara lama (textarea + execCommand) agar tetap bisa menyalin.
async function writeToClipboard(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // lanjut ke cara cadangan
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(area);
  return copied;
}

const copyInvoiceRef = async () => {
  if (!activeInvoice.value) return;
  const copied = await writeToClipboard(String(activeInvoice.value.ref_number));
  if (copied) {
    toast.success("Nomor referensi disalin.");
    invoiceRefCopied.value = true;
    setTimeout(() => {
      invoiceRefCopied.value = false;
    }, 1800);
  } else {
    toast.error("Tidak dapat menyalin. Salin nomor referensi secara manual.");
  }
};

const askPaymentConfirmation = () => {
  if (!paymentReceipt.value.nostruk.trim() || !paymentReceipt.value.nosbm.trim()) {
    toast.error("Isi nomor struk dan nomor bukti pembayaran terlebih dahulu.");
    return;
  }
  paymentConfirming.value = true;
};

const submitPaymentConfirmation = async () => {
  const invoice = activeInvoice.value;
  if (!invoice || invoice.status !== "ISSUED" || invoice.verification === "verified") return;
  paymentSubmitting.value = true;
  try {
    const response = await verifyPayment(invoice.id, {
      nostruk: paymentReceipt.value.nostruk.trim(),
      nosbm: paymentReceipt.value.nosbm.trim(),
    });
    if (response.data?.verification === "verified") {
      toast.success("Pembayaran berhasil diverifikasi oleh Transmedik.");
    } else {
      toast.error("Pembayaran belum dapat diverifikasi. Periksa kembali nomor struk dan nomor bukti pembayaran.");
    }
    paymentConfirming.value = false;
    const invoiceResponse = await getApplicationInvoices(String(applicationData.value?.id || ""));
    applicationInvoices.value = invoiceResponse.data ?? [];
  } catch (error) {
    toast.error(getApiErrorMessage(error, "Verifikasi pembayaran gagal. Silakan periksa kembali nomor struk dan nomor bukti pembayaran, lalu coba lagi."));
  } finally {
    paymentSubmitting.value = false;
  }
};

const itemDiscountTotal = computed(() =>
  activeInvoice.value?.items?.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0) || 0,
);

// Backend `subtotal` adalah total harga kotor item sebelum diskon item dan diskon invoice.
// Kurangi diskon item saja agar subtotal ini tetap sebelum diskon invoice.
const invoiceSubtotal = computed(() =>
  Math.max(0, Number(activeInvoice.value?.subtotal || 0) - itemDiscountTotal.value),
);

const printInvoice = (invoice: PaymentInvoice) => {
  // Template invoice membaca data penelitian dari properti `application`.
  const content = buildInvoiceA6Html({ ...invoice, application: applicationData.value } as any, {
    formatMoney,
    fallbackResearcher: auth.user?.name || "-",
  });

  const printWindow = window.open("", "_blank", "width=500,height=700");
  if (!printWindow) {
    toast.error("Pop-up diblokir browser. Izinkan pop-up untuk mencetak invoice.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
};

const closePaymentDrawer = () => {
  showPaymentDrawer.value = false;
  paymentConfirming.value = false;
};

const openEthics = () => {
  if (!applicationData.value || !needsEthics.value) return;

  if (applicationData.value.has_ethics_application === true) {
    toast.info("Formulir etik untuk pengajuan ini sudah pernah dibuat.");
    return;
  }

  router.push({ name: "researcher-ethics", query: { applicationId: applicationData.value.id } });
};

const scrollToNotes = () => {
  document.getElementById("catatan-revisi")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

// Sesuaikan dengan nama rute halaman edit pengajuan di router.
const EDIT_ROUTE_NAME = "researcher-status-edit";

const editApplication = async () => {
  const application = applicationData.value;
  if (!application) return;

  if (!router.hasRoute(EDIT_ROUTE_NAME)) {
    console.error(`Rute "${EDIT_ROUTE_NAME}" tidak ditemukan. Daftarkan rute halaman edit pengajuan terlebih dahulu.`);
    toast.error("Halaman edit pengajuan belum tersedia. Silakan hubungi petugas.");
    return;
  }

  // router.push mengembalikan Promise; tangani kegagalan navigasi (mis. guard menolak).
  try {
    await router.push({ name: EDIT_ROUTE_NAME, params: { id: application.id } });
  } catch (error) {
    console.error("Gagal membuka halaman edit pengajuan:", error);
    toast.error("Tidak dapat membuka halaman edit pengajuan. Silakan coba lagi.");
  }
};

const documentFileName = (doc: NonNullable<ApplicationData["documents"]>[number]) =>
  doc.original_name || doc.file_name || "Dokumen";

const documentUploadedAt = (doc: NonNullable<ApplicationData["documents"]>[number]) =>
  doc.uploaded_at || doc.created_at || null;

// Tab dibuka langsung dari klik agar tidak terkena popup blocker.
const openDocument = async (documentId: string | number, fileName: string) => {
  errorMessage.value = "";
  openingDocId.value = String(documentId);
  const tab = openDocumentTab();
  if (!tab) {
    errorMessage.value = "Browser memblokir tab dokumen. Izinkan pop-up untuk situs ini, lalu coba lagi.";
    openingDocId.value = "";
    return;
  }
  try {
    const blob = await downloadApplicationDocument(String(documentId));
    displayDocumentInTab(tab, blob, fileName);
  } catch (error) {
    tab.close();
    errorMessage.value = getApiErrorMessage(error, "Dokumen tidak dapat dibuka.");
  } finally {
    openingDocId.value = "";
  }
};

const submitExpeditedRevisions = async () => {
  if (!applicationData.value || !canSubmitExpeditedRevision.value) return;
  if (!allRevisionFilesSelected.value) {
    revisionError.value = "Unggah dokumen pengganti untuk setiap dokumen yang diminta sebelum mengirim ulang.";
    confirmingRevision.value = false;
    return;
  }

  revisionSubmitting.value = true;
  revisionError.value = "";
  try {
    const replacements: Array<{ item_id: string | number; document_id: string | number }> = [];
    for (const group of expeditedRevisionGroups.value) {
      const file = revisionFiles.value[String(group.document_id)];
      if (!file) continue;
      const uploaded = await uploadApplicationDocument(applicationData.value.id, {
        file,
        document_type: group.document_type || undefined,
      });
      const uploadedId = uploaded?.data?.id;
      if (!uploadedId) throw new Error("Dokumen berhasil diunggah tetapi ID dokumen tidak diterima.");
      group.items.forEach((item) => replacements.push({ item_id: item.id, document_id: uploadedId }));
    }

    await reviseApplication(applicationData.value.id, { revised_documents: replacements });
    toast.success("Dokumen revisi berhasil dikirim kepada reviewer.");
    revisionFiles.value = {};
    await loadDetail();
  } catch (error) {
    revisionError.value = getApiErrorMessage(error, "Dokumen revisi gagal dikirim. Periksa kembali berkas dan coba lagi.");
  } finally {
    revisionSubmitting.value = false;
    confirmingRevision.value = false;
  }
};

const loadDetail = async () => {
  const applicationId = String(route.params.id || "");
  if (!applicationId) {
    errorMessage.value = "ID pengajuan tidak valid.";
    return;
  }

  loading.value = true;
  historyLoading.value = true;
  errorMessage.value = "";

  try {
    const [detailResponse, historyResponse] = await Promise.all([
      getDataCollectionDetail(applicationId),
      getApplicationHistory(applicationId),
    ]);

    if (!detailResponse.success || !detailResponse.data) {
      errorMessage.value = "Data pengajuan tidak ditemukan.";
      return;
    }

    applicationData.value = detailResponse.data;
    history.value = historyResponse.success ? (historyResponse.data ?? []) : [];
    applicationInvoices.value = [];
    try {
      const invoiceResponse = await getApplicationInvoices(applicationId);
      applicationInvoices.value = invoiceResponse.data ?? [];
    } catch (invoiceError) {
      console.warn("Failed to fetch application invoices:", invoiceError);
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Gagal memuat detail pengajuan. Silakan coba lagi.");
    console.error("Failed to fetch application detail/history:", error);
  } finally {
    loading.value = false;
    historyLoading.value = false;
  }
};

// Halaman di belakang drawer tidak ikut ter-scroll saat drawer terbuka.
watch(showPaymentDrawer, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
});

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && showPaymentDrawer.value) closePaymentDrawer();
};

onMounted(() => {
  loadDetail();
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <main class="detail-pengajuan">
    <section class="page-heading">
      <div>
        <p class="eyebrow">PENGAJUAN</p>
        <h1>Detail Pengajuan</h1>
      </div>
    </section>

    <div v-if="errorMessage" class="alert alert--error" role="alert"><AlertCircle :size="18" /> {{ errorMessage }}</div>

    <div v-if="loading" class="state-container">
      <div class="loading-spinner" />
      <p>Memuat detail pengajuan...</p>
    </div>

    <template v-else-if="applicationData">
      <!-- Ringkasan pengajuan (satu-satunya tempat nomor, jenis, status, dan tanggal) -->
      <section class="application-hero">
        <div class="hero-top">
          <div>
            <span class="application-type">{{ getApplicationTypeLabel(applicationData.application_type) }}</span>
            <h2>{{ applicationData.research_title || "Tanpa judul" }}</h2>
            <p class="application-number">{{ applicationData.application_number }}</p>
          </div>
          <span :class="getStatusMeta(applicationData.status, applicationData).className">
            {{ getStatusMeta(applicationData.status, applicationData).label }}
          </span>
        </div>

        <div class="hero-meta">
          <span><CalendarDays :size="16" /> Diajukan {{ formatDate(applicationData.created_at) }}</span>
          <span><Clock3 :size="16" /> Diperbarui {{ formatDate(applicationData.updated_at) }}</span>
        </div>
      </section>

      <!-- Apa yang terjadi sekarang -->
      <section v-if="guide" class="next-step" :class="`next-step--${guide.tone}`" aria-live="polite">
        <div class="next-step-icon">
          <CheckCircle2 v-if="guide.tone === 'success'" :size="22" />
          <XCircle v-else-if="guide.tone === 'danger'" :size="22" />
          <AlertCircle v-else-if="guide.tone === 'warning'" :size="22" />
          <Info v-else :size="22" />
        </div>
        <div class="next-step-body">
          <strong>{{ guide.title }}</strong>
          <p>{{ guide.text }}</p>
        </div>
        <button v-if="guide.cta === 'ethics'" class="btn btn--primary" type="button" @click="openEthics">
          <ShieldCheck :size="16" /> Lengkapi Formulir Etik
        </button>
        <button v-else-if="guide.cta === 'revision'" class="btn btn--primary" type="button" @click="scrollToNotes">
          <Upload :size="16" /> Unggah Perbaikan
        </button>
        <button v-else-if="guide.cta === 'edit'" class="btn btn--primary" type="button" @click="editApplication">
          <Pencil :size="16" /> Edit Pengajuan
        </button>
        <button v-else-if="guide.cta === 'note'" class="btn btn--primary" type="button" @click="scrollToNotes">
          <History :size="16" /> Lihat Alasan
        </button>
      </section>

      <div class="layout">
        <!-- ===== Kolom utama ===== -->
        <section class="main-column">
          <!-- Catatan revisi: satu kontainer khusus -->
          <nav class="tabs" role="tablist" aria-label="Bagian detail pengajuan">
            <button type="button" role="tab" :aria-selected="activeTab === 'info'" :class="{ active: activeTab === 'info' }" @click="activeTab = 'info'">
              Informasi Pengajuan
            </button>
            <button type="button" role="tab" :aria-selected="activeTab === 'documents'" :class="{ active: activeTab === 'documents' }" @click="activeTab = 'documents'">
              Dokumen Pendukung <span class="tab-count">{{ applicationData.documents?.length || 0 }}</span>
            </button>
          </nav>
          <!-- Informasi pengajuan -->
          <article v-if="activeTab === 'info'" class="card">
            <div class="info-grid">
              <div v-if="applicationData.research_background" class="info-item info-item--full">
                <span>Ringkasan Penelitian</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(applicationData.research_background)" />
              </div>
              <div v-if="applicationData.research_objectives" class="info-item info-item--full">
                <span>Subjek/Objek Penelitian</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(applicationData.research_objectives)" />
              </div>
              <div v-if="applicationData.research_methodology" class="info-item info-item--full">
                <span>Metode Penelitian</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(applicationData.research_methodology)" />
              </div>
              <div class="info-item info-item--full">
                <span>{{ isDataCollection ? "Tujuan Pengambilan Data" : "Tujuan Penelitian" }}</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(applicationData.purpose || '-')" />
              </div>
              <div class="info-item info-item--full">
                <span>Kebutuhan Data</span>
                <div class="rich-text-content" v-html="sanitizeResearcherRichText(applicationData.data_needed || '-')" />
              </div>
              <div class="info-item">
                <span>Institusi Peneliti</span>
                <div class="rich-text-content">{{ applicationData.research_institution || "-" }}</div>
              </div>
              <div class="info-item">
                <span>Unit / Instalasi Tujuan</span>
                <div class="rich-text-content">{{ applicationData.research_location || "-" }}</div>
              </div>
              <div class="info-item">
                <span>Dosen Pembimbing/Penanggung Jawab</span>
                <div class="rich-text-content">{{ applicationData.person_responsible || "-" }}</div>
              </div>
              <div v-if="applicationData.research_duration" class="info-item">
                <span>Durasi Penelitian</span>
                <div class="rich-text-content">{{ applicationData.research_duration }}</div>
              </div>
              <div v-if="applicationData.data_collection_date" class="info-item">
                <span>Waktu Pengambilan Data</span>
                <div class="rich-text-content">{{ formatDate(applicationData.data_collection_date) }}</div>
              </div>
            </div>
          </article>

          <!-- Dokumen pendukung -->
          <article v-if="activeTab === 'documents'" class="card">
            <div v-if="applicationData.documents?.length" class="documents">
              <div v-for="doc in applicationData.documents" :key="doc.id" class="document">
                <div class="document-icon"><FileText :size="18" /></div>
                <div class="document-info">
                  <strong>{{ doc.document_type || "Dokumen pendukung" }}</strong>
                  <span :title="documentFileName(doc)">{{ documentFileName(doc) }}</span>
                  <small>Diunggah {{ formatDateTime(documentUploadedAt(doc)) }}</small>
                </div>
                <button class="btn btn--ghost btn--sm" type="button" :disabled="openingDocId === String(doc.id)" @click="openDocument(doc.id, documentFileName(doc))">
                  <ExternalLink :size="16" /> {{ openingDocId === String(doc.id) ? "Membuka…" : "Buka" }}
                </button>
              </div>
            </div>
            <p v-else class="empty-text">Tidak ada dokumen pendukung yang diunggah.</p>
          </article>
        </section>

        <!-- ===== Kolom samping ===== -->
        <aside class="side-column">

          <article
            v-if="showNotesCard"
            id="catatan-revisi"
            class="card"
            :class="applicationData.status === 'REJECTED' ? 'card--danger' : 'card--warning'"
          >
            <header class="card-header">
              <AlertCircle :size="18" />
              <h2>{{ applicationData.status === "REJECTED" ? "Alasan penolakan" : "Catatan revisi" }}</h2>
              <span v-if="showExpeditedRevisionPanel" class="header-chip">{{ selectedFileCount }} dari {{ expeditedRevisionGroups.length }} siap</span>
            </header>

            <div class="rev-body">
              <template v-if="showExpeditedRevisionPanel">
              <p class="muted">Baca catatan reviewer pada setiap dokumen, unggah dokumen pengganti, lalu kirim ulang.</p>
              <div class="rev-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="revisionReadyPercent">
                <span :style="{ width: revisionReadyPercent + '%' }" />
              </div>

              <article
                v-for="(group, index) in expeditedRevisionGroups"
                :key="String(group.document_id)"
                class="rev-doc"
                :class="{ 'rev-doc--ready': revisionFiles[String(group.document_id)] }"
              >
                <header class="rev-doc__head">
                  <span class="rev-doc__num">{{ index + 1 }}</span>
                  <div class="rev-doc__title">
                    <strong>{{ group.document_type || "Dokumen pendukung" }}</strong>
                    <small>{{ group.document_name || originalDocumentOf(group.document_id)?.original_name || "Dokumen #" + group.document_id }}</small>
                  </div>
                  <span class="rev-doc__state" :class="revisionFiles[String(group.document_id)] ? 'rev-doc__state--ok' : 'rev-doc__state--wait'">
                    {{ revisionFiles[String(group.document_id)] ? "Siap dikirim" : "Perlu dokumen pengganti" }}
                  </span>
                </header>

                <div class="rev-notes">
                  <div class="rev-notes__head">
                    <strong>Catatan revisi <span>({{ group.items.length }})</span></strong>
                    <button
                      v-if="originalDocumentOf(group.document_id)"
                      class="link-button"
                      type="button"
                      @click="openDocument(group.document_id, documentFileName(originalDocumentOf(group.document_id)!))"
                    >
                      <ExternalLink :size="14" /> Buka dokumen saat ini
                    </button>
                  </div>
                  <ul class="rev-notes__list">
                    <li v-for="item in group.items" :key="item.id" class="rev-note">
                      <div class="rev-note__who">
                        <span class="rev-note__avatar">{{ reviewerNumber(item.reviewer_name) }}</span>
                        <strong>{{ item.reviewer_name }}</strong>
                        <small v-if="item.cycle_number">Siklus review {{ item.cycle_number }}</small>
                      </div>
                      <p>{{ item.note?.trim() || "Reviewer tidak menambahkan catatan tertulis." }}</p>
                    </li>
                  </ul>
                </div>

                <input
                  :id="'revision-file-' + group.document_id"
                  :key="revisionInputKeys[String(group.document_id)] || 0"
                  type="file"
                  hidden
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  @change="onRevisionFilePick(group.document_id, $event)"
                />

                <button
                  v-if="!revisionFiles[String(group.document_id)]"
                  type="button"
                  class="rev-drop"
                  :class="{ 'rev-drop--over': dragKey === String(group.document_id) }"
                  @click="openRevisionPicker(group.document_id)"
                  @dragover.prevent="dragKey = String(group.document_id)"
                  @dragleave="dragKey = ''"
                  @drop.prevent="onRevisionDrop(group.document_id, $event)"
                >
                  <Upload :size="20" />
                  <span>
                    <strong>Pilih atau seret dokumen pengganti</strong>
                    <small>PDF. Satu berkas menjawab semua catatan di atas.</small>
                  </span>
                </button>

                <div v-else class="rev-file">
                  <CheckCircle2 :size="20" />
                  <span>
                    <strong>{{ revisionFiles[String(group.document_id)]?.name }}</strong>
                    <small>{{ formatFileSize(revisionFiles[String(group.document_id)]?.size) }} · siap dikirim</small>
                  </span>
                  <button class="link-button" type="button" @click="openRevisionPicker(group.document_id)">Ganti</button>
                  <button class="icon-button" type="button" aria-label="Hapus berkas" title="Hapus berkas" @click="removeRevisionFile(group.document_id)">
                    <Trash2 :size="15" />
                  </button>
                </div>

                <p v-if="revisionFileErrors[String(group.document_id)]" class="rev-error" role="alert">
                  <AlertCircle :size="15" /> {{ revisionFileErrors[String(group.document_id)] }}
                </p>
              </article>

              <footer class="rev-foot">
                <p v-if="!canSubmitExpeditedRevision" class="rev-hint rev-hint--wait">
                  <Info :size="16" />
                  Menunggu seluruh reviewer memberi keputusan. Dokumen revisi baru bisa dikirim setelah semua keputusan masuk.
                </p>
                <p v-else-if="missingRevisionFiles > 0" class="rev-hint">
                  <Info :size="16" /> Unggah {{ missingRevisionFiles }} dokumen lagi untuk bisa mengirim.
                </p>
                <p v-else class="rev-hint rev-hint--ok">
                  <CheckCircle2 :size="16" /> Semua dokumen siap. Pengajuan hanya kembali kepada reviewer yang meminta perbaikan.
                </p>

                <p v-if="revisionError" class="rev-error" role="alert"><AlertCircle :size="15" /> {{ revisionError }}</p>

                <div v-if="confirmingRevision" class="rev-confirm" role="alertdialog">
                  <p><strong>Kirim {{ expeditedRevisionGroups.length }} dokumen revisi?</strong> Setelah dikirim, dokumen tidak bisa diganti lagi.</p>
                  <div>
                    <button class="btn btn--ghost" type="button" :disabled="revisionSubmitting" @click="confirmingRevision = false">Periksa lagi</button>
                    <button class="btn btn--primary" type="button" :disabled="revisionSubmitting" @click="submitExpeditedRevisions">
                      {{ revisionSubmitting ? "Mengirim dokumen…" : "Ya, kirim sekarang" }}
                    </button>
                  </div>
                </div>
                <button
                  v-else
                  class="btn btn--primary"
                  type="button"
                  :disabled="!canSubmitExpeditedRevision || !allRevisionFilesSelected || revisionSubmitting"
                  @click="confirmingRevision = true"
                >
                  Kirim ulang dokumen revisi
                </button>
              </footer>
              </template>

              <template v-else-if="officerNote">
                <div class="officer-note" :class="{ 'officer-note--bad': applicationData.status === 'REJECTED' }">
                  <div class="officer-note__meta">
                    <strong>{{ applicationData.status === "REJECTED" ? "Alasan dari" : "Catatan dari" }} {{ officerNote.actor }}</strong>
                    <time>{{ formatDateTime(officerNote.date) }}</time>
                  </div>
                  <p>{{ officerNote.note || "Petugas tidak menambahkan catatan tertulis." }}</p>
                </div>
                <div v-if="applicationData.status === 'REVISION_REQUIRED'" class="officer-actions">
                  <p class="muted">Perbaiki data atau dokumen sesuai catatan di atas, lalu kirim ulang pengajuan.</p>
                  <button class="btn btn--primary" type="button" @click="editApplication">
                    <Pencil :size="16" /> Edit Pengajuan
                  </button>
                </div>
              </template>
            </div>
          </article>

          <article id="riwayat-status" class="card">
            <header class="card-header">
              <History :size="18" />
              <h2>Riwayat status</h2>
            </header>
            <div class="card-body">
              <p v-if="historyLoading" class="muted">Memuat riwayat…</p>
              <p v-else-if="!historySteps.length" class="muted">Belum ada riwayat perubahan status.</p>
              <ol v-else class="steps" aria-label="Tahapan status pengajuan">
                <li
                  v-for="step in historySteps"
                  :key="step.key"
                  class="step"
                  :class="[`step--${step.tone}`, step.current ? 'step--current' : 'step--done']"
                >
                  <span class="step__dot" aria-hidden="true"><Check v-if="!step.current" :size="12" /></span>
                  <div class="step__body">
                    <strong>{{ step.label }}</strong>
                    <time>{{ formatDateTime(step.date) }}</time>
                  </div>
                  <span v-if="step.current" class="step__badge">Saat ini</span>
                </li>
              </ol>
            </div>
          </article>

          <article v-if="activeInvoice" class="card">
            <header class="card-header">
              <Wallet :size="18" />
              <h2>Pembayaran</h2>
            </header>
            <div class="card-body">
              <div class="payment-summary-card">
                <div class="payment-summary-info">
                  <span class="payment-summary-label">INVOICE {{ activeInvoice.invoice_number }}</span>
                  <strong>{{ formatMoney(activeInvoice.total) }}</strong>
                  <span :class="['payment-status', activeInvoice.verification === 'verified' ? 'payment-status--paid' : activeInvoice.status === 'CANCELLED' ? 'payment-status--cancelled' : 'payment-status--pending']">
                    {{ paymentStatusLabel(activeInvoice) }}
                  </span>
                </div>
                <p v-if="activeInvoice.status === 'ISSUED' && activeInvoice.verification !== 'verified'">
                  Invoice sudah diterbitkan. Silakan lakukan pembayaran di kasir Rumah Sakit Unand, kemudian konfirmasi pembayaran melalui detail invoice.
                </p>
                <p v-else-if="activeInvoice.verification === 'verified'">
                  Pembayaran invoice ini sudah berhasil diverifikasi oleh sistem.
                </p>
                <p v-else>
                  Invoice ini sudah dibatalkan.
                </p>
                <button class="payment-open-button" type="button" @click="showPaymentDrawer = true">
                  <Wallet :size="16" />
                  Lihat detail pembayaran
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </article>
        </aside>
      </div>

      <div class="bottom-actions">
        <button class="btn btn--ghost" type="button" @click="goBack">
          <ArrowLeft :size="18" />
          Kembali ke Daftar Pengajuan
        </button>
      </div>
    </template>

    <div v-else class="empty-state">
      <FileText :size="42" />
      <h2>Pengajuan Tidak Ditemukan</h2>
      <p>Pengajuan yang Anda cari tidak dapat ditemukan.</p>
      <button class="btn btn--primary" type="button" @click="goBack">Kembali ke Status Pengajuan</button>
    </div>

    <Teleport to="body">
      <Transition name="payment-drawer">
        <div v-if="showPaymentDrawer && activeInvoice" class="payment-drawer-overlay" @click.self="closePaymentDrawer">
          <aside class="payment-drawer" role="dialog" aria-modal="true" :aria-label="'Detail pembayaran ' + activeInvoice.invoice_number">
            <header class="payment-drawer-head">
              <div class="payment-drawer-title">
                <span class="payment-drawer-icon"><FileText :size="19" /></span>
                <div>
                  <strong>Detail Pembayaran</strong>
                  <small>{{ activeInvoice.invoice_number }} · {{ activeInvoice.invoice_type === "RESEARCH" ? "Invoice penelitian" : "Invoice etik" }}</small>
                </div>
              </div>
              <div class="payment-drawer-head-actions">
                <span :class="['payment-status', activeInvoice.verification === 'verified' ? 'payment-status--paid' : activeInvoice.status === 'CANCELLED' ? 'payment-status--cancelled' : 'payment-status--pending']">
                  {{ paymentStatusLabel(activeInvoice) }}
                </span>
                <button class="payment-close-button" type="button" aria-label="Tutup detail pembayaran" @click="closePaymentDrawer">
                  <X :size="19" />
                </button>
              </div>
            </header>

            <div class="payment-drawer-body">
              <div class="payment-total-panel">
                <span>Total tagihan</span>
                <strong>{{ formatMoney(activeInvoice.total) }}</strong>
                <small>Terbit {{ formatDateTime(activeInvoice.issued_at) }}</small>
              </div>
              <div v-if="activeInvoice.status === 'ISSUED' && activeInvoice.verification !== 'verified'" class="payment-guidance">
                <Info :size="18" />
                <p>Silakan lakukan pembayaran di kasir Rumah Sakit Unand dengan menyebutkan nomor referensi berikut. Setelah pembayaran berhasil, masukkan nomor struk dan nomor bukti dari bukti pembayaran untuk konfirmasi.</p>
              </div>
              <div v-else-if="activeInvoice.status !== 'ISSUED' && activeInvoice.verification !== 'verified'" class="payment-guidance">
                <AlertCircle :size="18" />
                <p>Invoice ini sudah dibatalkan. Silakan hubungi petugas terkait jika masih memerlukan invoice pembayaran.</p>
              </div>
              <div class="payment-reference-box">
                <div><span>Nomor referensi</span><strong>{{ activeInvoice.ref_number }}</strong></div>
                <button class="payment-copy-button" type="button" @click="copyInvoiceRef">
                  <Check v-if="invoiceRefCopied" :size="15" />
                  <Copy v-else :size="15" />
                  {{ invoiceRefCopied ? "Tersalin" : "Salin" }}
                </button>
              </div>
              <section class="payment-detail-section">
                <div class="payment-detail-heading"><strong>Rincian tagihan</strong><span>{{ activeInvoice.items?.length || 0 }} item</span></div>
                <div v-for="item in activeInvoice.items || []" :key="item.id" class="payment-detail-item">
                  <div><strong>{{ item.product_name }}</strong><small>{{ item.quantity }} × {{ formatMoney(item.unit_price) }} · Diskon {{ Number(item.discount_percent || 0) }}%</small></div>
                  <strong>{{ formatMoney(item.total) }}</strong>
                </div>
                <div class="payment-detail-line"><span>Subtotal</span><strong>{{ formatMoney(invoiceSubtotal) }}</strong></div>
                <div class="payment-detail-line"><span>Diskon</span><strong>− {{ formatMoney(activeInvoice.discount_total) }}</strong></div>
                <div class="payment-detail-line payment-detail-line--total"><span>Total tagihan</span><strong>{{ formatMoney(activeInvoice.total) }}</strong></div>
              </section>
              <div v-if="activeInvoice.verification === 'verified'" class="payment-verified-panel">
                <CheckCircle2 :size="19" />
                <div><strong>Pembayaran terverifikasi</strong>
                  <small>{{ activeInvoice.status_pembayaran || "LUNAS" }} · {{ activeInvoice.tgl_pembayaran ? formatDateTime(activeInvoice.tgl_pembayaran) : "—" }}</small>
                  <small>Nomor struk: {{ activeInvoice.nostruk || "—" }}</small>
                  <small>Nomor bukti: {{ activeInvoice.nosbm || "—" }}</small>
                </div>
              </div>
              <section v-if="activeInvoice.status === 'ISSUED' && activeInvoice.verification !== 'verified'" class="payment-confirm-section">
                <div class="payment-detail-heading"><strong>Konfirmasi pembayaran</strong></div>
                <p>Masukkan nomor yang tercetak pada struk kasir Transmedik.</p>
                <div class="payment-receipt-fields">
                  <label>Nomor struk<input v-model="paymentReceipt.nostruk" type="text" autocomplete="off" placeholder="Contoh: NL26100001" /></label>
                  <label>Nomor bukti pembayaran<input v-model="paymentReceipt.nosbm" type="text" autocomplete="off" placeholder="Contoh: RV-26100001001" /></label>
                </div>
                <div v-if="paymentConfirming" class="payment-confirm-prompt">
                  <strong>Pastikan nomor sudah sesuai dengan struk kasir.</strong>
                  <div>
                    <button class="payment-copy-button" type="button" :disabled="paymentSubmitting" @click="paymentConfirming = false">Periksa lagi</button>
                    <button class="payment-submit-button" type="button" :disabled="paymentSubmitting" @click="submitPaymentConfirmation">
                      {{ paymentSubmitting ? "Memverifikasi…" : "Ya, konfirmasi pembayaran" }}
                    </button>
                  </div>
                </div>
                <button v-else class="payment-submit-button" type="button" :disabled="paymentSubmitting" @click="askPaymentConfirmation">
                  <CheckCircle2 :size="16" /> Konfirmasi pembayaran
                </button>
              </section>
            </div>

            <footer class="payment-drawer-foot">
              <button class="payment-copy-button" type="button" @click="printInvoice(activeInvoice)">
                <Printer :size="16" /> Cetak invoice
              </button>
              <button class="payment-copy-button" type="button" @click="closePaymentDrawer">Tutup</button>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
/* ===== Ringkasan pembayaran ===== */
.payment-summary-card{display:grid;gap:13px}
.payment-summary-info{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:5px 12px}
.payment-summary-label{grid-column:1/-1;color:var(--muted-foreground);font-size:.7rem;font-weight:700;letter-spacing:.06em}
.payment-summary-info>strong{color:var(--primary);font-size:1.35rem;line-height:1.3}
.payment-status{display:inline-flex;align-items:center;justify-content:center;width:max-content;max-width:100%;padding:5px 9px;border-radius:7px;font-size:.72rem;font-weight:700;white-space:nowrap}
.payment-status--pending{background:var(--color-warning-soft);color:var(--color-warning)}
.payment-status--paid{background:var(--color-success-soft);color:var(--color-success)}
.payment-status--cancelled{background:var(--color-neutral-soft);color:var(--muted-foreground)}
.payment-summary-card>p{margin:0;color:var(--muted-foreground);font-size:.82rem;line-height:1.55}
.payment-open-button{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:42px;padding:9px 14px;border:1px solid var(--primary);border-radius:9px;background:var(--primary);color:var(--primary-foreground);font:inherit;font-size:.84rem;font-weight:700;cursor:pointer;transition:filter .18s ease,transform .18s ease}
.payment-open-button:hover{filter:brightness(.96);transform:translateY(-1px)}
.payment-open-button span{margin-left:auto;font-size:1.1rem}

/* ===== Drawer detail pembayaran ===== */
.payment-drawer-overlay{position:fixed;inset:0;z-index:9999;display:flex;justify-content:flex-end;background:rgba(15,23,42,.48);backdrop-filter:blur(2px)}
/* Drawer: tinggi layar penuh. Header & footer tetap, hanya body yang di-scroll. */
.payment-drawer{display:flex;flex-direction:column;width:min(620px,100%);height:100%;max-height:100dvh;min-height:0;overflow:hidden;background:var(--card);box-shadow:-10px 0 36px rgba(0,0,0,.2)}
.payment-drawer-head{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:14px;padding:17px 20px;border-bottom:1px solid var(--border);background:var(--card)}
.payment-drawer-title{display:flex;align-items:center;gap:11px;min-width:0}
.payment-drawer-title>div{display:grid;gap:3px;min-width:0}
.payment-drawer-title strong{color:var(--foreground);font-size:.96rem}
.payment-drawer-title small{color:var(--muted-foreground);font-size:.76rem;overflow-wrap:anywhere}
.payment-drawer-icon{display:grid;place-items:center;width:40px;height:40px;flex:0 0 40px;border-radius:10px;background:var(--color-primary-soft);color:var(--primary)}
.payment-drawer-head-actions{display:flex;align-items:center;gap:10px}
.payment-close-button{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--muted-foreground);cursor:pointer}
.payment-close-button:hover{border-color:var(--primary);color:var(--primary)}
/* min-height:0 wajib agar flex item boleh lebih kecil dari isinya; tanpa ini scroll tidak muncul. */
.payment-drawer-body{display:flex;flex:1 1 auto;flex-direction:column;gap:15px;min-height:0;padding:20px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.payment-drawer-body>*{flex-shrink:0}
.payment-drawer-foot{display:flex;flex:0 0 auto;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:13px 20px;border-top:1px solid var(--border);background:var(--card)}
.payment-total-panel{display:grid;gap:5px;padding:17px;border-radius:11px;background:var(--muted)}
.payment-total-panel span,.payment-total-panel small{color:var(--muted-foreground);font-size:.78rem}
.payment-total-panel strong{color:var(--primary);font-size:1.65rem;line-height:1.25}
.payment-guidance{display:flex;align-items:flex-start;gap:10px;padding:12px 13px;border:1px solid var(--border);border-radius:9px;background:var(--background);color:var(--muted-foreground)}
.payment-guidance svg{flex:0 0 auto;color:var(--primary)}
.payment-guidance p{margin:0;font-size:.8rem;line-height:1.55}
.payment-guidance--success{border-color:var(--color-success-border);background:var(--color-success-soft);color:var(--color-success)}
.payment-guidance--success svg{color:var(--color-success)}
.payment-reference-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px dashed var(--primary);border-radius:10px;background:var(--color-primary-softer)}
.payment-reference-box span{display:block;color:var(--muted-foreground);font-size:.72rem}
.payment-reference-box strong{display:block;margin-top:4px;color:var(--foreground);font-size:1rem;letter-spacing:.04em;overflow-wrap:anywhere}
.payment-copy-button,.payment-submit-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--foreground);font:inherit;font-size:.78rem;font-weight:700;cursor:pointer}
.payment-copy-button:hover{border-color:var(--primary);color:var(--primary)}
.payment-submit-button{border-color:var(--primary);background:var(--primary);color:var(--primary-foreground)}
.payment-copy-button:disabled,.payment-submit-button:disabled{opacity:.55;cursor:not-allowed}
.payment-detail-section{overflow:hidden;border:1px solid var(--border);border-radius:10px}
.payment-detail-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;background:var(--muted);color:var(--foreground);font-size:.82rem}
.payment-detail-heading span{color:var(--muted-foreground);font-size:.74rem;font-weight:500}
.payment-detail-item,.payment-detail-line{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:11px 13px;border-top:1px solid var(--border);font-size:.8rem}
.payment-detail-item>div{display:grid;gap:4px;min-width:0}
.payment-detail-item>strong{flex:0 0 auto}
.payment-detail-item small{color:var(--muted-foreground);font-size:.72rem}
.payment-detail-line{align-items:center}
.payment-detail-line>span{color:var(--muted-foreground)}
.payment-detail-line--total{background:var(--color-primary-soft);color:var(--primary);font-weight:800}
.payment-detail-line--total>span{color:inherit}
.payment-verified-panel{display:flex;align-items:flex-start;gap:10px;padding:13px;border:1px solid var(--color-success-border);border-radius:10px;background:var(--color-success-soft);color:var(--color-success)}
.payment-verified-panel>div{display:grid;gap:4px}
.payment-verified-panel small{color:var(--muted-foreground);font-size:.74rem}
.payment-confirm-section{display:grid;gap:12px;padding-top:15px;border-top:1px solid var(--border)}
.payment-confirm-section>p{margin:-5px 0 0;color:var(--muted-foreground);font-size:.8rem;line-height:1.5}
.payment-receipt-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.payment-receipt-fields label{display:grid;gap:6px;color:var(--foreground);font-size:.78rem;font-weight:700}
.payment-receipt-fields input{width:100%;min-width:0;min-height:40px;padding:0 11px;border:1px solid var(--input);border-radius:8px;background:var(--background);color:var(--foreground);font:inherit;font-size:.82rem}
.payment-receipt-fields input:focus{outline:2px solid var(--color-primary-shadow);outline-offset:1px;border-color:var(--primary)}
.payment-confirm-prompt{display:grid;gap:10px;padding:13px;border:1px solid var(--color-warning-border);border-radius:9px;background:var(--color-warning-soft);font-size:.8rem}
.payment-confirm-prompt>div{display:flex;flex-wrap:wrap;gap:8px}
.payment-drawer-enter-active,.payment-drawer-leave-active{transition:opacity .2s ease}
.payment-drawer-enter-active .payment-drawer,.payment-drawer-leave-active .payment-drawer{transition:transform .22s ease}
.payment-drawer-enter-from,.payment-drawer-leave-to{opacity:0}
.payment-drawer-enter-from .payment-drawer,.payment-drawer-leave-to .payment-drawer{transform:translateX(100%)}
@media(max-width:640px){.payment-drawer{width:100%}.payment-drawer-head{align-items:flex-start;padding:14px 15px}.payment-drawer-head-actions{gap:7px}.payment-drawer-body{padding:15px}.payment-drawer-foot{padding:12px 15px}.payment-drawer-foot .payment-copy-button{flex:1}.payment-receipt-fields{grid-template-columns:minmax(0,1fr)}.payment-summary-info{grid-template-columns:1fr;align-items:start}.payment-summary-info>strong{font-size:1.25rem}.payment-summary-info .payment-status{justify-self:start}.payment-reference-box{align-items:flex-start}.payment-copy-button{flex:0 0 auto}}

/* ===== Halaman ===== */
.detail-pengajuan {
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
  font-size: 0.8rem;
  line-height: 1.55;
}

.empty-text {
  margin: 0;
  padding: 28px 16px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: 0.84rem;
}

/* ===== Heading ===== */
.page-heading {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 4px 0 4px;
}

.page-heading h1 {
  margin: 0;
  color: var(--primary);
  font-size: clamp(1.45rem, 2.2vw, 1.9rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
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
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.btn:focus-visible,
.link-button:focus-visible,
.icon-button:focus-visible,
.rev-drop:focus-visible,
.tabs button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.55;
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

.btn--sm {
  min-height: 34px;
  padding: 0 11px;
  font-size: 0.74rem;
}

.link-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--primary);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}

.link-button:hover {
  text-decoration: underline;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--muted-foreground);
  cursor: pointer;
}

.icon-button:hover {
  border-color: var(--destructive);
  color: var(--destructive);
}

/* ===== Hero ===== */
.application-hero {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--gradient-primary-soft);
  box-shadow: var(--shadow-sm);
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.application-type {
  display: inline-block;
  margin-bottom: 7px;
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-top h2 {
  max-width: 850px;
  margin: 0;
  font-size: clamp(1.15rem, 2vw, 1.55rem);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.application-number {
  margin: 8px 0 0;
  color: var(--muted-foreground);
  font-size: 0.82rem;
  font-weight: 600;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 0.8rem;
}

.hero-meta span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.hero-meta svg {
  color: var(--primary);
}

/* ===== Status ===== */
.status {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-height: 29px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
}

.status--draft,
.status--waiting {
  color: var(--color-warning);
  background: var(--color-warning-soft);
}

.status--submitted,
.status--review {
  color: var(--accent-foreground);
  background: var(--color-success-soft);
}

.status--revision {
  color: var(--destructive-foreground);
  background: var(--destructive);
}

.status--approved,
.status--completed,
.status--issued {
  color: var(--accent-foreground);
  background: var(--color-success-soft);
}

.status--rejected {
  color: var(--destructive);
  background: var(--color-danger-soft);
}

.status--default {
  color: var(--muted-foreground);
  background: var(--color-neutral-soft);
}

/* ===== Langkah berikutnya ===== */
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
  font-size: 0.95rem;
}

.next-step-body p {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: 0.83rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
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

.next-step--danger {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
}

.next-step--danger .next-step-icon {
  background: var(--card);
  color: var(--color-danger);
}

/* ===== Layout ===== */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.85fr);
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

.card--warning {
  border-color: var(--color-warning-border);
  scroll-margin-top: 16px;
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
  font-size: 0.92rem;
  font-weight: 700;
}

.card-header>svg {
  color: var(--primary);
}

.card--warning .card-header>svg {
  color: var(--color-warning);
}

.card--danger {
  border-color: var(--color-danger-border);
  scroll-margin-top: 16px;
}

.card--danger .card-header>svg {
  color: var(--destructive);
}

.header-chip {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: 0.7rem;
  font-weight: 700;
}

.card-body {
  display: grid;
  gap: 12px;
  padding: 16px 20px 20px;
}

/* ===== Informasi ===== */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.info-item {
  min-width: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.info-item:last-child {
  border-bottom: 0;
}

.info-item--full {
  grid-column: 1 / -1;
}

.info-item>span {
  display: block;
  margin-bottom: 6px;
  color: var(--primary);
  font-size: 0.74rem;
  font-weight: 700;
}

.rich-text-content {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.9rem;
  line-height: 1.6;
}

/* ===== Dokumen ===== */
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
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.document-info span,
.document-info small {
  color: var(--muted-foreground);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}

/* ===== Revisi reviewer ===== */
.rev-body {
  display: grid;
  gap: 14px;
  padding: 16px 20px 20px;
}

.rev-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--muted);
}

.rev-bar span {
  display: block;
  height: 100%;
  background: var(--primary);
  transition: width 0.25s ease;
}

.rev-doc {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.rev-doc--ready {
  border-color: var(--color-success-border);
}

.rev-doc__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rev-doc__num {
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.78rem;
  font-weight: 800;
}

.rev-doc__title {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.rev-doc__title strong {
  font-size: 0.9rem;
}

.rev-doc__title small {
  color: var(--muted-foreground);
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.rev-doc__state {
  flex: 0 0 auto;
  padding: 4px 9px;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.rev-doc__state--wait {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.rev-doc__state--ok {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.rev-notes {
  display: grid;
  gap: 10px;
}

.rev-notes__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.82rem;
}

.rev-notes__head strong span {
  color: var(--muted-foreground);
  font-weight: 500;
}

.rev-notes__list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rev-note {
  padding: 12px 14px;
  border-left: 3px solid var(--color-warning);
  border-radius: 0 8px 8px 0;
  background: var(--muted);
}

.rev-note__who {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 7px;
}

.rev-note__who strong {
  font-size: 0.8rem;
}

.rev-note__who small {
  color: var(--muted-foreground);
  font-size: 0.7rem;
}

.rev-note__avatar {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-muted);
  color: var(--primary);
  font-size: 0.68rem;
  font-weight: 800;
}

.rev-note p {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.rev-drop {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px;
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  background: var(--background);
  color: var(--muted-foreground);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rev-drop:hover,
.rev-drop--over {
  border-color: var(--primary);
  background: var(--color-primary-softer);
  color: var(--primary);
}

.rev-drop span {
  display: grid;
  gap: 2px;
}

.rev-drop strong {
  color: var(--foreground);
  font-size: 0.86rem;
}

.rev-drop small {
  color: var(--muted-foreground);
  font-size: 0.74rem;
}

.rev-file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-success-border);
  border-radius: 10px;
  background: var(--color-success-soft);
  color: var(--color-success);
}

.rev-file span {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.rev-file strong {
  color: var(--foreground);
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}

.rev-file small {
  color: var(--muted-foreground);
  font-size: 0.74rem;
}

.rev-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--destructive);
  font-size: 0.78rem;
}

.rev-foot {
  display: grid;
  justify-items: start;
  gap: 12px;
}

.rev-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.8rem;
  line-height: 1.55;
}

.rev-hint svg {
  flex: 0 0 auto;
  margin-top: 2px;
}

.rev-hint--wait {
  width: 100%;
  padding: 11px 13px;
  border-radius: 9px;
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.rev-hint--ok {
  color: var(--color-success);
}

.rev-confirm {
  width: 100%;
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  background: var(--color-primary-softer);
  font-size: 0.84rem;
}

.rev-confirm p {
  margin: 0;
  line-height: 1.5;
}

.rev-confirm>div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ===== Tab ===== */
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
  font-size: 0.84rem;
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
  font-size: 0.68rem;
  font-weight: 700;
}

/* ===== Catatan petugas ===== */
.officer-note {
  padding: 14px 16px;
  border-left: 3px solid var(--color-warning);
  border-radius: 0 10px 10px 0;
  background: var(--color-warning-soft);
}

.officer-note--bad {
  border-left-color: var(--destructive);
  background: var(--color-danger-soft);
}

.officer-note__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 8px;
  font-size: 0.8rem;
}

.officer-note__meta time {
  color: var(--muted-foreground);
  font-size: 0.74rem;
}

.officer-note p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.officer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

/* ===== Riwayat per tahap ===== */
.steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  --tone: var(--primary);
  --tone-soft: var(--color-primary-soft);
  position: relative;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding-bottom: 20px;
}

.step:last-child {
  padding-bottom: 0;
}

.step--good {
  --tone: var(--color-success);
  --tone-soft: var(--color-success-soft);
}

.step--warn {
  --tone: var(--color-warning);
  --tone-soft: var(--color-warning-soft);
}

.step--bad {
  --tone: var(--destructive);
  --tone-soft: var(--color-danger-soft);
}

.step:not(:last-child)::before {
  content: "";
  position: absolute;
  top: 24px;
  bottom: 2px;
  left: 10px;
  width: 2px;
  background: var(--primary);
  opacity: 0.35;
}

.step__dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--primary);
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
}

.step--current .step__dot {
  border-color: var(--tone);
  background: var(--card);
  box-shadow: 0 0 0 4px var(--tone-soft);
}

.step--current .step__dot::after {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tone);
}

.step__body strong {
  display: block;
  font-size: 0.86rem;
}

.step--done .step__body strong {
  font-weight: 600;
}

.step__body time {
  display: block;
  margin-top: 3px;
  color: var(--muted-foreground);
  font-size: 0.74rem;
}

.step__badge {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--tone-soft);
  color: var(--tone);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ===== Status halaman ===== */
.state-container {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  min-height: 320px;
  color: var(--muted-foreground);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-primary-shadow);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
}

.alert {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.88rem;
}

.alert--error {
  border: 1px solid var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--destructive);
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 320px;
  padding: 40px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  background: var(--card);
  color: var(--muted-foreground);
  text-align: center;
}

.empty-state h2,
.empty-state p {
  margin: 0;
}

.empty-state h2 {
  color: var(--foreground);
  font-size: 1.15rem;
}

.bottom-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: 4px;
}

/* ===== Responsif ===== */
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side-column {
    position: static;
  }
}

@media (max-width: 680px) {
  .application-hero {
    padding: 18px;
    border-radius: 12px;
  }

  .hero-top,
  .next-step,
  .rev-notes__head {
    flex-direction: column;
    align-items: stretch;
  }

  .next-step .btn {
    width: 100%;
  }

  .hero-meta {
    display: grid;
    gap: 9px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .info-item {
    padding: 14px 16px;
  }

  .document {
    flex-wrap: wrap;
  }

  .rev-body {
    padding: 14px 16px 18px;
  }

  .rev-doc__head {
    flex-wrap: wrap;
  }

  .rev-doc__state {
    margin-left: 40px;
  }

  .rev-foot .btn {
    width: 100%;
  }

  .rev-confirm>div .btn {
    flex: 1;
  }
}
@media (max-width: 680px) {
  .officer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .officer-actions .btn {
    width: 100%;
  }
}
</style>