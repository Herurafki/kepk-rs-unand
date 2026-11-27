<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, FileText, Save, Upload } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import FormSection from '../../components/researcher/FormSection.vue'
import {
  deleteApplicationDocument,
  downloadApplicationDocument,
  getDataCollectionDetail,
  getApplicationHistory,
  reviseApplication,
  uploadApplicationDocument,
  type ApplicationData,
  type ApplicationRevisionPayload,
} from '../../services/researcher/data-collection.service'
import { getApiErrorMessage } from '../../services/api/error'
import { displayDocumentInTab, openDocumentTab } from '../../utils/document-preview'

const route = useRoute()
const router = useRouter()
const application = ref<ApplicationData | null>(null)
const loading = ref(false)
const saving = ref(false)
const documentSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const revisionNote = ref('')
const confirmationChecked = ref(false)





const documentFileName = (doc: NonNullable<ApplicationData['documents']>[number]) =>
  doc.file_name || doc.original_name || 'Dokumen'

const documentDate = (doc: NonNullable<ApplicationData['documents']>[number]) =>
  doc.uploaded_at || doc.created_at || ''

const form = ref({
  research_title: '', research_background: '', research_objectives: '',
  research_methodology: '', research_location: '', research_institution: '',
  research_duration: '', data_collection_date: '', data_needed: '',
  purpose: '', person_responsible: '',
})

const isRevision = computed(() => application.value?.status === 'REVISION_REQUIRED')
const isDataAwal = computed(() => application.value?.application_type === 'DATA_AWAL')
const applicationTypeLabel = computed(() => ({
  DATA_AWAL: 'Pengambilan Data Awal',
  IZIN_PENELITIAN: 'Pengajuan Penelitian',
  IZIN_ETIK: 'Pengajuan Kaji Etik',
}[application.value?.application_type || ''] || 'Pengajuan'))

const durations = Array.from({ length: 12 }, (_, i) => `${i + 1} Bulan`)
const units = [
  'CENTRAL STERILE SUPPLY DEPARTMENT (CSSD) DAN LAUNDRY', 'Instalasi Bedah Sentral dan Anastesi',
  'Instalasi Diagnostik Terpadu', 'Instalasi Dialisis', 'Instalasi Farmasi',
  'Instalasi Gawat Darurat', 'Instalasi Gizi', 'Instalasi Kedokteran Forensik',
  'Instalasi Kesehatan Lingkungan', 'Instalasi Laboratorium dan Bank Darah',
  'Instalasi Onkologi Terpadu', 'Instalasi PEMELIHARAAN SARANA RUMAH SAKIT (IPS RS)',
  'Instalasi Radiodiagnostik', 'Instalasi Rawat Inap', 'Instalasi Rawat Intensif',
  'Instalasi Rawat Jalan', 'Instalasi Rehabilitasi Medik', 'Instalasi Rekam Medik',
  'Instalasi SISTEM MANAJEMEN RUMAH SAKIT (SIM RS)',
]

