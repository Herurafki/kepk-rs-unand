<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/routes/auth'
import { Menu, X, Phone, Mail, ChevronDown } from 'lucide-vue-next'
import { primaryNavigation } from '../../data/navigation'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const headerRef = ref<HTMLElement | null>(null)
const mobileMenuOpen = ref(false)
const openDesktopMenu = ref<string | null>(null)
const openMobileGroup = ref<string | null>(null)
const hoverMenu = ref<string | null>(null)
const hoverCloseTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const isAuthenticated = computed(() => authStore.isAuthenticated)
// Menu navigasi publik hanya ditampilkan untuk pengunjung dan role peneliti.
const showHeaderNavigation = computed(() => !isAuthenticated.value || authStore.hasRole('peneliti'))
const user = computed(() => authStore.user)
const logoUrl = `${import.meta.env.BASE_URL}logo-rs-unand.png`

const dashboardLink = computed(() => {
  if (authStore.hasRole('admin')) {
    return '/admin/dashboard'
  }
  return '/dashboard'
})

const profileLink = computed(() => authStore.hasRole('admin') ? '/admin/profile' : '/dashboard/profile')

// Active state comes from the matched route's meta, not manual path parsing
const activeSection = computed(() => route.meta.navSection as string | undefined)
function isNavActive(key: string) {
  return activeSection.value === key
}

// Desktop: hover opens dropdown, but click can also toggle
function onDesktopMenuHover(key: string) {
  if (key) {
    // Cancel any pending close timer when re-entering
    if (hoverCloseTimer.value) {
      clearTimeout(hoverCloseTimer.value)
      hoverCloseTimer.value = null
    }
    openDesktopMenu.value = key
    hoverMenu.value = key
  }
}

function onDesktopMenuLeave() {
  // Add a small delay before closing to allow cursor to move into dropdown
  hoverCloseTimer.value = setTimeout(() => {
    if (openDesktopMenu.value === hoverMenu.value) {
      openDesktopMenu.value = null
    }
    hoverMenu.value = null
    hoverCloseTimer.value = null
  }, 50) // 50ms delay gives smooth hover transition
}

function toggleDesktopMenu(key: string) {
  openDesktopMenu.value = openDesktopMenu.value === key ? null : key
}

function closeDesktopMenu() {
  openDesktopMenu.value = null
  hoverMenu.value = null
}

function toggleMobileGroup(key: string) {
  openMobileGroup.value = openMobileGroup.value === key ? null : key
}

function onDocumentClick(event: MouseEvent) {
  if (headerRef.value && !headerRef.value.contains(event.target as Node)) {
    closeDesktopMenu()
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  if (hoverCloseTimer.value) {
    clearTimeout(hoverCloseTimer.value)
  }
})

// Navigating anywhere closes any open menu
watch(() => route.fullPath, () => {
  closeDesktopMenu()
  mobileMenuOpen.value = false
  openMobileGroup.value = null
})

async function handleLogout() {
  await authStore.logout()
  mobileMenuOpen.value = false
  await router.push('/')
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}
</script>

