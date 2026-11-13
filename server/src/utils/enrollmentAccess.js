export function buildEnrollmentAccessFilter({
  role,
  school,
  userId,
  academicYear,
  classId,
  sectionId,
  assignedSections = [],
  childUserIds = [],
}) {
  const filter = { school };
  if (academicYear) filter.academicYear = academicYear;
  if (classId) filter.class = classId;
  if (sectionId) filter.section = sectionId;

  if (role === "principal") return filter;

  filter.status = "active";

  if (role === "student") {
    filter.student = userId;
    return filter;
  }

  if (role === "parent") {
    filter.student = { $in: childUserIds };
    return filter;
  }

  if (role === "teacher") {
    if (!assignedSections.length) return null;
    filter.$or = assignedSections.map(({ academicYear: yearId, class: classIdValue, section: sectionIdValue }) => ({
      academicYear: yearId,
      class: classIdValue,
      section: sectionIdValue,
    }));
    return filter;
  }

  return null;
}
