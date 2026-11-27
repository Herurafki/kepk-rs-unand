<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiClient } from '../../services/api'
import { getApiErrorMessage } from '../../services/api/error'

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const submit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  if (!email.value.trim()) {
    errorMessage.value = 'Email wajib diisi.'
    return
  }

  loading.value = true
  try {
    const response = await apiClient.post('/auth/forgot-password', {
      email: email.value.trim(),
    })
    successMessage.value = response.data?.message
      || 'Jika email terdaftar, instruksi pemulihan password akan dikirim.'
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error, 'Permintaan belum dapat diproses. Silakan coba lagi.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page forgot-page">
    <section class="auth-card auth-card--sm forgot-card">
      <p class="auth-kicker">Pemulihan akun</p>
      <h1 class="auth-title">Lupa Password?</h1>
      <p class="auth-subtitle">Masukkan email yang terdaftar. Jika akun ditemukan, kami akan mengirimkan tautan untuk membuat password baru.</p>

      <p v-if="successMessage" class="auth-alert auth-alert--success" role="status">{{ successMessage }}</p>
      <p v-if="errorMessage" class="auth-alert auth-alert--error" role="alert">{{ errorMessage }}</p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="forgot-label" for="forgot-email">Alamat email</label>
        <input
          id="forgot-email"
          v-model="email"
          class="forgot-input"
          type="email"
          autocomplete="email"
          placeholder="nama@institusi.ac.id"
          required
        />
        <button class="auth-button" type="submit" :disabled="loading">
          {{ loading ? 'Mengirim...' : 'Kirim Tautan Reset' }}
        </button>
      </form>

      <p class="auth-alt-link forgot-footer"><RouterLink to="/login">Kembali ke halaman login</RouterLink></p>
    </section>
  </main>
</template>

<style scoped>
.forgot-page {
  display: grid;
  min-height: 100dvh;
  padding: 24px;
  place-items: center;
  background: var(--background);
}
.forgot-card { width: min(100%, 480px); }
.forgot-label { color: var(--foreground); font-size: .9rem; font-weight: 600; }
.forgot-input {
  width: 100%;
  min-height: 46px;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--foreground);
  font: inherit;
}
.forgot-input:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.forgot-footer { margin-top: 22px; text-align: center; }
</style>