const loadApplication = async () => {
  const id = String(route.params.id || '')
  if (!id) { errorMessage.value = 'ID pengajuan tidak valid.'; return }
  loading.value = true
  try {
    const response = await getDataCollectionDetail(id)
    if (!response.success || !response.data) { errorMessage.value = 'Data pengajuan tidak ditemukan.'; return }
    application.value = response.data
    try {
      const history = await getApplicationHistory(id)
      const latestRevision = (history.data || [])
        .filter(item => item.new_status === 'REVISION_REQUIRED' && item.note?.trim())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      revisionNote.value = latestRevision?.note?.trim() || ''
    } catch {
      revisionNote.value = ''
    }
    if (response.data.status !== 'REVISION_REQUIRED') {
      errorMessage.value = 'Pengajuan hanya dapat diedit ketika statusnya Revisi.'
      return
    }
    const a = response.data
    form.value = {
      research_title: a.research_title ?? '',
      research_background: a.research_background ?? '',
      research_objectives: a.research_objectives ?? '',
      research_methodology: a.research_methodology ?? '',
      research_location: a.research_location ?? '',
      research_institution: a.research_institution ?? '',
      research_duration: a.research_duration ?? '',
      data_collection_date: a.data_collection_date ? a.data_collection_date.slice(0, 10) : '',
      data_needed: a.data_needed ?? '',
      purpose: a.purpose ?? '',
      person_responsible: a.person_responsible ?? '',
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal memuat pengajuan revisi.')
  } finally { loading.value = false }
}

const goBack = () => router.push({ name: 'researcher-status-detail', params: { id: route.params.id } })


const viewDocument = async (documentId: string, fileName: string) => {
  const previewWindow = openDocumentTab()
  if (!previewWindow) {
    errorMessage.value = 'Browser memblokir tab dokumen. Izinkan pop-up untuk situs ini, lalu coba lagi.'
    return
  }
  errorMessage.value = ''
  try {
    const blob = await downloadApplicationDocument(documentId)
    displayDocumentInTab(previewWindow, blob, fileName)
  } catch (error) {
    previewWindow.close()
    errorMessage.value = getApiErrorMessage(error, 'Dokumen tidak dapat dibuka.')
  }
}

const replaceDocument = async (doc: NonNullable<ApplicationData['documents']>[number], event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !application.value || !isRevision.value) return

  documentSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    // 1. Upload dokumen baru terlebih dahulu
    const uploadRes = await uploadApplicationDocument(application.value.id, {
      file,
      document_type: doc.document_type || 'LAINNYA',
    })
    
    // 2. Hapus dokumen lama yang diganti
    await deleteApplicationDocument(doc.id)

    // 3. Update state dokumen secara lokal di frontend agar urutannya tidak "loncat"
    if (application.value.documents) {
      const index = application.value.documents.findIndex(d => d.id === doc.id)
      if (index !== -1 && uploadRes.data) {
        // Ganti dokumen lama dengan dokumen baru di posisi indeks yang SAMA persis
        application.value.documents[index] = uploadRes.data
      } else {
        // Fallback jika respons upload tidak mengembalikan objek dokumen lengkap, refresh data
        const response = await getDataCollectionDetail(application.value.id)
        if (response.success && response.data) application.value = response.data
      }
    }

    successMessage.value = 'Dokumen berhasil diganti.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal mengganti dokumen.')
  } finally {
    documentSaving.value = false
  }
}



const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  if (!application.value || !isRevision.value) return

  const required: Array<[keyof typeof form.value, string]> = [
    ['research_title', 'Judul penelitian'], ['research_location', 'Unit / instalasi tujuan'],
    ['research_institution', 'Institusi penelitian'], ['data_needed', 'Kebutuhan data'],
    ['purpose', 'Tujuan'], ['person_responsible', 'Penanggung jawab'],
  ]
  if (isDataAwal.value) required.push(['data_collection_date', 'Waktu pengambilan data'])
  else required.push(
    ['research_background', 'Ringkasan penelitian'], ['research_objectives', 'Tujuan penelitian'],
    ['research_methodology', 'Metode penelitian'], ['research_duration', 'Durasi penelitian'],
  )
  const missing = required.find(([key]) => !String(form.value[key]).trim())
  if (missing) { errorMessage.value = `${missing[1]} wajib diisi.`; return }

  saving.value = true
  try {
    const payload: ApplicationRevisionPayload = {
      research_title: form.value.research_title.trim(),
      research_background: form.value.research_background.trim(),
      research_objectives: form.value.research_objectives.trim(),
      research_methodology: form.value.research_methodology.trim(),
      research_location: form.value.research_location.trim(),
      research_institution: form.value.research_institution.trim(),
      research_duration: form.value.research_duration.trim(),
      data_collection_date: form.value.data_collection_date || undefined,
      data_needed: form.value.data_needed.trim(),
      purpose: form.value.purpose.trim(),
      person_responsible: form.value.person_responsible.trim(),
    }
    const response = await reviseApplication(application.value.id, payload)
    if (!response.success) { errorMessage.value = 'Gagal mengirim revisi pengajuan.'; return }
    successMessage.value = 'Perubahan berhasil disimpan dan pengajuan telah dikirim kembali.'
    window.setTimeout(goBack, 900)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal mengirim revisi pengajuan. Silakan coba lagi.')
  } finally { saving.value = false }
}

