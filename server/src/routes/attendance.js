import { Router } from "express";
import AttendanceSession from "../models/Attendance.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import { AcademicYear, Section, StudentEnrollment, TeacherAssignment } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

function normalizeDate(value) {
  const date = new Date(`${String(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function canEditSection(req, sectionId) {
  if (req.user.role === ROLES.PRINCIPAL) return true;
  if (req.user.role !== ROLES.TEACHER) return false;
  const section = await Section.findOne({ _id: sectionId, school: req.user.school }).select("classTeacher");
  if (section?.classTeacher?.toString() === req.user._id.toString()) return true;
  return Boolean(await TeacherAssignment.exists({ school: req.user.school, teacher: req.user._id, section: sectionId, isClassTeacher: true, status: "active" }));
}

router.get("/", async (req, res, next) => {
  try {
    const year = req.query.academicYear
      ? await AcademicYear.findOne({ _id: req.query.academicYear, school: req.user.school })
      : await AcademicYear.findOne({ school: req.user.school, isActive: true });
    if (!year) return res.json({ students: [], session: null });
    const date = normalizeDate(req.query.date || new Date().toISOString().slice(0, 10));
    if (!date) return res.status(400).json({ message: "Invalid date" });

    let sectionId = req.query.sectionId;
    if (req.user.role === ROLES.STUDENT) {
      const enrollment = await StudentEnrollment.findOne({ school: req.user.school, academicYear: year._id, student: req.user._id, status: "active" });
      sectionId = enrollment?.section;
    }
    if (req.user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: req.user._id, school: req.user.school }).select("children");
      const childIds = parent?.children || [];
      const students = await Student.find({ _id: { $in: childIds }, school: req.user.school }).select("user");
      const enrollments = await StudentEnrollment.find({ school: req.user.school, academicYear: year._id, student: { $in: students.map((s) => s.user) }, status: "active" }).select("section");
      sectionId = enrollments[0]?.section;
    }
    if (!sectionId) return res.json({ students: [], session: null, canEdit: false });

    const enrollments = await StudentEnrollment.find({ school: req.user.school, academicYear: year._id, section: sectionId, status: "active" })
      .populate("student", "name email").sort({ createdAt: 1 });
    const studentProfiles = await Student.find({ school: req.user.school, user: { $in: enrollments.map((item) => item.student?._id).filter(Boolean) } }).select("user admissionNumber name");
    const profileByUser = new Map(studentProfiles.map((item) => [item.user.toString(), item]));
    const session = await AttendanceSession.findOne({ school: req.user.school, academicYear: year._id, section: sectionId, date });
    const statusByStudent = new Map((session?.records || []).map((record) => [record.student.toString(), record]));

    const students = enrollments.map((enrollment, index) => {
      const user = enrollment.student;
      const profile = profileByUser.get(user._id.toString());
      const record = statusByStudent.get(user._id.toString());
      return {
        userId: user._id,
        profileId: profile?._id,
        name: user.name,
        email: user.email,
        admissionNumber: profile?.admissionNumber || "—",
        rollNumber: index + 1,
        status: record?.status || "present",
        note: record?.note || "",
      };
    });

    res.json({ students, session, canEdit: await canEditSection(req, sectionId), academicYear: year, sectionId });
  } catch (error) { next(error); }
});

router.get("/summary", async (req, res, next) => {
  try {
    let studentUserId = req.query.studentId || req.user._id;
    if (req.user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: req.user._id, school: req.user.school }).select("children");
      const student = await Student.findOne({ _id: req.query.studentId, school: req.user.school });
      if (!student || !parent?.children?.some((id) => id.toString() === student._id.toString())) return res.status(403).json({ message: "You are not linked to this student" });
      studentUserId = student.user;
    }
    const sessions = await AttendanceSession.find({ school: req.user.school, "records.student": studentUserId }).lean();
    let present = 0; let absent = 0; let late = 0; let halfDay = 0;
    sessions.forEach((session) => session.records.filter((record) => record.student.toString() === studentUserId.toString()).forEach((record) => {
      if (record.status === "present") present += 1;
      if (record.status === "absent") absent += 1;
      if (record.status === "late") late += 1;
      if (record.status === "half_day") halfDay += 1;
    }));
    const total = present + absent + late + halfDay;
    const percentage = total ? Math.round(((present + late + halfDay * 0.5) / total) * 1000) / 10 : 0;
    res.json({ total, present, absent, late, halfDay, percentage });
  } catch (error) { next(error); }
});

router.post("/session", async (req, res, next) => {
  try {
    const { academicYear, section, date, records = [] } = req.body || {};
    if (!academicYear || !section || !date || !Array.isArray(records)) return res.status(400).json({ message: "academicYear, section, date and records are required" });
    if (!(await canEditSection(req, section))) return res.status(403).json({ message: "You cannot edit attendance for this section" });
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return res.status(400).json({ message: "Invalid date" });
    const validStatuses = new Set(["present", "absent", "late", "half_day"]);
    const cleanRecords = records.map((record) => ({ student: record.student, status: validStatuses.has(record.status) ? record.status : "present", note: String(record.note || "").trim() }));
    const session = await AttendanceSession.findOneAndUpdate(
      { school: req.user.school, academicYear, section, date: normalizedDate },
      { $set: { markedBy: req.user._id, records: cleanRecords, submittedAt: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ message: "Attendance saved successfully", session });
  } catch (error) { next(error); }
});

export default router;
