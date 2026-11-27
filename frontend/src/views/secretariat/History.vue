<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertCircle, Clock3, FileText, RefreshCw } from 'lucide-vue-next'
import { getApiErrorMessage } from '../../services/api/error'
import { getSecretariatApplications, type SecretariatApplication } from '../../services/secretariat/application.service'
import { getApplicationHistory, type ApplicationHistory } from '../../services/secretariat/history.service'

const applications = ref<SecretariatApplication[]>([])
const history = ref<ApplicationHistory[]>([])
const selectedApplicationId = ref('')
const loadingApplications = ref(false)
const loadingHistory = ref(false)
const errorMessage = ref('')

const selectedApplication = computed(() => applications.value.find(item => String(item.id) === selectedApplicationId.value))

const statusLabel = (status?: string | null) => ({
  DRAFT: 'Draft',
  SUBMITTED: 'Diajukan',
  ADMIN_REVIEW: 'Verifikasi DIKLAT',
  ADMIN_APPROVED: 'Disetujui DIKLAT',
  SEKRETARIS_REVIEW: 'Verifikasi Sekretaris',
  REVISION_REQUIRED: 'Memerlukan Revisi',
  WAITING_REVIEWER: 'Menunggu Reviewer',
  UNDER_REVIEW: 'Sedang Direview',
  REVIEW_COMPLETED: 'Review Selesai',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  PERMIT_ISSUED: 'Surat Diterbitkan',
}[status || ''] || status || '—')

const formatDateTime = (value: string) => new Date(value).toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

async function loadApplications() {
  loadingApplications.value = true
  errorMessage.value = ''
  try {
    applications.value = (await getSecretariatApplications()).data ?? []
    if (!selectedApplicationId.value && applications.value.length) selectedApplicationId.value = String(applications.value[0].id)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal memuat daftar pengajuan.')
  } finally {
    loadingApplications.value = false
  }
}

async function loadHistory() {
  if (!selectedApplicationId.value) {
    history.value = []
    return
  }
  loadingHistory.value = true
  errorMessage.value = ''
  try {
    history.value = (await getApplicationHistory(selectedApplicationId.value)).data ?? []
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Gagal memuat riwayat pengajuan.')
    history.value = []
  } finally {
    loadingHistory.value = false
  }
}

watch(selectedApplicationId, loadHistory)
onMounted(loadApplications)
</script>

