<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/routes/auth'
import { createResearchApplication } from '../../services/researcher/data-collection.service'
import { getApiErrorMessage } from '../../services/api/error'
import FormSection from '../../components/researcher/FormSection.vue'
import FileUpload from '../../components/researcher/FileUpload.vue'
import ResearcherInfoCard from '../../components/researcher/ResearcherInfoCard.vue'
import { useToast } from '../../composables/useToast'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const researchProfileFields = [
  'name',
  'identity',
  'institution',
  'faculty',
  'programStudy',
  'email',
] as const

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
  incomingLetterNumber: '', incomingLetterSubject: '', signatoryPosition: '',
})

const letterFile = ref<File | null>(null)
const proposalFile = ref<File | null>(null)
const cvFile = ref<File | null>(null)

const screeningAnswers = ref({
  question1: '',
  question2: '',
  question3: '',
  question4: '',
})

const confirmationChecked = ref(false)
const loading = ref(false)

const researchDurations = Array.from({ length: 12 }, (_, index) => `${index + 1} Bulan`)

const availableUnits = [
  'CENTRAL STERILE SUPPLY DEPARTMENT (CSSD) DAN LAUNDRY',
  'Instalasi Bedah Sentral dan Anastesi',
  'Instalasi CENTRAL STERILE SUPPLY DEPARTMENT (CSSD) DAN LAUNDRY',
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

const isFormValid = computed(() => {
  return (
    formData.value.researchTitle.trim() &&
    formData.value.researchSummary.trim() &&
    formData.value.researchPurpose.trim() &&
    formData.value.supervisorName.trim() &&
    formData.value.researchDuration &&
    formData.value.targetUnit &&
    formData.value.researchMethod.trim() &&
    formData.value.researchSubject.trim() &&
    formData.value.dataRequirements.trim() &&
    formData.value.incomingLetterNumber.trim() && formData.value.incomingLetterSubject.trim() && formData.value.signatoryPosition.trim() &&
    letterFile.value &&
    proposalFile.value &&
    cvFile.value &&
    screeningAnswers.value.question1 &&
    screeningAnswers.value.question2 &&
    screeningAnswers.value.question3 &&
    screeningAnswers.value.question4 &&
    confirmationChecked.value
  )
})

const handleSubmit = async () => {
  if (!isFormValid.value) {
    toast.error('Semua field wajib diisi dan semua dokumen harus dipilih.')
    return
  }

  if (!confirmationChecked.value) {
    toast.error('Anda harus memastikan bahwa informasi yang diajukan benar.')
    return
  }

  const groupCategory = authStore.user?.researcher?.category?.name
  const researchInstitution = authStore.user?.researcher?.profile?.institution

  if (!groupCategory || !researchInstitution) {
    toast.error('Kategori peneliti dan institusi wajib tersedia sebelum pengajuan dikirim.')
    return
  }

  loading.value = true

  try {
    const submitResponse = await createResearchApplication({
      application_type: 'IZIN_PENELITIAN',
      group_category: groupCategory,
      research_title: formData.value.researchTitle,
      research_background: formData.value.researchSummary,
      research_objectives: formData.value.researchSubject,
      research_methodology: formData.value.researchMethod,
      research_location: formData.value.targetUnit,
      research_institution: researchInstitution,
      research_duration: formData.value.researchDuration,
      data_needed: formData.value.dataRequirements,
      purpose: formData.value.researchPurpose,
      person_responsible: formData.value.supervisorName,
      correspondence: { incoming_letter_number: formData.value.incomingLetterNumber.trim(), incoming_letter_subject: formData.value.incomingLetterSubject.trim(), signatory_position: formData.value.signatoryPosition.trim() },
      screening: {
        question1: screeningAnswers.value.question1,
        question2: screeningAnswers.value.question2,
        question3: screeningAnswers.value.question3,
        question4: screeningAnswers.value.question4,
      },
      documents: [letterFile.value!, proposalFile.value!, cvFile.value!],
      document_types: [
        'Surat Pengantar dari Instansi',
        'Proposal Penelitian',
        'CV Peneliti',
      ],
    })

    if (!submitResponse.success || !submitResponse.data.id) {
      toast.error('Gagal membuat aplikasi pengajuan.')
      console.error('Submit response error:', submitResponse)
      return
    }

    toast.success('Pengajuan berhasil dikirim. Silakan tunggu review dari admin.')

    setTimeout(() => {
      formData.value = {
        researchTitle: '',
        researchSummary: '',
        researchPurpose: '',
        supervisorName: '',
        researchDuration: '',
        targetUnit: '',
        researchMethod: '',
        researchSubject: '',
        dataRequirements: '',
        incomingLetterNumber: '', incomingLetterSubject: '', signatoryPosition: '',
      }
      letterFile.value = null
      proposalFile.value = null
      cvFile.value = null
      screeningAnswers.value = {
        question1: '',
        question2: '',
        question3: '',
        question4: '',
      }
      confirmationChecked.value = false

      router.push({ name: 'researcher-status' })
    }, 2000)
  } catch (error: unknown) {
    toast.error(getApiErrorMessage(
      error,
      'Gagal mengirim pengajuan. Silakan coba lagi.',
    ))
    console.error('Form submission error:', error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="form-page">
    <!-- Page Title -->
    <div class="form-header">
      <h1 class="form-title">Pengajuan Penelitian</h1>
      <p class="form-subtitle">
        Lengkapi semua data di bawah untuk mengajukan permohonan penelitian ke rumah sakit.
      </p>
    </div>

    <form class="form-container" @submit.prevent="handleSubmit">
      <!-- Section A: Profil Peneliti -->
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

      <!-- Section B: Informasi Penelitian -->
      <FormSection
        title="INFORMASI PENELITIAN"
        icon="Info"
        description="Lengkapi informasi tentang penelitian yang akan Anda lakukan."
      >
        <!-- Judul Penelitian -->
        <div class="form-field">
          <label for="research-title" class="form-label">
            JUDUL PENELITIAN
            <span class="required">*</span>
          </label>
          <input
            id="research-title"
            v-model="formData.researchTitle"
            type="text"
            class="form-input"
            placeholder="Masukkan judul penelitian"
            maxlength="255"
            required
          >
        </div>

        <!-- Ringkasan Penelitian -->
        <div class="form-field">
          <label for="research-summary" class="form-label">
            RINGKASAN PENELITIAN
            <span class="required">*</span>
          </label>
          <textarea
            id="research-summary"
            v-model="formData.researchSummary"
            class="form-textarea"
            placeholder="Berikan ringkasan singkat tentang penelitian Anda"
            rows="3"
            maxlength="1000"
            required
          />
        </div>

        <!-- Tujuan Penelitian -->
        <div class="form-field">
          <label for="research-purpose" class="form-label">
            TUJUAN PENELITIAN
            <span class="required">*</span>
          </label>
          <textarea
            id="research-purpose"
            v-model="formData.researchPurpose"
            class="form-textarea"
            placeholder="Jelaskan tujuan penelitian"
            rows="4"
            maxlength="1000"
            required
          />
        </div>

        <!-- Dosen Pembimbing/Penanggungjawab -->
        <div class="form-field">
          <label for="supervisor-name" class="form-label">
            DOSEN PEMBIMBING/PENANGGUNGJAWAB
            <span class="required">*</span>
          </label>
          <input
            id="supervisor-name"
            v-model="formData.supervisorName"
            type="text"
            class="form-input"
            placeholder="Masukkan nama dosen pembimbing atau penanggung jawab"
            maxlength="255"
            required
          >
        </div>

        <!-- Durasi Penelitian -->
        <div class="form-field">
          <label for="research-duration" class="form-label">
            DURASI PENELITIAN
            <span class="required">*</span>
          </label>
          <select
            id="research-duration"
            v-model="formData.researchDuration"
            class="form-input"
            required
          >
            <option value="">Pilih durasi penelitian</option>
            <option v-for="duration in researchDurations" :key="duration" :value="duration">
              {{ duration }}
            </option>
          </select>
          <p class="form-helper-text">Pilih durasi penelitian dari 1 sampai 12 bulan.</p>
        </div>

        <!-- Unit / Instalasi Tujuan -->
        <div class="form-field">
          <label for="target-unit" class="form-label">
            UNIT / INSTALASI TUJUAN
            <span class="required">*</span>
          </label>
          <select
            id="target-unit"
            v-model="formData.targetUnit"
            class="form-input"
            required
          >
            <option value="">Pilih unit / instalasi tujuan</option>
            <option v-for="unit in availableUnits" :key="unit" :value="unit">
              {{ unit }}
            </option>
          </select>
        </div>

        <!-- Metode Penelitian -->
        <div class="form-field">
          <label for="research-method" class="form-label">
            METODE PENELITIAN
            <span class="required">*</span>
          </label>
          <textarea
            id="research-method"
            v-model="formData.researchMethod"
            class="form-textarea"
            placeholder="Jelaskan metode penelitian yang akan digunakan"
            rows="3"
            maxlength="1000"
            required
          />
          <p class="form-helper-text">Jelaskan metode yang digunakan dalam penelitian.</p>
        </div>

        <!-- Subjek / Objek Penelitian -->
        <div class="form-field">
          <label for="research-subject" class="form-label">
            SUBJEK / OBJEK PENELITIAN
            <span class="required">*</span>
          </label>
          <textarea
            id="research-subject"
            v-model="formData.researchSubject"
            class="form-textarea"
            placeholder="Jelaskan subjek atau objek penelitian"
            rows="3"
            maxlength="1000"
            required
          />
        </div>

        <!-- Kebutuhan Data -->
        <div class="form-field">
          <label for="data-requirements" class="form-label">
            KEBUTUHAN DATA
            <span class="required">*</span>
          </label>
          <textarea
            id="data-requirements"
            v-model="formData.dataRequirements"
            class="form-textarea"
            placeholder="Sebutkan data/informasi yang ingin diperoleh"
            rows="4"
            maxlength="1000"
            required
          />
        </div>
      </FormSection>

      <!-- Section C: Dokumen Pengajuan -->
      <FormSection
        title="DOKUMEN PENGAJUAN"
        description="Unggah semua dokumen yang diperlukan untuk pengajuan penelitian."
        icon="FileText"
      >
        <FileUpload
          v-model="letterFile"
          label="SURAT PENGANTAR DARI INSTANSI"
          :required="true"
          accepted-types=".pdf,.jpg,.jpeg,.png"
          :max-size-in-m-b="10"
          placeholder="Pilih atau seret file kesini"
        />
        <div class="form-field"><label for="incoming-letter-number" class="form-label">NOMOR SURAT PENGANTAR <span class="required">*</span></label><input id="incoming-letter-number" v-model="formData.incomingLetterNumber" type="text" class="form-input" placeholder="Masukkan nomor surat pengantar" maxlength="150" required></div>
        <div class="form-field"><label for="incoming-letter-subject" class="form-label">PERIHAL SURAT PENGANTAR <span class="required">*</span></label><input id="incoming-letter-subject" v-model="formData.incomingLetterSubject" type="text" class="form-input" placeholder="Contoh: Permohonan izin pengambilan data awal" maxlength="500" required></div>
        <div class="form-field"><label for="signatory-position" class="form-label">JABATAN PENANDATANGAN SURAT <span class="required">*</span></label><input id="signatory-position" v-model="formData.signatoryPosition" type="text" class="form-input" placeholder="Contoh: Wakil Dekan I Fakultas Keperawatan" maxlength="255" required><p class="form-helper-text">Jabatan ini akan digunakan sebagai tujuan surat izin KEPK.</p></div>

        <FileUpload
          v-model="proposalFile"
          label="PROPOSAL PENELITIAN"
          :required="true"
          accepted-types=".pdf,.jpg,.jpeg,.png"
          :max-size-in-m-b="10"
          placeholder="Pilih atau seret file kesini"
        />

        <FileUpload
          v-model="cvFile"
          label="CV PENELITI"
          :required="true"
          accepted-types=".pdf,.jpg,.jpeg,.png"
          :max-size-in-m-b="10"
          placeholder="Pilih atau seret file kesini"
        />
      </FormSection>

      <!-- Section D: Screening -->
      <FormSection
        title="SCREENING"
        icon="ClipboardCheck"
        description="Jawab semua pertanyaan berikut dengan jujur dan akurat."
      >
        <div class="screening-question">
          <label class="screening-label">
            1. Apakah penelitian melibatkan manusia sebagai subjek/responden, atau menggunakan data, informasi, rekam medis, maupun spesimen biologis yang berasal dari manusia?
            <span class="required">*</span>
          </label>
          <div class="screening-options">
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question1"
                type="radio"
                value="yes"
                class="screening-radio"
                required
              >
              <span>Ya</span>
            </label>
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question1"
                type="radio"
                value="no"
                class="screening-radio"
                required
              >
              <span>Tidak</span>
            </label>
          </div>
        </div>

        <div class="screening-question">
          <label class="screening-label">
            2. Apakah penelitian melibatkan organisme hidup selain manusia sebagai bagian dari penelitian?
            <span class="required">*</span>
          </label>
          <div class="screening-options">
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question2"
                type="radio"
                value="yes"
                class="screening-radio"
                required
              >
              <span>Ya</span>
            </label>
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question2"
                type="radio"
                value="no"
                class="screening-radio"
                required
              >
              <span>Tidak</span>
            </label>
          </div>
        </div>

        <div class="screening-question">
          <label class="screening-label">
            3. Apakah penelitian melibatkan pemberian, penggunaan, pengujian, atau pengembangan obat, produk herbal/tradisional, sel punca (stem cell), alat kesehatan, prosedur atau tindakan baru, atau teknologi kecerdasan buatan (artificial intelligence/AI) di bidang kesehatan?
            <span class="required">*</span>
          </label>
          <div class="screening-options">
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question3"
                type="radio"
                value="yes"
                class="screening-radio"
                required
              >
              <span>Ya</span>
            </label>
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question3"
                type="radio"
                value="no"
                class="screening-radio"
                required
              >
              <span>Tidak</span>
            </label>
          </div>
        </div>

        <div class="screening-question">
          <label class="screening-label">
            4. Apakah penelitian merupakan audit medik, evaluasi mutu pelayanan rutin, atau studi kasus untuk kepentingan pendidikan tanpa publikasi dan tanpa intervensi tambahan di luar standar pelayanan?
            <span class="required">*</span>
          </label>
          <div class="screening-options">
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question4"
                type="radio"
                value="yes"
                class="screening-radio"
                required
              >
              <span>Ya</span>
            </label>
            <label class="screening-option">
              <input
                v-model="screeningAnswers.question4"
                type="radio"
                value="no"
                class="screening-radio"
                required
              >
              <span>Tidak</span>
            </label>
          </div>
        </div>
      </FormSection>

      <!-- Messages -->
      <!-- Section E: Confirmation -->
      <div class="form-checkbox">
        <input
          id="confirmation"
          v-model="confirmationChecked"
          type="checkbox"
          class="checkbox-input"
          required
        >
        <label for="confirmation" class="checkbox-label">
          Saya memastikan bahwa informasi yang saya ajukan benar.
        </label>
      </div>

      <!-- Action buttons -->
      <div class="form-actions">
        <button
          type="submit"
          class="btn btn--primary"
          :disabled="loading || !isFormValid"
        >
          {{ loading ? 'Memproses...' : 'Kirim' }}
        </button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.form-field {
  display: grid;
  gap: 8px;
}

.form-label {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--accent-foreground);
  text-align: left;
  letter-spacing: 0.3px;
}

.required {
  color: var(--destructive);
  margin-left: 2px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--input);
  border-radius: 8px;
  font-size: 0.96rem;
  font-family: var(--font-sans);
  color: var(--foreground);
  background: var(--color-surface);
  transition: all 200ms ease;
  box-sizing: border-box;

  &::placeholder {
    color: color-mix(in srgb, var(--muted-foreground) 70%, var(--color-surface));
  }

  &:hover {
    border-color: color-mix(in srgb, var(--ring) 40%, var(--input));
  }

  &:focus {
    outline: none;
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
  resize: vertical;
  min-height: 100px;
  font-family: var(--font-sans);
}

.form-helper-text {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted-foreground);
}

.screening-question {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--color-primary-softer);
}

.screening-label {
  font-size: 0.96rem;
  font-weight: 600;
  color: var(--foreground);
  line-height: 1.5;
  display: block;
}

.screening-options {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.screening-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.screening-option span {
  font-size: 0.96rem;
  color: var(--foreground);
  font-weight: 500;
}

.screening-radio {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--primary);

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
}

.form-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.checkbox-input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: var(--primary);
  flex-shrink: 0;

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
}

.checkbox-label {
  font-size: 0.96rem;
  font-weight: 500;
  color: var(--foreground);
  cursor: pointer;
  line-height: 1.5;
}

.form-alert {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.92rem;
}

.form-alert--error {
  color: var(--destructive);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
}

.form-alert--success {
  color: var(--accent-foreground);
  background: var(--color-success-soft);
  border: 1px solid var(--color-success-border);
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
  height: 44px;
  padding: 0 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.96rem;
  cursor: pointer;
  transition: all 200ms ease;
  border: 1px solid var(--color-transparent);
  white-space: nowrap;

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
  color: var(--primary-foreground);
  background: var(--color-primary);
  box-shadow: var(--shadow-primary-sm);

  &:hover:not(:disabled) {
    background: var(--color-primary-dark);
    box-shadow: var(--shadow-primary-md);
  }
}

@media (max-width: 768px) {
.screening-options {
    gap: 16px;
  }
}
</style>
