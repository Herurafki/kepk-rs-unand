import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/routes/auth.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('../layouts/PublicLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('../views/public/Home.vue'), meta: { public: true, navSection: 'beranda' } },
        { path: 'profil/tentang-kami', name: 'profil-tentang-kami', component: () => import('../views/public/profil/TentangKami.vue'), meta: { public: true, navSection: 'profil' } },
        { path: 'profil/struktur-organisasi', name: 'profil-struktur-organisasi', component: () => import('../views/public/profil/StrukturOrganisasi.vue'), meta: { public: true, navSection: 'profil' } },
        { path: 'informasi/alur-pengajuan', name: 'informasi-alur-pengajuan', component: () => import('../views/public/informasi/AlurPengajuan.vue'), meta: { public: true, navSection: 'informasi' } },
        { path: 'informasi/tarif-komisi-etik', name: 'informasi-tarif-komisi-etik', component: () => import('../views/public/informasi/TarifKomisiEtik.vue'), meta: { public: true, navSection: 'informasi' } },
        { path: 'informasi/estimasi-waktu', name: 'informasi-estimasi-waktu', component: () => import('../views/public/informasi/EstimasiWaktu.vue'), meta: { public: true, navSection: 'informasi' } },
        { path: 'dokumen/kaji-etik', name: 'dokumen-kaji-etik', component: () => import('../views/public/dokumen/DocumentDetailView.vue'), props: { documentKey: 'kaji-etik' }, meta: { public: true, navSection: 'dokumen' } },
        { path: 'dokumen/informed-consent', name: 'dokumen-informed-consent', component: () => import('../views/public/dokumen/DocumentDetailView.vue'), props: { documentKey: 'informed-consent' }, meta: { public: true, navSection: 'dokumen' } },
        { path: 'dokumen/menjaga-kerahasiaan', name: 'dokumen-menjaga-kerahasiaan', component: () => import('../views/public/dokumen/DocumentDetailView.vue'), props: { documentKey: 'menjaga-kerahasiaan' }, meta: { public: true, navSection: 'dokumen' } },

      ],
    },
    {
      path: '/login', component: () => import('../layouts/AuthLayout.vue'), children: [{ path: '', name: 'login', component: () => import('../views/public/Login.vue'), meta: { public: true, guestOnly: true } }],
    },
    {
      path: '/register', component: () => import('../layouts/AuthLayout.vue'), children: [{ path: '', name: 'register', component: () => import('../views/public/Register.vue'), meta: { public: true, guestOnly: true } }],
    },
    {
      path: '/verify-email', component: () => import('../layouts/AuthLayout.vue'), children: [{ path: '', name: 'verify-email', component: () => import('../views/public/VerifyEmail.vue'), meta: { public: true } }],
    },
    {
      path: '/forgot-password', component: () => import('../layouts/AuthLayout.vue'), children: [{ path: '', name: 'forgot-password', component: () => import('../views/public/ForgotPassword.vue'), meta: { public: true, guestOnly: true } }],
    },
    {
      path: '/reset-password', component: () => import('../layouts/AuthLayout.vue'), children: [{ path: '', name: 'reset-password', component: () => import('../views/public/ResetPassword.vue'), meta: { public: true, guestOnly: true } }],
    },
    {
      path: '/dashboard', component: () => import('../layouts/DashboardLayout.vue'), meta: { requiresAuth: true }, children: [
        { path: '', name: 'dashboard', component: () => import('../views/shared/DashboardView.vue'), meta: { requiresAuth: true } },
        { path: 'profile', name: 'profile', component: () => import('../views/shared/ProfileView.vue'), meta: { requiresAuth: true } },
        { path: 'research', name: 'research-dashboard', component: () => import('../views/researcher/Dashboard.vue'), meta: { requiresAuth: true, roles: ['peneliti'] }, children: [
          { path: '', redirect: 'data-collection' },
          { path: 'data-collection', name: 'researcher-data-collection', component: () => import('../views/researcher/FormPengambilanDataAwal.vue'), meta: { requiresAuth: true, roles: ['peneliti'] , navSection: 'pengajuan'} },
          { path: 'permission', name: 'researcher-permission', component: () => import('../views/researcher/PengajuanPenelitian.vue'), meta: { requiresAuth: true, roles: ['peneliti'] , navSection: 'pengajuan'} },
          { path: 'ethics', name: 'researcher-ethics', component: () => import('../views/researcher/EthicsProposalPage.vue'), meta: { requiresAuth: true, roles: ['peneliti'] , navSection: 'pengajuan'} },
          { path: 'status', name: 'researcher-status', component: () => import('../views/researcher/StatusPengajuan.vue'), meta: { requiresAuth: true, roles: ['peneliti'] , navSection: 'pengajuan'} },
          { path: 'status/:id', name: 'researcher-status-detail', component: () => import('../views/researcher/DetailPengajuan.vue'), meta: { requiresAuth: true, roles: ['peneliti'] , navSection: 'pengajuan'} },
          { path: 'status/:id/edit', name: 'researcher-status-edit', component: () => import('../views/researcher/EditPengajuan.vue'), meta: { requiresAuth: true, roles: ['peneliti'] , navSection: 'pengajuan'} },
          { path: 'payments', name: 'researcher-payments', component: () => import('../views/shared/Payments.vue'), meta: { requiresAuth: true, roles: ['peneliti'] , navSection: 'pengajuan'} },
        ] },
      ],
    },
    {
      path: '/admin', component: () => import('../views/admin/Dashboard.vue'), meta: { requiresAuth: true, roles: ['admin'] }, children: [
        { path: '', redirect: { name: 'admin-dashboard' } },
        { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/Home.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
        { path: 'user-add', name: 'admin-user-add', component: () => import('../views/admin/UserAdd.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
        { path: 'user-list', name: 'admin-user-list', component: () => import('../views/admin/UserList.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
        { path: 'users', name: 'admin-users', component: () => import('../views/admin/User.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
        { path: 'profile', name: 'admin-profile', component: () => import('../views/admin/Profile.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
        { path: 'reports', name: 'admin-reports', component: () => import('../views/admin/Reports.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
        { path: 'audit', name: 'admin-audit', component: () => import('../views/admin/Audit.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
        { path: 'settings', name: 'admin-settings', component: () => import('../views/admin/Settings.vue'), meta: { requiresAuth: true, roles: ['admin'] } },
      ],
    },
    {
      path: '/diklit', component: () => import('../views/admin/Dashboard.vue'), meta: { requiresAuth: true, roles: ['diklit'] }, children: [
        { path: '', redirect: { name: 'diklit-dashboard' } },
        { path: 'dashboard', name: 'diklit-dashboard', component: () => import('../views/diklit/Dashboard.vue'), meta: { requiresAuth: true, roles: ['diklit'] } },
        { path: 'applications/:id', name: 'diklit-application-detail', component: () => import('../views/diklit/ApplicationDetail.vue'), meta: { requiresAuth: true, roles: ['diklit'] } },
        { path: 'courses', name: 'diklit-courses', component: () => import('../views/diklit/CourseList.vue'), meta: { requiresAuth: true, roles: ['diklit'] } },
        { path: 'reports', name: 'diklit-reports', component: () => import('../views/diklit/Report.vue'), meta: { requiresAuth: true, roles: ['diklit'] } },
        { path: 'payments', name: 'diklit-payments', component: () => import('../views/shared/Payments.vue'), meta: { requiresAuth: true, roles: ['diklit'] } },
        { path: 'settings/letter-numbers', name: 'diklit-letter-number-settings', component: () => import('../views/shared/LetterNumberSettings.vue'), meta: { requiresAuth: true, roles: ['diklit'] } },
      ],
    },
    {
      path: '/secretariat', component: () => import('../layouts/DashboardLayout.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] }, children: [
        { path: '', redirect: { name: 'secretariat-dashboard' } },
        { path: 'dashboard', name: 'secretariat-dashboard', component: () => import('../views/secretariat/Dashboard.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'applications', name: 'secretariat-applications', component: () => import('../views/secretariat/Applications.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'applications/:id', name: 'secretariat-application-detail', component: () => import('../views/secretariat/ApplicationDetail.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'reviewers', name: 'secretariat-reviewers', component: () => import('../views/secretariat/Reviewers.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'letters', name: 'secretariat-letters', component: () => import('../views/secretariat/Letters.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'history', name: 'secretariat-history', component: () => import('../views/secretariat/History.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'notifications', name: 'secretariat-notifications', component: () => import('../views/secretariat/Notifications.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'payments', name: 'secretariat-payments', component: () => import('../views/shared/Payments.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
        { path: 'settings/letter-numbers', name: 'secretariat-letter-number-settings', component: () => import('../views/shared/LetterNumberSettings.vue'), meta: { requiresAuth: true, roles: ['sekretariat'] } },
      ],
    },
    {
      path: '/reviewer', component: () => import('../layouts/DashboardLayout.vue'), meta: { requiresAuth: true, roles: ['reviewer'] }, children: [
        { path: '', redirect: { name: 'reviewer-dashboard' } },
        { path: 'dashboard', name: 'reviewer-dashboard', component: () => import('../views/reviewer/ReviewerDashboard.vue'), meta: { requiresAuth: true, roles: ['reviewer'] } },
        { path: 'tasks', name: 'reviewer-tasks', component: () => import('../views/reviewer/TaskList.vue'), meta: { requiresAuth: true, roles: ['reviewer'] } },
        { path: 'tasks/:id', name: 'reviewer-task-detail', component: () => import('../views/reviewer/Detail.vue'), meta: { requiresAuth: true, roles: ['reviewer'] } },
        { path: 'history', name: 'reviewer-history', component: () => import('../views/reviewer/History.vue'), meta: { requiresAuth: true, roles: ['reviewer'] } },
    ]},
    {
      path: '/chief', component: () => import('../layouts/DashboardLayout.vue'), meta: { requiresAuth: true, roles: ['ketua'] }, children: [
        { path: '', redirect: { name: 'chief-dashboard' } },
        { path: 'dashboard', name: 'chief-dashboard', component: () => import('../views/chief/Dashboard.vue'), meta: { requiresAuth: true, roles: ['ketua'] } },
        { path: 'peninjauan', name: 'chief-peninjauan', component: () => import('../views/chief/Peninjauan.vue'), meta: { requiresAuth: true, roles: ['ketua'] } },
        { path: 'history', name: 'chief-review', component: () => import('../views/chief/History.vue'), meta: { requiresAuth: true, roles: ['ketua'] } },
        { path: 'applications/:id', name: 'chief-application-detail', component: () => import('../views/chief/ApplicationDetail.vue'), meta: { requiresAuth: true, roles: ['ketua'] } },
        { path: 'approval', name: 'chief-approval', component: () => import('../views/chief/Approval.vue'), meta: { requiresAuth: true, roles: ['ketua'] } },
        { path: 'reports', name: 'chief-reports', component: () => import('../views/chief/Report.vue'), meta: { requiresAuth: true, roles: ['ketua'] } },
      ],
    },
  ],
})
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.initialized) await authStore.fetchCurrentUser()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.roles && Array.isArray(to.meta.roles)) {
    const userRoles = authStore.user?.roles ?? []
    const hasRequiredRole = (to.meta.roles as string[]).some(role => userRoles.includes(role))
    if (!hasRequiredRole) return getDashboardByRole(userRoles)
  }
  if (to.meta.guestOnly && authStore.isAuthenticated) return getDashboardByRole(authStore.user?.roles ?? [])
  return true
})
function getDashboardByRole(roles: string[]) {
  if (roles.includes('admin')) return { name: 'admin-dashboard' }
  if (roles.includes('diklit')) return { name: 'diklit-dashboard' }
  if (roles.includes('ketua')) return { name: 'chief-dashboard' }
  if (roles.includes('sekretariat')) return { name: 'secretariat-dashboard' }
  if (roles.includes('reviewer')) return { name: 'reviewer-dashboard' }
  if (roles.includes('peneliti')) return { name: 'research-dashboard' }
  return { name: 'dashboard' }
}
export default router
