<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDashboardPath, hasAnyRole } from '../../utils/role-permissions'
import { useAuthStore } from '../../stores/routes/auth.ts'
import { getApiErrorMessage } from '../../services/api/error.ts'
import AuthInputField from '../../components/auth/AuthInputField.vue'
import type { LoginPayload } from '../../services/auth/auth.service'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

type LoginMode = 'email' | 'nik'

const mode = ref<LoginMode>('email')
const email = ref('')
const nik = ref('')
const password = ref('')
const errorMessage = ref('')

const registeredMessage = ref('')
const emailVerificationRequired = ref(false)

const identifierLabel = computed(() =>
  mode.value === 'email' ? 'Alamat email' : 'NIK',
)

const switchMode = (next: LoginMode) => {
  if (mode.value === next) return
  mode.value = next
  email.value = ''
  nik.value = ''
  errorMessage.value = ''
}

const handleSubmit = async () => {
  errorMessage.value = ''
  emailVerificationRequired.value = false

  const trimmedEmail = email.value.trim()
  const trimmedNik = nik.value.trim()

  if (mode.value === 'email') {
    if (!trimmedEmail || !password.value) {
      errorMessage.value = 'Email dan password wajib diisi.'
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errorMessage.value = 'Format email tidak valid.'
      return
    }
  } else {
    if (!trimmedNik || !password.value) {
      errorMessage.value = 'NIK dan password wajib diisi.'
      return
    }
    if (!/^\d{16}$/.test(trimmedNik)) {
      errorMessage.value = 'NIK harus 16 digit angka.'
      return
    }
  }

  const payload: LoginPayload =
    mode.value === 'email'
      ? { email: trimmedEmail, password: password.value }
      : { nik: trimmedNik, password: password.value }

  try {
    await authStore.login(payload)

    const roles = authStore.user?.roles ?? []

    let redirect = getDashboardPath(roles)
    const requested = route.query.redirect
    if (
      typeof requested === 'string' &&
      requested.startsWith('/') &&
      !requested.startsWith('//')
    ) {
      const resolved = router.resolve(requested)
      const required = resolved.meta.roles
      if (
        resolved.matched.length &&
        !resolved.meta.guestOnly &&
        (!Array.isArray(required) || hasAnyRole(roles, required as string[]))
      ) {
        redirect = requested
      }
    }

    // Bersihkan state sensitif sebelum pindah halaman
    email.value = ''
    nik.value = ''
    password.value = ''

    await router.replace(redirect)
  } catch (error: unknown) {
    const responseData = (error as { response?: { data?: { code?: string; error?: string; message?: string } } })?.response?.data
    emailVerificationRequired.value = responseData?.code === 'EMAIL_NOT_VERIFIED' || responseData?.error === 'EMAIL_NOT_VERIFIED' || responseData?.message?.toLowerCase().includes('belum diverifikasi') === true
    errorMessage.value = getApiErrorMessage(
      error,
      mode.value === 'email'
        ? 'Email atau password tidak valid.'
        : 'NIK atau password tidak valid.',
    )
  }
}
</script>

<template>
  <main class="auth-page login-page">
    <section class="login-layout" aria-labelledby="login-title">
      <aside class="login-intro">
        <div class="login-intro__copy">
          <p class="login-intro__eyebrow">Sistem pengajuan penelitian</p>
          <h1>KEPK Rumah Sakit Universitas Andalas</h1>
          <p>
            Masuk untuk memantau proses, melengkapi dokumen, dan menerima
            pembaruan pengajuan penelitian.
          </p>
        </div>
        <div class="login-intro__footer">
          <span class="login-status-dot" aria-hidden="true" />
          Akses akun yang aman dan terkelola
        </div>
      </aside>

      <section class="auth-card auth-card--sm login-card">
        <div class="login-card__header">
          <p class="auth-kicker">Selamat datang kembali</p>
          <h2 id="login-title" class="auth-title">Masuk ke akun Anda</h2>
          <p class="auth-subtitle">
            Gunakan email atau NIK terdaftar untuk melanjutkan.
          </p>
        </div>

        <p v-if="registeredMessage" class="auth-alert auth-alert--success">
          {{ registeredMessage }}
        </p>

        <div class="login-mode-tabs" role="tablist" aria-label="Metode login">
          <button
            type="button"
            role="tab"
            id="tab-email"
            aria-controls="panel-login"
            :aria-selected="mode === 'email'"
            :tabindex="mode === 'email' ? 0 : -1"
            :class="['login-mode-tab', { 'is-active': mode === 'email' }]"
            @click="switchMode('email')"
          >
            Email
          </button>
          <button
            type="button"
            role="tab"
            id="tab-nik"
            aria-controls="panel-login"
            :aria-selected="mode === 'nik'"
            :tabindex="mode === 'nik' ? 0 : -1"
            :class="['login-mode-tab', { 'is-active': mode === 'nik' }]"
            @click="switchMode('nik')"
          >
            NIK
          </button>
        </div>

        <form
          id="panel-login"
          role="tabpanel"
          :aria-labelledby="mode === 'email' ? 'tab-email' : 'tab-nik'"
          class="auth-form login-form"
          novalidate
          @submit.prevent="handleSubmit"
        >
          <AuthInputField
            v-if="mode === 'email'"
            id="email"
            v-model="email"
            :label="identifierLabel"
            type="email"
            autocomplete="email"
            placeholder="nama@institusi.ac.id"
            icon="mail"
            required
          />

          <AuthInputField
            v-else
            id="nik"
            v-model="nik"
            :label="identifierLabel"
            type="number"
            inputmode="numeric"
            autocomplete="off"
            placeholder="16 digit NIK"
            icon="id-card"
            required
          />

          <AuthInputField
            id="password"
            v-model="password"
            label="Password"
            type="password"
            autocomplete="current-password"
            placeholder="Masukkan password"
            icon="lock"
            required
          />

          <p v-if="errorMessage" class="auth-alert auth-alert--error">
            {{ errorMessage }}
          </p>
          <p v-if="emailVerificationRequired" class="login-forgot-link">
            <RouterLink :to="{ name: 'verify-email', query: { email: mode === 'email' ? email : undefined } }">Kirim ulang tautan verifikasi</RouterLink>
          </p>

          <p class="login-forgot-link">
            <RouterLink to="/forgot-password">Lupa Password?</RouterLink>
          </p>

          <button
            class="auth-button login-button"
            type="submit"
            :disabled="authStore.loading"
          >
            <span
              v-if="authStore.loading"
              class="login-button__spinner"
              aria-hidden="true"
            />
            {{ authStore.loading ? 'Memproses...' : 'Masuk ke akun' }}
          </button>
        </form>

        <p class="auth-alt-link login-card__footer">
          Belum memiliki akun?
          <RouterLink to="/register">Daftar sebagai peneliti</RouterLink>
        </p>
      </section>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100dvh;
  padding: 32px;
  place-items: center;
  background:
    radial-gradient(circle at 8% 10%, var(--color-primary-soft), transparent 30%),
    var(--background);
}

