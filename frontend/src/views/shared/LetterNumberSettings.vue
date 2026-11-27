<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { AlertCircle, CheckCircle2, KeyRound, Save, Settings2, X } from 'lucide-vue-next'
import { getApiErrorMessage } from '../../services/api/error'
import { getLetterNumberSettings, saveLetterNumberSettings, type LetterNumberSettings } from '../../services/letter-number-settings.service'
// SESUAIKAN path dan field role dengan auth store di proyek Anda.
import { useAuthStore } from '../../stores/routes/auth'

const auth = useAuthStore()
const userRole = computed(() => String(auth.user?.roles ?? '').toLowerCase())

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const settings = ref<LetterNumberSettings | null>(null)
const snapshot = ref('')

// Modal konfirmasi password
const confirmOpen = ref(false)
const password = ref('')
const modalError = ref('')
const passwordInput = ref<HTMLInputElement | null>(null)

const labels: Record<string, string> = {
  DATA_AWAL: 'Surat Pengambilan Data Awal',
  IZIN_PENELITIAN: 'Surat Izin Penelitian',
  IZIN_ETIK: 'Surat Izin Etik',
  REGISTRASI_ETIK: 'Nomor Registrasi Etik',
}
const placeholders: Record<string, string> = {
  DATA_AWAL: 'B/{number}/UN16.34/PT.01.04/{year}',
  IZIN_PENELITIAN: 'B/{number}/UN16.34/PK.01.06/{year}',
  IZIN_ETIK: '{number}/UN16.34/RSUNAND/{year}',
  REGISTRASI_ETIK: 'B{number}/UN.16.34/KEPK/{month_roman}/{year}',
}

// Kelompok template per peran
const sections = [
  {
    id: 'diklit',
    role: 'diklit',
    title: 'Surat Diklit',
    description: 'Penomoran surat pengambilan data awal dan surat izin penelitian.',
    keys: ['DATA_AWAL', 'IZIN_PENELITIAN'],
  },
  {
    id: 'sekretariat',
    role: 'sekretariat',
    title: 'Surat Komisi Etik',
    description: 'Penomoran surat izin etik dan nomor registrasi etik.',
    keys: ['IZIN_ETIK', 'REGISTRASI_ETIK'],
  },
]

// Hanya tampilkan kelompok sesuai peran, dan hanya template yang boleh diedit (dari API)
const visibleSections = computed(() => {
  if (!settings.value) return []
  const editable = settings.value.editable_templates ?? []
  return sections
    .filter((s) => s.role === userRole.value)
    .map((s) => ({ ...s, keys: s.keys.filter((k) => editable.includes(k)) }))
    .filter((s) => s.keys.length > 0)
})

const showRegistrationStart = computed(
  () => !!settings.value?.can_edit_registration_start && userRole.value === 'sekretariat',
)

const isDirty = computed(() => !!settings.value && serialize(settings.value) !== snapshot.value)

function serialize(s: LetterNumberSettings) {
  return JSON.stringify({ t: s.templates, r: s.registration_start })
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
function preview(template?: string) {
  if (!template) return ''
  const now = new Date()
  return template
    .replace(/\{number\}/g, '001')
    .replace(/\{year\}/g, String(now.getFullYear()))
    .replace(/\{month_roman\}/g, ROMAN[now.getMonth()])
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    settings.value = await getLetterNumberSettings()
    snapshot.value = serialize(settings.value)
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Gagal memuat pengaturan nomor surat.')
  } finally {
    loading.value = false
  }
}

function requestSave() {
  if (!settings.value) return
  error.value = ''
  success.value = ''
  const empty = visibleSections.value.flatMap((s) => s.keys).find((k) => !settings.value!.templates[k]?.trim())
  if (empty) {
    error.value = `Template "${labels[empty] || empty}" tidak boleh kosong.`
    return
  }
  password.value = ''
  modalError.value = ''
  confirmOpen.value = true
}

function closeConfirm() {
  if (saving.value) return
  confirmOpen.value = false
  password.value = ''
  modalError.value = ''
}

