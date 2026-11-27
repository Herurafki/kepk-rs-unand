<script setup lang="ts">
import { ref, computed } from 'vue'
import { AlertCircle, CheckCircle } from 'lucide-vue-next'
import type { Role, CreateUserPayload } from '../../../types/admin/user.types'

interface Props {
  roles: Role[]
  loading?: boolean
  loadingRoles?: boolean
  error?: string | null
  rolesError?: string | null
  success?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingRoles: false,
  error: null,
  rolesError: null,
  success: false,
})

const emit = defineEmits<{
  submit: [payload: CreateUserPayload]
  reset: []
}>()

// ======================================================
// FORM STATE
// ======================================================

const formData = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: '',
  is_active: true,
})

// ======================================================
// VALIDATION STATE
// ======================================================

const touched = ref({
  name: false,
  email: false,
  password: false,
  confirmPassword: false,
  role: false,
})

// ======================================================
// VALIDATION FUNCTIONS
// ======================================================

const validateName = (name: string) => {
  if (!name.trim()) return 'Nama wajib diisi'
  if (name.trim().length < 2) return 'Nama minimal 2 karakter'
  if (name.trim().length > 255) return 'Nama maksimal 255 karakter'

  return null
}

const validateEmail = (email: string) => {
  if (!email.trim()) return 'Email wajib diisi'

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    return 'Format email tidak valid'
  }

  return null
}

const validatePassword = (password: string) => {
  if (!password) return 'Password wajib diisi'
  if (password.length < 8) return 'Password minimal 8 karakter'

  return null
}

const validateConfirmPassword = (
  password: string,
  confirmPassword: string
) => {
  if (!confirmPassword) {
    return 'Konfirmasi password wajib diisi'
  }

  if (password !== confirmPassword) {
    return 'Password tidak cocok'
  }

  return null
}

const validateRole = (role: string) => {
  if (!role) return 'Role wajib dipilih'

  return null
}

// ======================================================
// COMPUTED ERRORS
// ======================================================

const nameError = computed(() => {
  if (!touched.value.name) return null

  return validateName(formData.value.name)
})

const emailError = computed(() => {
  if (!touched.value.email) return null

  return validateEmail(formData.value.email)
})

const passwordError = computed(() => {
  if (!touched.value.password) return null

  return validatePassword(formData.value.password)
})

const confirmPasswordError = computed(() => {
  if (!touched.value.confirmPassword) return null

  return validateConfirmPassword(
    formData.value.password,
    formData.value.confirmPassword
  )
})

const roleError = computed(() => {
  if (!touched.value.role) return null

  return validateRole(formData.value.role)
})

// ======================================================
// FORM VALIDATION
// ======================================================

const isFormValid = computed(() => {
  return (
    !nameError.value &&
    !emailError.value &&
    !passwordError.value &&
    !confirmPasswordError.value &&
    !roleError.value &&
    formData.value.name.trim() !== '' &&
    formData.value.email.trim() !== '' &&
    formData.value.password !== '' &&
    formData.value.confirmPassword !== '' &&
    formData.value.role !== ''
  )
})

// ======================================================
// SUBMIT
// ======================================================

const handleSubmit = () => {
  // Tandai semua field sebagai sudah disentuh
  touched.value.name = true
  touched.value.email = true
  touched.value.password = true
  touched.value.confirmPassword = true
  touched.value.role = true

  // Stop kalau validation gagal
  if (!isFormValid.value) {
    return
  }

  // Payload yang dikirim ke parent/store
  const payload: CreateUserPayload = {
    name: formData.value.name.trim(),
    email: formData.value.email.trim(),
    password: formData.value.password,
    role: formData.value.role, // Mengubah role menjadi array
    is_active: formData.value.is_active,
  }

  // Debug
  console.log('CREATE USER PAYLOAD:', payload)

  emit('submit', payload)
}

// ======================================================
// RESET
// ======================================================

const handleReset = () => {
  formData.value = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    is_active: true,
  }

  touched.value = {
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    role: false,
  }

  emit('reset')
}

const formatRoleName = (role: string) => {
  const roleLabels: Record<string, string> = {
    SUPERADMIN: 'Super Administrator',
    KETUA: 'Ketua KEPK',
    SEKRETARIAT: 'Sekretaris KEPK',
    DIKLIT: 'Diklit',
    REVIEWER: 'Reviewer',
    PENELITI: 'Peneliti',
  }

  return roleLabels[role] ?? role
}

