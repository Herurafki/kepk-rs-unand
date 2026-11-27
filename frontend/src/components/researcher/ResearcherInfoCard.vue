<script setup lang="ts">
import { computed } from 'vue'

type ResearcherFieldKey =
  | 'name'
  | 'email'
  | 'category'
  | 'identity'
  | 'nim'
  | 'nip'
  | 'nik'
  | 'phone'
  | 'address'
  | 'faculty'
  | 'department'
  | 'institution'
  | 'programStudy'

interface Props {
  name?: string
  email?: string
  category?: string
  nim?: string | null
  nip?: string | null
  nik?: string | null
  phone?: string | null
  address?: string | null
  faculty?: string | null
  department?: string | null
  institution?: string | null
  programStudy?: string | null
  fields?: readonly ResearcherFieldKey[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  name: '-',
  email: '-',
  category: '-',
  nim: null,
  nip: null,
  nik: null,
  phone: null,
  address: null,
  faculty: null,
  department: null,
  institution: null,
  programStudy: null,
  fields: () => [
    'name',
    'email',
    'category',
    'nip',
    'nim',
    'nik',
    'phone',
    'address',
    'institution',
    'department',
    'faculty',
    'programStudy',
  ],
  loading: false,
})

const formatValue = (value: string | null | undefined) =>
  value && value.trim() ? value : '-'

const identityField = computed(() => {
  const identities = [
    { label: 'NIM', value: props.nim },
    { label: 'NIP', value: props.nip },
    { label: 'NIK', value: props.nik },
  ]

  return identities.find(({ value }) => value?.trim()) ?? identities[0]
})

const fieldDefinitions = computed(() => ({
  name: { label: 'NAMA', value: props.name },
  email: { label: 'EMAIL', value: props.email },
  category: { label: 'KATEGORI', value: props.category },
  identity: identityField.value,
  nim: { label: 'NIM', value: props.nim },
  nip: { label: 'NIP', value: props.nip },
  nik: { label: 'NIK', value: props.nik },
  phone: { label: 'NOMOR TELEPON', value: props.phone },
  address: { label: 'ALAMAT', value: props.address },
  faculty: { label: 'FAKULTAS', value: props.faculty },
  department: { label: 'UNIT / DEPARTEMEN', value: props.department },
  institution: { label: 'INSTITUSI', value: props.institution },
  programStudy: { label: 'PROGRAM STUDI', value: props.programStudy },
}))

const visibleFields = computed(() =>
  props.fields.map((key) => ({
    key,
    ...fieldDefinitions.value[key],
  })),
)
</script>

<template>
  <div class="researcher-info">
    <div v-if="loading" class="profile-readonly researcher-info__grid" aria-busy="true">
      <div
        v-for="field in visibleFields"
        :key="field.key"
        class="info-field"
      >
        <div class="loading-skeleton loading-skeleton--label" />
        <div class="loading-skeleton loading-skeleton--value" />
      </div>
    </div>

    <dl v-else class="profile-readonly researcher-info__grid">
      <div
        v-for="field in visibleFields"
        :key="field.key"
        class="info-field"
      >
        <dt class="info-field__label">{{ field.label }}</dt>
        <dd class="info-field__value">{{ formatValue(field.value) }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.researcher-info {
  min-width: 0;
}

.researcher-info__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
}

.info-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.info-field__label {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--accent-foreground);
  text-align: left;
  letter-spacing: 0.3px;
}

.info-field__value {
  display: flex;
  align-items: center;
  min-height: 46px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--foreground);
  font-size: 0.96rem;
  font-family: var(--font-sans);
  line-height: 1.5;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.loading-skeleton {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    var(--color-overlay-subtle) 25%,
    var(--color-overlay) 50%,
    var(--color-overlay-subtle) 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

.loading-skeleton--label {
  width: 40%;
  height: 14px;
}

.loading-skeleton--value {
  width: 100%;
  height: 46px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 768px) {
  .researcher-info__grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
