# School Management System Architecture

## Product model

The system is a single-school, role-based management platform. A school administrator/principal creates and manages user accounts. Students, teachers, parents and accountants do not self-register.

## Roles

- **Principal** — highest application access. Can manage school operations and all role-owned data.
- **Teacher** — sees and manages only assigned academic data such as classes, students, attendance, assignments and exams.
- **Student** — sees their own academic, attendance, timetable, result and fee information.
- **Parent** — sees information for their linked children only.
- **Accountant** — manages fee and payment workflows plus financial reports; no academic administration access.

## Authentication model

1. A user receives credentials created/provided by the school.
2. The login endpoint authenticates the credentials and returns a session/token.
3. The frontend stores only the authenticated user/session state.
4. Protected routes require authentication.
5. Role checks control which dashboard and frontend modules are visible.
6. The backend will enforce the same permissions; hiding a menu item is never treated as security.

## Planned modules

1. Authentication and user management
2. Principal dashboard
3. Teacher dashboard
4. Student dashboard
5. Parent dashboard
6. Accountant dashboard
7. Students
8. Teachers and staff
9. Parents and relationships
10. Classes, sections and subjects
11. Timetable
12. Attendance
13. Assignments
14. Examinations and results
15. Fees, payments and receipts
16. Leave management
17. Announcements and communication
18. Reports
19. School settings
20. Public admission application flow

## Admission flow (later phase)

The admission form will live on the school's public website. Submitted applications will appear in the Principal's **Admissions** module. After approval, the school can create the student/parent records and issue login credentials.

## Dashboard principles

Every role gets the same application shell but a role-specific navigation and dashboard. The Principal has the broadest view; other roles are constrained to their own or assigned records.

## Development phases

- **Phase 1:** application foundation, routing, authentication state and access-control model
- **Phase 2:** role dashboards and navigation
- **Phase 3:** academic modules
- **Phase 4:** attendance, timetable, exams and assignments
- **Phase 5:** fees and reports
- **Phase 6:** admissions and communication
- **Phase 7:** backend APIs, MongoDB, production authorization and audit/security hardening
