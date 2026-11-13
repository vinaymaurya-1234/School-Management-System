# School Management System

A full-stack school ERP with separate role-based workspaces for Principal, Teacher, Student, Parent and Accountant.

## Architecture

- **Client:** React, Vite, React Router and Axios.
- **Server:** Node.js, Express and Socket.IO.
- **Database:** MongoDB with Mongoose.
- **Authentication:** JWT sessions with role and permission checks.
- **Communication:** Authenticated real-time messaging with MongoDB-backed conversation and attachment storage.

## Main modules

- Student admissions, profiles and parent/guardian links.
- Teacher directory, class/section setup and teaching assignments.
- Academic years, subjects and timetables.
- Student and staff attendance.
- Homework, submissions, exams, marks review and published results.
- Fee structures, instalments, payments, receipts and finance reports.
- Staff payroll and leave management.
- Notices, events, holidays and role-authorized messaging.

## Local development

### 1. Configure the backend

~~~bash
cd server
npm ci
cp .env.example .env
~~~

Set at least MONGODB_URI, JWT_SECRET (use a long, random secret) and CLIENT_URL (normally http://localhost:5173).

Optional Razorpay credentials are only required when enabling online fee checkout.

Start the API:

~~~bash
npm run dev
~~~

The API defaults to http://localhost:5000/api.

### 2. Configure the frontend

In another terminal:

~~~bash
cd client
npm ci
npm run dev
~~~

The frontend defaults to the local API URL. To use another API host, create client/.env and set VITE_API_URL to the API base URL, including /api.

### 3. Create and use accounts

Use the school's authorized principal/bootstrap setup to create real accounts. There are no shared demo credentials in this repository. Student and parent access is linked to school records and enrollment relationships.

## Quality checks

From the repository root:

~~~bash
npm ci --prefix client
npm run lint --prefix client
npm run build --prefix client

npm ci --prefix server
npm test --prefix server
find server/src -type f -name '*.js' -print0 | xargs -0 -n1 node --check
~~~

GitHub Actions runs the same client lint/build and backend syntax/test checks on the feature/school-system-foundation branch and pull requests.

## Security notes

- Keep real secrets in local environment files or your deployment secret manager; never commit them.
- API authorization must be enforced on the server, not only by hiding frontend navigation.
- Parent access is limited to linked children; teacher access is limited to assigned sections.
- Do not use production student data in development or screenshots.
- Run end-to-end checks with separate accounts for every role before deploying changes to a live school.
