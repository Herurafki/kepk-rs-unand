<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, CheckCircle2, Download, FileText, RefreshCw, Upload } from 'lucide-vue-next'
import { getApiErrorMessage } from '../../services/api/error'
import { displayDocumentInTab, openDocumentTab } from '../../utils/document-preview'
import { getSecretariatApplications, type SecretariatApplication } from '../../services/secretariat/application.service'
import { downloadSecretariatLetter, generateSecretariatLetter, getSecretariatLetters, uploadSignedSecretariatLetter, type SecretariatLetter } from '../../services/secretariat/letter.service'

const loading = ref(false)
const actionLoading = ref<string | null>(null)
const errorMessage = ref('')
const successMessage = ref('')
const letters = ref<SecretariatLetter[]>([])
const applications = ref<SecretariatApplication[]>([])
const activeTab = ref<'pending' | 'generated' | 'signed'>('pending')
const manualNumbers = ref<Record<string, string>>({})
const numberModalApplication = ref<SecretariatApplication | null>(null)

const eligibleApplications = computed(() => applications.value.filter(application =>
  application.application_type === 'IZIN_ETIK' && application.status === 'APPROVED',
))

const pendingApplications = computed(() => eligibleApplications.value.filter(application =>
  !letters.value.some(letter => String(letter.application_id) === String(application.id)),
))

const secretariatEthicsLetters = computed(() => letters.value.filter(letter => letter.application_type === 'IZIN_ETIK' && ['IZIN_ETIK', 'BEBAS_KAJI_ETIK'].includes(letter.letter_type)))
const generatedLetters = computed(() => secretariatEthicsLetters.value.filter(letter => letter.letter_status === 'GENERATED'))
const signedLetters = computed(() => secretariatEthicsLetters.value.filter(letter => letter.letter_status === 'SIGNED_UPLOADED'))

const typeLabel = (type?: string) => ({
  IZIN_PENELITIAN: 'Izin Penelitian',
  IZIN_ETIK: 'Izin Etik',
  BEBAS_KAJI_ETIK: 'Bebas Kaji Etik',
}[type || ''] || type || '—')

const statusMeta = (status: string) => status === 'SIGNED_UPLOADED'
  ? { label: 'Sudah ditandatangani', className: 'status status--signed' }
  : { label: 'Menunggu tanda tangan', className: 'status status--generated' }

const formatDate = (value?: string) => value
  ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

function letterTypeFor(application: SecretariatApplication) {
  if (application.application_type !== 'IZIN_ETIK' || application.status !== 'APPROVED') return ''
  return application.review_type === 'EXEMPTED' ? 'BEBAS_KAJI_ETIK' : 'IZIN_ETIK'
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [letterResponse, applicationResponse] = await Promise.all([
      getSecretariatLetters(),
      getSecretariatApplications(),
    ])
    letters.value = letterResponse.data ?? []
    applications.value = applicationResponse.data ?? []
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal memuat data surat.')
  } finally {
    loading.value = false
  }
}

function openNumberModal(application: SecretariatApplication) {
  if (letterTypeFor(application) === 'BEBAS_KAJI_ETIK') {
    void generate(application)
    return
  }
  numberModalApplication.value = application
  manualNumbers.value[String(application.id)] = ''
}

function closeNumberModal() {
  if (actionLoading.value) return
  numberModalApplication.value = null
}

async function generate(application: SecretariatApplication, manualNumber?: string) {
  const letterType = letterTypeFor(application)
  if (!letterType) return
  actionLoading.value = String(application.id)
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await generateSecretariatLetter(String(application.id), letterType, letterType === 'IZIN_ETIK' ? manualNumber : undefined)
    successMessage.value = `Surat untuk ${application.application_number} berhasil dibuat.`
    numberModalApplication.value = null
    await load()
    activeTab.value = 'generated'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal membuat surat.')
  } finally {
    actionLoading.value = null
  }
}

