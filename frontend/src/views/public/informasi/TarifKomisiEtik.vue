<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import { tarifGroups as hardcodedGroups, type TarifGroup } from '../../../data/tarifKomisiEtik'
import { fetchTarif, useTarifApi } from '../../../services/tarifApi'

const groups = ref<TarifGroup[]>(hardcodedGroups)
const activeId = ref<string>(hardcodedGroups[0]?.id ?? '')
const loading = ref(false)
const error = ref<string | null>(null)

const activeGroup = computed(() => groups.value.find((g) => g.id === activeId.value) ?? groups.value[0])

async function loadTarif() {
  if (!useTarifApi) return
  loading.value = true
  error.value = null
  try {
    const data = await fetchTarif()
    if (data.length) {
      groups.value = data
      if (!data.some((g) => g.id === activeId.value)) activeId.value = data[0].id
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Gagal memuat tarif'
  } finally {
    loading.value = false
  }
}

function formatPrice(price: number | null) {
  if (price === null) return 'Menunggu data tarif'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
}

onMounted(loadTarif)
</script>

<template>
  <div class="info-page">
    <PageHeader
      title="Tarif Penelitian"
      description="Pilih tahapan layanan untuk melihat rincian tarif dan alur pembayarannya."
    />

    <p v-if="loading" class="notice">Memuat data tarif…</p>
    <p v-else-if="error" class="notice">
      {{ error }}. Menampilkan data bawaan.
      <button type="button" @click="loadTarif">Coba lagi</button>
    </p>

    <div v-if="activeGroup" class="tarif">
      <!-- Segmented tabs -->
      <div class="tarif__tabs" role="tablist" aria-label="Tahapan layanan">
        <button
          v-for="group in groups"
          :key="group.id"
          type="button"
          role="tab"
          class="tarif__tab"
          :class="{ 'is-active': group.id === activeGroup.id }"
          :aria-selected="group.id === activeGroup.id"
          @click="activeId = group.id"
        >
          {{ group.name }}
        </button>
      </div>

      <Transition name="swap" mode="out-in">
        <div :key="activeGroup.id" class="tarif__panel" role="tabpanel">
          <header class="tarif__head">
            <h2>{{ activeGroup.name }}</h2>
            <p>{{ activeGroup.description }}</p>
          </header>

          <div class="tarif__body">
            <!-- Kolom tarif -->
            <section class="tarif__col" aria-label="Rincian tarif">
              <h3 class="tarif__label">Rincian Tarif</h3>
              <ul class="price-list">
                <li v-for="item in activeGroup.items" :key="item.label" class="price-list__row">
                  <div class="price-list__info">
                    <span class="price-list__name">{{ item.label }}</span>
                    <span v-if="item.note" class="price-list__note">{{ item.note }}</span>
                  </div>
                  <span class="price-list__price" :class="{ 'is-pending': item.price === null }">
                    {{ formatPrice(item.price) }}
                  </span>
                </li>
              </ul>
              <p class="tarif__hint">
                Nominal dapat berubah sewaktu-waktu. Nominal yang berlaku adalah yang tercantum pada tagihan Anda.
              </p>
            </section>

            <!-- Kolom alur pembayaran -->
            <section class="tarif__col tarif__col--flow" aria-label="Alur pembayaran">
              <h3 class="tarif__label">Alur Pembayaran</h3>
              <ol class="steps">
                <li v-for="(step, i) in activeGroup.steps" :key="step.title" class="steps__item">
                  <span class="steps__dot">{{ i + 1 }}</span>
                  <div>
                    <h4>{{ step.title }}</h4>
                    <p>{{ step.description }}</p>
                  </div>
                </li>
              </ol>
            </section>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.notice {
  margin: 0 0 14px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--color-surface);
  font-size: 0.9rem;
  color: var(--muted-foreground);
}

.notice button {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-foreground);
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

/* Satu wadah menyatu: tab + panel */
.tarif {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--color-surface);
  overflow: hidden;
}

.tarif__tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.tarif__tab {
  flex: 1 0 auto;
  padding: 14px 20px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.tarif__tab:hover {
  color: var(--accent-foreground);
}

.tarif__tab.is-active {
  color: var(--accent-foreground);
  border-bottom-color: var(--accent-foreground);
}

.tarif__tab:focus-visible {
  outline: 2px solid var(--accent-foreground);
  outline-offset: -4px;
}

.tarif__panel {
  padding: 24px;
}

.tarif__head h2 {
  margin: 0 0 4px;
  font-size: 1.2rem;
  color: var(--accent-foreground);
}

.tarif__head p {
  margin: 0;
  font-size: 0.92rem;
  color: var(--muted-foreground);
}

.tarif__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  margin-top: 22px;
}

.tarif__col {
  padding-right: 28px;
}

.tarif__col--flow {
  padding: 0 0 0 28px;
  border-left: 1px solid var(--border);
}

.tarif__label {
  margin: 0 0 12px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

/* Daftar tarif */
.price-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.price-list__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.price-list__row:first-child {
  border-top: 0;
  padding-top: 0;
}

.price-list__info {
  display: grid;
  gap: 2px;
}

.price-list__name {
  font-size: 0.95rem;
  color: var(--accent-foreground);
}

.price-list__note {
  font-size: 0.8rem;
  color: var(--muted-foreground);
}

.price-list__price {
  font-weight: 700;
  white-space: nowrap;
  color: var(--accent-foreground);
}

.price-list__price.is-pending {
  font-weight: 500;
  font-style: italic;
  color: var(--muted-foreground);
}

.tarif__hint {
  margin: 14px 0 0;
  font-size: 0.82rem;
  font-style: italic;
  color: var(--muted-foreground);
}

/* Stepper */
.steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps__item {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
}

.steps__item:last-child {
  padding-bottom: 0;
}

.steps__item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 13px;
  top: 28px;
  bottom: 2px;
  width: 2px;
  background: var(--border);
}

.steps__dot {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-foreground);
  color: var(--color-surface);
  font-size: 0.78rem;
  font-weight: 700;
}

.steps__item h4 {
  margin: 3px 0 2px;
  font-size: 0.93rem;
  color: var(--accent-foreground);
}

.steps__item p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--muted-foreground);
}

/* Transisi pergantian tab */
.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .swap-enter-active,
  .swap-leave-active {
    transition: none;
  }
}

@media (max-width: 760px) {
  .tarif__panel {
    padding: 18px;
  }

  .tarif__body {
    grid-template-columns: 1fr;
  }

  .tarif__col {
    padding-right: 0;
  }

  .tarif__col--flow {
    margin-top: 22px;
    padding: 22px 0 0;
    border-left: 0;
    border-top: 1px solid var(--border);
  }
}
</style>