<template>
  <header ref="headerRef" class="unified-header">
    <div class="top-info-bar">
      <div class="info-container">
        <a href="tel:07518465000">
          <Phone :size="16" aria-hidden="true" /><span>0751 - 8465000</span>
        </a>
        <a href="mailto:mail@rsp.unand.ac.id">
          <Mail :size="18" aria-hidden="true" /><span>mail@rsp.unand.ac.id</span>
        </a>
      </div>
    </div>

    <div class="main-header">
      <div class="header-container">
        <RouterLink to="/" class="header-brand" @click="closeMobileMenu">
          <img :src="logoUrl" width="67" height="63" alt="Rumah Sakit Universitas Andalas" />
          <span class="brand-text">DIKLIT RUMAH SAKIT<br />UNIVERSITAS ANDALAS</span>
        </RouterLink>

        <nav v-if="showHeaderNavigation" class="desktop-nav" aria-label="Navigasi utama">
          <template v-for="item in primaryNavigation" :key="item.key">
            <RouterLink v-if="item.to" :to="item.to" class="nav-link" :class="{ 'is-active': isNavActive(item.key) }"
              :aria-current="isNavActive(item.key) ? 'page' : undefined">
              {{ item.label }}
            </RouterLink>

            <!-- Dropdown menu item with hover + click interaction -->
            <div v-else class="nav-menu-wrapper" @mouseenter="onDesktopMenuHover(item.key)"
              @mouseleave="onDesktopMenuLeave">
              <button type="button" class="nav-link nav-link--dropdown" :class="{ 'is-active': isNavActive(item.key) }"
                :aria-expanded="openDesktopMenu === item.key" aria-haspopup="true" @click="toggleDesktopMenu(item.key)">
                {{ item.label }}
                <ChevronDown :size="14" class="nav-chevron" :class="{ 'is-open': openDesktopMenu === item.key }"
                  aria-hidden="true" />
              </button>

              <!-- Dropdown panel -->
              <ul v-show="openDesktopMenu === item.key" class="dropdown-menu" role="menu"
                @mouseenter="onDesktopMenuHover(item.key)" @mouseleave="onDesktopMenuLeave">
                <li v-for="subitem in item.items" :key="subitem.label" role="none">
                  <RouterLink :to="subitem.to" role="menuitem" class="dropdown-item" @click="closeDesktopMenu">
                    {{ subitem.label }}
                  </RouterLink>
                </li>
              </ul>
            </div>
          </template>
        </nav>

        <div class="header-actions" :class="{ 'header-actions--dashboard': isAuthenticated && !showHeaderNavigation }">
          <span class="user-divider" aria-hidden="true" />
          <div v-if="isAuthenticated" class="user-section">
            <RouterLink :to="profileLink" class="user-link"
              :title="`Profile: ${user?.name} (${user?.roles?.join(', ') || 'User'})`"
              :aria-label="`Profile untuk ${user?.name}`">
              <svg width="39" height="39" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor"
                  d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m0 13c-2.424 0-4.634.822-6.255 1.984A7.98 7.98 0 0 0 12 20a7.98 7.98 0 0 0 6.254-3.016C16.634 15.822 14.424 15 12 15m0-9a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7" />
              </svg>
            </RouterLink>
            <button type="button" class="logout-btn" @click="handleLogout">Logout</button>
          </div>
          <div v-else class="guest-actions">
            <RouterLink to="/login" class="login-btn" :class="{ active: route.path === '/login' }"
              :aria-current="route.path === '/login' ? 'page' : undefined">Login</RouterLink>
            <RouterLink to="/register" class="register-btn" :class="{ active: route.path === '/register' }"
              :aria-current="route.path === '/register' ? 'page' : undefined">Register</RouterLink>
          </div>
          <button v-if="showHeaderNavigation" type="button" class="mobile-menu-btn" @click="toggleMobileMenu"
            :aria-expanded="mobileMenuOpen" aria-controls="header-mobile-navigation"
            :aria-label="mobileMenuOpen ? 'Tutup menu' : 'Buka menu'">
            <Menu v-if="!mobileMenuOpen" :size="24" />
            <X v-else :size="24" />
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile navigation -->
    <nav v-if="mobileMenuOpen && showHeaderNavigation" id="header-mobile-navigation" class="mobile-nav"
      aria-label="Navigasi mobile">
      <template v-for="item in primaryNavigation" :key="item.key">
        <RouterLink v-if="item.to" :to="item.to" class="nav-link" :class="{ 'is-active': isNavActive(item.key) }"
          :aria-current="isNavActive(item.key) ? 'page' : undefined" @click="closeMobileMenu">
          {{ item.label }}
        </RouterLink>

        <!-- Mobile accordion group -->
        <div v-else class="mobile-nav__group">
          <button type="button" class="nav-link mobile-nav__trigger" :class="{ 'is-active': isNavActive(item.key) }"
            :aria-expanded="openMobileGroup === item.key" @click="toggleMobileGroup(item.key)">
            {{ item.label }}
            <ChevronDown :size="14" class="nav-chevron" :class="{ 'is-open': openMobileGroup === item.key }"
              aria-hidden="true" />
          </button>
          <ul v-show="openMobileGroup === item.key" class="mobile-nav__submenu">
            <li v-for="sub in item.items" :key="sub.label">
              <RouterLink :to="sub.to" @click="closeMobileMenu">{{ sub.label }}</RouterLink>
            </li>
          </ul>
        </div>
      </template>

      <div v-if="isAuthenticated" class="mobile-user-section">
        <span class="mobile-user-name">{{ user?.name }} · {{ user?.roles?.join(', ') }}</span>
        <RouterLink :to="dashboardLink" class="nav-link" @click="closeMobileMenu">Dashboard</RouterLink>
        <button type="button" class="logout-btn" @click="handleLogout">Logout</button>
      </div>
      <div v-else class="mobile-guest-section">
        <RouterLink to="/login" class="login-btn" :class="{ active: route.path === '/login' }"
          :aria-current="route.path === '/login' ? 'page' : undefined" @click="closeMobileMenu">Login</RouterLink>
        <RouterLink to="/register" class="register-btn" :class="{ active: route.path === '/register' }"
          :aria-current="route.path === '/register' ? 'page' : undefined" @click="closeMobileMenu">Register</RouterLink>
      </div>
    </nav>
  </header>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&display=swap');

