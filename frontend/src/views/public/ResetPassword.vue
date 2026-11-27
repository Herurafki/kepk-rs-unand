<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiClient } from '../../services/api'
import { getApiErrorMessage } from '../../services/api/error'

const route = useRoute()
const router = useRouter()
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showPassword = ref(false)

const submit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  if (!token.value) {
    errorMessage.value = 'Tautan reset tidak valid. Silakan minta tautan baru.'
    return
  }
  if (password.value.length < 8) {
    errorMessage.value = 'Password baru minimal 8 karakter.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Konfirmasi password tidak cocok.'
    return
  }

  loading.value = true
  try {
    const response = await apiClient.post('/auth/reset-password', {
      token: token.value,
      password: password.value,
    })
    successMessage.value = response.data?.message || 'Password berhasil diubah.'
    password.value = ''
    confirmPassword.value = ''
    window.setTimeout(() => router.replace('/login'), 1800)
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error, 'Tautan reset tidak valid atau sudah kedaluwarsa.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page reset-page">
    <section class="auth-card auth-card--sm reset-card">
      <p class="auth-kicker">Keamanan akun</p>
      <h1 class="auth-title">Buat Password Baru</h1>
      <p class="auth-subtitle">Gunakan password baru yang kuat dan belum pernah digunakan untuk akun ini.</p>

      <p v-if="successMessage" class="auth-alert auth-alert--success" role="status">{{ successMessage }}</p>
      <p v-if="errorMessage" class="auth-alert auth-alert--error" role="alert">{{ errorMessage }}</p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="reset-label" for="reset-password">Password baru</label>
        <input
          id="reset-password"
          v-model="password"
          class="reset-input"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          minlength="8"
          maxlength="72"
          placeholder="Minimal 8 karakter"
          required
        />

        <label class="reset-label" for="reset-confirm-password">Konfirmasi password baru</label>
        <input
          id="reset-confirm-password"
          v-model="confirmPassword"
          class="reset-input"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          minlength="8"
          maxlength="72"
          placeholder="Ulangi password baru"
          required
        />

        <label class="reset-show">
          <input v-model="showPassword" type="checkbox" />
          Tampilkan password
        </label>

        <button class="auth-button" type="submit" :disabled="loading || !token">
          {{ loading ? 'Menyimpan...' : 'Simpan Password Baru' }}
        </button>
      </form>

      <p class="auth-alt-link reset-footer"><RouterLink to="/forgot-password">Minta tautan reset baru</RouterLink></p>
    </section>
  </main>
</template>

<style scoped>
.reset-page {
  display: grid;
  min-height: 100dvh;
  padding: 24px;
  place-items: center;
  background: var(--background);
}
.reset-card { width: min(100%, 480px); }
.reset-label { color: var(--foreground); font-size: .9rem; font-weight: 600; }
.reset-input {
  width: 100%;
  min-height: 46px;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
}
.reset-input:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.reset-show { display: flex; align-items: center; gap: 9px; color: var(--foreground); font-size: .9rem; }
.reset-footer { margin-top: 22px; text-align: center; }
</style>
