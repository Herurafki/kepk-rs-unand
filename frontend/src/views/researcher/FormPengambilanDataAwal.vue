<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/routes/auth'
import { submitDataCollection } from '../../services/researcher/data-collection.service'
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

// Form state
const formData = ref({
  proposalTitle: '',
  purpose: '',
  supervisorName: '',
  dataCollectionDate: '',
  targetUnit: '',
  dataRequirements: '',
  incomingLetterNumber: '',
  incomingLetterSubject: '',
  signatoryPosition: '',
})

const supportingFile = ref<File | null>(null)
const confirmationChecked = ref(false)

// Form state
const loading = ref(false)

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
    formData.value.proposalTitle.trim() &&
    formData.value.purpose.trim() &&
    formData.value.supervisorName.trim() &&
    formData.value.dataCollectionDate &&
    formData.value.targetUnit &&
    formData.value.dataRequirements.trim() &&
    formData.value.incomingLetterNumber.trim() &&
    formData.value.incomingLetterSubject.trim() &&
    formData.value.signatoryPosition.trim() &&
    supportingFile.value &&
    confirmationChecked.value
  )
})

const handleSubmit = async () => {
  // Validation
  if (!isFormValid.value) {
    toast.error('Semua field wajib diisi dan file harus dipilih.')
    return
  }

  if (!confirmationChecked.value) {
    toast.error('Anda harus memastikan bahwa informasi yang diajukan benar.')
    return
  }

  if (!supportingFile.value) {
    toast.error('Surat pengantar dari instansi harus dipilih.')
    return
  }

  const groupCategory = authStore.user?.researcher?.category?.name
  const researchInstitution = authStore.user?.researcher?.profile?.institution

  if (!groupCategory || !researchInstitution) {
    toast.error('Data profil peneliti belum lengkap. Silakan lengkapi profil terlebih dahulu.')
    return
  }

  loading.value = true

  try {
    const submitResponse = await submitDataCollection({
      application_type: 'DATA_AWAL',
      group_category: groupCategory,
      research_title: formData.value.proposalTitle.trim(),
      research_location: formData.value.targetUnit,
      research_institution: researchInstitution,
      data_collection_date: formData.value.dataCollectionDate,
      data_needed: formData.value.dataRequirements.trim(),
      purpose: formData.value.purpose.trim(),
      person_responsible: formData.value.supervisorName.trim(),
      correspondence: { incoming_letter_number: formData.value.incomingLetterNumber.trim(), incoming_letter_subject: formData.value.incomingLetterSubject.trim(), signatory_position: formData.value.signatoryPosition.trim() },
      documents: [supportingFile.value],
      document_types: ['Surat Pengantar dari Instansi'],
    })

    if (!submitResponse.success || !submitResponse.data.id) {
      toast.error('Gagal membuat aplikasi pengajuan.')
      console.error('Submit response error:', submitResponse)
      return
    }

    toast.success('Pengajuan berhasil dikirim. Silakan tunggu review dari admin.')

    // Reset form
    setTimeout(() => {
      formData.value = {
        proposalTitle: '',
        purpose: '',
        supervisorName: '',
        dataCollectionDate: '',
        targetUnit: '',
        dataRequirements: '',
        incomingLetterNumber: '', incomingLetterSubject: '', signatoryPosition: '',
      }
      supportingFile.value = null
      confirmationChecked.value = false

      // Redirect to status page
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
      <h1 class="form-title">Pengajuan Pengambilan Data Awal</h1>
      <p class="form-subtitle">
        Lengkapi semua data di bawah untuk mengajukan permohonan pengambilan data awal ke rumah sakit.
      </p>
    </div>

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

      <!-- Informasi Penelitian -->
      <FormSection
        title="INFORMASI DATA AWAL"
        icon="Info"
        description="Lengkapi informasi tentang pengambilan data awal yang akan Anda lakukan. Data identitas Anda sudah tercatat dari akun login."
      >
        <!-- Judul Proposal -->
        <div class="form-field">
          <label for="proposal-title" class="form-label">
            JUDUL PROPOSAL
            <span class="required">*</span>
          </label>
          <input
            id="proposal-title"
            v-model="formData.proposalTitle"
            type="text"
            class="form-input"
            placeholder="Masukkan judul proposal penelitian"
            maxlength="255"
            required
          >
        </div>

        <!-- Tujuan Pengambilan Data Awal -->
        <div class="form-field">
          <label for="purpose" class="form-label">
            TUJUAN PENGAMBILAN DATA AWAL
            <span class="required">*</span>
          </label>
          <textarea
            id="purpose"
            v-model="formData.purpose"
            class="form-textarea"
            placeholder="Jelaskan tujuan pengambilan data awal"
            rows="4"
            maxlength="1000"
            required
          />
        </div>

        <!-- Dosen Pembimbing -->
        <div class="form-field">
          <label for="supervisor" class="form-label">
            DOSEN PEMBIMBING/PENANGGUNGJAWAB
            <span class="required">*</span>
          </label>
          <input
            id="supervisor"
            v-model="formData.supervisorName"
            type="text"
            class="form-input"
            placeholder="Masukkan nama dosen pembimbing atau penanggung jawab"
            maxlength="255"
            required
          >
        </div>

        <!-- Waktu Pengambilan Data -->
        <div class="form-field">
          <label for="collection-date" class="form-label">
            WAKTU PENGAMBILAN DATA
            <span class="required">*</span>
          </label>
          <input
            id="collection-date"
            v-model="formData.dataCollectionDate"
            type="date"
            class="form-input"
            required
          >
          <p class="form-helper-text">Pilih tanggal dimulainya pengambilan data awal.</p>
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
            <option value="">Pilih unit / instalasi tujuan pengambilan data awal</option>
            <option v-for="unit in availableUnits" :key="unit" :value="unit">
              {{ unit }}
            </option>
          </select>
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

      <!-- Section B: Dokumen Pendukung -->
      <FormSection
        title="DOKUMEN PENDUKUNG"
        description="Unggah surat pengantar dari institusi Anda."
        icon="FileText"
      >
        <FileUpload
          v-model="supportingFile"
          label="SURAT PENGANTAR DARI INSTANSI"
          :required="true"
          accepted-types=".pdf"
          :max-size-in-m-b="10"
          placeholder="Pilih atau seret file kesini"
        />
        <div class="form-field"><label for="incoming-letter-number" class="form-label">NOMOR SURAT PENGANTAR <span class="required">*</span></label><input id="incoming-letter-number" v-model="formData.incomingLetterNumber" type="text" class="form-input" placeholder="Masukkan nomor surat pengantar" maxlength="150" required></div>
        <div class="form-field"><label for="incoming-letter-subject" class="form-label">PERIHAL SURAT PENGANTAR <span class="required">*</span></label><input id="incoming-letter-subject" v-model="formData.incomingLetterSubject" type="text" class="form-input" placeholder="Contoh: Permohonan izin pengambilan data awal" maxlength="500" required></div>
        <div class="form-field"><label for="signatory-position" class="form-label">JABATAN PENANDATANGAN SURAT <span class="required">*</span></label><input id="signatory-position" v-model="formData.signatoryPosition" type="text" class="form-input" placeholder="Contoh: Wakil Dekan I Fakultas Keperawatan" maxlength="255" required><p class="form-helper-text">Jabatan ini akan digunakan sebagai tujuan surat izin KEPK.</p></div>
      </FormSection>

      <!-- Messages -->
      <!-- Section C: Konfirmasi & Submit -->
        <!-- Confirmation checkbox -->
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
}
</style>
