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

async function validateExamItems({ school, academicYear, classId, sectionId, items }) {
  const year = await AcademicYear.findOne({ _id: academicYear, school });
  const schoolClass = await SchoolClass.findOne({ _id: classId, school, academicYear });
  const section = await Section.findOne({ _id: sectionId, school, academicYear, class: classId });

  if (!year) return { error: [404, "Academic year not found"] };
  if (!schoolClass) return { error: [404, "Class not found"] };
  if (!section) return { error: [404, "Section does not belong to the selected class"] };
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return { error: [400, "Add between 1 and 30 exams"] };
  }

  const normalized = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    if (!item.subjectName?.trim() || !item.scheduledAt || !item.endsAt) {
      return { error: [400, `Exam ${index + 1}: subject, start time and end time are required`] };
    }

    const start = new Date(item.scheduledAt);
    const end = new Date(item.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { error: [400, `Exam ${index + 1}: invalid exam date or time`] };
    }
    if (end <= start) {
      return { error: [400, `Exam ${index + 1}: end time must be after the start time`] };
    }

    normalized.push({
      school,
      academicYear,
      class: classId,
      section: sectionId,
      subjectName: item.subjectName.trim(),
      scheduledAt: start,
      endsAt: end,
    });
  }

  return { year, normalized };
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

router.post("/bulk", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) {
      return res.status(403).json({ message: "Only the principal can create exams" });
    }

    const { academicYear, classId, sectionId, items } = req.body || {};
    const result = await validateExamItems({ school: req.user.school, academicYear, classId, sectionId, items });
    if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });

    const documents = result.normalized.map((item) => ({ ...item, createdBy: req.user._id }));
    const exams = await Exam.insertMany(documents, { ordered: true });
    const populated = await Exam.find({ _id: { $in: exams.map((exam) => exam._id) } })
      .populate("class", "name")
      .populate("section", "name")
      .sort({ scheduledAt: 1, subjectName: 1 });

    res.status(201).json({ message: `${populated.length} exams scheduled successfully`, exams: populated });
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
    const result = await validateExamItems({
      school: req.user.school,
      academicYear,
      classId,
      sectionId,
      items: [{ subjectName, scheduledAt, endsAt }],
    });
    if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });

    const exam = await Exam.create({ ...result.normalized[0], createdBy: req.user._id });
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
