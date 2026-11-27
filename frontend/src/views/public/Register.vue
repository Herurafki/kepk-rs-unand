
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { apiClient } from '../../services/api'
import {
  register,
  type RegisterPayload,
  fetchCategories,
  type Category,
} from '../../services/auth/auth.service.ts'
import { getApiErrorMessage } from '../../services/api/error.ts'
import AuthInputField from '../../components/auth/AuthInputField.vue'
import RegisterCategoryCard, {
  type CategoryOption,
} from '../../components/auth/RegisterCategoryCard.vue'

const router = useRouter()

type RegisterCategoryName = 'Dosen' | 'Mahasiswa' | 'Staff' | 'Umum'
type JenisInstitusi = 'Universitas' | 'Rumah Sakit'

// Master data interfaces
interface InstitusiMaster {
  id: number
  nama_institusi: string
  jenis: JenisInstitusi
}

interface FakultasMaster {
  id: number
  nama_fakultas: string
}

interface ProdiMaster {
  id: number
  nama_prodi: string
}

interface MasterResponse<T> {
  success: boolean
  data: T[]
}

// Registration categories
const categories = ref<Category[]>([])
const selectedCategoryId = ref<string | null>(null)

// Master data
const institusiList = ref<InstitusiMaster[]>([])
const fakultasList = ref<FakultasMaster[]>([])
const prodiList = ref<ProdiMaster[]>([])

// Map category names to icons
const categoryIconMap: Record<RegisterCategoryName, string> = {
  Dosen: 'dosen',
  Mahasiswa: 'mahasiswa',
  Staff: 'staff',
  Umum: 'umum',
}

// Create category options
const categoryOptions = computed<CategoryOption[]>(() => {
  return categories.value.map(cat => {
    const catName = cat.name as RegisterCategoryName
    const icon = categoryIconMap[catName] as
      'dosen' | 'mahasiswa' | 'staff' | 'umum'

    return {
      value: cat.id,
      label: cat.name,
      description: getDescriptionForCategory(catName),
      icon: icon || 'dosen',
    }
  })
})

// Get category description
function getDescriptionForCategory(
  categoryName: RegisterCategoryName
): string {
  const descriptions: Record<RegisterCategoryName, string> = {
    Dosen: 'Untuk tenaga pengajar / dosen',
    Mahasiswa: 'Untuk mahasiswa aktif',
    Staff: 'Untuk staf / pegawai institusi',
    Umum: 'Untuk masyarakat umum',
  }

  return descriptions[categoryName] || ''
}

// Get category name by ID
function getCategoryNameById(
  categoryId: string | null
): RegisterCategoryName | null {
  if (!categoryId) return null

  const category = categories.value.find(
    c => c.id === categoryId
  )

  return category
    ? (category.name as RegisterCategoryName)
    : null
}

const selectedCategoryName = computed(() =>
  getCategoryNameById(selectedCategoryId.value)
)

// Shared fields
const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')

// Category-specific fields
const nip = ref('')
const nim = ref('')
const nik = ref('')
const institusi = ref('')
const fakultas = ref('')
const programStudi = ref('')
const instalasiUnitKerja = ref('')
const noHp = ref('')
const alamat = ref('')

// Form status
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

// Institution suggestions by registration category
const institusiSuggestions = computed<string[]>(() => {
  const category = selectedCategoryName.value

  if (
    category !== 'Dosen' &&
    category !== 'Mahasiswa' &&
    category !== 'Staff'
  ) {
    return []
  }

  const jenis: JenisInstitusi =
    category === 'Staff'
      ? 'Rumah Sakit'
      : 'Universitas'

  return institusiList.value
    .filter(item => item.jenis === jenis)
    .map(item => item.nama_institusi)
})

// Faculty suggestions
const fakultasSuggestions = computed<string[]>(() => {
  return fakultasList.value.map(
    item => item.nama_fakultas
  )
})

// Program study suggestions
const prodiSuggestions = computed<string[]>(() => {
  return prodiList.value.map(
    item => item.nama_prodi
  )
})

// Change registration category
const selectCategory = (categoryId: string) => {
  if (selectedCategoryId.value === categoryId) return

  selectedCategoryId.value = categoryId

  // Reset category-dependent fields
  institusi.value = ''
  fakultas.value = ''
  programStudi.value = ''
  instalasiUnitKerja.value = ''

  errorMessage.value = ''
  successMessage.value = ''
}

