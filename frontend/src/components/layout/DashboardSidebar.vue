<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/routes/auth'

interface NavItem {
  label: string
  path: string
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const authStore = useAuthStore()
const router = useRouter()
async function handleLogout() { await authStore.logout(); await router.push('/login') }

const navigationSections = computed<NavSection[]>(() => {
  const sections: NavSection[] = []



  if (authStore.hasRole('peneliti')) {
    sections.push({
      title: 'Pengajuan Peneliti',
      items: [
        { label: 'Pengajuan Izin Penelitian', path: '/dashboard/research/permission' },
        { label: 'Pengambilan Data Awal', path: '/dashboard/research/data-collection' },
        { label: 'Pengajuan Etik', path: '/dashboard/research/ethics' },
        { label: 'Pembayaran', path: '/dashboard/research/payments' },
      ],
    })
  }

  if (authStore.hasRole('diklit')) {
    sections.push({
      title: 'DIKLIT',
      items: [
        { label: 'Dashboard', path: '/diklit/dashboard' },
        { label: 'Verifikasi', path: '/diklit/courses' },
        { label: 'Surat', path: '/diklit/reports' },
        { label: 'Invoice', path: '/diklit/payments' },
        { label: 'Pengaturan', path: '/diklit/settings/letter-numbers' },
        { label: 'Profil', path: '/dashboard/profile' },
      ],
    })
  }

  if (authStore.hasRole('sekretariat')) {
    sections.push({
      title: 'SEKRETARIAT',
      items: [
        { label: 'Dashboard', path: '/secretariat/dashboard' },
        { label: 'Pengajuan', path: '/secretariat/applications' },
        { label: 'Anggota Reviewer', path: '/secretariat/reviewers' },
        { label: 'Surat', path: '/secretariat/letters' },
        { label: 'Invoice', path: '/secretariat/payments' },
        { label: 'Pengaturan', path: '/secretariat/settings/letter-numbers' },
        { label: 'Profil', path: '/dashboard/profile' },
      ],
    })
  }

  if (authStore.hasRole('reviewer')) {
    sections.push({
      title: 'REVIEWER',
      items: [
        { label: 'Dashboard', path: '/reviewer/dashboard' },
        { label: 'Tugas Review', path: '/reviewer/tasks' },
        { label: 'Riwayat', path: '/reviewer/history' },
        { label: 'Profil', path: '/dashboard/profile' },
      ],
    })
  }

  if (authStore.hasRole('ketua')) {
    sections.push({
      title: 'KETUA',
      items: [
        { label: 'Dashboard', path: '/chief/dashboard' },
        { label: 'Peninjauan', path: '/chief/peninjauan' },
        { label: 'Riwayat', path: '/chief/history' },
        { label: 'Profil', path: '/dashboard/profile' },
        { label: 'Pengaturan', path: '/chief/settings' },
        // { label: 'Logout', path: '/logout' },
      ],
    })
  }

  if (authStore.hasRole('admin')) {
    sections.push(
      {
        title: 'DASHBOARD SUPERADMIN',
        items: [
          { label: 'Ringkasan Sistem', path: '/admin/dashboard' },
        ],
      },
      {
        title: 'MANAJEMEN PENGGUNA',
        items: [
          { label: 'Tambah Pengguna', path: '/admin/user-add' },
          { label: 'Daftar Pengguna', path: '/admin/user-list' },
        ],
      },
      {
        title: 'KEAMANAN & MONITORING',
        items: [
          { label: 'Audit Trail', path: '/admin/audit' },
          { label: 'Monitoring Pengajuan', path: '/admin/reports' },
          { label: 'Pengaturan Sistem', path: '/admin/settings' },
        ],
      },
      {
        title: 'AKUN',
        items: [
          { label: 'Profil', path: '/dashboard/profile' },
        ],
      },
    )
  }

  return sections
})
</script>

<template>
  <aside class="dashboard-sidebar">
    <nav>
      <template v-for="(section, index) in navigationSections" :key="section.title ?? index">
        <div v-if="section.title" class="sidebar-section-title">{{ section.title }}</div>
        <div  class="sidebar-divider" />
        <button
          v-for="item in section.items.filter(item => item.path === '/logout')"
          :key="`logout-${item.path}`"
          class="sidebar-link sidebar-button"
          type="button"
          @click="handleLogout"
        >
          {{ item.label }}
        </button>
        <RouterLink
          v-for="item in section.items.filter(item => item.path !== '/logout')"
          :key="item.path"
          :to="item.path"
          class="sidebar-link"
        >
          {{ item.label }}
        </RouterLink>
        
      </template>
    </nav>
  </aside>
</template>

<style scoped>
.dashboard-sidebar {
  width: 280px;
  background: var(--sidebar);
  border-right: 1px solid var(--sidebar-border);
  padding: 24px 0;
  overflow-y: auto;
  flex-shrink: 0;
  position: sticky;
  top: 70px;
  max-height: calc(100vh - 70px);
}

.dashboard-sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 12px;
}

.sidebar-section-title {
  padding: 12px 16px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--muted-foreground);
}

.sidebar-divider {
  height: 1px;
  background: var(--sidebar-border);
  margin: 8px 12px;
}

 .sidebar-link {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  text-decoration: none;
  color: var(--sidebar-foreground);
  border-radius: 8px;
  transition: all 200ms ease;
  font-size: 14px;
  font-weight: 500;
}

.sidebar-link:hover {
  background: var(--color-overlay-subtle);
  color: var(--primary);
}

 .sidebar-button { width: 100%; text-align: left; }

.sidebar-link.router-link-active {
  background: var(--sidebar-accent);
  color: var(--sidebar-accent-foreground);
}

@media (max-width: 768px) {
  .dashboard-sidebar {
    width: 260px;
    padding: 20px 0;
  }
}

@media (max-width: 640px) {
  .dashboard-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--sidebar-border);
    max-height: none;
    position: static;
    padding: 12px 0;
  }

  .dashboard-sidebar nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 0 12px;
    gap: 8px;
  }

  .sidebar-link {
    white-space: nowrap;
    flex-shrink: 0;
  }
}
</style>
