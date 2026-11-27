<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/routes/auth'
import apiClient from '../../services/api/client'
import { updateResearcherProfile } from '../../services/researcher/profile.service'
import { getApiErrorMessage } from '../../services/api/error'
import { useToast } from '../../composables/useToast'
import ChangePasswordForm from '../../components/shared/ChangePasswordForm.vue'

const authStore = useAuthStore()
const toast = useToast()
const isEditMode = ref(false)
const loading = ref(false)
const reviewerEdit = ref(false)
const reviewerLoading = ref(false)
const reviewerProfile = ref({ specialization: '', position: '', organization: '', phone: '', address: '' })
const reviewerForm = ref({ organization: '', phone: '', address: '' })
const isReviewer = computed(() => authStore.user?.roles?.includes('reviewer'))
async function loadReviewerProfile() {
  if (!isReviewer.value) return
  try {
    const response = await apiClient.get('/users/reviewers/me')
    const data = response.data.data
    reviewerProfile.value = { specialization: data.specialization || '', position: data.position || '', organization: data.organization || '', phone: data.phone || '', address: data.address || '' }
    reviewerForm.value = { organization: reviewerProfile.value.organization, phone: reviewerProfile.value.phone, address: reviewerProfile.value.address }
  } catch (error) { toast.error(getApiErrorMessage(error, 'Gagal memuat profil reviewer.')) }
}
async function saveReviewerProfile() {
  reviewerLoading.value = true
  try {
    const response = await apiClient.put('/users/reviewers/me', reviewerForm.value)
    const data = response.data.data
    reviewerProfile.value = { specialization: data.specialization || '', position: data.position || '', organization: data.organization || '', phone: data.phone || '', address: data.address || '' }
    reviewerEdit.value = false
    toast.success('Profil reviewer berhasil diperbarui.')
  } catch (error) { toast.error(getApiErrorMessage(error, 'Gagal menyimpan profil reviewer.')) }
  finally { reviewerLoading.value = false }
}

// Form state for editing
const formData = ref({
  nik: '',
  nim: '',
  nip: '',
  phone: '',
  address: '',
  faculty: '',
  department: '',
  institution: '',
  program_study: '',
})

// Display data
const profileData = ref({
  name: '',
  email: '',
  category: '',
  nik: '',
  nim: '',
  nip: '',
  phone: '',
  address: '',
  faculty: '',
  department: '',
  institution: '',
  program_study: '',
})