/* The shared header owns its sticky offset for both existing dashboard shells. */
@media (min-width: 641px) {
  .unified-header~ :is(.dashboard-body, .admin-body)>.dashboard-sidebar {
    top: 139px;
    max-height: calc(100vh - 139px);
  }

  .unified-header~.dashboard-body>.dashboard-content {
    min-height: calc(100vh - 139px);
  }
}
</style>

<style scoped>
.unified-header {
  position: sticky;
  top: 0;
  z-index: 100;
  color: var(--color-text);
  font-family: 'Poppins', sans-serif;
  font-size: 16px;
  letter-spacing: 0.02em;
}

.unified-header a,
.unified-header button {
  text-decoration: none;
}

.unified-header :is(a, button):focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}

/* Top info bar */
.top-info-bar {
  height: 48px;
  background: var(--color-primary);
}

.info-container,
.header-container {
  width: calc(100% - 48px);
  max-width: 1300px;
  margin: 0 auto;
  display: flex;
  align-items: center;
}

.info-container {
  height: 48px;
  padding-left: 8px;
  gap: 28px;
}

.info-container a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-inverse);
  font-weight: 600;
  line-height: 1.1;
  white-space: nowrap;
}

.info-container svg {
  flex-shrink: 0;
}

/* Main header */
.main-header {
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.header-container {
  height: 91px;
  gap: 20px;
}

/* Brand */
.header-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  color: var(--color-primary);
}

.header-brand img {
  width: 67px;
  height: 63px;
  object-fit: contain;
  flex-shrink: 0;
}

.brand-text {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

/* Desktop navigation */
.desktop-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex: 1;
}

/* Nav link base (both regular and dropdown trigger) */
.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  color: var(--color-text);
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  border: 0;
  background: none;
  cursor: pointer;
  position: relative;
  transition: color 0.15s ease, transform 0.15s ease;
}

/* Underline marks both hovered and active navigation items. */
.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--color-primary);
  transition: width 0.2s ease;
}

.nav-link:hover {
  color: var(--color-primary);
}

.nav-link:hover::after {
  width: 100%;
}

.nav-link.is-active::after {
  width: 100%;
}

/* Dropdown-specific styling */
.nav-link--dropdown {
  font-family: inherit;
  letter-spacing: inherit;
}

.nav-chevron {
  flex-shrink: 0;
  transition: transform 0.2s ease;
  color: var(--color-primary);
}

.nav-link--dropdown[aria-expanded="true"] .nav-chevron,
.nav-chevron.is-open {
  transform: rotate(180deg);
}

/* Dropdown menu wrapper for hover area */
.nav-menu-wrapper {
  position: relative;
}

/* Invisible hover bridge to prevent dropdown from closing
   when cursor moves from trigger to dropdown panel */
.nav-menu-wrapper::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 12px;
  pointer-events: none;
}

/* Dropdown panel */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 240px;
  margin: 0;
  padding: 8px;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  z-index: 10;
}

