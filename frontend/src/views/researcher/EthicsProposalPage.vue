<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {FileText} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/routes/auth'
import {
  getDataCollectionDetail,
  submitEthicsApplication,
  type EthicsApplicationSubmission,
} from '../../services/researcher/data-collection.service'
import { getApiErrorMessage } from '../../services/api/error'
import FormSection from '../../components/researcher/FormSection.vue'
import FileUpload from '../../components/researcher/FileUpload.vue'
import ResearcherInfoCard from '../../components/researcher/ResearcherInfoCard.vue'
import { useToast } from '../../composables/useToast'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const parentApplicationId = computed(() => {
  const value = route.query.applicationId
  const normalized = typeof value === 'string' ? value.trim() : ''
  return /^\d+$/.test(normalized) ? normalized : undefined
})

const isNeedEthics = computed(() => parentApplicationId.value !== undefined)

const researchProfileFields = ['name', 'identity', 'institution', 'faculty', 'programStudy', 'email'] as const

const formData = ref({
  researchTitle: '',
  researchSummary: '',
  researchPurpose: '',
  supervisorName: '',
  researchDuration: '',
  targetUnit: '',
  researchMethod: '',
  researchSubject: '',
  dataRequirements: '',
})

const documents = ref<Record<string, File | null>>({
  coverLetter: null,
  ethicsForm: null,
  proposal: null,
  informedConsent: null,
  researcherCv: null,
  conflictStatement: null,
  paymentProof: null,
})

const screeningAnswers = ref<Record<string, string>>({
  question1: '',
  question2: '',
  question3: '',
  question4: '',
  question5: '',
  question6: '',
})

const screeningQuestions = [
  'Apakah data atau informasi yang digunakan telah dianonimkan sepenuhnya sehingga subjek tidak dapat diidentifikasi, baik secara langsung maupun tidak langsung, termasuk melalui nama, nomor rekam medis, nomor identitas, alamat, atau pengenal lainnya?',
  'Apakah penelitian melibatkan interaksi, wawancara, kuesioner, observasi, pemeriksaan, pengukuran, pengujian, atau intervensi secara langsung terhadap manusia sebagai subjek penelitian?',
  'Apakah penelitian melibatkan kelompok rentan, seperti anak, ibu hamil, lansia, penyandang disabilitas, pasien dengan gangguan kesadaran atau gangguan kejiwaan, atau kelompok yang memiliki keterbatasan dalam memberikan persetujuan?',
  'Apakah penelitian berpotensi menimbulkan risiko atau ketidaknyamanan bagi subjek penelitian, baik secara fisik, psikologis, sosial, maupun ekonomi?',
  'Apakah penelitian melibatkan spesimen biologis, seperti darah, jaringan, urin, saliva, cairan tubuh, sel, atau bahan biologis lainnya yang berasal dari manusia?',
  'Apakah penelitian melibatkan tindakan, perlakuan, atau prosedur terhadap organisme hidup selain manusia yang berpotensi menyebabkan rasa sakit, cedera, penderitaan, perubahan kondisi, atau kematian?',
]

const confirmationChecked = ref(false)
const loading = ref(false)
const loadingParent = ref(false)
const parentDocuments = ref<Array<{ id: string | number; file_name?: string; original_name?: string; document_type?: string; file_path?: string }>>([])
const researchDurations = Array.from({ length: 12 }, (_, index) => `${index + 1} Bulan`)

const availableUnits = [
  'CENTRAL STERILE SUPPLY DEPARTMENT (CSSD) DAN LAUNDRY',
  'Instalasi Bedah Sentral dan Anastesi',
  'Instalasi Diagnostik Terpadu',
  'Instalasi Dialisis',
  'Instalasi Farmasi',
  'Instalasi Gawat Darurat',
  'Instalasi Gizi',
  'Instalasi Kedokteran Forensik',
  'Instalasi Kesehatan Lingkungan',
  'Instalasi Laboratorium dan Bank Darah',
  'Instalasi Onkologi Terpadu',
  'Instalasi PEMELIHARAAN SARANA RUMAH SAKIT (IPS RS)',
  'Instalasi Radiodiagnostik',
  'Instalasi Rawat Inap',
  'Instalasi Rawat Intensif',
  'Instalasi Rawat Jalan',
  'Instalasi Rehabilitasi Medik',
  'Instalasi Rekam Medik',
  'Instalasi SISTEM MANAJEMEN RUMAH SAKIT (SIM RS)',
]

