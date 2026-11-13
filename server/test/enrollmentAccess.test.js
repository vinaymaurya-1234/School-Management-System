import test from "node:test";
import assert from "node:assert/strict";
import { buildEnrollmentAccessFilter } from "../src/utils/enrollmentAccess.js";

const school = "school-1";
const teacherSections = [
  { academicYear: "year-1", class: "class-1", section: "section-1" },
  { academicYear: "year-1", class: "class-2", section: "section-2" },
];

test("principal can query school enrollments with requested filters", () => {
  assert.deepEqual(buildEnrollmentAccessFilter({
    role: "principal", school, academicYear: "year-1", classId: "class-1",
  }), { school, academicYear: "year-1", class: "class-1" });
});

test("student enrollment query is always restricted to the signed-in student", () => {
  assert.deepEqual(buildEnrollmentAccessFilter({
    role: "student", school, userId: "student-user", academicYear: "year-1",
  }), { school, academicYear: "year-1", status: "active", student: "student-user" });
});

test("parent enrollment query is restricted to linked child accounts", () => {
  assert.deepEqual(buildEnrollmentAccessFilter({
    role: "parent", school, childUserIds: ["child-1", "child-2"],
  }), { school, status: "active", student: { $in: ["child-1", "child-2"] } });
});

test("teacher enrollment query is restricted to assigned class sections", () => {
  assert.deepEqual(buildEnrollmentAccessFilter({
    role: "teacher", school, assignedSections: teacherSections,
  }), {
    school, status: "active",
    $or: [
      { academicYear: "year-1", class: "class-1", section: "section-1" },
      { academicYear: "year-1", class: "class-2", section: "section-2" },
    ],
  });
});

test("teacher with no assignments and unsupported roles cannot query enrollments", () => {
  assert.equal(buildEnrollmentAccessFilter({ role: "teacher", school }), null);
  assert.equal(buildEnrollmentAccessFilter({ role: "accountant", school }), null);
});