// ======================================================
// FIELD BLUR
// ======================================================

const handleFieldBlur = (
  field: keyof typeof touched.value
) => {
  touched.value[field] = true
}
</script>

<template>
  <div class="user-form-container">

    <!-- ========================================= -->
    <!-- SUCCESS MESSAGE -->
    <!-- ========================================= -->

    <div
      v-if="success"
      class="alert alert-success"
    >
      <CheckCircle :size="20" />

      <span>
        User berhasil ditambahkan!
      </span>
    </div>

    <!-- ========================================= -->
    <!-- ERROR MESSAGE -->
    <!-- ========================================= -->

    <div
      v-if="error"
      class="alert alert-error"
    >
      <AlertCircle :size="20" />

      <span>
        {{ error }}
      </span>
    </div>

    <!-- ========================================= -->
    <!-- FORM -->
    <!-- ========================================= -->

    <form
      @submit.prevent="handleSubmit"
      class="form"
    >

      <!-- ======================================= -->
      <!-- NAME -->
      <!-- ======================================= -->

      <div class="form-group">

        <label
          for="name"
          class="form-label"
        >
          Nama

          <span class="required">
            *
          </span>
        </label>

        <input
          id="name"
          v-model="formData.name"
          type="text"
          placeholder="Masukkan nama lengkap"
          class="form-input"
          :class="{ 'has-error': nameError }"
          @blur="handleFieldBlur('name')"
          maxlength="255"
        />

        <span
          v-if="nameError"
          class="form-error"
        >
          {{ nameError }}
        </span>

      </div>

      <!-- ======================================= -->
      <!-- EMAIL -->
      <!-- ======================================= -->

      <div class="form-group">

        <label
          for="email"
          class="form-label"
        >
          Email

          <span class="required">
            *
          </span>
        </label>

        <input
          id="email"
          v-model="formData.email"
          type="email"
          placeholder="email@example.com"
          class="form-input"
          :class="{ 'has-error': emailError }"
          @blur="handleFieldBlur('email')"
        />

        <span
          v-if="emailError"
          class="form-error"
        >
          {{ emailError }}
        </span>

      </div>

      <!-- ======================================= -->
      <!-- PASSWORD -->
      <!-- ======================================= -->

      <div class="form-group">

        <label
          for="password"
          class="form-label"
        >
          Password

          <span class="required">
            *
          </span>
        </label>

        <input
          id="password"
          v-model="formData.password"
          type="password"
          placeholder="Minimal 8 karakter"
          class="form-input"
          :class="{ 'has-error': passwordError }"
          @blur="handleFieldBlur('password')"
          minlength="8"
        />

        <span
          v-if="passwordError"
          class="form-error"
        >
          {{ passwordError }}
        </span>

      </div>

      <!-- ======================================= -->
      <!-- CONFIRM PASSWORD -->
      <!-- ======================================= -->

      <div class="form-group">

        <label
          for="confirmPassword"
          class="form-label"
        >
          Konfirmasi Password

          <span class="required">
            *
          </span>
        </label>

        <input
          id="confirmPassword"
          v-model="formData.confirmPassword"
          type="password"
          placeholder="Ulangi password"
          class="form-input"
          :class="{
            'has-error': confirmPasswordError
          }"
          @blur="handleFieldBlur('confirmPassword')"
          minlength="8"
        />

        <span
          v-if="confirmPasswordError"
          class="form-error"
        >
          {{ confirmPasswordError }}
        </span>

      </div>

      <!-- ======================================= -->
      <!-- ROLE -->
      <!-- ======================================= -->

      <div class="form-group">

        <label
          for="role"
          class="form-label"
        >
          Role

          <span class="required">
            *
          </span>
        </label>

        <!-- Loading -->

        <div
          v-if="loadingRoles"
          class="roles-state roles-loading"
        >
          <p class="state-message">
            ⏳ Memuat daftar role...
          </p>
        </div>

        <!-- Error -->

        <div
          v-else-if="rolesError"
          class="roles-state roles-error"
        >
          <p class="state-message">
            ⚠️ {{ rolesError }}
          </p>

          <p class="state-hint">
            Hubungi administrator jika masalah berlanjut
          </p>
        </div>

        <!-- Empty -->

        <div
          v-else-if="roles.length === 0"
          class="roles-state roles-empty"
        >
          <p class="state-message">
            ❌ Tidak ada role yang tersedia
          </p>

          <p class="state-hint">
            Tidak ada role yang bisa dipilih di sistem
          </p>
        </div>

        <!-- Role Select -->

        <!-- Role Select -->

