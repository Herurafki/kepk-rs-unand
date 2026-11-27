<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApiErrorMessage } from '../../services/api/error'
import { resendVerification, verifyEmail } from '../../services/auth/auth.service'

const route = useRoute()
const router = useRouter()
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const loading = ref(false)
const resendLoading = ref(false)
const verified = ref(false)
const errorMessage = ref('')
const infoMessage = ref(route.query.sent === '1' ? 'Registrasi berhasil. Kami sedang mengirim tautan verifikasi ke email Anda. Periksa kotak masuk atau folder spam.' : '')
const resendMessage = ref('')

onMounted(async () => {
  if (!token.value) return
  loading.value = true
  try {
    await verifyEmail(token.value)
    verified.value = true
    infoMessage.value = 'Alamat email berhasil diverifikasi. Sekarang Anda dapat masuk ke akun Peneliti.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.')
  } finally {
    loading.value = false
  }
})

async function handleResend() {
  errorMessage.value = ''
  resendMessage.value = ''
  if (!email.value.trim()) {
    errorMessage.value = 'Masukkan alamat email yang digunakan saat registrasi.'
    return
  }
  resendLoading.value = true
  try {
    const result = await resendVerification(email.value.trim())
    resendMessage.value = result.message
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal mengirim ulang tautan verifikasi.')
  } finally {
    resendLoading.value = false
  }
}
</script>

<template>
  <main class="verify-page">
    <section class="auth-card verify-card">
      <div class="verify-icon" :class="{ 'is-success': verified }" aria-hidden="true">
        <svg v-if="verified" viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none"><path d="M3 6.5 12 13l9-6.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <p class="auth-kicker">Verifikasi akun Peneliti</p>
      <h1 class="auth-title">{{ verified ? 'Email terverifikasi!' : token ? 'Memverifikasi email...' : 'Periksa email Anda' }}</h1>
      <p v-if="loading" class="auth-subtitle">Mohon tunggu, kami sedang memeriksa tautan verifikasi.</p>
      <p v-else-if="infoMessage" class="auth-alert auth-alert--success">{{ infoMessage }}</p>
      <p v-if="errorMessage" class="auth-alert auth-alert--error">{{ errorMessage }}</p>
      <template v-if="!verified">
        <p class="verify-description">Belum menerima email? Masukkan alamat email yang digunakan saat registrasi untuk meminta tautan baru.</p>
        <form class="auth-form" @submit.prevent="handleResend">
          <label for="verification-email">Alamat email</label>
          <input id="verification-email" v-model="email" type="email" autocomplete="email" placeholder="nama@email.com" required />
          <button class="auth-button" type="submit" :disabled="resendLoading">
            {{ resendLoading ? 'Mengirim...' : 'Kirim ulang tautan' }}
          </button>
        </form>
        <p v-if="resendMessage" class="auth-alert auth-alert--success">{{ resendMessage }}</p>
      </template>
      <button v-if="verified" class="auth-button verify-login" type="button" @click="router.push({ name: 'login' })">Masuk ke akun</button>
      <p class="auth-alt-link"><RouterLink to="/login">Kembali ke halaman login</RouterLink></p>
    </section>
  </main>
</template>

<style scoped>
.verify-page { display:grid; min-height:70vh; padding:24px; place-items:center; background:var(--background); }
.verify-card { width:min(100%, 480px); padding:42px; text-align:center; }
.verify-icon { display:grid; width:64px; height:64px; margin:0 auto 22px; place-items:center; border-radius:50%; color:var(--primary); background:var(--color-primary-soft); }
.verify-icon svg { width:30px; height:30px; }
.verify-icon.is-success { color:var(--color-success, var(--primary)); }
.verify-description { margin:22px 0 16px; line-height:1.6; }
.verify-card .auth-form { display:grid; gap:12px; text-align:left; }
.verify-card label { font-size:.9rem; font-weight:600; }
.verify-card input { width:100%; padding:12px 14px; border:1px solid var(--border); border-radius:10px; color:var(--foreground); background:var(--card); font:inherit; }
.verify-login { width:100%; margin-top:20px; }
.verify-card .auth-alt-link { margin-top:24px; }
@media(max-width:480px){.verify-page{padding:12px}.verify-card{padding:30px 22px}}
</style>
