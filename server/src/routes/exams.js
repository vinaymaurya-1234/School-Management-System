import { Router } from "express";
import Exam from "../models/Exam.js";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import { AcademicYear, SchoolClass, Section, StudentEnrollment } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

async function activeYearForSchool(schoolId, academicYearId) {
  if (academicYearId) {
    return AcademicYear.findOne({ _id: academicYearId, school: schoolId });
  }
  return AcademicYear.findOne({ school: schoolId, isActive: true });
}

async function studentScope(userId, schoolId, academicYearId) {
  return StudentEnrollment.findOne({
    student: userId,
    school: schoolId,
    academicYear: academicYearId,
    status: "active",
  }).select("class section");
}

async function parentScope(userId, schoolId, academicYearId) {
  const parent = await Parent.findOne({ user: userId, school: schoolId }).select("children");
  if (!parent?.children?.length) return null;

  const children = await Student.find({
    _id: { $in: parent.children },
    school: schoolId,
    active: true,
  }).select("user");
  const childUserIds = children.map((child) => child.user);
  return StudentEnrollment.find({
    student: { $in: childUserIds },
    school: schoolId,
    academicYear: academicYearId,
    status: "active",
  }).select("class section student");
}

router.get("/", async (req, res, next) => {
  try {
    const year = await activeYearForSchool(req.user.school, req.query.academicYear);
    if (!year) return res.json({ exams: [], academicYear: null });

    const filter = { school: req.user.school, academicYear: year._id };

    if (req.user.role === ROLES.STUDENT) {
      const enrollment = await studentScope(req.user._id, req.user.school, year._id);
      if (!enrollment) return res.json({ exams: [], academicYear: year });
      filter.class = enrollment.class;
      filter.section = enrollment.section;
    }

    if (req.user.role === ROLES.PARENT) {
      const enrollments = await parentScope(req.user._id, req.user.school, year._id);
      if (!enrollments?.length) return res.json({ exams: [], academicYear: year });
      filter.$or = enrollments.map((item) => ({ class: item.class, section: item.section }));
    }

    if (req.query.classId && [ROLES.PRINCIPAL, ROLES.TEACHER].includes(req.user.role)) {
      filter.class = req.query.classId;
    }
    if (req.query.sectionId && [ROLES.PRINCIPAL, ROLES.TEACHER].includes(req.user.role)) {
      filter.section = req.query.sectionId;
    }

    const exams = await Exam.find(filter)
      .populate("class", "name")
      .populate("section", "name")
      .sort({ scheduledAt: 1, subjectName: 1 });

    res.json({ exams, academicYear: year });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) {
      return res.status(403).json({ message: "Only the principal can create exams" });
    }

    const { academicYear, classId, sectionId, subjectName, scheduledAt, endsAt } = req.body || {};
    if (!academicYear || !classId || !sectionId || !subjectName?.trim() || !scheduledAt || !endsAt) {
      return res.status(400).json({ message: "Class, section, subject name, start time and end time are required" });
    }

    const year = await AcademicYear.findOne({ _id: academicYear, school: req.user.school });
    const schoolClass = await SchoolClass.findOne({ _id: classId, school: req.user.school, academicYear });
    const section = await Section.findOne({ _id: sectionId, school: req.user.school, academicYear, class: classId });
    if (!year) return res.status(404).json({ message: "Academic year not found" });
    if (!schoolClass) return res.status(404).json({ message: "Class not found" });
    if (!section) return res.status(404).json({ message: "Section does not belong to the selected class" });

    const start = new Date(scheduledAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid exam start or end time" });
    }
    if (end <= start) {
      return res.status(400).json({ message: "Exam end time must be after the start time" });
    }

    const exam = await Exam.create({
      school: req.user.school,
      academicYear,
      class: classId,
      section: sectionId,
      subjectName: subjectName.trim(),
      scheduledAt: start,
      endsAt: end,
      createdBy: req.user._id,
    });

    const populated = await Exam.findById(exam._id)
      .populate("class", "name")
      .populate("section", "name");

    res.status(201).json({ message: "Exam scheduled successfully", exam: populated });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) {
      return res.status(403).json({ message: "Only the principal can remove exams" });
    }
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json({ message: "Exam removed successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
