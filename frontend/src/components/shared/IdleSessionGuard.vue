<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '../../services/api'
import { useAuthStore } from '../../stores/routes/auth'
import { useToast } from '../../composables/useToast'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const idleMinutes = ref(30)
const warningMinutes = ref(1)
const remainingSeconds = ref(30 * 60)
const warningOpen = ref(false)
const busy = ref(false)
let deadline = 0
let lastInteraction = Date.now()
let lastHeartbeat = 0
let intervalId: number | undefined
const countdown = computed(() => {
  const minutes = Math.floor(remainingSeconds.value / 60)
  const seconds = remainingSeconds.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})
const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'click']

function resetDeadline() {
  if (!auth.isAuthenticated || warningOpen.value) return
  lastInteraction = Date.now()
  deadline = Date.now() + idleMinutes.value * 60_000
  remainingSeconds.value = idleMinutes.value * 60
}
function onActivity() {
  if (!warningOpen.value) resetDeadline()
}
async function endSession(message = 'Sesi berakhir karena tidak ada aktivitas.') {
  if (busy.value) return
  busy.value = true
  try { await auth.logout() } catch { auth.clearAuth() }
  warningOpen.value = false
  toast.warning(message)
  await router.replace({ name: 'login' })
  busy.value = false
}
async function continueSession() {
  if (busy.value) return
  busy.value = true
  try {
    await apiClient.get('/auth/me')
    warningOpen.value = false
    resetDeadline()
  } catch {
    try { await auth.logout() } catch { auth.clearAuth() }
    warningOpen.value = false
    toast.warning('Sesi tidak dapat diperpanjang. Silakan login kembali.')
    await router.replace({ name: 'login' })
  } finally { busy.value = false }
}
async function loadSettings() {
  try {
    const response = await apiClient.get('/settings/idle-session')
    idleMinutes.value = Number(response.data.data.idle_timeout_minutes) || 30
    warningMinutes.value = Number(response.data.data.idle_warning_minutes) || 1
    resetDeadline()
  } catch { resetDeadline() }
}
async function tick() {
  if (!auth.isAuthenticated || !deadline) return
  // Keep the server-side session activity in sync while the user is actively using the page.
  if (!warningOpen.value && Date.now() - lastInteraction < 65_000 && Date.now() - lastHeartbeat >= 60_000) {
    lastHeartbeat = Date.now()
    try { await apiClient.get('/auth/me') } catch { await endSession('Sesi tidak valid atau telah berakhir. Silakan login kembali.'); return }
  }
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  remainingSeconds.value = remaining
  if (remaining <= 0) void endSession()
  else if (remaining <= warningMinutes.value * 60) warningOpen.value = true
}
onMounted(() => {
  void loadSettings()
  activityEvents.forEach(event => window.addEventListener(event, onActivity, { passive: true }))
  intervalId = window.setInterval(tick, 1000)
  window.addEventListener('storage', onActivity)
})
onBeforeUnmount(() => {
  activityEvents.forEach(event => window.removeEventListener(event, onActivity))
  window.removeEventListener('storage', onActivity)
  if (intervalId) window.clearInterval(intervalId)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="warningOpen && auth.isAuthenticated" class="idle-overlay" role="presentation">
      <section class="idle-dialog" role="dialog" aria-modal="true" aria-labelledby="idle-title">
        <div class="idle-dialog__icon">!</div>
        <h2 id="idle-title">Sesi akan berakhir</h2>
        <p>Anda tidak terdeteksi beraktivitas. Sesi akan otomatis berakhir dalam:</p>
        <strong class="idle-dialog__countdown">{{ countdown }}</strong>
        <p class="idle-dialog__hint">Pilih “Lanjutkan sesi” untuk tetap masuk ke aplikasi.</p>
        <div class="idle-dialog__actions">
          <button type="button" class="idle-dialog__logout" :disabled="busy" @click="endSession('Anda telah keluar dari aplikasi.')">Keluar</button>
          <button type="button" class="idle-dialog__continue" :disabled="busy" @click="continueSession">{{ busy ? 'Memproses...' : 'Lanjutkan sesi' }}</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.idle-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:var(--color-scrim)}
.idle-dialog{width:min(440px,100%);padding:28px;border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--card);box-shadow:var(--shadow-lg);text-align:center;color:var(--foreground)}
.idle-dialog__icon{display:grid;place-items:center;width:48px;height:48px;margin:0 auto 14px;border-radius:50%;background:var(--color-warning-soft);color:var(--color-warning);font-size:28px;font-weight:800}
.idle-dialog h2{margin:0 0 10px;font-size:1.25rem}
.idle-dialog p{color:var(--muted-foreground);line-height:1.55}
.idle-dialog__countdown{display:block;margin:18px 0;font-size:2.5rem;font-variant-numeric:tabular-nums;color:var(--color-warning)}
.idle-dialog__hint{font-size:.88rem}
.idle-dialog__actions{display:flex;justify-content:center;gap:10px;margin-top:22px}
.idle-dialog__actions button{padding:11px 18px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;font-weight:600}
.idle-dialog__logout{background:var(--card);color:var(--foreground)}
.idle-dialog__continue{border-color:var(--primary)!important;background:var(--primary);color:var(--primary-foreground)}
.idle-dialog__actions button:disabled{opacity:.6;cursor:wait}
</style>
