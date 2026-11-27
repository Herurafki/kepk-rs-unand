
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Props {
  id: string
  label: string
  modelValue: string
  type?: string
  autocomplete?: string
  placeholder?: string
  maxlength?: number
  minlength?: number
  required?: boolean
  suggestions?: string[]
  icon?: 'user' | 'mail' | 'lock' | 'id-card' | 'building' | 'academic' | 'briefcase' | 'phone' | 'map-pin'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  autocomplete: undefined,
  placeholder: '',
  maxlength: undefined,
  minlength: undefined,
  required: false,
  suggestions: undefined,
  icon: 'user',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isFocused = ref(false)
const activeIndex = ref(-1)

const hasSuggestions = computed(() => Array.isArray(props.suggestions))

const filteredSuggestions = computed(() => {
  if (!hasSuggestions.value) return []

  const query = props.modelValue.trim().toLocaleLowerCase('id-ID')

  return (props.suggestions ?? []).filter(item =>
    item.toLocaleLowerCase('id-ID').includes(query)
  )
})

const showSuggestions = computed(() =>
  hasSuggestions.value &&
  isFocused.value &&
  filteredSuggestions.value.length > 0
)

watch(filteredSuggestions, () => {
  activeIndex.value = -1
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  activeIndex.value = -1
}

const handleFocus = () => {
  if (hasSuggestions.value) {
    isFocused.value = true
    activeIndex.value = -1
  }
}

const handleBlur = () => {
  isFocused.value = false
  activeIndex.value = -1
}

const selectSuggestion = (value: string) => {
  emit('update:modelValue', value)
  isFocused.value = false
  activeIndex.value = -1
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!hasSuggestions.value) return

  if (event.key === 'Escape') {
    isFocused.value = false
    activeIndex.value = -1
    return
  }

  if (!showSuggestions.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(
      activeIndex.value + 1,
      filteredSuggestions.value.length - 1
    )
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    const selected = filteredSuggestions.value[activeIndex.value]

    if (selected) {
      selectSuggestion(selected)
    }
  }
}
</script>

<template>
  <div class="auth-field" v-bind="$attrs">
    <label :for="id">{{ label }}</label>

    <div class="auth-input-shell">
      <span class="auth-input-icon" aria-hidden="true">
        <svg
          v-if="icon === 'user'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>

        <svg
          v-else-if="icon === 'mail'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>

        <svg
          v-else-if="icon === 'id-card'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M9 12h6" />
          <path d="M16 14h1" />
        </svg>

        <svg
          v-else-if="icon === 'building'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
          <line x1="6" y1="12" x2="6" y2="9" />
          <line x1="18" y1="12" x2="18" y2="9" />
        </svg>

        <svg
          v-else-if="icon === 'academic'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <circle cx="9" cy="10" r="1" />
          <circle cx="12" cy="10" r="1" />
          <circle cx="15" cy="10" r="1" />
        </svg>

        <svg
          v-else-if="icon === 'briefcase'"
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

        <svg
          v-else-if="icon === 'phone'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 1 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>

        <svg
          v-else-if="icon === 'map-pin'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>

        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </svg>
      </span>

      <input
        :id="id"
        :value="modelValue"
        :type="type"
        :autocomplete="hasSuggestions ? 'off' : autocomplete"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :minlength="minlength"
        :required="required"
        :role="hasSuggestions ? 'combobox' : undefined"
        :aria-autocomplete="hasSuggestions ? 'list' : undefined"
        :aria-expanded="hasSuggestions ? showSuggestions : undefined"
        :aria-controls="hasSuggestions ? `${id}-suggestions` : undefined"
        :aria-activedescendant="
          showSuggestions && activeIndex >= 0
            ? `${id}-option-${activeIndex}`
            : undefined
        "
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      >

      <ul
        v-if="showSuggestions"
        :id="`${id}-suggestions`"
        class="auth-suggestions"
        role="listbox"
      >
        <li
          v-for="(suggestion, index) in filteredSuggestions"
          :id="`${id}-option-${index}`"
          :key="suggestion"
          class="auth-suggestion"
          :class="{ 'auth-suggestion--active': index === activeIndex }"
          role="option"
          :aria-selected="index === activeIndex"
          @mousedown.prevent="selectSuggestion(suggestion)"
        >
          {{ suggestion }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.auth-field {
  display: grid;
  gap: 8px;
}

.auth-field label {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--accent-foreground);
  text-align: left;
  letter-spacing: 0.3px;
}

.auth-input-shell {
  position: relative;
}

.auth-input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-foreground);
  width: 18px;
  height: 18px;
  pointer-events: none;
}

.auth-input-icon svg {
  width: 100%;
  height: 100%;
}

.auth-input-shell input {
  width: 100%;
  height: 46px;
  border: 1px solid var(--input);
  border-radius: 12px;
  padding: 0 14px 0 42px;
  font-size: 0.96rem;
  color: var(--foreground);
  background: var(--color-surface);
  transition: all 0.2s ease;
  font-family: var(--font-sans);
}

.auth-input-shell input::placeholder {
  color: color-mix(in srgb, var(--muted-foreground) 70%, white);
}

.auth-input-shell input:hover {
  border-color: color-mix(in srgb, var(--ring) 40%, var(--input));
}

.auth-input-shell input:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: var(--shadow-focus);
}

.auth-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 220px;
  margin: 0;
  padding: 5px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.auth-suggestion {
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--foreground);
  font-size: 0.9rem;
  line-height: 1.4;
  cursor: pointer;
}

.auth-suggestion:hover,
.auth-suggestion--active {
  background: var(--color-primary-softer);
  color: var(--foreground);
}
</style>