.dropdown-item {
  display: block;
  padding: 10px 12px;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.dropdown-item:hover,
.dropdown-item:focus-visible {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

/* Header actions */
.header-actions,
.user-section,
.guest-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

/* Keep account actions aligned to the right when public navigation is hidden. */
.header-actions {
  margin-left: auto;
}

.user-divider {
  height: 52px;
  width: 1px;
  background: var(--color-border);
}

.user-link {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  color: var(--color-primary);
}

.logout-btn {
  width: 119px;
  height: 39px;
  border: 0;
  border-radius: 16px;
  background: var(--color-danger);
  color: var(--color-text-inverse);
  font: 600 16px 'Poppins', sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.2s ease;
}

.logout-btn:hover {
  background: var(--color-danger);
}

.dashboard-btn {
  all: unset;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 200ms ease;
  font-size: 14px;
  font-weight: 500;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.dashboard-btn svg {
  flex-shrink: 0;
}

.dashboard-btn:hover {
  background: var(--color-primary-soft);
  color: var(--primary);
}

.dashboard-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (min-width: 1400px) and (max-width: 1599px) {
  .user-section {
    gap: 8px;
  }

  .dashboard-btn .btn-label {
    display: none;
  }
}

.login-btn,
.register-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 39px;
  padding: 0 12px;
  font-weight: 600;
  background: var(--color-secondary);
  color: var(--color-text);
  border: 3px solid var(--color-primary);  /* lebar + style + warna */
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
}

.login-btn:hover,
.register-btn:hover {
  background: var(--color-primary-soft);
  color: var(--color-text);
  transition: transform 0.18s ease, filter 0.2s ease;
}

/* Mobile menu button */
.mobile-menu-btn {
  display: none;
  width: 44px;
  height: 44px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

/* Mobile navigation */
.mobile-nav {
  display: none;
}

@media (max-width: 1399px) {

  .desktop-nav,
  .header-actions>.user-divider,
  .header-actions:not(.header-actions--dashboard)>.user-section,
  .header-actions>.guest-actions {
    display: none;
  }

  .header-container {
    justify-content: space-between;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .mobile-nav {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--color-surface);
    padding: 16px 24px;
    max-height: calc(100dvh - 139px);
    overflow-y: auto;
    box-shadow: var(--shadow-md);
  }

  .mobile-nav .nav-link {
    align-self: flex-start;
    white-space: normal;
    width: 100%;
    justify-content: space-between;
  }

  .mobile-nav__group {
    display: flex;
    flex-direction: column;
  }

  .mobile-nav__trigger {
    width: 100%;
    justify-content: space-between;
  }

  .mobile-nav__submenu {
    list-style: none;
    margin: 0;
    padding: 4px 0 8px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mobile-nav__submenu a {
    display: block;
    padding: 8px 4px;
    color: var(--color-text);
    font-size: 14px;
    text-decoration: none;
  }

  .mobile-nav__submenu a:hover {
    color: var(--color-primary);
  }

  .mobile-user-section,
  .mobile-guest-section {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    border-top: 1px solid var(--color-border);
    padding-top: 12px;
  }

  .mobile-user-name {
    flex-basis: 100%;
    overflow-wrap: anywhere;
    font-size: 14px;
  }
}

@media (max-width: 640px) {

  .info-container,
  .header-container {
    width: calc(100% - 24px);
  }

  .info-container {
    padding-left: 0;
    gap: 6px 16px;
    flex-wrap: wrap;
    align-content: center;
  }

  .info-container a {
    font-size: 11px;
    gap: 4px;
    letter-spacing: 0;
  }

  .header-container {
    gap: 8px;
  }

  .header-brand {
    gap: 8px;
    min-width: 0;
  }

  .header-brand img {
    width: 48px;
    height: 48px;
  }

  .brand-text {
    font-size: 12px;
    letter-spacing: 0;
  }

  .header-actions {
    gap: 0;
  }

  .mobile-menu-btn {
    width: 36px;
    flex-shrink: 0;
  }
}
</style>

<style scoped>
.login-btn.active,
.register-btn.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
</style>
