<script setup lang="ts">
export interface CategoryOption {
  value: string
  label: string
  description: string
  icon: 'dosen' | 'mahasiswa' | 'staff' | 'umum'
}

interface Props {
  option: CategoryOption
  selected: boolean
}

defineProps<Props>()

defineEmits<{
  select: []
}>()
</script>

<template>
  <button
    type="button"
    class="category-card"
    :class="{ 'category-card--selected': selected }"
    role="radio"
    :aria-checked="selected"
    @click="$emit('select')"
  >
    <span class="category-card__icon" aria-hidden="true">
      <!-- Dosen icon: mortarboard / graduation cap variant -->
      <svg
        v-if="option.icon === 'dosen'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3L2 8v4c0 4 10 8 10 8s10-4 10-8V8l-10-5z" />
        <path d="M12 13v6" />
      </svg>

      <!-- Mahasiswa icon: graduation cap with diploma -->
      <svg
        v-else-if="option.icon === 'mahasiswa'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3L2 8v4c0 4 10 8 10 8s10-4 10-8V8l-10-5z" />
        <path d="M7 11l10 5" />
        <path d="M17 11l-10 5" />
      </svg>

      <!-- Staff icon: briefcase -->
      <svg
        v-else-if="option.icon === 'staff'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="7" width="18" height="14" rx="2" ry="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M9 14h6" />
        <path d="M9 18h6" />
      </svg>

      <!-- Umum icon: user circle -->
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="10" r="3" />
        <path d="M8 18a4 4 0 0 1 8 0" />
      </svg>
    </span>

    <span class="category-card__label">{{ option.label }}</span>

    <span class="category-card__desc">{{ option.description }}</span>

    <span v-if="selected" class="category-card__check" aria-hidden="true">
      <!-- Checkmark icon -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  </button>
</template>

<style scoped>
.category-card {
  position: relative;
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
  min-height: 48px;
  padding: 18px 12px;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  background: var(--color-surface);
  color: var(--foreground);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.92rem;
  transition: all 0.2s ease;
}

.category-card:hover {
  border-color: var(--ring);
  background: var(--color-primary-softer);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.category-card:focus-visible {
  outline: none;
  border-color: var(--ring);
  box-shadow: var(--shadow-focus);
}

.category-card--selected {
  border-color: var(--primary);
  background: var(--secondary);
  box-shadow: var(--shadow-focus), var(--shadow-md);
}

.category-card--selected .category-card__label {
  color: var(--accent-foreground);
  font-weight: 600;
}

.category-card__icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--primary);
  background: color-mix(in srgb, var(--secondary) 72%, white);
}

.category-card__icon svg {
  width: 20px;
  height: 20px;
}

.category-card--selected .category-card__icon {
  background: var(--primary);
  color: var(--primary-foreground);
}

.category-card__label {
  font-weight: 500;
  font-size: 0.94rem;
  line-height: 1.2;
}

.category-card__desc {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  line-height: 1.3;
}

.category-card__check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  color: var(--primary);
}

.category-card__check svg {
  width: 100%;
  height: 100%;
}

@media (max-width: 640px) {
  .category-card {
      min-height: 40px;
      padding: 14px 8px;
    }
}

@media (max-width: 640px) {
  .category-card__label {
      font-size: 0.88rem;
    }
}

@media (max-width: 640px) {
  .category-card__desc {
      font-size: 0.7rem;
    }
}

@media (prefers-reduced-motion: reduce) {
  .category-card {
      transition: none;
    }
}
</style>
