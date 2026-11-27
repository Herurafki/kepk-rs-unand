export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isRequired(value: string): boolean {
  return value.trim().length > 0
}

export function hasMinLength(value: string, min: number): boolean {
  return value.length >= min
}

export function hasMaxLength(value: string, max: number): boolean {
  return value.length <= max
}