<div v-else>
  <select
    id="role"
    v-model="formData.role"
    class="form-input"
    :class="{ 'has-error': roleError }"
    :disabled="loadingRoles || rolesError !== null"
    @blur="handleFieldBlur('role')"
  >
    <option
      value=""
      disabled
    >
      Pilih role
    </option>

    <option
      v-for="role in roles"
      :key="role.id"
      :value="role.name"
    >
      {{ formatRoleName(role.name) }}
    </option>
  </select>
</div>

        <!-- Validation Error -->

        <span
          v-if="roleError"
          class="form-error"
        >
          {{ roleError }}
        </span>

      </div>

      <!-- ======================================= -->
      <!-- ACTIVE STATUS -->
      <!-- ======================================= -->

      <div class="form-group">

        <label class="checkbox-wrapper">

          <input
            v-model="formData.is_active"
            type="checkbox"
          />

          <span>
            Aktifkan user ini
          </span>

        </label>

      </div>

      <!-- ======================================= -->
      <!-- ACTIONS -->
      <!-- ======================================= -->

      <div class="form-actions">

        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading"
        >
          <span v-if="loading">
            Menyimpan...
          </span>

          <span v-else>
            Tambah User
          </span>
        </button>

        <button
          type="button"
          class="btn btn-secondary"
          @click="handleReset"
          :disabled="loading"
        >
          Reset
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.user-form-container {
  width: 100%;
  max-width: 600px;
  margin: 0;
  padding-left: 12px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 14px;
  font-weight: 500;

  &.alert-success {
    background: color-mix(in srgb, var(--primary) 10%, var(--color-surface));
    border: 1px solid var(--primary);
    color: var(--primary);

    svg {
      color: var(--primary);
    }
  }

  &.alert-error {
    background: color-mix(in srgb, var(--destructive) 10%, var(--color-surface));
    border: 1px solid var(--destructive);
    color: var(--destructive);

    svg {
      color: var(--destructive);
    }
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  display: flex;
  gap: 4px;
}

.required {
  color: var(--color-danger);
}

.form-input {
  padding: 12px 16px;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--foreground);
  font-size: 14px;
  transition: all 200ms ease;

  &::placeholder {
    color: var(--muted-foreground);
  }

  &:hover {
    border-color: color-mix(
      in srgb,
      var(--ring) 40%,
      var(--input)
    );
  }

  &:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: var(--shadow-focus);
  }

  &.has-error {
    border-color: var(--destructive);

    &:focus {
      box-shadow: 0 0 0 3px var(--color-danger-soft);
    }
  }
}

.form-error {
  font-size: 12px;
  color: var(--color-danger);
  margin-top: -4px;
}

.roles-state {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
}

.roles-loading {
  background: color-mix(
    in srgb,
    var(--primary) 5%,
    var(--color-surface)
  );

  border-color: var(--primary);
}

.roles-error {
  background: color-mix(
    in srgb,
    var(--destructive) 5%,
    var(--color-surface)
  );

  border-color: var(--destructive);
}

.roles-empty {
  background: color-mix(
    in srgb,
    var(--muted-foreground) 5%,
    var(--color-surface)
  );

  border-color: var(--border);
}

.state-message {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
}

.roles-loading .state-message {
  color: var(--primary);
}

.roles-error .state-message {
  color: var(--destructive);
}

.roles-empty .state-message {
  color: var(--muted-foreground);
}

.state-hint {
  margin: 0;
  font-size: 12px;
  color: var(--muted-foreground);
  font-style: italic;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  span {
    font-size: 14px;
    color: var(--foreground);
  }
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

.btn-primary {
  flex: 1;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 700;

  &:hover:not(:disabled) {
    box-shadow: var(--shadow-primary-md);

    transform: translateY(-2px);
    filter: brightness(1.06);
  }
}

.btn-secondary {
  flex: 1;
  background: var(--muted);
  color: var(--foreground);
  border: 1px solid var(--border);

  &:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--muted) 80%,
      var(--border)
    );

    border-color: var(--ring);
  }
}

@media (max-width: 640px) {
  .user-form-container {
    max-width: 100%;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