// Fetch categories and master data once
onMounted(async () => {
  const results = await Promise.allSettled([
    fetchCategories(),
    apiClient.get<MasterResponse<InstitusiMaster>>(
      '/master/institusi'
    ),
    apiClient.get<MasterResponse<FakultasMaster>>(
      '/master/fakultas'
    ),
    apiClient.get<MasterResponse<ProdiMaster>>(
      '/master/prodi'
    ),
  ])

  const [
    categoriesResult,
    institusiResult,
    fakultasResult,
    prodiResult,
  ] = results

  // Registration categories
  if (categoriesResult.status === 'fulfilled') {
    categories.value = categoriesResult.value
  } else {
    console.error(
      'Failed to fetch categories:',
      categoriesResult.reason
    )
  }

  // Institutions
  if (
    institusiResult.status === 'fulfilled' &&
    institusiResult.value.data.success &&
    Array.isArray(institusiResult.value.data.data)
  ) {
    institusiList.value = institusiResult.value.data.data
  } else {
    console.error(
      'Failed to fetch institusi:',
      institusiResult.status === 'rejected'
        ? institusiResult.reason
        : 'Invalid response'
    )
  }

  // Faculties
  if (
    fakultasResult.status === 'fulfilled' &&
    fakultasResult.value.data.success &&
    Array.isArray(fakultasResult.value.data.data)
  ) {
    fakultasList.value = fakultasResult.value.data.data
  } else {
    console.error(
      'Failed to fetch fakultas:',
      fakultasResult.status === 'rejected'
        ? fakultasResult.reason
        : 'Invalid response'
    )
  }

  // Program studies
  if (
    prodiResult.status === 'fulfilled' &&
    prodiResult.value.data.success &&
    Array.isArray(prodiResult.value.data.data)
  ) {
    prodiList.value = prodiResult.value.data.data
  } else {
    console.error(
      'Failed to fetch prodi:',
      prodiResult.status === 'rejected'
        ? prodiResult.reason
        : 'Invalid response'
    )
  }
})

