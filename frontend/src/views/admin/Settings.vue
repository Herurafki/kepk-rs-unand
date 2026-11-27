<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiClient } from '../../services/api'
import { useToast } from '../../composables/useToast'

const toast = useToast()
const idleTimeout = ref(30)
const warning = ref(1)
const loading = ref(false)
const saving = ref(false)

async function loadSettings() {
  loading.value = true
  try {
    const response = await apiClient.get('/settings/idle-session')
    idleTimeout.value = Number(response.data.data.idle_timeout_minutes) || 30
    warning.value = Number(response.data.data.idle_warning_minutes) || 1
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Pengaturan sesi gagal dimuat.')
  } finally { loading.value = false }
}
async function saveSettings() {
  if (!Number.isInteger(idleTimeout.value) || idleTimeout.value < 5 || idleTimeout.value > 1440) {
    toast.error('Batas inaktivitas harus antara 5 sampai 1440 menit.')
    return
  }
  if (!Number.isInteger(warning.value) || warning.value < 1 || warning.value >= idleTimeout.value) {
    toast.error('Waktu peringatan minimal 1 menit dan harus lebih kecil dari batas inaktivitas.')
    return
  }
  saving.value = true
  try {
    const response = await apiClient.patch('/settings/idle-session', {
      idle_timeout_minutes: idleTimeout.value,
      idle_warning_minutes: warning.value,
    })
    idleTimeout.value = Number(response.data.data.idle_timeout_minutes)
    warning.value = Number(response.data.data.idle_warning_minutes)
    toast.success('Pengaturan otomatis logout berhasil disimpan.')
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Pengaturan sesi gagal disimpan.')
  } finally { saving.value = false }
}
onMounted(loadSettings)
</script>

<template>
  <main class="session-settings">
    <header class="session-settings__header">
      <div>
        <p class="session-settings__eyebrow">ADMINISTRASI SISTEM</p>
        <h1>Pengaturan Sesi</h1>
        <p>Kelola batas waktu inaktivitas sebelum pengguna otomatis keluar dari aplikasi.</p>
      </div>
    </header>

    <section class="session-settings__card">
      <div class="session-settings__card-heading">
        <div class="session-settings__symbol">◷</div>
        <div>
          <h2>Automatic Logout</h2>
          <p>Pengaturan ini berlaku untuk seluruh role pengguna.</p>
        </div>
      </div>

      <div v-if="loading" class="session-settings__loading">Memuat pengaturan...</div>
      <form v-else class="session-settings__form" @submit.prevent="saveSettings">
        <label class="session-settings__field">
          <span>Batas waktu inaktivitas</span>
          <div class="session-settings__input-wrap">
            <input v-model.number="idleTimeout" type="number" min="5" max="1440" required>
            <span>menit</span>
          </div>
          <small>Pengguna akan otomatis logout setelah tidak melakukan aktivitas selama waktu ini.</small>
        </label>

        <label class="session-settings__field">
          <span>Peringatan sebelum logout</span>
          <div class="session-settings__input-wrap">
            <input v-model.number="warning" type="number" min="1" :max="Math.max(1, idleTimeout - 1)" required>
            <span>menit</span>
          </div>
          <small>Dialog peringatan ditampilkan sebelum sesi berakhir.</small>
        </label>

        <div class="session-settings__preview">
          <strong>Pratinjau pengaturan</strong>
          <p>Pengguna mendapat peringatan pada menit ke-{{ Math.max(0, idleTimeout - warning) }} dan logout otomatis setelah {{ idleTimeout }} menit tanpa aktivitas.</p>
        </div>

        <div class="session-settings__actions">
          <button type="button" class="session-settings__reset" :disabled="saving" @click="idleTimeout = 30; warning = 1">Kembalikan default</button>
          <button type="submit" class="session-settings__save" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan pengaturan' }}</button>
        </div>
      </form>
    </section>
  </main>
</template>

<style scoped>
.session-settings{max-width:920px;margin:0 auto;padding:28px 24px 48px;color:var(--foreground)}
.session-settings__header{margin-bottom:24px}
.session-settings__eyebrow{margin:0 0 8px;color:var(--primary);font-size:.75rem;font-weight:700;letter-spacing:.09em}
.session-settings__header h1{margin:0;font-size:1.7rem}
.session-settings__header p:last-child{margin:8px 0 0;color:var(--muted-foreground);line-height:1.5}
.session-settings__card{padding:24px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--card);box-shadow:var(--shadow-sm)}
.session-settings__card-heading{display:flex;align-items:center;gap:14px;padding-bottom:20px;border-bottom:1px solid var(--border)}
.session-settings__symbol{display:grid;place-items:center;width:46px;height:46px;border-radius:var(--radius-md);background:var(--color-primary-soft);color:var(--primary);font-size:26px}
.session-settings__card-heading h2{margin:0;font-size:1.1rem}
.session-settings__card-heading p{margin:5px 0 0;color:var(--muted-foreground);font-size:.9rem}
.session-settings__form{display:grid;gap:22px;padding-top:22px}
.session-settings__field{display:grid;gap:8px;font-weight:600}
.session-settings__input-wrap{display:flex;align-items:center;gap:12px;max-width:320px}
.session-settings__input-wrap input{width:100%;padding:11px 12px;border:1px solid var(--input);border-radius:var(--radius-md);background:var(--card);color:var(--foreground);font:inherit}
.session-settings__input-wrap span{color:var(--muted-foreground);font-weight:400}
.session-settings__field small{color:var(--muted-foreground);font-weight:400;line-height:1.45}
.session-settings__preview{padding:16px;border:1px solid var(--color-info);border-radius:var(--radius-md);background:var(--color-info-softer)}
.session-settings__preview p{margin:6px 0 0;color:var(--muted-foreground);line-height:1.5}
.session-settings__actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.session-settings__actions button{padding:11px 16px;border:1px solid var(--border);border-radius:var(--radius-md);font:inherit;font-weight:600;cursor:pointer}
.session-settings__reset{background:var(--card);color:var(--foreground)}
.session-settings__save{border-color:var(--primary)!important;background:var(--primary);color:var(--primary-foreground)}
.session-settings__actions button:disabled{opacity:.6;cursor:wait}
.session-settings__loading{padding:28px 0;color:var(--muted-foreground)}
@media(max-width:640px){.session-settings{padding:20px 16px}.session-settings__card{padding:18px}.session-settings__actions{flex-direction:column-reverse}.session-settings__actions button{width:100%}}
</style>
