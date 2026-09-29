import { Router } from "express";
import TimetableEntry from "../models/Timetable.js";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import { AcademicYear, Section, StudentEnrollment, TeacherAssignment } from "../models/Academic.js";
import { ClassSubject } from "../models/Subject.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const PERIODS = [
  ["08:00", "08:45"], ["08:45", "09:30"], ["09:45", "10:30"],
  ["10:30", "11:15"], ["11:30", "12:15"], ["12:15", "13:00"],
];

async function studentEnrollmentForUser(userId, schoolId, academicYear) {
  return StudentEnrollment.findOne({ school: schoolId, academicYear, student: userId, status: "active" });
}

async function parentChildUserIds(userId, schoolId) {
  const parent = await Parent.findOne({ user: userId, school: schoolId }).select("children");
  if (!parent) return [];
  const children = await Student.find({ _id: { $in: parent.children || [] }, school: schoolId }).select("user");
  return children.map((child) => child.user);
}

router.get("/", async (req, res, next) => {
  try {
    const year = req.query.academicYear
      ? await AcademicYear.findOne({ _id: req.query.academicYear, school: req.user.school })
      : await AcademicYear.findOne({ school: req.user.school, isActive: true });
    if (!year) return res.json({ entries: [] });

    const filter = { school: req.user.school, academicYear: year._id };
    if (req.query.sectionId) filter.section = req.query.sectionId;
    if (req.query.teacherId) filter.teacher = req.query.teacherId;

    if (req.user.role === ROLES.TEACHER) filter.teacher = req.user._id;
    if (req.user.role === ROLES.STUDENT) {
      const enrollment = await studentEnrollmentForUser(req.user._id, req.user.school, year._id);
      if (!enrollment) return res.json({ entries: [] });
      filter.section = enrollment.section;
    }
    if (req.user.role === ROLES.PARENT) {
      const childIds = await parentChildUserIds(req.user._id, req.user.school);
      if (!childIds.length) return res.json({ entries: [] });
      const enrollments = await StudentEnrollment.find({ school: req.user.school, academicYear: year._id, student: { $in: childIds }, status: "active" }).select("section");
      filter.section = { $in: enrollments.map((item) => item.section) };
    }

    const entries = await TimetableEntry.find(filter)
      .populate("teacher", "name email")
      .populate("subject", "name code")
      .populate("section", "name class")
      .sort({ day: 1, periodNumber: 1 });
    res.json({ entries, academicYear: year });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can set the timetable" });
    const { academicYear, section, teacher, subject, day, periodNumber, startTime, endTime, room, status = "draft" } = req.body || {};
    if (!academicYear || !section || !teacher || !subject || !day || !periodNumber || !startTime || !endTime) return res.status(400).json({ message: "academicYear, section, teacher, subject, day, periodNumber, startTime and endTime are required" });
    const existingSection = await Section.findOne({ _id: section, school: req.user.school, academicYear });
    const existingTeacher = await User.findOne({ _id: teacher, school: req.user.school, role: ROLES.TEACHER, active: true });
    if (!existingSection) return res.status(404).json({ message: "Section not found" });
    if (!existingTeacher) return res.status(404).json({ message: "Teacher not found" });

    const conflict = await TimetableEntry.findOne({ school: req.user.school, academicYear, day, periodNumber, $or: [{ section }, { teacher }] });
    if (conflict) return res.status(409).json({ message: conflict.section.toString() === section.toString() ? "This section already has a lesson in that period" : "This teacher is already teaching another section in that period" });

    const entry = await TimetableEntry.create({ school: req.user.school, academicYear, section, teacher, subject, day, periodNumber: Number(periodNumber), startTime, endTime, room, status });
    res.status(201).json({ message: "Timetable entry created", entry });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Timetable conflict: the section or teacher is already booked in that period" });
    next(error);
  }
});

router.post("/auto-generate", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can generate timetables" });
    const { academicYear, section } = req.body || {};
    if (!academicYear || !section) return res.status(400).json({ message: "academicYear and section are required" });
    const sectionDoc = await Section.findOne({ _id: section, school: req.user.school, academicYear });
    if (!sectionDoc) return res.status(404).json({ message: "Section not found" });

    const mappings = await ClassSubject.find({ school: req.user.school, academicYear, class: sectionDoc.class })
      .populate("subject", "name code")
      .lean();
    const assignments = await TeacherAssignment.find({ school: req.user.school, academicYear, class: sectionDoc.class, status: "active" })
      .populate("teacher", "name")
      .lean();
    if (!mappings.length) return res.status(400).json({ message: "No subjects are mapped to this class yet. Add subjects and teacher assignments first." });

    const existing = await TimetableEntry.find({ school: req.user.school, academicYear, $or: [{ section }, { teacher: { $in: assignments.map((item) => item.teacher) } }] }).lean();
    const sectionBusy = new Set(existing.filter((item) => item.section.toString() === section.toString()).map((item) => `${item.day}:${item.periodNumber}`));
    const teacherBusy = new Set(existing.map((item) => `${item.teacher.toString()}:${item.day}:${item.periodNumber}`));

    const missingTeachers = [];
    const conflicts = [];
    const created = [];

    for (const mapping of mappings) {
      const weeklyPeriods = Math.min(Number(mapping.weeklyPeriods) || 1, DAYS.length * PERIODS.length);
      const candidates = assignments.filter((item) => item.subject?.toString() === mapping.subject._id.toString() && (!item.section || item.section.toString() === section.toString()));
      const assignment = candidates[0];
      if (!assignment?.teacher) {
        missingTeachers.push(mapping.subject?.name || "Unknown subject");
        continue;
      }
      let placed = 0;
      for (const day of DAYS) {
        for (let periodIndex = 0; periodIndex < PERIODS.length; periodIndex += 1) {
          if (placed >= weeklyPeriods) break;
          const periodNumber = periodIndex + 1;
          const key = `${day}:${periodNumber}`;
          const teacherKey = `${assignment.teacher._id || assignment.teacher}:${day}:${periodNumber}`;
          if (sectionBusy.has(key) || teacherBusy.has(teacherKey)) continue;
          const [startTime, endTime] = PERIODS[periodIndex];
          const entry = await TimetableEntry.create({
            school: req.user.school, academicYear, section, teacher: assignment.teacher._id || assignment.teacher,
            subject: mapping.subject._id, day, periodNumber, startTime, endTime, room: "", status: "draft",
          });
          sectionBusy.add(key); teacherBusy.add(teacherKey); created.push(entry); placed += 1;
        }
        if (placed >= weeklyPeriods) break;
      }
      if (placed < weeklyPeriods) conflicts.push(`${mapping.subject?.name || "Subject"}: only ${placed}/${weeklyPeriods} periods could be placed`);
    }

    res.status(201).json({ message: "Timetable generation completed", createdCount: created.length, missingTeachers, conflicts });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A timetable conflict occurred while generating the schedule. Refresh and try again." });
    next(error);
  }
});

router.patch("/:id/publish", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can publish a timetable" });
    const entry = await TimetableEntry.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, { status: "published" }, { new: true });
    if (!entry) return res.status(404).json({ message: "Timetable entry not found" });
    res.json({ message: "Timetable entry published", entry });
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can delete timetable entries" });
    const entry = await TimetableEntry.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!entry) return res.status(404).json({ message: "Timetable entry not found" });
    res.json({ message: "Timetable entry deleted" });
  } catch (error) { next(error); }
});

export default router;