onMounted(loadApplication)
</script>

<template>
  <main class="form-page">
    <div class="form-header">
      <p class="form-eyebrow">PENGAJUAN</p>
      <h1 class="form-title">Edit Pengajuan</h1>
      <p class="form-subtitle">Perbarui data pengajuan sesuai catatan revisi.</p>
    </div>

    <div v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</div>
    <div v-if="loading" class="state">
      <div class="spinner" />
      <p>Memuat data pengajuan...</p>
    </div>

    <template v-else-if="application && isRevision">

      <section class="summary">
        <span>{{ applicationTypeLabel }}</span>
        <h2>{{ application.research_title }}</h2>
        <small>{{ application.application_number }}</small>
      </section>

      <section class="revision-banner">
        <div class="revision-icon"><FileText :size="20" /></div>
        <div>
          <strong>Pengajuan perlu diperbaiki</strong>
          <p v-if="revisionNote" class="revision-note">{{ revisionNote }}</p>
          <p>
            Perbaiki data yang diminta lalu klik <b>Simpan & Kirim Revisi</b>.
            Status akan kembali menjadi <b>Diajukan</b>.
          </p>
        </div>
      </section>

      <form class="form-container" @submit.prevent="handleSubmit">
        <FormSection title="INFORMASI PENGAJUAN" icon="Info">
          <div class="form-grid">
            <div class="form-field form-field--full">
              <label class="form-label">JUDUL PENELITIAN <b>*</b></label>
              <input
                v-model="form.research_title"
                class="form-input"
                type="text"
                maxlength="255"
                required
              >
            </div>

            <div v-if="!isDataAwal" class="form-field form-field--full">
              <label class="form-label">RINGKASAN PENELITIAN <b>*</b></label>
              <textarea
                v-model="form.research_background"
                class="form-textarea"
                rows="5"
                required
              />
            </div>

            <div v-if="!isDataAwal" class="form-field form-field--full">
              <label class="form-label">TUJUAN PENELITIAN <b>*</b></label>
              <textarea
                v-model="form.research_objectives"
                class="form-textarea"
                rows="4"
                required
              />
            </div>

            <div class="form-field">
              <label class="form-label">PENANGGUNG JAWAB <b>*</b></label>
              <input v-model="form.person_responsible" class="form-input" type="text" required>
            </div>

            <div v-if="!isDataAwal" class="form-field">
              <label class="form-label">DURASI PENELITIAN <b>*</b></label>
              <select v-model="form.research_duration" class="form-input" required>
                <option value="">Pilih durasi</option>
                <option v-for="duration in durations" :key="duration" :value="duration">
                  {{ duration }}
                </option>
              </select>
            </div>

            <div v-if="isDataAwal" class="form-field">
              <label class="form-label">WAKTU PENGAMBILAN DATA <b>*</b></label>
              <input
                v-model="form.data_collection_date"
                class="form-input"
                type="date"
                required
              >
            </div>

            <div class="form-field">
              <label class="form-label">UNIT / INSTALASI TUJUAN <b>*</b></label>
              <select v-model="form.research_location" class="form-input" required>
                <option value="">Pilih unit</option>
                <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
              </select>
            </div>

            <div class="form-field">
              <label class="form-label">INSTITUSI PENELITIAN <b>*</b></label>
              <input
                v-model="form.research_institution"
                class="form-input"
                type="text"
                required
              >
            </div>

            <div class="form-field form-field--full">
              <label class="form-label">
                {{ isDataAwal ? 'TUJUAN PENGAMBILAN DATA AWAL' : 'TUJUAN PENELITIAN' }}
                <b>*</b>
              </label>
              <textarea v-model="form.purpose" class="form-textarea" rows="4" required />
            </div>

            <div class="form-field form-field--full">
              <label class="form-label">KEBUTUHAN DATA <b>*</b></label>
              <textarea v-model="form.data_needed" class="form-textarea" rows="4" required />
            </div>

            <div v-if="!isDataAwal" class="form-field form-field--full">
              <label class="form-label">METODE PENELITIAN <b>*</b></label>
              <textarea
                v-model="form.research_methodology"
                class="form-textarea"
                rows="5"
                required
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="DOKUMEN PENDUKUNG" icon="FileText">
          <div class="document-note">
            <FileText :size="18" />
            <span>
              Dokumen dapat dilihat, diunduh, ditambah, atau dihapus selama status pengajuan
              masih Revisi.
            </span>
          </div>

          <div v-if="application.documents?.length" class="documents">
            <div v-for="doc in application.documents" :key="doc.id" class="document">
              <div class="document-main">
                <FileText :size="18" />
                <div>
                  <strong>{{ doc.document_type || 'Dokumen pendukung' }}</strong>
                  <small>{{ documentFileName(doc) }}</small>
                  <small v-if="documentDate(doc)">
                    Diunggah {{ new Date(documentDate(doc)).toLocaleDateString('id-ID') }}
                  </small>
                </div>
              </div>

              <div class="document-actions">
                <button
                  class="document-button"
                  type="button"
                  title="Lihat dokumen"
                  @click="viewDocument(String(doc.id), documentFileName(doc))"
                >
                  <FileText :size="16" />
                  Lihat
                </button>
                <label class="document-button document-edit-button" :aria-disabled="documentSaving">
                  <Upload :size="16" />
                  Edit
                  <input
                    class="document-replace-input"
                    type="file"
                    :disabled="documentSaving"
                    :aria-label="`Ganti ${documentFileName(doc)}`"
                    @change="replaceDocument(doc, $event)"
                  >
                </label>
              </div>
            </div>
          </div>

          
        </FormSection>

        <label class="confirmation">
        <input v-model="confirmationChecked" type="checkbox" required>
        <span>
          Saya memastikan bawah informasi yang saya ajukan benar
        </span>
      </label>

        <div v-if="successMessage" class="alert alert--success">
          <CheckCircle2 :size="18" />
          {{ successMessage }}
        </div>

        <div class="form-actions">
          <button class="btn btn--secondary" type="button" :disabled="saving" @click="goBack">
            Batal
          </button>
          <button class="btn btn--primary" type="submit" :disabled="saving">
            <Save :size="18" />
            {{ saving ? 'Mengirim...' : 'Simpan & Kirim Revisi' }}
          </button>
        </div>
      </form>
    </template>

    <div v-else class="state">
      <FileText :size="42" />
      <h2>Pengajuan tidak dapat diedit</h2>
      <p>Fitur edit hanya tersedia ketika status pengajuan adalah Revisi.</p>
      <button class="btn btn--secondary" type="button" @click="goBack">
        Kembali ke Detail
      </button>
    </div>
  </main>
