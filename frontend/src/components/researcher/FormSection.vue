<script setup lang="ts">
import {
  User,
  FileText,
  Check,
  Info,
  History,
  Wallet,
  ClipboardCheck,
} from 'lucide-vue-next'
interface Props {
  title: string
  description?: string
  icon?: string
}

withDefaults(defineProps<Props>(), {
  description: undefined,
  icon: undefined,
})

const iconMap = {
  User,
  FileText,
  Check,
  Info,
  History,
  Wallet,
  ClipboardCheck,
}
</script>

<template>
  <div class="form-section">
    <!-- Section header -->
    <div class="form-section__header">
      <div class="form-section__title-group">
        <div v-if="icon" class="form-section__icon">
          <component :is="iconMap[icon as keyof typeof iconMap]" />
        </div>
        <h3 class="section-title form-section__title">{{ title }}</h3>
      </div>
      <p v-if="description" class="form-section__description">
        {{ description }}
      </p>
    </div>

    <!-- Section content -->
    <div class="form-section__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.form-section {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: 16px;
}

.form-section__header {
  display: grid;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
}

.form-section__title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-section__icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  font-size: 16px;
  background: var(--color-primary-soft);
  color: var(--primary);
}

.form-section__icon--info {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.form-section__icon--file {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.form-section__icon--check {
  background: var(--color-success-soft);
  color: var(--accent-foreground);
}

.form-section__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--foreground);
}

.form-section__description {
  margin: 0;
  font-size: 0.92rem;
  color: var(--muted-foreground);
  line-height: 1.5;
}

.form-section__content {
  display: grid;
  gap: 16px;
}

@media (max-width: 768px) {
  .form-section {
    padding: 18px;
    gap: 14px;
  }

  .form-section__title {
    font-size: 1rem;
  }

  .form-section__content {
    gap: 14px;
  }
}
</style>