async function confirmSave() {
  if (!settings.value || saving.value) return
  if (!password.value) {
    modalError.value = 'Masukkan password akun untuk menyimpan perubahan.'
    return
  }
  saving.value = true
  modalError.value = ''
  try {
    await saveLetterNumberSettings({
      templates: settings.value.templates,
      registration_start: settings.value.can_edit_registration_start ? settings.value.registration_start : undefined,
      password: password.value,
    })
    confirmOpen.value = false
    password.value = ''
    success.value = 'Pengaturan nomor surat berhasil disimpan.'
    await load()
  } catch (e) {
    modalError.value = getApiErrorMessage(e, 'Pengaturan gagal disimpan.')
  } finally {
    saving.value = false
  }
}

watch(confirmOpen, async (open) => {
  if (open) {
    await nextTick()
    passwordInput.value?.focus()
  }
})

onMounted(load)
</script>

<template>
  <main class="page">
    <header class="heading">
      <div>
        <span class="eyebrow">KONFIGURASI SISTEM</span>
        <h1>Pengaturan Nomor Surat</h1>
        <p>Atur pola penomoran surat. Nomor yang sudah diterbitkan tidak akan berubah ketika template diperbarui.</p>
      </div>
      <span class="heading__icon"><Settings2 :size="26" /></span>
    </header>

    <div v-if="success" class="notice success" role="status"><CheckCircle2 :size="18" />{{ success }}</div>
    <div v-if="error" class="notice error" role="alert"><AlertCircle :size="18" />{{ error }}</div>

    <section v-if="loading" class="panel">Memuat pengaturan...</section>

    <template v-else-if="settings">
      <section v-if="!visibleSections.length && !showRegistrationStart" class="panel empty">
        Tidak ada pengaturan nomor surat yang dapat Anda ubah dengan peran saat ini.
      </section>

      <section v-else class="panel">
        <div class="legend">
          <h2>Placeholder tersedia</h2>
          <p>
            <code>{number}</code> nomor urut, <code>{year}</code> tahun, <code>{month_roman}</code> bulan romawi.
            Nomor manual dimasukkan saat penerbitan.
          </p>
        </div>

        <div v-for="section in visibleSections" :key="section.id" class="group">
          <header class="group__head">
            <h2>{{ section.title }}</h2>
            <p>{{ section.description }}</p>
          </header>

          <div v-for="key in section.keys" :key="key" class="field">
            <label :for="'template-' + key">{{ labels[key] || key }}</label>
            <input
              :id="'template-' + key"
              v-model="settings.templates[key]"
              type="text"
              :placeholder="placeholders[key]"
              autocomplete="off"
              spellcheck="false"
            />
            <small class="preview">
              Pratinjau:
              <strong>{{ preview(settings.templates[key] || placeholders[key]) }}</strong>
            </small>
          </div>
        </div>

        <div v-if="showRegistrationStart" class="group">
          <header class="group__head">
            <h2>Nomor awal registrasi etik</h2>
            <p>
              Nilai ini digunakan saat pertama kali nomor registrasi dibuat pada tahun baru.
              Counter tahun berjalan tetap berlanjut.
            </p>
          </header>
          <div class="field field--short">
            <label for="registration-start">Nomor awal</label>
            <input id="registration-start" v-model.number="settings.registration_start" type="number" min="1" step="1" />
          </div>
        </div>

        <footer class="actions">
          <span v-if="isDirty" class="actions__state">Ada perubahan yang belum disimpan</span>
          <button class="save" type="button" :disabled="!isDirty" @click="requestSave">
            <Save :size="17" />Simpan Pengaturan
          </button>
        </footer>
      </section>
    </template>

    <!-- Pop up konfirmasi password -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="confirmOpen" class="overlay" @mousedown.self="closeConfirm" @keydown.esc="closeConfirm">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <button class="modal__close" type="button" aria-label="Tutup" :disabled="saving" @click="closeConfirm">
              <X :size="18" />
            </button>

            <span class="modal__icon"><KeyRound :size="22" /></span>
            <h2 id="confirm-title">Konfirmasi perubahan</h2>
            <p>Masukkan password akun Anda untuk menyimpan perubahan template nomor surat.</p>

            <form class="modal__form" @submit.prevent="confirmSave">
              <div class="field">
                <label for="current-password">Password akun saat ini</label>
                <input
                  id="current-password"
                  ref="passwordInput"
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Masukkan password"
                />
              </div>

              <div v-if="modalError" class="notice error" role="alert"><AlertCircle :size="16" />{{ modalError }}</div>

              <div class="modal__actions">
                <button class="btn-ghost" type="button" :disabled="saving" @click="closeConfirm">Batal</button>
                <button class="save" type="submit" :disabled="saving">
                  <Save :size="17" />{{ saving ? 'Menyimpan...' : 'Konfirmasi & Simpan' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 20px; color: var(--foreground) }
.heading { display: flex; justify-content: space-between; align-items: center; gap: 20px }
.heading__icon { display: grid; place-items: center; width: 48px; height: 48px; flex: none; border-radius: var(--radius-md); background: var(--color-overlay-subtle); color: var(--primary) }
.eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: var(--primary) }
h1 { margin: 7px 0; font-size: 28px }
h2 { margin: 0; font-size: 16px }
p { margin: 0; color: var(--muted-foreground); font-size: 14px; line-height: 1.6 }

