import { test, expect } from '@playwright/test'

test('halaman utama KEPK dapat dibuka', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/frontend/i)
})