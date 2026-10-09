import { Router } from "express";
import mongoose from "mongoose";
import AttendanceSession from "../models/Attendance.js";
import AttendanceNotification from "../models/AttendanceNotification.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import User from "../models/User.js";
import { AcademicYear, Section, StudentEnrollment, TeacherAssignment, SchoolClass } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = new Set(["present", "absent", "late", "half_day"]);

function normalizeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function sameId(left, right) {
  return Boolean(left && right && left.toString() === right.toString());
}

async function canEditSection(req, sectionId, academicYearId) {
  if (req.user.role === ROLES.PRINCIPAL) return true;
  if (req.user.role !== ROLES.TEACHER) return false;
  const section = await Section.findOne({ _id: sectionId, school: req.user.school, academicYear: academicYearId }).select("classTeacher");
  if (sameId(section?.classTeacher, req.user._id)) return true;
  return Boolean(await TeacherAssignment.exists({
    school: req.user.school, academicYear: academicYearId, teacher: req.user._id,
    section: sectionId, isClassTeacher: true, status: "active",
  }));
}

async function canViewSection(req, sectionId, academicYearId) {
  if (req.user.role === ROLES.PRINCIPAL) return true;
  if (req.user.role !== ROLES.TEACHER) return false;
  const section = await Section.findOne({ _id: sectionId, school: req.user.school, academicYear: academicYearId }).select("classTeacher");
  if (sameId(section?.classTeacher, req.user._id)) return true;
  return Boolean(await TeacherAssignment.exists({
    school: req.user.school, academicYear: academicYearId, teacher: req.user._id,
    section: sectionId, status: "active",
  }));
}

async function notifyParentsOfAbsences({ schoolId, academicYearId, sectionId, date, sessionId, absentUserIds }) {
  if (!absentUserIds.length) return;
  const studentProfiles = await Student.find({ school: schoolId, user: { $in: absentUserIds } }).select("_id user name");
  if (!studentProfiles.length) return;
  const profileByUser = new Map(studentProfiles.map((profile) => [profile.user.toString(), profile]));
  const parents = await Parent.find({ school: schoolId, children: { $in: studentProfiles.map((profile) => profile._id) } }).select("user children");
  const classSection = await Section.findOne({ _id: sectionId, school: schoolId }).populate("class", "name").select("name class");
  const messages = [];
  for (const parent of parents) {
    for (const childId of parent.children) {
      const child = studentProfiles.find((profile) => sameId(profile._id, childId));
      if (!child || !absentUserIds.some((id) => sameId(id, child.user))) continue;
      messages.push({
        school: schoolId, parent: parent.user, student: child.user, session: sessionId,
        academicYear: academicYearId, date,
        title: "Student marked absent",
        message: `${child.name} was marked absent on ${date.toISOString().slice(0, 10)}${classSection ? ` for Class ${classSection.class?.name || ""} Section ${classSection.name}` : ""}.`,
      });
    }
  }
  if (messages.length) {
    await AttendanceNotification.bulkWrite(messages.map((message) => ({
      updateOne: {
        filter: { parent: message.parent, student: message.student, session: message.session },
        update: { $setOnInsert: message },
        upsert: true,
      },
    })));
  }
}