</template>

<style scoped>
.form-eyebrow {
  margin: 0 0 4px;
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.revision-banner {
  display: flex;
  gap: 13px;
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid var(--color-danger-border);
  border-radius: 12px;
  background: var(--color-danger-soft);
  color: var(--destructive);
}

.revision-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 9px;
  background: var(--color-danger-soft);
}

.revision-banner p {
  margin: 4px 0 0;
  color: var(--destructive);
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.revision-banner .revision-note {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--color-danger-border);
  border-radius: 8px;
  background: var(--card);
  color: var(--foreground);
  white-space: pre-wrap;
}

.summary {
  margin-bottom: 20px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
}

.summary > span {
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary h2 {
  margin: 5px 0;
  color: var(--foreground);
  font-size: 1.1rem;
  line-height: 1.45;
}

.summary small {
  color: var(--muted-foreground);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.form-field {
  display: grid;
  gap: 8px;
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-label {
  color: var(--accent-foreground);
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.form-label b {
  color: var(--destructive);
}

.form-input,
.form-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 0.96rem;
  outline: none;
  transition: all 200ms ease;

  &:hover {
    border-color: color-mix(in srgb, var(--ring) 40%, var(--input));
  }

  &:focus {
    border-color: var(--ring);
    box-shadow: var(--shadow-focus);
  }

  &:disabled {
    background: var(--muted);
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
  line-height: 1.55;
}

.form-input--small {
  padding: 8px 9px;
}

.document-note {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 9px;
  background: var(--color-primary-soft);
  color: var(--muted-foreground);
  font-size: 0.78rem;
  line-height: 1.5;
}

.document-note svg {
  flex: 0 0 auto;
  color: var(--primary);
}

.documents {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.document {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.document-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.document-main > svg {
  flex: 0 0 auto;
  color: var(--primary);
}

.document strong {
  display: block;
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.document small {
  display: block;
  margin-top: 2px;
  color: var(--muted-foreground);
  font-size: 0.72rem;
}

.document-actions {
  display: flex;
  gap: 7px;
  flex: 0 0 auto;
}

.document-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--card);
  color: var(--primary);
  font: inherit;
  font-size: 0.75rem;
  text-decoration: none;
  cursor: pointer;
}

.document-edit-button {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.document-replace-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.document-edit-button[aria-disabled="true"] {
  opacity: 0.6;
  pointer-events: none;
}
.document-button--danger {
  color: var(--destructive);
}

.confirmation {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 8px;
  color: var(--foreground);
  font-size: .92rem;
  line-height: 1.5;
  cursor: pointer;
}

.confirmation input {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  margin-top: 1px;
  accent-color: var(--primary);
}


.upload-box {
  margin-top: 12px;
  padding: 14px;
  border: 1px dashed var(--border);
  border-radius: 9px;
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--color-primary-soft);
  color: var(--primary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.upload-label input {
  display: none;
}

.selected-documents {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.selected-document {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px 34px;
  gap: 8px;
  align-items: center;
}

.remove-selected {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--card);
  color: var(--destructive);
  cursor: pointer;
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px 15px;
  border-radius: 9px;
  font-size: 0.84rem;
}

.alert--error {
  border: 1px solid var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--destructive);
}

.alert--success {
  border: 1px solid var(--color-success-border);
  background: var(--color-success-soft);
  color: var(--accent-foreground);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  gap: 8px;
  height: 44px;
  padding: 0 24px;
  border: 1px solid var(--color-transparent);
  border-radius: 8px;
  font-size: 0.96rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn--primary {
  background: var(--color-primary);
  color: var(--primary-foreground);
  box-shadow: var(--shadow-primary-sm);

  &:hover:not(:disabled) {
    background: var(--color-primary-dark);
    box-shadow: var(--shadow-primary-md);
  }
}

.btn--secondary {
  border-color: var(--border);
  background: var(--card);
  color: var(--primary);

  &:hover:not(:disabled) {
    border-color: var(--primary);
    background: var(--color-primary-soft);
  }
}

.state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  min-height: 320px;
  padding: 30px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--card);
  color: var(--muted-foreground);
  text-align: center;
}

.state h2,
.state p {
  margin: 0;
}

.state h2 {
  color: var(--foreground);
  font-size: 1.1rem;
}

.spinner {
  width: 34px;
  height: 34px;
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

@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-field--full {
    grid-column: auto;
  }

  .selected-document {
    grid-template-columns: 1fr;
  }

  .remove-selected {
    justify-self: end;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions .btn {
    width: 100%;
  }
}
</style>
