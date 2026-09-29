import { Router } from "express";
import {
  AcademicYear,
  SchoolClass,
  Section,
  StudentEnrollment,
  TeacherAssignment,
} from "./models/Academic.js";
import User from "./models/User.js";
import { requireAuth } from "./middleware/auth.js";
import { ROLES } from "./config/permissions.js";

const router = Router();
router.use(requireAuth);

function canManageAcademic(req) {
  return req.user.role === ROLES.PRINCIPAL;
}

function sectionNameFromIndex(index) {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

router.get("/years", async (req, res, next) => {
  try {
    const years = await AcademicYear.find({ school: req.user.school }).sort({ startDate: -1 });
    res.json({ years });
  } catch (error) {
    next(error);
  }
});

router.post("/years", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can create academic years" });
    const { name, startDate, endDate, isActive = false } = req.body || {};
    if (!name || !startDate || !endDate) return res.status(400).json({ message: "name, startDate and endDate are required" });
    if (new Date(startDate) >= new Date(endDate)) return res.status(400).json({ message: "startDate must be before endDate" });
    if (isActive) await AcademicYear.updateMany({ school: req.user.school }, { $set: { isActive: false } });
    const year = await AcademicYear.create({ school: req.user.school, name: String(name).trim(), startDate, endDate, isActive });
    res.status(201).json({ year });
  } catch (error) {
    next(error);
  }
});

router.post("/years/rollover", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can start a new academic year" });
    const { sourceYearId, name, startDate, endDate } = req.body || {};
    if (!sourceYearId || !name || !startDate || !endDate) return res.status(400).json({ message: "sourceYearId, name, startDate and endDate are required" });
    if (new Date(startDate) >= new Date(endDate)) return res.status(400).json({ message: "startDate must be before endDate" });
    const sourceYear = await AcademicYear.findOne({ _id: sourceYearId, school: req.user.school });
    if (!sourceYear) return res.status(404).json({ message: "Source academic year not found" });
    const existingYear = await AcademicYear.findOne({ school: req.user.school, name: String(name).trim() });
    if (existingYear) return res.status(409).json({ message: "This academic year already exists" });
    await AcademicYear.updateMany({ school: req.user.school }, { $set: { isActive: false } });
    const newYear = await AcademicYear.create({ school: req.user.school, name: String(name).trim(), startDate, endDate, isActive: true });
    const oldClasses = await SchoolClass.find({ school: req.user.school, academicYear: sourceYear._id }).sort({ order: 1 });
    for (const oldClass of oldClasses) {
      const newClass = await SchoolClass.create({ school: req.user.school, academicYear: newYear._id, name: oldClass.name, order: oldClass.order });
      const oldSections = await Section.find({ school: req.user.school, academicYear: sourceYear._id, class: oldClass._id });
      for (const oldSection of oldSections) {
        await Section.create({ school: req.user.school, academicYear: newYear._id, class: newClass._id, name: oldSection.name });
      }
    }
    res.status(201).json({ message: "New academic year created successfully. Class and section structure copied; students and teachers were not duplicated.", year: newYear, copiedClasses: oldClasses.length });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A class or section already exists in the new academic year" });
    next(error);
  }
});

router.get("/classes", async (req, res, next) => {
  try {
    const filter = { school: req.user.school };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    const classes = await SchoolClass.find(filter).sort({ order: 1 });
    res.json({ classes });
  } catch (error) { next(error); }
});

router.post("/classes", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can create classes" });
    const { academicYear, name, order } = req.body || {};
    if (!academicYear || !name || order === undefined) return res.status(400).json({ message: "academicYear, name and order are required" });
    const year = await AcademicYear.findOne({ _id: academicYear, school: req.user.school });
    if (!year) return res.status(404).json({ message: "Academic year not found" });

    const schoolClass = await SchoolClass.create({ school: req.user.school, academicYear, name: String(name).trim(), order: Number(order) });

    // Every new class starts with Section A automatically.
    const sectionA = await Section.create({
      school: req.user.school,
      academicYear,
      class: schoolClass._id,
      name: "A",
    });

    res.status(201).json({ class: schoolClass, section: sectionA, message: `Class ${schoolClass.name} created with Section A` });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This class already exists for the academic year" });
    next(error);
  }
});

router.get("/sections", async (req, res, next) => {
  try {
    const filter = { school: req.user.school };
    if (req.query.classId) filter.class = req.query.classId;
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    const sections = await Section.find(filter).populate("class", "name order").populate("classTeacher", "name email").sort({ name: 1 });
    res.json({ sections });
  } catch (error) { next(error); }
});

// Adds the next section automatically: A -> B -> C -> D ...
router.post("/classes/:classId/sections", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can add sections" });
    const { classId } = req.params;
    const { classTeacher } = req.body || {};
    const schoolClass = await SchoolClass.findOne({ _id: classId, school: req.user.school });
    if (!schoolClass) return res.status(404).json({ message: "Class not found" });

    const sectionCount = await Section.countDocuments({ school: req.user.school, academicYear: schoolClass.academicYear, class: classId });
    const name = sectionNameFromIndex(sectionCount);
    const section = await Section.create({
      school: req.user.school,
      academicYear: schoolClass.academicYear,
      class: classId,
      name,
      classTeacher: classTeacher || undefined,
    });
    res.status(201).json({ message: `Section ${name} created successfully`, section });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "The next section already exists. Please refresh and try again." });
    next(error);
  }
});

