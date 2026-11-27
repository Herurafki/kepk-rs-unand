<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  minHeight?: string
  disabled?: boolean
}>(), {
  placeholder: 'Tulis deskripsi...',
  minHeight: '140px',
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const editor = ref<HTMLElement | null>(null)
const isFocused = ref(false)

const sanitize = (html: string) => {
  const template = document.createElement('template')
  template.innerHTML = html
  template.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((node) => node.remove())
  template.content.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on')) node.removeAttribute(attribute.name)
    })
  })
  return template.innerHTML
}

const syncFromModel = async () => {
  await nextTick()
  if (editor.value && editor.value.innerHTML !== props.modelValue) {
    editor.value.innerHTML = props.modelValue || ''
  }
}

const emitValue = () => {
  if (!editor.value) return
  const value = sanitize(editor.value.innerHTML)
  editor.value.innerHTML = value
  emit('update:modelValue', value)
}

const command = (name: string, value?: string) => {
  if (props.disabled) return
  editor.value?.focus()
  document.execCommand(name, false, value)
  emitValue()
}

const clearFormat = () => command('removeFormat')

watch(() => props.modelValue, syncFromModel)
onMounted(syncFromModel)
</script>

<template>
  <div class="rich-text-field" :class="{ 'is-focused': isFocused, 'is-disabled': disabled }">
    <div class="toolbar" role="toolbar" aria-label="Format teks">
      <button type="button" title="Tebal" :disabled="disabled" @mousedown.prevent="command('bold')"><strong>B</strong></button>
      <button type="button" title="Miring" :disabled="disabled" @mousedown.prevent="command('italic')"><em>I</em></button>
      <button type="button" title="Garis bawah" :disabled="disabled" @mousedown.prevent="command('underline')"><u>U</u></button>
      <span class="separator" />
      <button type="button" title="Daftar bernomor" :disabled="disabled" @mousedown.prevent="command('insertOrderedList')">1.</button>
      <button type="button" title="Daftar bullet" :disabled="disabled" @mousedown.prevent="command('insertUnorderedList')">•</button>
      <button type="button" title="Rata kiri" :disabled="disabled" @mousedown.prevent="command('justifyLeft')">≡</button>
      <button type="button" title="Rata tengah" :disabled="disabled" @mousedown.prevent="command('justifyCenter')">≡</button>
      <span class="separator" />
      <button type="button" title="Hapus format" :disabled="disabled" @mousedown.prevent="clearFormat">Tx</button>
    </div>
    <div
      ref="editor"
      class="editor"
       :contenteditable="!disabled"
      :data-placeholder="placeholder"
      :style="{ minHeight }"
      role="textbox"
      aria-multiline="true"
      :aria-readonly="disabled"
      :tabindex="disabled ? 0 : undefined"
      @focus="isFocused = true"
      @blur="isFocused = false"
      @input="emitValue"
      @paste="emitValue"
    />
  </div>
</template>

<style scoped>
.rich-text-field {
  overflow: hidden;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--color-surface);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.rich-text-field.is-focused {
  border-color: var(--ring);
  box-shadow: var(--shadow-focus);
}

.rich-text-field.is-disabled {
  background: var(--muted);
  opacity: .75;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--muted);
}

.toolbar button {
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  cursor: pointer;
}

.toolbar button:hover:not(:disabled) {
  border-color: var(--border);
  background: var(--card);
}

.toolbar button:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.separator {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: var(--border);
}

.editor {
  padding: 12px 14px;
  outline: none;
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: .96rem;
  line-height: 1.6;
  overflow-y: auto;
}

.editor:empty::before {
  content: attr(data-placeholder);
  color: var(--muted-foreground);
  pointer-events: none;
}

.editor :deep(p) {
  margin: 0 0 8px;
}

.editor :deep(ul),
.editor :deep(ol) {
  margin: 0 0 8px;
  padding-left: 24px;
}
</style>
