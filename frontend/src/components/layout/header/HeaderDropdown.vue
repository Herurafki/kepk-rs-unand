<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import type { HeaderSubNavItem } from '../../../data/navigation'

defineProps<{
  navKey: string
  label: string
  items: HeaderSubNavItem[]
  isOpen: boolean
  isActive: boolean
}>()

const emit = defineEmits<{
  toggle: [key: string]
  close: []
}>()
</script>

<template>
  <div class="header-dropdown" @keydown.esc="emit('close')">
    <button
      type="button"
      class="nav-link header-dropdown__trigger"
      :class="{ 'is-active': isActive }"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="emit('toggle', navKey)"
    >
      {{ label }}
      <ChevronDown :size="12" class="header-dropdown__chevron" :class="{ 'is-open': isOpen }" aria-hidden="true" />
    </button>

    <ul v-show="isOpen" class="header-dropdown__menu" role="menu">
      <li v-for="item in items" :key="item.label" role="none">
        <RouterLink :to="item.to" role="menuitem" class="header-dropdown__item" @click="emit('close')">
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
