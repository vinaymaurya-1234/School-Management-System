# School Management System — Module Blueprint

A **module** is a major functional area of the school platform. Each module will contain one or more pages, APIs, permissions, and data models as implementation progresses.

## Module catalogue

| Module | Main pages / features | Primary access |
|---|---|---|
| Dashboard | Role-specific overview | All roles |
| Student Management | Students, add student, profile, documents | Principal, Teacher, Parent, Accountant |
| Teacher Management | Teachers, profile, schedule | Principal |
| Parent Management | Parents, profiles, children | Principal |
| Staff Management | Staff, departments, attendance, leave | Principal |
| Academic Management | Academic year, classes, sections, subjects, class teachers | Principal, Teacher |
| Classes & Sections | Classes, sections, class details | Principal, Teacher |
| Subjects | Subjects, details, teacher assignment | Principal, Teacher |
| Timetable | Class timetable, teacher timetable, schedules | Principal, Teacher, Student, Parent |
| Attendance | Student/teacher attendance and reports | Principal, Teacher, Student, Parent |
| Examinations | Exams, schedule, marks, results, report cards | Principal, Teacher, Student, Parent |
| Assignments | Create, submit, evaluate assignments | Principal, Teacher, Student, Parent |
| Fees & Payments | Fee structure, payments, pending fees, receipts, reports | Principal, Student, Parent, Accountant |
| Admissions | Applications, enquiries, review, approval | Principal |
| Communication | Announcements, notices, messages | Principal, Teacher, Student, Parent |
| Leave Management | Requests, own leave, approvals | Principal, Teacher, Student |
| Reports | Student, attendance, fee, exam, academic reports | Principal, Teacher, Accountant |
| School Settings | School profile, academic year, departments, system settings | Principal |

## Access principle

Role access describes what a user is allowed to enter. Data-level authorization will be stricter than menu visibility. For example, a teacher may access Student Management but only students assigned to that teacher's classes; a parent may access student information only for their linked children.

The Principal has administrative access across the platform. Accountant access is focused on financial workflows, while student and parent access is limited to their own or linked-child information.

## Implementation order

1. Dashboard and shared layout
2. Student and teacher management
3. Academic structure: academic year, classes, sections, subjects
4. Timetable
5. Attendance
6. Examinations and results
7. Assignments
8. Fees and payments
9. Communication and leave
10. Reports
11. Admissions
12. School settings
13. Backend APIs, database models, authentication and server-side authorization

This document is the product blueprint; individual screens and APIs will be implemented incrementally on the feature branch before merging to `main`.
