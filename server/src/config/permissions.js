export const ROLES = Object.freeze({
  PRINCIPAL: "principal",
  TEACHER: "teacher",
  STUDENT: "student",
  PARENT: "parent",
  ACCOUNTANT: "accountant",
});

export const RESPONSIBILITIES = Object.freeze({
  CLASS_TEACHER: "class_teacher",
  TIMETABLE_MANAGER: "timetable_manager",
  EXAM_COORDINATOR: "exam_coordinator",
  FEE_MANAGER: "fee_manager",
  NOTICE_MANAGER: "notice_manager",
  EVENT_MANAGER: "event_manager",
});

export const PERMISSIONS = Object.freeze({
  MANAGE_TIMETABLE: "manage_timetable",
  MANAGE_ATTENDANCE: "manage_attendance",
  MANAGE_EXAMS: "manage_exams",
  MANAGE_FEES: "manage_fees",
  MANAGE_NOTICES: "manage_notices",
  MANAGE_EVENTS: "manage_events",
});

const responsibilityPermissions = {
  [RESPONSIBILITIES.TIMETABLE_MANAGER]: [PERMISSIONS.MANAGE_TIMETABLE],
  [RESPONSIBILITIES.CLASS_TEACHER]: [PERMISSIONS.MANAGE_ATTENDANCE],
  [RESPONSIBILITIES.EXAM_COORDINATOR]: [PERMISSIONS.MANAGE_EXAMS],
  [RESPONSIBILITIES.FEE_MANAGER]: [PERMISSIONS.MANAGE_FEES],
  [RESPONSIBILITIES.NOTICE_MANAGER]: [PERMISSIONS.MANAGE_NOTICES],
  [RESPONSIBILITIES.EVENT_MANAGER]: [PERMISSIONS.MANAGE_EVENTS],
};

export function getPermissionsForUser(user) {
  if (!user) return [];
  if (user.role === ROLES.PRINCIPAL) return Object.values(PERMISSIONS);

  const permissions = new Set();
  for (const responsibility of user.responsibilities ?? []) {
    for (const permission of responsibilityPermissions[responsibility] ?? []) {
      permissions.add(permission);
    }
  }

  return [...permissions];
}

export function hasPermission(user, permission) {
  return getPermissionsForUser(user).includes(permission);
}