const documentDefinitions = [
  { key: 'coverLetter', label: 'SURAT PENGANTAR DARI INSTANSI', aliases: ['surat pengantar', 'surat permohonan', 'surat_pengantar', 'surat_pendukung', 'cover_letter'], required: true },
  { key: 'ethicsForm', label: 'FORMULIR PERMOHONAN KAJI ETIK', aliases: ['formulir etik', 'formulir kaji etik', 'permohonan kaji etik', 'formulir_etika', 'formulir_etik', 'ethics_form'], required: true },
  { key: 'proposal', label: 'PROPOSAL PENELITIAN', aliases: ['proposal', 'rancangan penelitian', 'proposal_penelitian', 'PROPOSAL'], required: true },
  { key: 'informedConsent', label: 'PSP & INFORMED CONSENT', aliases: ['psp', 'informed consent', 'persetujuan setelah penjelasan', 'informed_consent', 'psp_informed_consent', 'PSP_INFORMED_CONSENT'], required: true },
  { key: 'researchInstruments', label: 'INSTRUMEN PENELITIAN', aliases: ['instrumen', 'kuesioner', 'pedoman wawancara', 'instrumen penelitian', 'research_instruments', 'questionnaire'], required: false },
  { key: 'researcherCv', label: 'BIODATA PENELITI (CV) DAN SERTIFIKAT PELATIHAN ETIK PENELITIAN / GCP PENELITI UTAMA', aliases: ['biodata', 'cv', 'curriculum vitae', 'biodata_peneliti', 'researcher_cv', 'CV'], required: true },
  { key: 'researchTeamList', label: 'DAFTAR PENELITI / ANGGOTA TIM PENELITIAN', aliases: ['daftar peneliti', 'anggota tim', 'tim penelitian', 'research_team', 'daftar_peneliti'], required: true },
  { key: 'conflictStatement', label: 'SURAT PERNYATAAN TIDAK ADA KONFLIK KEPENTINGAN', aliases: ['konflik kepentingan', 'conflict of interest', 'tidak ada konflik', 'conflict_of_interest', 'SURAT_PERNYATAAN_TIDAK_ADA_KONFLIK_KEPENTINGAN'], required: true },
  { key: 'approvalLetter', label: 'BUKTI PERSETUJUAN PEMBIMBING/ PERSETUJUAN SPONSOR', aliases: ['persetujuan pembimbing', 'persetujuan sponsor', 'bukti persetujuan', 'approval_letter', 'sponsor_approval'], required: false },
  { key: 'investigatorBrochure', label: 'BROSUR PENELITI , PROTOKOL SPONSOR, DAN ASURANSI/INDEMNIFIKASI SUBJEK', aliases: ['brosur peneliti', 'protokol sponsor', 'asuransi subjek', 'indemnifikasi', 'investigator_brochure', 'sponsor_protocol'], required: false },
  { key: 'animalEthics', label: 'DOKUMEN TERKAIT PENGGUNAAN HEWAN COBA, TERMASUK KAJI ETIK PENGGUNAAN HEWAN', aliases: ['hewan coba', 'etik hewan', 'kaji etik hewan', 'animal_ethics', 'hewan_coba'], required: false },
  { key: 'otherDocuments', label: 'SURAT PERNYATAAN MENJAGA KERAHASIAAN DATA PENELITIAN', aliases: ['surat pernyataan', 'menjaga kerahasian data', 'surat_pernyataan', 'menjaga_kerahasian_data'], required: true },  
] as const

const normalized = (value: string | undefined | null) =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const documentAlreadyProvided = (definition: (typeof documentDefinitions)[number]) =>
  parentDocuments.value.some((doc) => {
    const type = normalized(doc.document_type)
    const file = normalized(doc.file_name || doc.original_name)
    const label = normalized(definition.label)
    const aliases = definition.aliases.map(normalized)
    const candidates = [type, file].filter(Boolean)

    return candidates.some((candidate) =>
      candidate === label ||
      candidate.includes(label) ||
      label.includes(candidate) ||
      aliases.some((alias) => candidate.includes(alias) || alias.includes(candidate)),
    )
  })

const missingDocumentDefinitions = computed(() =>
  documentDefinitions.filter((definition) => !documentAlreadyProvided(definition)),
)