const isResearcher = computed(() => authStore.user?.roles?.includes('peneliti'))
const accountRoleLabel = computed(() =>
  (authStore.user?.roles || []).map((role: string) => role.replace(/_/g, ' ').toUpperCase()).join(', ') || 'PENGGUNA',
)
const accountInitial = computed(() => authStore.user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U')
const isStaff = computed(() =>
  authStore.user?.researcher?.category?.name?.trim().toLowerCase() === 'staff',
)
const isDosen = computed(() =>
  authStore.user?.researcher?.category?.name?.trim().toLowerCase() === 'dosen',
)
const isMhs = computed(() =>
  authStore.user?.researcher?.category?.name?.trim().toLowerCase() === 'mahasiswa',
)
const userInitials = computed(() =>
  (profileData.value.name || '-')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join('') || '-',
)

const formatValue = (value: string | null | undefined) => {
  return value && String(value).trim() ? value : '-'
}

const preferredIdentity = computed(() => {
  const identities = [
    { label: 'NIM', value: profileData.value.nim },
    { label: 'NIP', value: profileData.value.nip },
    { label: 'NIK', value: profileData.value.nik },
  ]

  return identities.find(({ value }) => value !== '-') ?? identities[0]
})

const loadProfileData = () => {
  if (!authStore.user) return

  profileData.value = {
    name: authStore.user.name || '-',
    email: authStore.user.email || '-',
    category: authStore.user.researcher?.category?.name || '-',
    nik: formatValue(authStore.user.researcher?.profile?.nik),
    nim: formatValue(authStore.user.researcher?.profile?.nim),
    nip: formatValue(authStore.user.researcher?.profile?.nip),
    phone: formatValue(authStore.user.researcher?.profile?.phone),
    address: formatValue(authStore.user.researcher?.profile?.address),
    faculty: formatValue(authStore.user.researcher?.profile?.faculty),
    department: formatValue(authStore.user.researcher?.profile?.department),
    institution: formatValue(authStore.user.researcher?.profile?.institution),
    program_study: formatValue(authStore.user.researcher?.profile?.program_study),
  }

  // Initialize form data
  formData.value = {
    nik: authStore.user.researcher?.profile?.nik || '',
    nim: authStore.user.researcher?.profile?.nim || '',
    nip: authStore.user.researcher?.profile?.nip || '',
    phone: authStore.user.researcher?.profile?.phone || '',
    address: authStore.user.researcher?.profile?.address || '',
    faculty: authStore.user.researcher?.profile?.faculty || '',
    department: authStore.user.researcher?.profile?.department || '',
    institution: authStore.user.researcher?.profile?.institution || '',
    program_study: authStore.user.researcher?.profile?.program_study || '',
  }
}

const enterEditMode = () => {
  isEditMode.value = true
}

const cancelEdit = () => {
  isEditMode.value = false
  loadProfileData() // Reset form data
}

const handleSaveProfile = async () => {
  if (!isResearcher.value) return

  loading.value = true

  try {
    const response = await updateResearcherProfile({
      nik: formData.value.nik || null,
      nim: formData.value.nim || null,
      nip: formData.value.nip || null,
      phone: formData.value.phone || null,
      address: formData.value.address || null,
      faculty: formData.value.faculty || null,
      department: formData.value.department || null,
      institution: formData.value.institution || null,
      program_study: formData.value.program_study || null,
    })

    if (response.success) {
      // Update auth store with new data
      if (response.data.user) {
        authStore.user = response.data.user
      }

      toast.success('Profil berhasil diperbarui!')
      loadProfileData()
      isEditMode.value = false
    }
  } catch (error) {
    toast.error(getApiErrorMessage(
      error,
      'Gagal menyimpan profile. Silakan coba lagi.',
    ))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProfileData()
  loadReviewerProfile()
})
</script>

<template>
  <main class="profile-page">
    <!-- Page Header -->
    <div class="page-header">
      <h1 class="page-title">Profile</h1>
      <p class="page-subtitle">Lihat dan kelola informasi profil akun Anda.</p>
    </div>


    <section v-if="isReviewer" class="professional-profile reviewer-profile">
      <div class="professional-profile__identity">
        <div class="profile-avatar" aria-hidden="true">{{ (authStore.user?.name || 'R').slice(0, 1).toUpperCase() }}</div>
        <div class="professional-profile__heading">
          <p class="professional-profile__eyebrow">Profil Reviewer</p>
          <h2>{{ authStore.user?.name }}</h2>
          <p>{{ authStore.user?.email }}</p>
          <span class="category-badge">{{ reviewerProfile.specialization || 'Spesialisasi belum diatur' }}<template v-if="reviewerProfile.position"> · {{ reviewerProfile.position }}</template></span>
        </div>
        <button v-if="!reviewerEdit" class="btn btn--secondary professional-profile__edit" type="button" @click="reviewerEdit = true">Edit Profil</button>
      </div>
      <form v-if="reviewerEdit" class="profile-section reviewer-profile-form" @submit.prevent="saveReviewerProfile">
        <div class="form-grid">
          <div class="form-field"><label class="form-label" for="reviewer-organization">Organisasi / Institusi</label><input id="reviewer-organization" v-model="reviewerForm.organization" class="form-input" /></div>
          <div class="form-field"><label class="form-label" for="reviewer-phone">Nomor Telepon</label><input id="reviewer-phone" v-model="reviewerForm.phone" class="form-input" type="tel" /></div>
          <div class="form-field form-field--full"><label class="form-label" for="reviewer-address">Alamat</label><textarea id="reviewer-address" v-model="reviewerForm.address" class="form-textarea" rows="3" /></div>
        </div>
        <div class="form-actions"><button class="btn btn--primary" type="submit" :disabled="reviewerLoading">{{ reviewerLoading ? 'Menyimpan...' : 'Simpan Perubahan' }}</button><button class="btn btn--secondary" type="button" :disabled="reviewerLoading" @click="reviewerEdit = false; loadReviewerProfile()">Batal</button></div>
      </form>
      <dl v-else class="professional-profile__details">
        <div class="profile-detail"><dt>Organisasi / Institusi</dt><dd>{{ reviewerProfile.organization || '—' }}</dd></div>
        <div class="profile-detail"><dt>Nomor Telepon</dt><dd>{{ reviewerProfile.phone || '—' }}</dd></div>
        <div class="profile-detail profile-detail--wide"><dt>Alamat</dt><dd>{{ reviewerProfile.address || '—' }}</dd></div>
      </dl>
    </section>
    <!-- View Mode -->
    <div v-if="isResearcher && !isEditMode" class="profile-container">
      <section class="professional-profile" aria-labelledby="profile-name">
        <div class="professional-profile__identity">
          <div class="profile-avatar" aria-hidden="true">{{ userInitials }}</div>
          <div class="professional-profile__heading">
            <p class="professional-profile__eyebrow">Profil Peneliti</p>
            <h2 id="profile-name">{{ profileData.name }}</h2>
            <span v-if="isResearcher" class="category-badge">{{ profileData.category }}</span>
            <p>{{ profileData.email }}</p>
          </div>
          <button
            v-if="isResearcher"
            type="button"
            class="btn btn--secondary professional-profile__edit"
            @click="enterEditMode"
          >
            Edit Profil
          </button>
        </div>

        <dl v-if="isResearcher" class="professional-profile__details">
          <div class="profile-detail">
            <dt>{{ preferredIdentity.label }}</dt>
            <dd>{{ preferredIdentity.value }}</dd>
          </div>
          <div class="profile-detail">
            <dt>Nomor Telepon</dt>
            <dd>{{ profileData.phone }}</dd>
          </div>
          <div class="profile-detail profile-detail--wide">
            <dt>Alamat</dt>
            <dd>{{ profileData.address }}</dd>
          </div>

        </dl>
      </section>

      <!-- Informasi Institusi -->
      <div v-if="isResearcher" class="profile-section">
        <div class="section-header">
          <h2 class="section-title">Informasi Institusi</h2>
          <p class="section-description">Informasi institusi dan program studi Anda</p>
        </div>

        <div class="profile-grid">
          <!-- Institution -->
          <div class="profile-field">
            <label class="profile-field__label">Institusi</label>
            <div class="profile-field__value">{{ profileData.institution }}</div>
          </div>

          <div v-if="isStaff" class="profile-field">
            <label class="profile-field__label">Unit / Departemen</label>
            <div class="profile-field__value">{{ profileData.department }}</div>
          </div>

          <!-- Faculty -->
          <div class="profile-field">
            <label class="profile-field__label">Fakultas</label>
            <div class="profile-field__value">{{ profileData.faculty }}</div>
          </div>

          <!-- Program Study -->
          <div class="profile-field">
            <label class="profile-field__label">Program Studi</label>
            <div class="profile-field__value">{{ profileData.program_study }}</div>
          </div>
        </div>
      </div>

    </div>

    <!-- Edit Mode -->
    <div v-else-if="isResearcher" class="profile-container">
      <form @submit.prevent="handleSaveProfile">
        <!-- Section 1: Data Identitas -->
        <div class="profile-section">
          <div class="section-header">
            <h2 class="section-title">Data Identitas</h2>
            <p class="section-description">Edit informasi identitas pribadi Anda</p>
          </div>

          <div class="form-grid">
            <!-- NIK -->
            <div class="form-field">
              <label for="nik" class="form-label">NIK</label>
              <input
                id="nik"
                v-model="formData.nik"
                type="text"
                class="form-input"
                placeholder="Nomor Induk Kependudukan"
              />
            </div>

            <!-- NIM -->
            <div v-if="isMhs" class="form-field">
              <label for="nim" class="form-label">NIM</label>
              <input
                id="nim"
                v-model="formData.nim"
                type="text"
                class="form-input"
                placeholder="Nomor Induk Mahasiswa"
              />
            </div>

            <!-- NIP -->
            <div v-if="isStaff || isDosen" class="form-field">
              <label for="nip" class="form-label">NIP</label>
              <input
                id="nip"
                v-model="formData.nip"
                type="text"
                class="form-input"
                placeholder="Nomor Induk Pegawai"
              />
            </div>

            <!-- Phone -->
            <div class="form-field">
              <label for="phone" class="form-label">Nomor Telepon</label>
              <input
                id="phone"
                v-model="formData.phone"
                type="tel"
                class="form-input"
                placeholder="Contoh: 081233445505"
              />
            </div>

            <!-- Address -->
            <div class="form-field form-field--full">
              <label for="address" class="form-label">Alamat</label>
              <textarea
                id="address"
                v-model="formData.address"
                class="form-textarea"
                placeholder="Masukkan alamat lengkap Anda"
                rows="3"
              />
            </div>
          </div>
        </div>

        <!-- Section 2: Informasi Institusi -->
        <div class="profile-section">
          <div class="section-header">
            <h2 class="section-title">Informasi Institusi</h2>
            <p class="section-description">Edit informasi institusi dan program studi Anda</p>
          </div>

          <div class="form-grid">
            <!-- Institution -->
            <div class="form-field">
              <label for="institution" class="form-label">Institusi</label>
              <input
                id="institution"
                v-model="formData.institution"
                type="text"
                class="form-input"
                placeholder="Nama institusi Anda"
              />
            </div>

            <div v-if="isStaff" class="form-field">
              <label for="department" class="form-label">Unit / Departemen</label>
              <input
                id="department"
                v-model="formData.department"
                type="text"
                class="form-input"
                placeholder="Nama unit atau departemen"
              />
            </div>

            <!-- Faculty -->
            <div class="form-field">
              <label for="faculty" class="form-label">Fakultas</label>
              <input
                id="faculty"
                v-model="formData.faculty"
                type="text"
                class="form-input"
                placeholder="Nama fakultas"
              />
            </div>

            <!-- Program Study -->
            <div class="form-field">
              <label for="program_study" class="form-label">Program Studi</label>
              <input
                id="program_study"
                v-model="formData.program_study"
                type="text"
                class="form-input"
                placeholder="Nama program studi"
              />
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="form-actions">
          <button
            type="submit"
            class="btn btn--primary"
            :disabled="loading"
          >
            {{ loading ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
          <button
            type="button"
            class="btn btn--secondary"
            @click="cancelEdit"
            :disabled="loading"
          >
            Batalkan
          </button>
        </div>
      </form>
    </div>
    <!-- Profil akun untuk role non-peneliti dan non-reviewer -->
    <section v-if="!isResearcher && !isReviewer" class="professional-profile account-profile">
      <div class="professional-profile__identity">
        <div class="profile-avatar" aria-hidden="true">{{ accountInitial }}</div>
        <div class="professional-profile__heading">
          <p class="professional-profile__eyebrow">Profil Pengguna</p>
          <h2>{{ authStore.user?.name || 'Nama belum tersedia' }}</h2>
          <p>{{ authStore.user?.email || 'Email belum tersedia' }}</p>
          <span class="category-badge">{{ accountRoleLabel }}</span>
        </div>
      </div>
      <dl class="professional-profile__details">
        <div class="profile-detail">
          <dt>Nama Lengkap</dt>
          <dd>{{ authStore.user?.name || '—' }}</dd>
        </div>
        <div class="profile-detail">
          <dt>Email</dt>
          <dd>{{ authStore.user?.email || '—' }}</dd>
        </div>
        <div class="profile-detail profile-detail--wide">
          <dt>Role / Hak Akses</dt>
          <dd>{{ accountRoleLabel }}</dd>
        </div>
      </dl>
    </section>

    <ChangePasswordForm />
  </main>
</template>

<style scoped>
.profile-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 0;
}

.page-header {
  margin-bottom: 32px;
  text-align: left;
}

.page-title {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--foreground);
}

.page-subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.profile-container {
  display: grid;
  gap: 32px;
}

.professional-profile {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-md);
}