// Kept for controlled/internal imports; normal UI should use POST /classes/:classId/sections.
router.post("/sections", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can create sections" });
    const { academicYear, class: classId, name, classTeacher } = req.body || {};
    if (!academicYear || !classId || !name) return res.status(400).json({ message: "academicYear, class and name are required" });
    const schoolClass = await SchoolClass.findOne({ _id: classId, school: req.user.school, academicYear });
    if (!schoolClass) return res.status(404).json({ message: "Class not found for the academic year" });
    const section = await Section.create({ school: req.user.school, academicYear, class: classId, name: String(name).trim(), classTeacher: classTeacher || undefined });
    res.status(201).json({ section });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This section already exists for the class" });
    next(error);
  }
});

router.post("/enrollments", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can manage student enrollments" });
    const { academicYear, student, class: classId, section } = req.body || {};
    if (!academicYear || !student || !classId || !section) return res.status(400).json({ message: "academicYear, student, class and section are required" });
    const [year, studentUser, schoolClass, sectionDoc] = await Promise.all([
      AcademicYear.findOne({ _id: academicYear, school: req.user.school }),
      User.findOne({ _id: student, school: req.user.school, role: ROLES.STUDENT }),
      SchoolClass.findOne({ _id: classId, school: req.user.school, academicYear }),
      Section.findOne({ _id: section, school: req.user.school, academicYear, class: classId }),
    ]);
    if (!year) return res.status(404).json({ message: "Academic year not found" });
    if (!studentUser) return res.status(404).json({ message: "Student user not found" });
    if (!schoolClass || !sectionDoc) return res.status(404).json({ message: "Class or section not found for the academic year" });
    const enrollment = await StudentEnrollment.create({ school: req.user.school, academicYear, student, class: classId, section });
    res.status(201).json({ enrollment });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Student is already enrolled for this academic year" });
    next(error);
  }
});

router.get("/enrollments", async (req, res, next) => {
  try {
    const filter = { school: req.user.school };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.classId) filter.class = req.query.classId;
    if (req.query.sectionId) filter.section = req.query.sectionId;
    const enrollments = await StudentEnrollment.find(filter).populate("student", "name email").populate("class", "name order").populate("section", "name").sort({ createdAt: 1 });
    res.json({ enrollments });
  } catch (error) { next(error); }
});

router.post("/promotions", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can promote students" });
    const { sourceAcademicYear, targetAcademicYear, promotions } = req.body || {};
    if (!sourceAcademicYear || !targetAcademicYear || !Array.isArray(promotions) || promotions.length === 0) return res.status(400).json({ message: "sourceAcademicYear, targetAcademicYear and promotions are required" });
    const targetYear = await AcademicYear.findOne({ _id: targetAcademicYear, school: req.user.school });
    if (!targetYear) return res.status(404).json({ message: "Target academic year not found" });
    const results = [];
    for (const item of promotions) {
      const sourceEnrollment = await StudentEnrollment.findOne({ school: req.user.school, academicYear: sourceAcademicYear, student: item.student });
      if (!sourceEnrollment) continue;
      const targetClass = await SchoolClass.findOne({ _id: item.class, school: req.user.school, academicYear: targetAcademicYear });
      const targetSection = await Section.findOne({ _id: item.section, school: req.user.school, academicYear: targetAcademicYear, class: item.class });
      if (!targetClass || !targetSection) continue;
      await StudentEnrollment.updateOne({ _id: sourceEnrollment._id }, { $set: { status: item.status === "failed" ? "failed" : "promoted" } });
      const newEnrollment = await StudentEnrollment.create({ school: req.user.school, academicYear: targetAcademicYear, student: item.student, class: item.class, section: item.section, status: "active" });
      results.push(newEnrollment);
    }
    res.status(201).json({ message: "Student promotion completed", promotedCount: results.length, enrollments: results });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "One or more students already have an enrollment in the target academic year" });
    next(error);
  }
});

router.get("/teacher-assignments", async (req, res, next) => {
  try {
    const filter = { school: req.user.school };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.teacherId) filter.teacher = req.query.teacherId;
    const assignments = await TeacherAssignment.find(filter).populate("teacher", "name email").populate("class", "name order").populate("section", "name").sort({ createdAt: 1 });
    res.json({ assignments });
  } catch (error) { next(error); }
});

router.post("/teacher-assignments", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can manage teacher assignments" });
    const { academicYear, teacher, class: classId, section, subject, isClassTeacher = false } = req.body || {};
    if (!academicYear || !teacher) return res.status(400).json({ message: "academicYear and teacher are required" });
    const teacherUser = await User.findOne({ _id: teacher, school: req.user.school, role: ROLES.TEACHER, active: true });
    if (!teacherUser) return res.status(404).json({ message: "Teacher not found" });
    const assignment = await TeacherAssignment.create({ school: req.user.school, academicYear, teacher, class: classId || undefined, section: section || undefined, subject: subject || undefined, isClassTeacher });
    res.status(201).json({ assignment });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This teacher assignment already exists" });
    next(error);
  }
});

export default router;