const isFormValid = computed(() => {
  const fieldsValid = [
    formData.value.researchTitle,
    formData.value.researchSummary,
    formData.value.researchPurpose,
    formData.value.supervisorName,
    formData.value.researchDuration,
    formData.value.targetUnit,
    formData.value.researchMethod,
    formData.value.researchSubject,
    formData.value.dataRequirements,
  ].every((value) => value.trim())

  const screeningValid = Object.values(screeningAnswers.value).every(Boolean)
  const documentsValid = documentDefinitions
    .filter((definition) => definition.required)
    .every((definition) => documentAlreadyProvided(definition) || Boolean(documents.value[definition.key]))

  return Boolean(
    fieldsValid &&
    documentsValid &&
    confirmationChecked.value &&
    !loadingParent.value &&
    screeningValid,
  )
})

const setDocument = (key: string, file: File | null) => {
  documents.value[key] = file
}

const loadParentApplication = async () => {
  if (!parentApplicationId.value) return

  loadingParent.value = true
  try {
    const response = await getDataCollectionDetail(parentApplicationId.value)
    const application = response.data

    if (application.application_type !== 'IZIN_PENELITIAN') {
      toast.error('Pengajuan induk untuk izin etik harus berupa izin penelitian.')
      return
    }

    parentDocuments.value = application.documents ?? []

    formData.value = {
      researchTitle: application.research_title ?? '',
      researchSummary: application.research_background ?? '',
      researchPurpose:  application.purpose ?? '',
      supervisorName: application.person_responsible ?? '',
      researchDuration: application.research_duration ?? '',
      targetUnit: application.research_location ?? '',
      researchMethod: application.research_methodology ?? '',
      researchSubject: application.research_subject ?? application.research_objectives ?? '',
      dataRequirements: application.data_needed ?? '',
    }
  } catch (error: unknown) {
    toast.error(getApiErrorMessage(error, 'Data penelitian induk tidak dapat dimuat.'))
  } finally {
    loadingParent.value = false
  }
}