.professional-profile__identity {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 28px;
  background: var(--gradient-primary-soft);
  border-bottom: 1px solid var(--border);
}

.profile-avatar {
  display: grid;
  flex: 0 0 68px;
  width: 68px;
  height: 68px;
  place-items: center;
  border: 3px solid var(--card);
  border-radius: 50%;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-primary-sm);
  color: var(--primary-foreground);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.professional-profile__heading {
  min-width: 0;
  flex: 1;
}

.professional-profile__eyebrow {
  margin: 0 0 4px;
  color: var(--accent-foreground);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.professional-profile__heading h2 {
  margin: 0;
  color: var(--foreground);
  font-size: 1.35rem;
  line-height: 1.3;
}

.professional-profile__heading > p:last-child {
  overflow-wrap: anywhere;
  margin: 7px 0 0;
  color: var(--muted-foreground);
  font-size: 0.9rem;
}

.category-badge {
  display: inline-flex;
  margin-top: 8px;
  padding: 4px 9px;
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-full);
  background: var(--color-success-soft);
  color: var(--accent-foreground);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: capitalize;
}

.professional-profile__edit {
  flex: 0 0 auto;
}

.professional-profile__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 0;
}

.profile-detail {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 20px 28px;
  border-bottom: 1px solid var(--border);
}

