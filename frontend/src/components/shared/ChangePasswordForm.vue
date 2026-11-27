<script setup lang="ts">
import { ref } from 'vue'
import { apiClient } from '../../services/api'
import { getApiErrorMessage } from '../../services/api/error'
import { useToast } from '../../composables/useToast'

const toast = useToast()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPasswords = ref(false)
const loading = ref(false)

const submit = async () => {
  if (newPassword.value.length < 8 || newPassword.value.length > 72) {
    toast.error('Password baru harus terdiri dari 8 sampai 72 karakter.')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.error('Konfirmasi password baru tidak cocok.')
    return
  }
  if (currentPassword.value === newPassword.value) {
    toast.error('Password baru harus berbeda dari password lama.')
    return
  }

  loading.value = true
  try {
    const response = await apiClient.post('/auth/change-password', {
      current_password: currentPassword.value,
      new_password: newPassword.value,
    })
    toast.success(response.data?.message || 'Password berhasil diperbarui. Silakan login kembali.')
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error: unknown) {
    toast.error(getApiErrorMessage(error, 'Gagal memperbarui password. Silakan coba lagi.'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="change-password">
    <header class="change-password__header">
      <h2>Ubah Password</h2>
      <p>Masukkan password lama, lalu tentukan password baru untuk akun Anda.</p>
    </header>

    <form class="change-password__form" @submit.prevent="submit">
      <label for="current-password">Password lama</label>
      <input id="current-password" v-model="currentPassword" :type="showPasswords ? 'text' : 'password'" autocomplete="current-password" required />

      <label for="new-password">Password baru</label>
      <input id="new-password" v-model="newPassword" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" minlength="8" maxlength="72" required />

      <label for="confirm-new-password">Konfirmasi password baru</label>
      <input id="confirm-new-password" v-model="confirmPassword" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" minlength="8" maxlength="72" required />

      <label class="change-password__toggle">
        <input v-model="showPasswords" type="checkbox" />
        Tampilkan password
      </label>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Memperbarui...' : 'Perbarui Password' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.change-password {
  margin-top: 28px;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
}
.change-password__header { margin-bottom: 22px; }
.change-password__header h2 { margin: 0 0 6px; color: var(--foreground); font-size: 1.15rem; }
.change-password__header p { margin: 0; color: var(--muted-foreground); font-size: .9rem; }
.change-password__form { display: grid; gap: 10px; max-width: 520px; }
.change-password__form > label:not(.change-password__toggle) { margin-top: 8px; color: var(--foreground); font-size: .9rem; font-weight: 600; }
.change-password__form > input:not([type="checkbox"]) {
  width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--input);
  border-radius: 8px; background: var(--color-surface); color: var(--foreground); font: inherit;
}
.change-password__form > input:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.change-password__toggle { display: flex; align-items: center; gap: 8px; margin: 8px 0; color: var(--muted-foreground); font-size: .9rem; }
.change-password__form button {
  justify-self: start; min-height: 44px; padding: 0 20px; border: 0; border-radius: 8px;
  background: var(--color-primary); color: var(--primary-foreground); font: inherit; font-weight: 600; cursor: pointer;
}
.change-password__form button:disabled { opacity: .6; cursor: not-allowed; }
@media (max-width: 768px) { .change-password { padding: 20px; } .change-password__form button { width: 100%; } }
</style>