const handleSubmit = async () => {
  if (!isFormValid.value) {
    toast.error('Lengkapi seluruh informasi, dokumen yang diperlukan, dan konfirmasi sebelum mengirim.')
    return
  }

  const groupCategory = authStore.user?.researcher?.category?.name
  const researchInstitution = authStore.user?.researcher?.profile?.institution

  if (!groupCategory || !researchInstitution) {
    toast.error('Kategori peneliti dan institusi wajib tersedia sebelum pengajuan dikirim.')
    return
  }

  const selectedDocuments = documentDefinitions
    .map((definition) => ({
      definition,
      file: documents.value[definition.key],
    }))
    .filter((item) => Boolean(item.file)) as Array<{
      definition: (typeof documentDefinitions)[number]
      file: File
    }>

  loading.value = true

  try {
    const submission: EthicsApplicationSubmission = {
      application_type: 'IZIN_ETIK',
      ...(parentApplicationId.value ? { parent_application_id: parentApplicationId.value } : {}),
      group_category: groupCategory,
      research_title: formData.value.researchTitle.trim(),
      research_background: formData.value.researchSummary.trim(),
      research_objectives: formData.value.researchSubject.trim(),
      research_methodology: formData.value.researchMethod.trim(),
      research_location: formData.value.targetUnit,
      research_institution: researchInstitution,
      research_duration: formData.value.researchDuration.trim(),
      data_needed: formData.value.dataRequirements.trim(),
      purpose: formData.value.researchPurpose.trim(),
      person_responsible: formData.value.supervisorName.trim(),
      documents: selectedDocuments.map((item) => item.file),
      document_types: selectedDocuments.map((item) => item.definition.label),
      screening: {
        question1: screeningAnswers.value.question1,
        question2: screeningAnswers.value.question2,
        question3: screeningAnswers.value.question3,
        question4: screeningAnswers.value.question4,
        question5: screeningAnswers.value.question5,
        question6: screeningAnswers.value.question6,
      },
    }

    const response = await submitEthicsApplication(submission)

    if (!response.success || !response.data?.id) {
      toast.error('Gagal membuat pengajuan izin etik.')
      return
    }

    toast.success('Pengajuan izin etik berhasil dikirim. Silakan tunggu proses review.')

    window.setTimeout(() => {
      router.push({ name: 'researcher-status' })
    }, 1200)
  } catch (error: unknown) {
    toast.error(getApiErrorMessage(
      error,
      'Gagal mengirim pengajuan izin etik. Silakan coba lagi.',
    ))
    console.error('Ethics application submission error:', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadParentApplication)
</script>

<template>
  <main class="form-page">  
    <div class="form-header">
      <h1 class="form-title">Permohonan Izin Etik</h1>
      <p v-if="!isNeedEthics" class="form-subtitle">
        Lengkapi semua data di bawah untuk mengajukan permohonan izin etik ke rumah sakit.
      </p>
    </div>

    <section v-if="isNeedEthics" class="need-ethics-banner">
        <div class="need-ethics-icon"><FileText :size="20" /></div>
        <div>
            <strong>Tindakan Diperlukan: Revisi Etik</strong>
            <p>
              Unggah/perbaiki dokumen etik yang diminta, lalu klik <b>Kirim Revisi Etik</b>.
              Status akan kembali menjadi <b>Verifikasi Berkas</b>.
            </p>
        </div>
      </section>

    <form class="form-container" @submit.prevent="handleSubmit">
      <FormSection title="PROFIL PENELITI" icon="User">
        <ResearcherInfoCard
          :name="authStore.user?.name"
          :nim="authStore.user?.researcher?.profile?.nim"
          :nip="authStore.user?.researcher?.profile?.nip"
          :nik="authStore.user?.researcher?.profile?.nik"
          :institution="authStore.user?.researcher?.profile?.institution"
          :faculty="authStore.user?.researcher?.profile?.faculty"
          :program-study="authStore.user?.researcher?.profile?.program_study"
          :email="authStore.user?.email"
          :fields="researchProfileFields"
        />
      </FormSection>

      <FormSection title="INFORMASI PENELITIAN" icon="Info">
        <div class="form-field">
          <label for="research-title" class="form-label">JUDUL PENELITIAN <span class="required">*</span></label>
          <input
            id="research-title"
            v-model="formData.researchTitle"
            class="form-input"
            type="text"
            placeholder="Masukkan judul penelitian"
            maxlength="255"
            required
            :readonly="isNeedEthics"
            :disabled="isNeedEthics"
          >
        </div>

        <div class="form-field">
          <label for="research-summary">RINGKASAN PENELITIAN <span class="required">*</span></label>
          <textarea
            id="research-summary"
            v-model="formData.researchSummary"
            class="form-input form-textarea"
            placeholder="Tuliskan ringkasan singkat mengenai penelitian"
            rows="5"
            required
            :readonly="isNeedEthics"
            :disabled="isNeedEthics"
          />
        </div>

        <div class="form-field">
          <label for="research-purpose">TUJUAN PENELITIAN <span class="required">*</span></label>
          <textarea
            id="research-purpose"
            v-model="formData.researchPurpose"
            class="form-input form-textarea"
            placeholder="Tuliskan tujuan yang ingin dicapai dari penelitian"
            rows="5"
            required
            :readonly="isNeedEthics"
            :disabled="isNeedEthics"
          />
        </div>

        <div class="form-field">
          <label for="supervisor">DOSEN PEMBIMBING/PENANGGUNGJAWAB <span class="required">*</span></label>
          <input
            id="supervisor"
            v-model="formData.supervisorName"
            class="form-input"
            type="text"
            placeholder="Masukkan nama dosen pembimbing atau penanggungjawab penelitian"
            required
            :readonly="isNeedEthics"
            :disabled="isNeedEthics"
          >
        </div>

        <div class="form-field">
          <label for="research-duration">WAKTU PENELITIAN <span class="required">*</span></label>
          <select id="research-duration" v-model="formData.researchDuration" class="form-input" required :disabled="isNeedEthics">
            <option value="">Pilih durasi penelitian</option>
            <option v-for="duration in researchDurations" :key="duration" :value="duration">
              {{ duration }}
            </option>
          </select>
          <p class="form-helper-text">Pilih durasi penelitian dari 1 sampai 12 bulan.</p>
        </div>

        <div class="form-field">
          <label for="target-unit">UNIT / INSTALASI TUJUAN <span class="required">*</span></label>
          <select id="target-unit" v-model="formData.targetUnit" class="form-input" required :disabled="isNeedEthics">
            <option value="">Pilih unit atau instalasi tempat pengambilan data</option>
            <option v-for="unit in availableUnits" :key="unit" :value="unit">{{ unit }}</option>
          </select>
        </div>

        <div class="form-field">
          <label for="research-method">METODE PENELITIAN <span class="required">*</span></label>
          <textarea
            id="research-method"
            v-model="formData.researchMethod"
            class="form-input form-textarea"
            type="text"
            placeholder="Masukkan metode penelitian yang digunakan"
            required
            :readonly="isNeedEthics"
            :disabled="isNeedEthics"
          />
        </div>

        <div class="form-field">
          <label for="research-subject">SUBJEK/OBJEK PENELITIAN <span class="required">*</span></label>
          <textarea
            id="research-subject"
            v-model="formData.researchSubject"
            class="form-input form-textarea"
            type="text"
            placeholder="Jelaskan subjek atau objek yang menjadi fokus penelitian"
            :readonly="isNeedEthics"
            :disabled="isNeedEthics"
          />
        </div>

        <div class="form-field">
          <label for="data-requirements">KEBUTUHAN DATA <span class="required">*</span></label>
          <textarea
            id="data-requirements"
            v-model="formData.dataRequirements"
            class="form-input form-textarea"
            type="text"
            placeholder="Jelaskan data yang dibutuhkan untuk mendukung penelitian"
            required
            :readonly="isNeedEthics"
            :disabled="isNeedEthics"
          />
        </div>
      </FormSection>

      <FormSection title="DOKUMEN PENGAJUAN" icon="FileText">
        <div v-if="parentApplicationId && parentDocuments.length" class="inherited-documents">
          <div class="document-section-heading">
            <div>
              <strong>DOKUMEN DARI PENGAJUAN PENELITIAN</strong>
              <p>Dokumen yang sudah diunggah pada pengajuan penelitian otomatis digunakan untuk proses etik.</p>
            </div>
            <span class="document-count">{{ parentDocuments.length }} dokumen tersedia</span>
          </div>

          <div v-for="doc in parentDocuments" :key="doc.id" class="inherited-document">
            <div class="inherited-document__status">✓</div>
            <div class="inherited-document__info">
              <strong>{{ doc.file_name || doc.original_name || 'Dokumen penelitian' }}</strong>
              <span>{{ doc.document_type || 'Dokumen pendukung' }}</span>
            </div>
            <span class="inherited-document__badge">Digunakan otomatis</span>
          </div>
        </div>


        <div v-if="missingDocumentDefinitions.length" class="missing-documents">
          <FileUpload
            v-for="definition in missingDocumentDefinitions"
            :key="definition.key"
            :model-value="documents[definition.key]"
            :label="definition.label"
            :required="definition.required"
            accepted-types=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            :max-size-in-m-b="10"
            placeholder="Pilih atau seret file kesini"
            @update:model-value="setDocument(definition.key, $event)"
          />
        </div>

        <div v-else class="all-documents-complete">
          <span>✓</span>
          <div>
            <strong>Semua dokumen yang dibutuhkan sudah tersedia.</strong>
            <p>Tidak perlu mengunggah dokumen ulang.</p>
          </div>
        </div>
      </FormSection>

      <FormSection title="SCREENING" icon="ClipboardCheck">

        <div v-for="(question, index) in screeningQuestions" :key="question" class="screening-question">
          <p class="screening-question__text">{{ question }}</p>
          <div class="screening-options">
            <label>
              <input
                v-model="screeningAnswers['question' + (index + 1)]"
                type="radio"
                :name="'screening-ethics-' + (index + 1)"
                value="yes"
                class="screening-radio"
                required
              >
              <span>Ya</span>
            </label>
            <label>
              <input
                v-model="screeningAnswers['question' + (index + 1)]"
                type="radio"
                :name="'screening-ethics-' + (index + 1)"
                value="no"
                class="screening-radio"
                required
              >
              <span>Tidak</span>
            </label>
          </div>
        </div>
      </FormSection>

      <label class="confirmation">
        <input v-model="confirmationChecked" type="checkbox" required>
        <span>
          Saya menyatakan bahwa seluruh informasi dan dokumen yang saya lampirkan pada pengajuan izin etik ini adalah benar dan dapat dipertanggungjawabkan.
        </span>
      </label>

      <div v-if="loadingParent" class="form-alert form-alert--info">
        Memuat data penelitian induk...
      </div>

      <div v-if="isNeedEthics" class="form-alert form-alert--info">Informasi penelitian dari pengajuan sebelumnya dikunci dan tidak dapat diubah pada tahap pengajuan etik.</div>      <div class="form-actions">
        <button type="submit" class="submit-button" :disabled="loading || !isFormValid">
          {{ loading ? 'Mengirim...' : 'Kirim' }}
        </button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.inherited-documents,.missing-documents{display:grid;gap:10px}.document-section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px;padding:14px 16px;border:1px solid var(--border);border-radius:10px;background:var(--muted)}.document-section-heading--additional{margin-top:18px;margin-bottom:4px}.document-section-heading strong{color:var(--accent-foreground);font-size:.82rem}.document-section-heading p{margin:5px 0 0;color:var(--muted-foreground);font-size:.78rem;line-height:1.45}.document-count{white-space:nowrap;color:var(--muted-foreground);font-size:.72rem}.inherited-document{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--color-surface)}.inherited-document__status{display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;border-radius:50%;background:var(--color-success-soft);color:var(--accent-foreground);font-weight:800}.inherited-document__info{display:grid;gap:3px;min-width:0;flex:1}.inherited-document__info strong{overflow:hidden;color:var(--foreground);font-size:.82rem;text-overflow:ellipsis;white-space:nowrap}.inherited-document__info span{color:var(--muted-foreground);font-size:.72rem}.inherited-document__badge{white-space:nowrap;color:var(--accent-foreground);font-size:.7rem;font-weight:700}.all-documents-complete{display:flex;align-items:center;gap:12px;padding:15px;border:1px solid var(--border);border-radius:10px;background:var(--color-success-soft);color:var(--accent-foreground)}.all-documents-complete>span{font-size:1.15rem;font-weight:800}.all-documents-complete strong{font-size:.82rem}.all-documents-complete p{margin:3px 0 0;font-size:.75rem;color:var(--muted-foreground)}