.profile-detail:nth-child(odd) {
  border-right: 1px solid var(--border);
}

.profile-detail--wide {
  grid-column: 1 / -1;
  border-bottom: 0;
}

.profile-detail--wide:nth-child(odd) {
  border-right: 0;
}

.profile-detail dt {
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.profile-detail dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--foreground);
  font-size: 0.95rem;
  line-height: 1.55;
}

.profile-section {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  padding: 28px;
  box-shadow: var(--shadow-sm);
  margin-top: 12px
}

.section-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.section-title {
  margin: 0 0 4px;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--foreground);
}

.section-description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted-foreground);
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.profile-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.profile-field__label {
  font-size: 0.84rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted-foreground);
}

.profile-field__value {
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 12px 14px;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--color-surface);
  font-size: 0.96rem;
  font-weight: 400;
  color: var(--foreground);
  line-height: 1.5;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.profile-field__value--long {
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Form Styles */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-field {
  display: grid;
  gap: 8px;
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--accent-foreground);
  letter-spacing: 0.3px;
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
  min-height: 80px;
  font-family: var(--font-sans);
}

/* Action Buttons */
.profile-actions,
.form-actions {
  display: flex;
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

.btn--secondary {
  color: var(--primary);
  background: var(--color-surface);
  border-color: var(--border);

  &:hover:not(:disabled) {
    background: var(--muted);
    border-color: var(--primary);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .profile-page {
    padding: 0;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .page-title {
    font-size: 24px;
  }

  .profile-container {
    gap: 24px;
  }

  .professional-profile__identity {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 20px;
  }

  .professional-profile__edit {
    width: 100%;
  }

  .professional-profile__details {
    grid-template-columns: 1fr;
  }

  .profile-detail,
  .profile-detail:nth-child(odd) {
    padding: 16px 20px;
    border-right: 0;
  }

  .profile-detail:last-child {
    border-bottom: 0;
  }

  .profile-section {
    padding: 20px;
  }

  .section-header {
    margin-bottom: 16px;
    padding-bottom: 12px;
  }

  .section-title {
    font-size: 1.05rem;
  }

  .profile-grid,
  .form-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .profile-actions,
  .form-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