router.get("/", async (req, res, next) => {
  try {
    const year = req.query.academicYear
      ? await AcademicYear.findOne({ _id: req.query.academicYear, school: req.user.school })
      : await AcademicYear.findOne({ school: req.user.school, isActive: true });
    if (!year) return res.json({ students: [], session: null, canEdit: false });
    const date = normalizeDate(req.query.date || new Date().toISOString().slice(0, 10));
    if (!date) return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." });

    let sectionId = req.query.sectionId;
    let ownStudentUserIds = null;

    if (req.user.role === ROLES.STUDENT) {
      const enrollment = await StudentEnrollment.findOne({ school: req.user.school, academicYear: year._id, student: req.user._id, status: "active" });
      sectionId = enrollment?.section;
      ownStudentUserIds = [req.user._id];
    } else if (req.user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: req.user._id, school: req.user.school }).select("children");
      const profiles = await Student.find({ _id: { $in: parent?.children || [] }, school: req.user.school }).select("user");
      ownStudentUserIds = profiles.map((profile) => profile.user);
      const enrollment = await StudentEnrollment.findOne({ school: req.user.school, academicYear: year._id, student: { $in: ownStudentUserIds }, status: "active" });
      sectionId = enrollment?.section;
    }

    if (!sectionId) return res.json({ students: [], session: null, canEdit: false, academicYear: year });
    const section = await Section.findOne({ _id: sectionId, school: req.user.school, academicYear: year._id });
    if (!section) return res.status(404).json({ message: "Section not found for this academic year." });

    const canEdit = await canEditSection(req, sectionId, year._id);
    if ([ROLES.PRINCIPAL, ROLES.TEACHER].includes(req.user.role) && !(await canViewSection(req, sectionId, year._id))) {
      return res.status(403).json({ message: "You are not assigned to view this section's attendance." });
    }

    const enrollmentFilter = { school: req.user.school, academicYear: year._id, section: sectionId, status: "active" };
    if (ownStudentUserIds) enrollmentFilter.student = { $in: ownStudentUserIds };
    const enrollments = await StudentEnrollment.find(enrollmentFilter)
      .populate("student", "name email")
      .sort({ createdAt: 1 });
    const profiles = await Student.find({ school: req.user.school, user: { $in: enrollments.map((item) => item.student?._id).filter(Boolean) } }).select("user admissionNumber");
    const profileByUser = new Map(profiles.map((profile) => [profile.user.toString(), profile]));
    const session = await AttendanceSession.findOne({ school: req.user.school, academicYear: year._id, section: sectionId, date });
    const statusByStudent = new Map((session?.records || []).map((record) => [record.student.toString(), record]));
    const students = enrollments.map((enrollment, index) => {
      const student = enrollment.student;
      const profile = profileByUser.get(student._id.toString());
      const record = statusByStudent.get(student._id.toString());
      return {
        userId: student._id, name: student.name, email: student.email,
        admissionNumber: profile?.admissionNumber || "—", rollNumber: index + 1,
        status: record?.status || "not_marked", note: record?.note || "",
      };
    });
    res.json({ students, session, canEdit, academicYear: year, sectionId, submittedAt: session?.submittedAt || null });
  } catch (error) { next(error); }
});

router.get("/summary", async (req, res, next) => {
  try {
    let studentUserId = req.user._id;
    if (req.user.role === ROLES.PARENT) {
      const student = await Student.findOne({ _id: req.query.studentId, school: req.user.school });
      const parent = await Parent.findOne({ user: req.user._id, school: req.user.school }).select("children");
      if (!student || !parent?.children?.some((id) => sameId(id, student._id))) return res.status(403).json({ message: "You are not linked to this student." });
      studentUserId = student.user;
    } else if (req.user.role === ROLES.STUDENT) {
      if (req.query.studentId && !sameId(req.query.studentId, req.user._id)) return res.status(403).json({ message: "You can only view your own attendance." });
    } else if (req.user.role === ROLES.PRINCIPAL) {
      if (!req.query.studentId) return res.status(400).json({ message: "studentId is required." });
      const student = await Student.findOne({ school: req.user.school, user: req.query.studentId }).select("user");
      if (!student) return res.status(404).json({ message: "Student not found." });
      studentUserId = student.user;
    } else {
      return res.status(403).json({ message: "You cannot view this attendance summary." });
    }
    const sessions = await AttendanceSession.find({ school: req.user.school, "records.student": studentUserId }).lean();
    let present = 0; let absent = 0; let late = 0; let halfDay = 0;
    for (const session of sessions) for (const record of session.records) {
      if (!sameId(record.student, studentUserId)) continue;
      if (record.status === "present") present += 1;
      if (record.status === "absent") absent += 1;
      if (record.status === "late") late += 1;
      if (record.status === "half_day") halfDay += 1;
    }
    const total = present + absent + late + halfDay;
    const percentage = total ? Math.round(((present + late + halfDay * 0.5) / total) * 1000) / 10 : 0;
    res.json({ total, present, absent, late, halfDay, percentage });
  } catch (error) { next(error); }
});

router.get("/notifications", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PARENT) return res.status(403).json({ message: "Parent access required." });
    const notifications = await AttendanceNotification.find({ school: req.user.school, parent: req.user._id })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ notifications });
  } catch (error) { next(error); }
});

