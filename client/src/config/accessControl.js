export const ROLES = {
  PRINCIPAL: 'principal',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
  ACCOUNTANT: 'accountant',
}

export const ROLE_LABELS = {
  [ROLES.PRINCIPAL]: 'Principal',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.STUDENT]: 'Student',
  [ROLES.PARENT]: 'Parent',
  [ROLES.ACCOUNTANT]: 'Accountant',
}

export const ROLE_HOME_ROUTES = {
  [ROLES.PRINCIPAL]: '/dashboard/principal',
  [ROLES.TEACHER]: '/dashboard/teacher',
  [ROLES.STUDENT]: '/dashboard/student',
  [ROLES.PARENT]: '/dashboard/parent',
  [ROLES.ACCOUNTANT]: '/dashboard/accountant',
}

// Frontend visibility map. Backend authorization will mirror this model later.
export const ROLE_PERMISSIONS = {
  [ROLES.PRINCIPAL]: ['*'],
  [ROLES.TEACHER]: [
    'dashboard.view',
    'classes.view.assigned',
    'students.view.assigned',
    'timetable.view.assigned',
    'attendance.manage.assigned',
    'assignments.manage.assigned',
    'exams.manage.assigned',
    'profile.manage.own',
  ],
  [ROLES.STUDENT]: [
    'dashboard.view',
    'timetable.view.own',
    'attendance.view.own',
    'assignments.view.own',
    'exams.view.own',
    'results.view.own',
    'fees.view.own',
    'profile.manage.own',
  ],
  [ROLES.PARENT]: [
    'dashboard.view',
    'children.view.own',
    'attendance.view.children',
    'assignments.view.children',
    'exams.view.children',
    'results.view.children',
    'fees.view.children',
    'profile.manage.own',
  ],
  [ROLES.ACCOUNTANT]: [
    'dashboard.view',
    'students.view.basic',
    'fees.manage',
    'payments.manage',
    'receipts.manage',
    'financialReports.view',
    'profile.manage.own',
  ],
}

export function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes('*') || permissions.includes(permission)
}