async function downloadLetter(letter: SecretariatLetter) {
  actionLoading.value = String(letter.id)
  errorMessage.value = ''
  const tab = openDocumentTab()
  if (!tab) { errorMessage.value = 'Browser memblokir tab dokumen. Izinkan pop-up, lalu coba lagi.'; actionLoading.value = null; return }
  try {
    const blob = await downloadSecretariatLetter(letter.id)
    displayDocumentInTab(tab, blob, `${letter.letter_number}.pdf`)
  } catch (error) {
    tab.close()
    errorMessage.value = getApiErrorMessage(error, 'Surat tidak dapat dibuka.')
  } finally {
    actionLoading.value = null
  }
}

async function uploadSigned(applicationId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.type !== 'application/pdf') {
    errorMessage.value = 'File surat yang diunggah harus PDF.'
    return
  }
  actionLoading.value = applicationId
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await uploadSignedSecretariatLetter(applicationId, file)
    successMessage.value = 'Surat bertanda tangan berhasil diunggah.'
    await load()
    activeTab.value = 'signed'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal mengunggah surat bertanda tangan.')
  } finally {
    actionLoading.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="heading">
      <div><span class="eyebrow">SEKRETARIAT KEPK</span>
        <h1>Surat</h1>
        <p>Monitoring dan penerbitan surat yang berkaitan dengan pengajuan KEPK.</p>
      </div>
      <button class="refresh" :disabled="loading" @click="load">
        <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
      </button>
    </header>

    <div v-if="successMessage" class="success">
      <CheckCircle2 :size="18" />{{ successMessage }}
    </div>
    <div v-if="errorMessage" class="alert">
      <AlertCircle :size="18" />{{ errorMessage }}
    </div>

    <section class="card">
      <div class="tabs">
        <button :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">Perlu Diproses <span>{{
          pendingApplications.length }}</span></button>
        <button :class="{ active: activeTab === 'generated' }" @click="activeTab = 'generated'">Menunggu Tanda Tangan
          <span>{{ generatedLetters.length }}</span></button>
        <button :class="{ active: activeTab === 'signed' }" @click="activeTab = 'signed'">Surat Terbit <span>{{
          signedLetters.length }}</span></button>
      </div>

      <div v-if="loading" class="state">
        <RefreshCw :size="28" class="spin" />Memuat surat...
      </div>
      <div v-else-if="activeTab === 'pending' && !pendingApplications.length" class="state">
        <FileText :size="34" /><strong>Tidak ada surat yang perlu diproses</strong><span>Pengajuan yang sudah memenuhi
          tahap penerbitan surat akan muncul di sini.</span>
      </div>
      <div v-else-if="activeTab === 'generated' && !generatedLetters.length" class="state">
        <FileText :size="34" /><strong>Belum ada surat yang menunggu tanda tangan</strong>
      </div>
      <div v-else-if="activeTab === 'signed' && !signedLetters.length" class="state">
        <FileText :size="34" /><strong>Belum ada surat terbit</strong>
      </div>

      <div v-else-if="activeTab === 'pending'" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nomor Pengajuan</th>
              <th>Peneliti</th>
              <th>Jenis Pengajuan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="application in pendingApplications" :key="application.id">
              <td><strong>{{ application.application_number }}</strong></td>
              <td><strong>{{ application.researcher_name || '—' }}</strong><small>{{ application.researcher_email || '—'
                  }}</small></td>
              <td>{{ typeLabel(application.application_type) }}</td>
              <td><span class="status status--ready">Siap diterbitkan</span></td>
              <td class="issue-actions"><button class="primary-action" :disabled="actionLoading === String(application.id)" @click="openNumberModal(application)">
                  <FileText :size="15" />{{ actionLoading === String(application.id) ? 'Membuat...' : 'Buat Surat' }}
                </button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nomor Surat</th>
              <th>Nomor Pengajuan</th>
              <th>Peneliti</th>
              <th>Jenis Surat</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="letter in activeTab === 'generated' ? generatedLetters : signedLetters" :key="letter.id">
              <td><strong>{{ letter.letter_number }}</strong><small v-if="letter.registration_number">Registrasi: {{ letter.registration_number }}</small></td>
              <td>{{ letter.application_number || '—' }}</td>
              <td><strong>{{ letter.researcher_name || '—' }}</strong><small>{{ letter.researcher_email || '—'
                  }}</small></td>
              <td>{{ typeLabel(letter.letter_type) }}</td>
              <td>{{ formatDate(letter.created_at) }}</td>
              <td><span :class="statusMeta(letter.letter_status).className">{{ statusMeta(letter.letter_status).label
                  }}</span></td>
              <td class="actions"><button class="download" :disabled="actionLoading === String(letter.id)"
                  @click="downloadLetter(letter)">
                  <FileText :size="15" /> Buka
                </button><label v-if="letter.letter_status === 'GENERATED'" class="upload">
                  <Upload :size="15" /> Upload Tanda Tangan<input type="file" accept="application/pdf,.pdf" hidden
                    @change="uploadSigned(letter.application_id, $event)" />
                </label></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

    <div v-if="numberModalApplication" class="number-modal-backdrop" @click.self="closeNumberModal">
      <section class="number-modal" role="dialog" aria-modal="true" aria-labelledby="secretariat-number-title">
        <header class="number-modal__header">
          <div><span class="number-modal__eyebrow">PENERBITAN SURAT ETIK</span><h2 id="secretariat-number-title">Masukkan Nomor Surat</h2></div>
          <button class="number-modal__close" type="button" aria-label="Tutup" :disabled="!!actionLoading" @click="closeNumberModal">×</button>
        </header>
        <p>Masukkan nomor urut surat untuk pengajuan <strong>{{ numberModalApplication.application_number }}</strong>.</p>
        <div class="number-modal__preview"><span>Format nomor surat</span><strong>XX/UN16.34/RSUNAND/TAHUN</strong></div>
        <div class="number-modal__field">
          <label for="secretariat-manual-number">Nomor urut</label>
          <input id="secretariat-manual-number" v-model="manualNumbers[String(numberModalApplication.id)]" type="text" inputmode="numeric" maxlength="12" placeholder="Contoh: 0123" autofocus @keyup.enter="generate(numberModalApplication, manualNumbers[String(numberModalApplication.id)])" />
          <small>Masukkan angka saja, tanpa huruf atau tanda baca.</small>
        </div>
        <footer class="number-modal__actions">
          <button class="number-modal__cancel" type="button" :disabled="!!actionLoading" @click="closeNumberModal">Batal</button>
          <button class="number-modal__submit" type="button" :disabled="!!actionLoading || !/^\d{1,12}$/.test(manualNumbers[String(numberModalApplication.id)] || '')" @click="generate(numberModalApplication, manualNumbers[String(numberModalApplication.id)])">{{ actionLoading ? 'Membuat surat...' : 'Generate Surat' }}</button>
        </footer>
      </section>
    </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6)
}

.heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start
}

.eyebrow {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em
}

h1 {
  margin: 8px 0;
  color: var(--foreground);
  font-size: clamp(24px, 3vw, 32px)
}

p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px
}

.refresh,
.download,
.upload,
.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer
}

.refresh,
.download,
.upload {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground)
}

.primary-action {
  border: 0;
  background: var(--primary);
  color: var(--primary-foreground)
}

.refresh:disabled,
.download:disabled,
.primary-action:disabled {
  opacity: .55;
  cursor: not-allowed
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-sm)
}

.tabs {
  display: flex;
  gap: 20px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border)
}

.tabs button {
  padding: 16px 4px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 14px;
  cursor: pointer
}

.tabs button.active {
  border-bottom-color: var(--primary);
  color: var(--primary);
  font-weight: 600
}

.tabs span {
  margin-left: 5px;
  font-size: 11px
}

.table-wrap {
  overflow: auto
}

table {
  width: 100%;
  border-collapse: collapse
}

th,
td {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-size: 13px;
  color: var(--foreground);
  white-space: nowrap
}

th {
  background: var(--color-overlay-subtle);
  color: var(--muted-foreground);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .05em
}

td small {
  display: block;
  margin-top: 3px;
  color: var(--muted-foreground)
}

tr:hover {
  background: var(--color-primary-light); 
}