.login-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(380px, 1fr);
  width: min(100%, 1020px);
  min-height: 590px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow-lg);
}

.login-intro {
  display: flex;
  flex-direction: column;
  padding: 42px;
  color: var(--primary-foreground);
  background-image: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
    url('public/images/background-rs-unand-2.png');
  background-size: cover;
  background-position: right;
  background-repeat: no-repeat;
}

.login-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.login-brand__mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--color-surface-overlay-medium);
  border-radius: 10px;
  background: var(--color-surface-overlay);
  font-family: var(--font-serif);
  font-size: 1.2rem;
}

.login-intro__copy {
  margin: auto 0;
}

.login-intro__eyebrow {
  margin: 0 0 12px;
  color: var(--primary-muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.login-intro h1 {
  max-width: 440px;
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(2rem, 4vw, 2.8rem);
  line-height: 1.22;
}

.login-intro__copy > p:last-child {
  max-width: 400px;
  margin: 18px 0 0;
  color: var(--primary-muted);
  font-size: 0.95rem;
  line-height: 1.75;
}

.login-intro__footer {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--secondary);
  font-size: 0.78rem;
}

.login-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary-light);
  box-shadow: 0 0 0 4px var(--color-surface-overlay);
}

.login-card {
  align-self: center;
  width: min(100%, 460px);
  margin: 0 auto;
  padding: 48px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.login-card__header {
  margin-bottom: 30px;
}

.login-card .auth-kicker {
  margin-bottom: 10px;
}

.login-card .auth-title {
  margin: 0 0 10px;
  font-size: clamp(1.7rem, 3vw, 2.15rem);
}

/* ─── Tab pilih metode login ─────────────────────────────── */
.login-mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-bottom: 24px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--background);
}

.login-mode-tab {
  padding: 10px 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: rgb(181, 181, 181);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.login-mode-tab:hover {
  color: var(--foreground);
}

.login-mode-tab.is-active {
  background: var(--color-primary-soft);
  color: var(--primary);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.06));
}

.login-mode-tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ─── Form ───────────────────────────────────────────────── */
.login-form {
  gap: 20px;
}

.login-forgot-link {
  margin: -8px 0 0;
  text-align: right;
  font-size: 0.88rem;
}
.login-forgot-link a {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
}
.login-forgot-link a:hover {
  text-decoration: underline;
}

.login-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 6px;
}

.login-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-surface-overlay-medium);
  border-top-color: var(--primary-foreground);
  border-radius: 50%;
  animation: login-spin 0.7s linear infinite;
}

.login-card__footer {
  margin-top: 24px;
  text-align: center;
}

@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 780px) {
  .login-page {
    padding: 18px;
  }
  .login-layout {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .login-intro {
    min-height: 210px;
    padding: 28px;
  }
  .login-intro__copy {
    margin: 32px 0 0;
  }
  .login-intro h1 {
    font-size: 1.7rem;
  }
  .login-intro__copy > p:last-child {
    display: none;
  }
  .login-intro__footer {
    margin-top: auto;
  }
  .login-card {
    width: 100%;
    padding: 32px 28px;
  }
}

@media (max-width: 480px) {
  .login-page {
    padding: 0;
    background: var(--card);
  }
  .login-layout {
    min-height: 100dvh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .login-intro {
    min-height: 184px;
    padding: 24px;
  }
  .login-brand {
    font-size: 0.82rem;
  }
  .login-intro h1 {
    font-size: 1.45rem;
  }
  .login-card {
    padding: 30px 24px 36px;
  }
  .login-mode-tabs {
    margin-bottom: 20px;
  }
  .login-mode-tab {
    padding: 9px 10px;
    font-size: 0.86rem;
  }
}
</style>