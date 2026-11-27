<script setup lang="ts">
import { ref, computed } from 'vue'
import { Upload, X } from 'lucide-vue-next'

interface Props {
  label: string
  modelValue: File | null
  required?: boolean
  acceptedTypes?: string
  maxSizeInMB?: number
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  acceptedTypes: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
  maxSizeInMB: 5,
  placeholder: 'Tarik file ke sini atau klik untuk memilih file',
})

const emit = defineEmits<{
  'update:modelValue': [value: File | null]
}>()

const isDragging = ref(false)
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement>()

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const fileSizeFormatted = computed(() => {
  if (props.modelValue) {
    return formatFileSize(props.modelValue.size)
  }
  return ''
})

const validateFile = (file: File): boolean => {
  errorMessage.value = ''

  // Check file type
  const acceptedExtensions = props.acceptedTypes.split(',').map(t => t.trim().toLowerCase())
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

  if (!acceptedExtensions.includes(fileExtension)) {
    errorMessage.value = `Tipe file tidak didukung. File yang didukung: ${props.acceptedTypes}`
    return false
  }

  // Check file size
  const maxSizeInBytes = props.maxSizeInMB * 1024 * 1024
  if (file.size > maxSizeInBytes) {
    errorMessage.value = `Ukuran file terlalu besar. Maksimal: ${props.maxSizeInMB}MB`
    return false
  }

  return true
}

const handleFileSelect = (file: File | null) => {
  if (!file) return

  if (validateFile(file)) {
    emit('update:modelValue', file)
  }
}

const handleInputChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  handleFileSelect(file || null)
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    handleFileSelect(files[0])
  }
}

const handleRemoveFile = () => {
  emit('update:modelValue', null)
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  errorMessage.value = ''
}

const handleClick = () => {
  fileInput.value?.click()
}
</script>

<template>
  <div class="file-upload">
    <!-- Label with required indicator -->
    <label class="file-upload__label">
      {{ label }}
      <span v-if="required" class="required-indicator">*</span>
    </label>

    <!-- Error message if any -->
    <div v-if="errorMessage" class="file-upload__error">
      {{ errorMessage }}
    </div>

    <!-- File selected state -->
    <div v-if="modelValue" class="file-upload__selected">
      <div class="file-upload__file-info">
        <div class="file-upload__file-name">{{ modelValue.name }}</div>
        <div class="file-upload__file-size">{{ fileSizeFormatted }}</div>
      </div>
      <button
        type="button"
        class="file-upload__remove-btn"
        @click="handleRemoveFile"
        title="Hapus file"
        aria-label="Hapus file yang dipilih"
      >
        <X :size="18" />
      </button>
    </div>

    <!-- Drag & Drop area -->
    <div
      v-else
      class="file-upload__dropzone"
      :class="{ 'file-upload__dropzone--dragging': isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="handleClick"
      role="button"
      tabindex="0"
      :aria-label="`Drag and drop area untuk file ${label}`"
      @keydown.enter="handleClick"
      @keydown.space="handleClick"
    >
      <div class="file-upload__icon">
        <Upload :size="32" />
      </div>
      <div class="file-upload__text">
        <p class="file-upload__main-text">{{ placeholder }}</p>
        <p class="file-upload__sub-text">
          Format: {{ acceptedTypes }} | Maksimal: {{ maxSizeInMB }}MB
        </p>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      class="file-upload__input"
      :accept="acceptedTypes"
      @change="handleInputChange"
      :required="required"
      :aria-label="`File input untuk ${label}`"
    >
  </div>
</template>

<style scoped>
.file-upload {
  display: grid;
  gap: 8px;
}

.file-upload__label {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--accent-foreground);
  text-align: left;
  letter-spacing: 0.3px;
}

.required-indicator {
  color: var(--destructive);
  margin-left: 2px;
}

.file-upload__error {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.92rem;
  color: var(--destructive);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
}

.file-upload__dropzone {
  display: grid;
  place-items: center;
  gap: 12px;
  padding: 32px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  background: var(--color-surface-translucent);
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: var(--primary);
    background: var(--color-info-softer);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  &.file-upload__dropzone--dragging {
    border-color: var(--primary);
    background: var(--color-info-soft);
    transform: scale(1.02);
  }
}

.file-upload__icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--color-primary-soft);
  color: var(--primary);
}

.file-upload__icon svg {
  width: 32px;
  height: 32px;
}

.file-upload__text {
  text-align: center;
}

.file-upload__main-text {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 500;
  color: var(--foreground);
}

.file-upload__sub-text {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--muted-foreground);
}

.file-upload__selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--color-success-soft);
  border: 1px solid var(--color-success-border);
}

.file-upload__file-info {
  display: grid;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.file-upload__file-name {
  font-size: 0.94rem;
  font-weight: 600;
  color: var(--foreground);
  word-break: break-word;
}

.file-upload__file-size {
  font-size: 0.84rem;
  color: var(--muted-foreground);
}

.file-upload__remove-btn {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--muted-foreground);
  transition: all 200ms ease;
  flex-shrink: 0;

  &:hover {
    background: var(--color-danger-soft);
    color: var(--destructive);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
}

.file-upload__input {
  display: none;
}

@media (max-width: 768px) {
  .file-upload__dropzone {
    padding: 24px;
    gap: 10px;
  }

  .file-upload__icon {
    width: 40px;
    height: 40px;
  }

  .file-upload__main-text {
    font-size: 0.92rem;
  }
}
</style>
