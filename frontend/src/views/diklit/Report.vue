<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, Eye, RefreshCw, Search, XCircle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getDiklitApplications, type DiklitApplication } from '../../services/diklit/application.service'
import { getApiErrorMessage } from '../../services/api/error'

const router = useRouter();
const applications = ref<DiklitApplication[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const search = ref('')

const types = {
  DATA_AWAL: 'Data Awal',
  IZIN_PENELITIAN: 'Izin Penelitian',
}

const letters = computed(() => applications.value.filter(i => i.status === 'PERMIT_ISSUED'  || i.status === 'APPROVED' && i.requires_ethics === false).filter(i => {
    const q = search.value.trim().toLowerCase();
    return !q || [i.application_number, i.research_title, i.researcher_name, i.researcher_email].some(v => String(v || '').toLowerCase().includes(q))
}).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))

const date = (v: string) => new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
async function load() {
    loading.value = true; errorMessage.value = '';
    try { applications.value = (await getDiklitApplications()).data ?? [] } catch (e) { errorMessage.value = getApiErrorMessage(e, 'Gagal memuat daftar surat.') }
    finally { loading.value = false }
}
function detail(id: string) { router.push({ name: 'diklit-application-detail', params: { id } }) }
async function download(id: string, number: string) {
    try {
        const { default: apiClient } = await import('../../services/api/client');
        const r = await apiClient.get(`/applications/${id}/letter`, { responseType: 'blob' });
        const url = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = url; a.download = `surat-${number}.pdf`; a.click(); URL.revokeObjectURL(url)
    } catch (e) { errorMessage.value = getApiErrorMessage(e, 'Surat belum dapat diunduh.') }
}
onMounted(load)
</script>
<template>
    <div class="page">
        <header class="heading">
            <div><span class="eyebrow">DIKLIT</span>
                <h1>Surat</h1>
                <p>Daftar pengajuan yang telah selesai dan memiliki surat izin.</p>
            </div><button class="button" :disabled="loading" @click="load">
                <RefreshCw :size="17" :class="{ spin: loading }" /> Muat ulang
            </button>
        </header>
        <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>
        <section class="card">
            <div class="toolbar"><label>
                    <Search :size="17" /><input v-model="search" type="search"
                        placeholder="Cari nomor, judul, atau peneliti..." />
                </label></div>
            <div v-if="loading" class="state">
                <RefreshCw :size="28" class="spin" />Memuat surat...
            </div>
            <div v-else-if="!letters.length" class="state">
                <XCircle :size="30" />Belum ada surat
            </div>
            <div v-else class="table">
                <table>
                    <thead>
                        <tr>
                            <th>Pengajuan</th>
                            <th>Peneliti</th>
                            <th>Jenis</th>
                            <th>Tanggal selesai</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="i in letters" :key="i.id">
                            <td><strong class="number">{{ i.application_number }}</strong></td>
                            <td><strong>{{ i.researcher_name || '—' }}</strong><small>{{ i.researcher_email || '—'
                            }}</small>
                            </td>
                            <td>{{ types[i.application_type as keyof typeof types] ?? i.application_type }}</td>
                            <td>{{ date(i.updated_at || i.created_at) }}</td>
                            <td class="actions"><button class="detail" @click="detail(i.id)">
                                    <Eye :size="15" /> Detail
                                </button><button class="detail" @click="download(i.id, i.application_number)">
                                    <Download :size="15" /> Surat
                                </button></td>
                        </tr>
                    </tbody>
                </table>
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
    gap: var(--space-4);
    align-items: flex-start
}

.eyebrow {
    color: var(--primary);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em
}

h1 {
    margin: var(--space-2) 0;
    color: var(--foreground);
    font-size: clamp(24px, 3vw, 32px)
}

p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 14px
}

.button,
.detail {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    color: var(--foreground);
    font: inherit;
    cursor: pointer
}

.alert {
    padding: 12px;
    border: 1px solid var(--color-danger-border);
    border-radius: var(--radius-md);
    background: var(--color-danger-soft);
    color: var(--color-danger)
}

.card {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--card);
    box-shadow: var(--shadow-sm)
}

.toolbar {
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--border);
    background: var(--sidebar)
}

.toolbar label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 520px;
    padding: 10px 12px;
    border: 1px solid var(--input);
    border-radius: var(--radius-md);
    background: var(--card);
    color: var(--muted-foreground)
}

input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 13px
}

.table {
    overflow: auto
}

table {
    width: 100%;
    border-collapse: collapse
}

th {
    padding: 12px var(--space-4);
    background: var(--background);
    color: var(--muted-foreground);
    font-size: 11px;
    text-align: left;
    text-transform: uppercase
}

td {
    padding: 14px var(--space-4);
    border-top: 1px solid var(--border);
    font-size: 13px;
    color: var(--foreground)
}

tr:hover {
  background: var(--color-primary-light); 
}

.number {
    display: block;
    color: var(--primary)
}

.title,
small {
    display: block;
    color: var(--muted-foreground);
    margin-top: 3px
}

.actions {
    display: flex;
    gap: 8px
}

.state {
    min-height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: var(--space-2);
    color: var(--muted-foreground)
}

.spin {
    animation: spin .9s linear infinite
}

@keyframes spin {
    to {
        transform: rotate(360deg)
    }
}

@media(max-width:640px) {
    .heading {
        flex-direction: column
    }

    .actions {
        flex-direction: column
    }
}
</style>