<template>
  <div class="page">
    <header class="heading">
      <div><span class="eyebrow">SEKRETARIAT KEPK</span>
        <h1>Riwayat</h1>
        <p>Riwayat aktivitas dan perubahan status pengajuan.</p>
      </div>
      <button class="refresh" :disabled="loadingApplications || loadingHistory" @click="loadApplications">
        <RefreshCw :size="17" :class="{ spin: loadingApplications }" /> Muat ulang
      </button>
    </header>

    <div v-if="errorMessage" class="alert">
      <AlertCircle :size="18" />{{ errorMessage }}
    </div>

    <section class="card selector-card">
      <div class="selector-head">
        <div>
          <h2>Pilih Pengajuan</h2>
          <p>Lihat perubahan status dan aktivitas untuk satu pengajuan.</p>
        </div>
      </div>
      <div v-if="loadingApplications" class="state small">
        <RefreshCw :size="22" class="spin" />Memuat pengajuan...
      </div>
      <label v-else class="select-wrap">
        <FileText :size="17" />
        <select v-model="selectedApplicationId">
          <option value="" disabled>Pilih pengajuan</option>
          <option v-for="application in applications" :key="application.id" :value="String(application.id)">
            {{ application.application_number }} — {{ application.researcher_name || 'Tanpa nama' }}
          </option>
        </select>
      </label>
    </section>

    <section v-if="selectedApplication" class="card summary">
      <div><span>Nomor Pengajuan</span><strong>{{ selectedApplication.application_number }}</strong></div>
      <div><span>Peneliti</span><strong>{{ selectedApplication.researcher_name || '—' }}</strong></div>
      <div><span>Status Saat Ini</span><strong>{{ statusLabel(selectedApplication.status) }}</strong></div>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h2>Timeline Status</h2>
          <p>Setiap perubahan status tercatat berdasarkan aktivitas di backend KEPK.</p>
        </div>
      </div>
      <div v-if="loadingHistory" class="state">
        <RefreshCw :size="28" class="spin" />Memuat riwayat...
      </div>
      <div v-else-if="!selectedApplicationId" class="state">
        <Clock3 :size="32" />Pilih pengajuan untuk melihat riwayat.
      </div>
      <div v-else-if="!history.length" class="state">
        <Clock3 :size="32" /><strong>Belum ada riwayat</strong><span>Belum ada perubahan status yang tercatat untuk
          pengajuan ini.</span>
      </div>
      <div v-else class="timeline">
        <article v-for="(item, index) in history" :key="item.id" class="timeline-item">
          <div class="timeline-marker"><span></span><i v-if="index < history.length - 1"></i></div>
          <div class="timeline-content">
            <div class="timeline-top"><strong>{{ statusLabel(item.new_status) }}</strong><time>{{
              formatDateTime(item.created_at) }}</time></div>
            <p v-if="item.previous_status"><span>{{ statusLabel(item.previous_status) }}</span><b>→</b><span>{{
              statusLabel(item.new_status) }}</span></p>
            <p v-if="item.note" class="note">{{ item.note }}</p>
            <small>Diproses oleh: {{ item.changed_by_name || 'Pengguna sistem' }}</small>
          </div>
        </article>
      </div>
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


.refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-weight: 600;
  cursor: pointer
}

.refresh:disabled {
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

.selector-head,
.section-head {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border)
}

h2 {
  margin: 0 0 4px;
  color: var(--foreground);
  font-size: 18px
}

.select-wrap {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 20px 24px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--muted-foreground)
}

select {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  cursor: pointer
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border)
}

.summary>div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: var(--card)
}

.summary span {
  color: var(--muted-foreground);
  font-size: 12px
}

.summary strong {
  color: var(--foreground);
  font-size: 14px
}

.state {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-foreground);
  text-align: center
}

.state.small {
  min-height: 100px
}

.state strong {
  color: var(--foreground)
}

.alert {
  display: flex;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger)
}

.timeline {
  padding: 24px
}

.timeline-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 14px;
  min-height: 100px
}

.timeline-marker {
  position: relative;
  display: flex;
  justify-content: center
}

.timeline-marker span {
  position: relative;
  z-index: 2;
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border: 3px solid var(--card);
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 0 2px var(--primary)
}

.timeline-marker i {
  position: absolute;
  top: 17px;
  bottom: -4px;
  width: 2px;
  background: var(--border)
}

.timeline-content {
  padding-bottom: 20px
}

.timeline-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start
}

.timeline-top strong {
  color: var(--foreground);
  font-size: 14px
}

.timeline-top time {
  color: var(--muted-foreground);
  font-size: 12px;
  white-space: nowrap
}

.timeline-content p {
  margin-top: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--muted-foreground);
  font-size: 12px
}

.timeline-content b {
  color: var(--primary)
}

.timeline-content .note {
  display: block;
  padding: 9px 11px;
  border-radius: var(--radius-md);
  background: var(--color-overlay-subtle);
  color: var(--foreground);
  line-height: 1.5
}

.timeline-content small {
  display: block;
  margin-top: 7px;
  color: var(--muted-foreground);
  font-size: 11px
}

.spin {
  animation: spin .9s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

@media(max-width:720px) {
  .heading {
    flex-direction: column
  }

  .summary {
    grid-template-columns: 1fr
  }

  .timeline-top {
    flex-direction: column;
    gap: 5px
  }
}
</style>
