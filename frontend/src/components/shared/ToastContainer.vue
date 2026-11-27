<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-vue-next'
import { useToast } from '../../composables/useToast'

const toast = useToast()
const toastItems = computed(() => toast.items.value)
let alertObserver: MutationObserver | undefined
const seenAlerts = new WeakMap<Element, string>()
const dismissedMessages = new Set<string>()
const hiddenClass = 'toast-legacy-alert-hidden'

function normalizeMessage(element: HTMLElement) {
  return (element.textContent || '').replace(/\s+/g, ' ').trim()
}

function dismissToast(id: number, message: string) {
  dismissedMessages.add(message)
  toast.dismiss(id)
}

function collectInlineAlerts() {
  const activeMessages = new Set<string>()
  const selector = '.auth-alert, .alert, .form-alert, .success, .file-upload__error, [role="alert"], .error-message, .success-message, .form-error, .form-success'

  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    if (element.closest('.toast-stack')) return
    const message = normalizeMessage(element)
    if (!message) return

    activeMessages.add(message)
    element.classList.add(hiddenClass)

    if (dismissedMessages.has(message) || seenAlerts.get(element) === message) return
    seenAlerts.set(element, message)

    const classes = element.className.toString().toLowerCase()
    const type = /success|berhasil/.test(classes) ? 'success'
      : /warning|peringatan/.test(classes) ? 'warning'
      : /info|informasi/.test(classes) ? 'info'
      : 'error'
    toast.show(type, message)
  })

  // A message can notify again after it has disappeared from the page.
  for (const message of dismissedMessages) {
    if (!activeMessages.has(message)) dismissedMessages.delete(message)
  }
}

onMounted(() => {
  collectInlineAlerts()
  alertObserver = new MutationObserver(collectInlineAlerts)
  alertObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
})

onBeforeUnmount(() => alertObserver?.disconnect())
const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}
</script>

<template>
  <section class="toast-stack" aria-label="Notifikasi" aria-live="polite">
    <TransitionGroup name="toast">
      <article
        v-for="item in toastItems"
        :key="item.id"
        class="toast-card"
        :class="`toast-card--${item.type}`"
        role="status"
      >
        <component :is="icons[item.type]" class="toast-card__icon" :size="25" :stroke-width="2.2" />
        <div class="toast-card__content">
          <strong class="toast-card__title">{{ item.title }}</strong>
          <p class="toast-card__message">{{ item.message }}</p>
        </div>
        <button
          class="toast-card__close"
          type="button"
          :aria-label="`Tutup notifikasi ${item.title}`"
          @click="dismissToast(item.id, item.message)"
        >
          <X :size="18" />
        </button>
      </article>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  z-index: 10000;
  top: 24px;
  right: 24px;
  display: grid;
  width: min(420px, calc(100vw - 32px));
  gap: 12px;
  pointer-events: none;
}

.toast-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.toast-card--success {
  border-color: var(--color-success-border);
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  color: var(--color-success);
}

.toast-card--error {
  border-color: var(--color-danger-border);
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
  color: var(--color-danger);
}

.toast-card--info {
  border-color: var(--color-info);
  background: color-mix(in srgb, var(--color-info) 10%, var(--color-surface));
  color: var(--color-info);
}

.toast-card--warning {
  border-color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface));
  color: var(--color-warning);
}

.toast-card__icon {
  flex: 0 0 auto;
  margin-top: 1px;
}

.toast-card__content {
  min-width: 0;
  flex: 1;
}

.toast-card__title {
  display: block;
  font-size: 0.92rem;
  line-height: 1.4;
}

.toast-card__message {
  margin: 4px 0 0;
  color: var(--foreground);
  font-size: 0.85rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.toast-card__close {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  padding: 2px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.toast-card__close:hover {
  background: var(--color-overlay-subtle);
  color: var(--foreground);
}

.toast-enter-active,
.toast-leave-active,
.toast-move {
  transition: opacity var(--transition-base), transform var(--transition-base);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

.toast-leave-active {
  position: absolute;
  right: 0;
  left: 0;
}

@media (max-width: 640px) {
  .toast-stack {
    top: 12px;
    right: 12px;
    width: calc(100vw - 24px);
  }
}
</style>