.form-field {
  display: grid;
  gap: 8px;
}

.form-label {
  font-size: .92rem;
  font-weight: 600;
  color: var(--accent-foreground);
  text-align: left;
  letter-spacing: .3px;
}

.form-field label {
  color: var(--accent-foreground);
  font-size: .875rem;
  font-weight: 600;
}

.required {
  color: var(--destructive);
}

.form-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  padding: 11px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  outline: none;
  color: var(--foreground);
  font: inherit;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.form-input::placeholder {
  color: var(--muted-foreground);
}

.form-input:disabled, .form-input[readonly] { background: var(--muted); color: var(--muted-foreground); cursor: not-allowed; opacity: 1; }\n\n.form-input:focus {
  border-color: var(--color-primary-dark);
  background: var(--color-surface);
  box-shadow: var(--shadow-focus);
}

.form-textarea {
  min-height: 125px;
  resize: vertical;
}

.screening-info {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: .88rem;
  line-height: 1.55;
}

.screening-question {
  display: grid;
  gap: 14px;
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}

.screening-question__text {
  margin: 0;
  color: var(--foreground);
  font-size: .92rem;
  font-weight: 500;
  line-height: 1.55;
}

.screening-options {
  display: flex;
  align-items: center;
  gap: 28px;
}

.screening-options label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--foreground);
  font-size: .92rem;
}