.panel { display: flex; flex-direction: column; gap: 24px; padding: 24px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--card) }
.empty { color: var(--muted-foreground); font-size: 14px }

.legend { display: grid; gap: 4px; padding: 14px 16px; border-radius: var(--radius-md); background: var(--color-overlay-subtle) }
.legend h2 { font-size: 13px }
.legend p { font-size: 13px }

.group { display: flex; flex-direction: column; gap: 16px; padding-top: 24px; border-top: 1px solid var(--border) }
.legend + .group { padding-top: 0; border-top: 0 }
.group__head { display: grid; gap: 2px }

.field { display: flex; flex-direction: column; gap: 7px; max-width: 760px }
.field--short { max-width: 240px }
label { font-size: 13px; font-weight: 600 }
input { width: 100%; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--background); color: var(--foreground); font: inherit; transition: border-color .15s, box-shadow .15s }
input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--color-overlay-subtle) }
small { font-size: 12px; color: var(--muted-foreground) }
.preview strong { color: var(--foreground); font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all }
code { padding: 2px 5px; border-radius: 4px; background: var(--background); font-size: 12px }

.actions { display: flex; align-items: center; justify-content: flex-end; gap: 14px; padding-top: 20px; border-top: 1px solid var(--border) }
.actions__state { font-size: 13px; color: var(--muted-foreground) }

.save { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; border: 0; border-radius: var(--radius-md); background: var(--primary); color: var(--primary-foreground); font-weight: 600; cursor: pointer; transition: opacity .15s }
.save:hover:not(:disabled) { opacity: .9 }
.save:disabled { opacity: .5; cursor: not-allowed }
.btn-ghost { padding: 11px 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: transparent; color: var(--foreground); font-weight: 600; cursor: pointer }
.btn-ghost:hover:not(:disabled) { background: var(--color-overlay-subtle) }
.btn-ghost:disabled { opacity: .5; cursor: not-allowed }

.notice { display: flex; align-items: center; gap: 9px; padding: 12px; border-radius: var(--radius-md); font-size: 14px }
.success { background: var(--color-success-soft); color: var(--color-success) }
.error { background: var(--color-danger-soft); color: var(--color-danger) }

/* Modal */
.overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / .5); backdrop-filter: blur(2px) }
.modal { position: relative; width: 100%; max-width: 420px; padding: 28px 24px 24px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--card); color: var(--foreground); box-shadow: 0 24px 60px rgb(0 0 0 / .25) }
.modal__close { position: absolute; top: 12px; right: 12px; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--muted-foreground); cursor: pointer }
.modal__close:hover:not(:disabled) { background: var(--color-overlay-subtle) }
.modal__icon { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 14px; border-radius: 50%; background: var(--color-overlay-subtle); color: var(--primary) }
.modal h2 { margin-bottom: 4px; font-size: 18px }
.modal__form { display: flex; flex-direction: column; gap: 14px; margin-top: 18px }
.modal__form .field { max-width: none }
.modal__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px }

.modal-enter-active, .modal-leave-active { transition: opacity .18s ease }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform .18s ease }
.modal-enter-from, .modal-leave-to { opacity: 0 }
.modal-enter-from .modal, .modal-leave-to .modal { transform: translateY(10px) scale(.98) }

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active, .modal-leave-active, .modal-enter-active .modal, .modal-leave-active .modal { transition: none }
}

@media (max-width: 640px) {
  .heading { align-items: flex-start }
  .heading__icon { display: none }
  h1 { font-size: 23px }
  .panel { padding: 18px }
  .actions { flex-direction: column; align-items: stretch }
  .actions__state { text-align: center }
  .modal__actions { flex-direction: column-reverse }
  .modal__actions > * { width: 100% }
}
</style>