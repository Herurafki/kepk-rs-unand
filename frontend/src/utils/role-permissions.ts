const roleAliases: Record<string, string> = {
  sekretariat: 'sekretariat',
  ketua_reviewer: 'chief_reviewer',
  ketua: 'chief_reviewer',
}

export const normalizeRole = (role: string) => roleAliases[role] ?? role
export const hasAnyRole = (
  roles: readonly string[],
  required: readonly string[],
) =>
  required.some((role) =>
    roles.some((value) => normalizeRole(value) === normalizeRole(role)),
  )

export function getDashboardPath(roles: readonly string[]) {
  const dashboards = [
    ['admin', '/admin/dashboard'],
    ['diklit', '/diklit/dashboard'],
    ['chief_reviewer', '/chief/dashboard'],
    ['reviewer', '/reviewer/dashboard'],
    ['sekretariat', '/secretariat/dashboard'],
    ['peneliti', '/dashboard/profile'],
  ] as const
  return (
    dashboards.find(([role]) => hasAnyRole(roles, [role]))?.[1] ?? '/dashboard'
  )
}