.screening-radio {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--primary);
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

.form-alert {
  padding: 12px 16px;
  border-radius: 10px;
  font-size: .9rem;
}

.form-alert--info {
  color: var(--color-primary-dark);
  background: var(--color-primary-soft);
}

.form-alert--error {
  color: var(--destructive);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
}

.form-alert--success {
  color: var(--color-primary-dark);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-success-border);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.form-helper-text {
  margin: 0;
  font-size: .84rem;
  color: var(--muted-foreground);
}

.need-ethics-banner {
  display: flex;
  gap: 13px;
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid var(--color-warning-border);
  border-radius: 12px;
  background: linear-gradient(to right, #FEC53D, #987625);
  color: var(--color-text-inverse-muted);
}

.need-ethics-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 9px;
  background: var(--color-danger-soft);
}

.-need-ethics-banner p {
  margin: 4px 0 0;
  color: var(--color-text);
  font-size: 0.8rem;
  line-height: 1.5;
}


.submit-button {
  min-width: 123px;
  min-height: 46px;
  padding: 10px 24px;
  border: 0;
  border-radius: 10px;
  background: var(--color-primary);
  color: var(--primary-foreground);
  font-size: .875rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-primary-sm);
}

.submit-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .document-section-heading {
    flex-direction: column;
  }

  .document-count,
  .inherited-document__badge {
    white-space: normal;
  }

  .screening-options {
    gap: 18px;
  }
}
</style>