// Submit registration
const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  // Check category
  if (!selectedCategoryId.value) {
    errorMessage.value =
      'Pilih kategori registrasi terlebih dahulu.'
    return
  }

  // Check shared required fields
  if (
    !name.value.trim() ||
    !email.value.trim() ||
    !password.value
  ) {
    errorMessage.value = 'Semua field wajib diisi.'
    return
  }

  if (password.value.length < 8) {
    errorMessage.value = 'Password minimal 8 karakter.'
    return
  }

  if (password.value !== passwordConfirmation.value) {
    errorMessage.value = 'Konfirmasi password tidak cocok.'
    return
  }

  // Category-specific validation
  const categoryName = getCategoryNameById(
    selectedCategoryId.value
  )

  if (
    categoryName === 'Dosen' ||
    categoryName === 'Staff'
  ) {
    if (!nip.value.trim()) {
      errorMessage.value = 'NIP wajib diisi.'
      return
    }
  }

  if (categoryName === 'Mahasiswa') {
    if (!nim.value.trim()) {
      errorMessage.value = 'NIM wajib diisi.'
      return
    }
  }

  if (
    categoryName === 'Dosen' ||
    categoryName === 'Mahasiswa' ||
    categoryName === 'Staff' ||
    categoryName === 'Umum'
  ) {
    if (!nik.value.trim()) {
      errorMessage.value = 'NIK wajib diisi.'
      return
    }
  }

  if (
    categoryName === 'Dosen' ||
    categoryName === 'Mahasiswa' ||
    categoryName === 'Staff'
  ) {
    if (!institusi.value.trim()) {
      errorMessage.value = 'Institusi wajib diisi.'
      return
    }
  }

  if (
    categoryName === 'Dosen' ||
    categoryName === 'Mahasiswa'
  ) {
    if (
      !fakultas.value.trim() ||
      !programStudi.value.trim()
    ) {
      errorMessage.value =
        'Fakultas dan Program Studi wajib diisi.'
      return
    }
  }

  if (categoryName === 'Staff') {
    if (!instalasiUnitKerja.value.trim()) {
      errorMessage.value =
        'Instalasi/Unit Kerja wajib diisi.'
      return
    }
  }

  if (!noHp.value.trim() || !alamat.value.trim()) {
    errorMessage.value =
      'No. HP dan Alamat wajib diisi.'
    return
  }

  loading.value = true

  try {
    const categoryName = getCategoryNameById(
      selectedCategoryId.value
    )

    // Build registration payload
    const payload: RegisterPayload = {
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      category_id: selectedCategoryId.value!,
      profile: {
        phone: noHp.value.trim(),
        address: alamat.value.trim(),
      },
    }

    if (
      categoryName === 'Dosen' ||
      categoryName === 'Staff'
    ) {
      payload.profile.nip = nip.value.trim()
    }

    if (categoryName === 'Mahasiswa') {
      payload.profile.nim = nim.value.trim()
    }

    if (
      categoryName === 'Dosen' ||
      categoryName === 'Mahasiswa' ||
      categoryName === 'Staff' ||
      categoryName === 'Umum'
    ) {
      payload.profile.nik = nik.value.trim()
    }

    if (
      categoryName === 'Dosen' ||
      categoryName === 'Mahasiswa' ||
      categoryName === 'Staff'
    ) {
      payload.profile.institution = institusi.value.trim()
    }

    if (categoryName === 'Umum') {
      payload.profile.institution = 'Independen'
    }

    if (
      categoryName === 'Dosen' ||
      categoryName === 'Mahasiswa'
    ) {
      payload.profile.faculty = fakultas.value.trim()
      payload.profile.program_study =
        programStudi.value.trim()
    }

    if (categoryName === 'Staff') {
      payload.profile.work_unit =
        instalasiUnitKerja.value.trim()
    }

    await register(payload)

    successMessage.value =
      'Registrasi berhasil. Periksa email untuk verifikasi akun.'

    password.value = ''
    passwordConfirmation.value = ''

    await router.push({
      name: 'verify-email',
      query: { email: email.value.trim(), sent: '1' },
    })
  } catch (error: unknown) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 409
    ) {
      errorMessage.value = 'Email sudah terdaftar.'
    } else {
      errorMessage.value = getApiErrorMessage(
        error,
        'Registrasi gagal. Silakan coba lagi.',
      )
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card auth-card--lg">


      <h1 class="auth-title">
        Registrasi Peneliti
      </h1>

      <p class="auth-subtitle">
        Buat akun baru untuk mengajukan penelitian.
      </p>

      <!-- Category Selector -->
      <div
        class="category-selector"
        role="radiogroup"
        aria-label="Pilih kategori registrasi"
      >
        <RegisterCategoryCard
          v-for="option in categoryOptions"
          :key="option.value"
          :option="option"
          :selected="selectedCategoryId === option.value"
          @select="selectCategory(option.value)"
        />
      </div>

      <!-- Registration Form -->
      <form
        v-if="selectedCategoryId"
        class="auth-form auth-form--lg"
        @submit.prevent="handleSubmit"
      >
        <!-- Shared Fields -->
        <AuthInputField
          id="name"
          v-model="name"
          label="Nama Lengkap"
          type="text"
          autocomplete="name"
          placeholder="Masukkan nama lengkap"
          :maxlength="100"
          icon="user"
          required
        />

        <AuthInputField
          id="email"
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          placeholder="Masukkan alamat email"
          :maxlength="255"
          icon="mail"
          required
        />

        <AuthInputField
          id="password"
          v-model="password"
          label="Password"
          type="password"
          autocomplete="new-password"
          placeholder="Masukkan password"
          :minlength="8"
          icon="lock"
          required
        />

        <AuthInputField
          id="password-confirmation"
          v-model="passwordConfirmation"
          label="Konfirmasi Password"
          type="password"
          autocomplete="new-password"
          placeholder="Ulangi password"
          :minlength="8"
          icon="lock"
          required
        />

        <!-- Dosen Fields -->
        <template
          v-if="getCategoryNameById(selectedCategoryId) === 'Dosen'"
        >
          <AuthInputField
            id="nip"
            v-model="nip"
            label="NIP"
            type="text"
            placeholder="Nomor Induk Pegawai"
            :maxlength="100"
            icon="id-card"
            required
          />

          <AuthInputField
            id="nik-dosen"
            v-model="nik"
            label="NIK"
            type="text"
            placeholder="Nomor Induk Kependudukan"
            :maxlength="100"
            icon="id-card"
            required
          />

          <AuthInputField
            id="no-hp"
            v-model="noHp"
            label="No. HP"
            type="tel"
            autocomplete="tel"
            placeholder="Nomor telepon / HP"
            :maxlength="20"
            icon="phone"
            required
          />

          <AuthInputField
            id="institusi"
            v-model="institusi"
            label="Institusi"
            type="text"
            placeholder="Nama institusi"
            :maxlength="100"
            :suggestions="institusiSuggestions"
            icon="building"
            required
          />

          <AuthInputField
            id="fakultas"
            v-model="fakultas"
            label="Fakultas"
            type="text"
            placeholder="Nama fakultas"
            :maxlength="100"
            :suggestions="fakultasSuggestions"
            icon="academic"
            required
          />

          <AuthInputField
            id="program-studi"
            v-model="programStudi"
            label="Program Studi"
            type="text"
            placeholder="Nama program studi"
            :maxlength="100"
            :suggestions="prodiSuggestions"
            icon="academic"
            required
          />
        </template>

        <!-- Mahasiswa Fields -->
        <template
          v-if="getCategoryNameById(selectedCategoryId) === 'Mahasiswa'"
        >
          <AuthInputField
            id="nim"
            v-model="nim"
            label="NIM"
            type="text"
            placeholder="Nomor Induk Mahasiswa"
            :maxlength="100"
            icon="id-card"
            required
          />

          <AuthInputField
            id="nik-mahasiswa"
            v-model="nik"
            label="NIK"
            type="text"
            placeholder="Nomor Induk Kependudukan"
            :maxlength="100"
            icon="id-card"
            required
          />

          <AuthInputField
            id="no-hp"
            v-model="noHp"
            label="No. HP"
            type="tel"
            autocomplete="tel"
            placeholder="Nomor telepon / HP"
            :maxlength="20"
            icon="phone"
            required
          />

          <AuthInputField
            id="institusi"
            v-model="institusi"
            label="Institusi"
            type="text"
            placeholder="Nama institusi"
            :maxlength="100"
            :suggestions="institusiSuggestions"
            icon="building"
            required
          />

          <AuthInputField
            id="fakultas"
            v-model="fakultas"
            label="Fakultas"
            type="text"
            placeholder="Nama fakultas"
            :maxlength="100"
            :suggestions="fakultasSuggestions"
            icon="academic"
            required
          />

          <AuthInputField
            id="program-studi"
            v-model="programStudi"
            label="Program Studi"
            type="text"
            placeholder="Nama program studi"
            :maxlength="100"
            :suggestions="prodiSuggestions"
            icon="academic"
            required
          />
        </template>

        <!-- Staff Fields -->
        <template
          v-if="getCategoryNameById(selectedCategoryId) === 'Staff'"
        >
          <AuthInputField
            id="nip"
            v-model="nip"
            label="NIP"
            type="text"
            placeholder="Nomor Induk Pegawai"
            :maxlength="100"
            icon="id-card"
            required
          />

          <AuthInputField
            id="nik-staff"
            v-model="nik"
            label="NIK"
            type="text"
            placeholder="Nomor Induk Kependudukan"
            :maxlength="100"
            icon="id-card"
            required
          />

          <AuthInputField
            id="no-hp"
            v-model="noHp"
            label="No. HP"
            type="tel"
            autocomplete="tel"
            placeholder="Nomor telepon / HP"
            :maxlength="20"
            icon="phone"
            required
          />

          <AuthInputField
            id="institusi"
            v-model="institusi"
            label="Institusi"
            type="text"
            placeholder="Nama institusi"
            :maxlength="100"
            :suggestions="institusiSuggestions"
            icon="building"
            required
          />

          <AuthInputField
            id="instalasi-unit-kerja"
            v-model="instalasiUnitKerja"
            label="Instalasi/Unit Kerja"
            type="text"
            placeholder="Nama instalasi atau unit kerja"
            :maxlength="100"
            icon="briefcase"
            required
          />
        </template>

        <!-- Umum Fields -->
        <template
          v-if="getCategoryNameById(selectedCategoryId) === 'Umum'"
        >
          <AuthInputField
            id="nik"
            v-model="nik"
            label="NIK"
            type="text"
            placeholder="Nomor Induk Kependudukan"
            :maxlength="100"
            icon="id-card"
            required
          />

          <AuthInputField
            id="no-hp"
            v-model="noHp"
            label="No. HP"
            type="tel"
            autocomplete="tel"
            placeholder="Nomor telepon / HP"
            :maxlength="20"
            icon="phone"
            required
          />
        </template>

        <!-- Address -->
        <AuthInputField
          id="alamat"
          v-model="alamat"
          label="Alamat"
          type="text"
          placeholder="Alamat lengkap"
          :maxlength="255"
          icon="map-pin"
          class="span-full"
          required
        />

        <!-- Form Messages -->
        <p
          v-if="errorMessage"
          class="auth-alert auth-alert--error"
        >
          {{ errorMessage }}
        </p>

        <p
          v-if="successMessage"
          class="auth-alert auth-alert--success"
        >
          {{ successMessage }}
        </p>

        <!-- Submit -->
        <button
          class="auth-button"
          type="submit"
          :disabled="loading || !selectedCategoryId"
        >
          {{ loading ? 'Memproses...' : 'Registrasi' }}
        </button>
      </form>

      <p class="auth-alt-link">
        Sudah punya akun?
        <RouterLink to="/login">
          Login di sini
        </RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.category-selector {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 32px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

@media (max-width: 640px) {
  .category-selector {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 24px;
    padding-bottom: 6px;
  }
}
</style>