router.get("/pending", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can view pending attendance." });
    const year = req.query.academicYear
      ? await AcademicYear.findOne({ _id: req.query.academicYear, school: req.user.school })
      : await AcademicYear.findOne({ school: req.user.school, isActive: true });
    if (!year) return res.json({ pending: [], total: 0 });
    const date = normalizeDate(req.query.date || new Date().toISOString().slice(0, 10));
    if (!date) return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." });
    const sections = await Section.find({ school: req.user.school, academicYear: year._id }).populate("class", "name").populate("classTeacher", "name email").lean();
    const sessions = await AttendanceSession.find({ school: req.user.school, academicYear: year._id, date }).select("section submittedAt").lean();
    const completed = new Set(sessions.filter((item) => item.submittedAt).map((item) => item.section.toString()));
    const pending = sections.filter((section) => !completed.has(section._id.toString())).map((section) => ({
      sectionId: section._id, section: section.name, classId: section.class?._id,
      className: section.class?.name || "Class", classTeacher: section.classTeacher?.name || "Unassigned",
      status: "pending",
    }));
    res.json({ pending, total: pending.length, academicYear: year, date });
  } catch (error) { next(error); }
});

router.post("/session", async (req, res, next) => {
  try {
    const { academicYear, section: sectionId, date: dateValue, records } = req.body || {};
    if (!academicYear || !sectionId || !dateValue || !Array.isArray(records)) {
      return res.status(400).json({ message: "academicYear, section, date and records are required." });
    }
    if (!mongoose.isValidObjectId(academicYear) || !mongoose.isValidObjectId(sectionId)) return res.status(400).json({ message: "Invalid academic year or section." });
    const year = await AcademicYear.findOne({ _id: academicYear, school: req.user.school });
    const section = await Section.findOne({ _id: sectionId, school: req.user.school, academicYear });
    if (!year || !section) return res.status(404).json({ message: "Academic year or section not found." });
    if (!(await canEditSection(req, sectionId, academicYear))) return res.status(403).json({ message: "Only the class teacher or principal can submit attendance for this section." });
    const date = normalizeDate(dateValue);
    if (!date) return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." });
    if (date < new Date(`${year.startDate.toISOString().slice(0, 10)}T00:00:00.000Z`) || date > new Date(`${year.endDate.toISOString().slice(0, 10)}T00:00:00.000Z`)) {
      return res.status(400).json({ message: "Attendance date must be within the selected academic year." });
    }
    const enrollments = await StudentEnrollment.find({ school: req.user.school, academicYear, section: sectionId, status: "active" }).select("student");
    const enrolledIds = new Set(enrollments.map((item) => item.student.toString()));
    if (records.length !== enrolledIds.size) return res.status(400).json({ message: "Attendance must include every active student in this section exactly once." });
    const seen = new Set();
    const cleanRecords = [];
    for (const record of records) {
      if (!record?.student || !mongoose.isValidObjectId(record.student) || !enrolledIds.has(String(record.student))) return res.status(400).json({ message: "Attendance contains a student who is not actively enrolled in this section." });
      if (seen.has(String(record.student))) return res.status(400).json({ message: "Duplicate student attendance record detected." });
      if (!VALID_STATUSES.has(record.status)) return res.status(400).json({ message: "Mark every student as Present, Absent, Late or Half day before saving." });
      seen.add(String(record.student));
      cleanRecords.push({ student: record.student, status: record.status, note: String(record.note || "").trim().slice(0, 500) });
    }
    const previous = await AttendanceSession.findOne({ school: req.user.school, academicYear, section: sectionId, date });
    const session = await AttendanceSession.findOneAndUpdate(
      { school: req.user.school, academicYear, section: sectionId, date },
      { $set: { markedBy: req.user._id, records: cleanRecords, submittedAt: new Date() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const absentUserIds = cleanRecords.filter((record) => record.status === "absent").map((record) => record.student);
    await notifyParentsOfAbsences({ schoolId: req.user.school, academicYearId: academicYear, sectionId, date, sessionId: session._id, absentUserIds });
    res.json({ message: previous ? "Attendance updated successfully." : "Attendance submitted successfully.", session });
  } catch (error) { next(error); }
});

export default router;