.actions {
  display: flex;
  gap: 8px
}

.upload {
  cursor: pointer
}

.status {
  display: inline-flex;
  padding: 6px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600
}

.status--ready {
  background: var(--color-info-soft);
  color: var(--color-info)
}

.status--generated {
  background: var(--color-warning-soft);
  color: var(--color-warning)
}

.status--signed {
  background: var(--color-success-soft);
  color: var(--color-success)
}

.state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-foreground);
  text-align: center
}

.state strong {
  color: var(--foreground)
}

.success,
.alert {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md)
}

.success {
  border: 1px solid var(--color-success-border);
  background: var(--color-success-soft);
  color: var(--color-success)
}

.alert {
  border: 1px solid var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.spin {
  animation: spin .9s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media(max-width:700px) {
  .heading {
    flex-direction: column
  }

  .tabs {
    overflow: auto
  }

  .actions {
    flex-direction: column
  }
}

.issue-actions { display: flex; align-items: center; gap: 8px }
.number-modal-backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px; background: rgb(15 23 42 / 58%); backdrop-filter: blur(3px); animation: number-modal-fade .18s ease-out }
.number-modal { width: min(100%, 460px); padding: 24px; border: 1px solid var(--border); border-radius: 18px; background: var(--card); color: var(--foreground); box-shadow: 0 24px 70px rgb(0 0 0 / 24%); animation: number-modal-rise .2s ease-out }
.number-modal__header,.number-modal__actions { display: flex; align-items: center; justify-content: space-between; gap: 12px }
.number-modal__eyebrow { color: var(--primary); font-size: .65rem; font-weight: 800; letter-spacing: .1em }
.number-modal h2 { margin: 5px 0 0; font-size: 1.2rem }
.number-modal__close { width: 34px; height: 34px; border: 0; border-radius: 9px; background: var(--muted); color: var(--muted-foreground); font-size: 1.5rem; line-height: 1; cursor: pointer }
.number-modal p { margin: 16px 0; color: var(--muted-foreground); font-size: .82rem; line-height: 1.55 }
.number-modal__preview { display: grid; gap: 5px; padding: 12px 14px; margin-bottom: 18px; border: 1px solid var(--border); border-radius: 11px; background: var(--muted) }
.number-modal__preview span,.number-modal__field small { color: var(--muted-foreground); font-size: .7rem }
.number-modal__preview strong { font-family: monospace; font-size: .78rem; overflow-wrap: anywhere }
.number-modal__field { display: grid; gap: 7px; margin-bottom: 22px }
.number-modal__field label { font-size: .8rem; font-weight: 700 }
.number-modal__field input { width: 100%; box-sizing: border-box; padding: 12px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--background); color: var(--foreground); font: inherit; font-size: 1rem; letter-spacing: .04em }
.number-modal__field input:focus { outline: 2px solid var(--ring); outline-offset: 1px; border-color: var(--primary) }
.number-modal__actions { justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--border) }
.number-modal__cancel,.number-modal__submit { min-height: 40px; padding: 0 15px; border-radius: 9px; font: inherit; font-size: .8rem; font-weight: 700; cursor: pointer }
.number-modal__cancel { border: 1px solid var(--border); background: var(--card); color: var(--foreground) }
.number-modal__submit { border: 0; background: var(--primary); color: var(--primary-foreground) }
.number-modal__submit:disabled,.number-modal__cancel:disabled,.number-modal__close:disabled { opacity: .55; cursor: not-allowed }
@keyframes number-modal-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes number-modal-rise { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
@media(max-width:480px) { .number-modal { padding: 19px; border-radius: 15px } .number-modal__actions>* { flex: 1 } }
@media(prefers-reduced-motion:reduce) { .number-modal-backdrop,.number-modal { animation: none } }
</style>
