import { Router } from "express";
import { AcademicYear, SchoolClass, TeacherAssignment } from "../models/Academic.js";
import { ClassSubject, Subject } from "../models/Subject.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

function principalOnly(req, res, next) {
  if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can manage subjects" });
  next();
}

router.get("/", async (req, res, next) => {
  try {
    const filter = { school: req.user.school };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.classId) filter.class = req.query.classId;

    const mappings = await ClassSubject.find(filter)
      .populate("class", "name order")
      .populate("subject", "name code isOptional")
      .sort({ createdAt: 1 });

    const assignmentFilter = { school: req.user.school, status: "active" };
    if (req.query.academicYear) assignmentFilter.academicYear = req.query.academicYear;
    if (req.query.classId) assignmentFilter.class = req.query.classId;
    const assignments = await TeacherAssignment.find(assignmentFilter)
      .populate("teacher", "name email")
      .populate("section", "name")
      .populate("subject", "name code")
      .lean();

    const records = mappings.map((mapping) => {
      const classId = mapping.class?._id?.toString();
      const subjectId = mapping.subject?._id?.toString();
      const subjectAssignments = assignments.filter((item) =>
        item.class?.toString() === classId && item.subject?._id?.toString() === subjectId
      );
      return {
        ...mapping.toObject(),
        teachers: subjectAssignments.map((item) => ({
          id: item.teacher?._id,
          name: item.teacher?.name,
          section: item.section?.name || "All sections",
          assignmentId: item._id,
        })),
      };
    });
    res.json({ subjects: records, count: records.length });
  } catch (error) { next(error); }
});

router.post("/", principalOnly, async (req, res, next) => {
  try {
    const { academicYear, name, classIds, classId, weeklyPeriods = 5, classFrequencies = {} } = req.body || {};
    const targets = [...new Set((Array.isArray(classIds) ? classIds : [classId]).filter(Boolean).map(String))];
    const cleanName = String(name || "").trim();
    if (!academicYear || !cleanName || !targets.length) {
      return res.status(400).json({ message: "Academic year, subject name and at least one class are required" });
    }
    const year = await AcademicYear.findOne({ _id: academicYear, school: req.user.school });
    if (!year) return res.status(404).json({ message: "Academic year not found" });
    const validClasses = await SchoolClass.find({ _id: { $in: targets }, school: req.user.school, academicYear });
    if (validClasses.length !== targets.length) return res.status(404).json({ message: "One or more classes were not found for this academic year" });

    let subject = await Subject.findOne({ school: req.user.school, academicYear, name: { $regex: new RegExp("^" + cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } });
    if (!subject) subject = await Subject.create({ school: req.user.school, academicYear, name: cleanName });

    const existingMappings = await ClassSubject.find({ school: req.user.school, academicYear, subject: subject._id, class: { $in: targets } }).select("class");
    const existingIds = new Set(existingMappings.map((item) => item.class.toString()));
    const created = [];
    for (const targetClass of targets) {
      if (existingIds.has(targetClass)) continue;
      const requestedFrequency = Number(classFrequencies[targetClass] ?? weeklyPeriods ?? 5);
      if (!Number.isInteger(requestedFrequency) || requestedFrequency < 1 || requestedFrequency > 36) {
        return res.status(400).json({ message: `Weekly lectures for class ${targetClass} must be a whole number between 1 and 36.` });
      }
      const mapping = await ClassSubject.create({
        school: req.user.school, academicYear, class: targetClass, subject: subject._id,
        weeklyPeriods: requestedFrequency,
      });
      created.push(mapping);
    }
    if (!created.length) return res.status(409).json({ message: "This subject is already assigned to all selected classes" });
    res.status(201).json({ message: "Subject saved and assigned to selected classes", subject, mappings: created });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This subject is already assigned to the selected class" });
    next(error);
  }
});

router.post("/assign", principalOnly, async (req, res, next) => {
  try {
    const { academicYear, subjectId, classIds, weeklyPeriods = 5, classFrequencies = {} } = req.body || {};
    const targets = [...new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean).map(String))];
    if (!academicYear || !subjectId || !targets.length) return res.status(400).json({ message: "Subject and at least one class are required" });
    const [year, subject, validClasses] = await Promise.all([
      AcademicYear.findOne({ _id: academicYear, school: req.user.school }),
      Subject.findOne({ _id: subjectId, school: req.user.school, academicYear }),
      SchoolClass.find({ _id: { $in: targets }, school: req.user.school, academicYear }),
    ]);
    if (!year) return res.status(404).json({ message: "Academic year not found" });
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    if (validClasses.length !== targets.length) return res.status(404).json({ message: "One or more classes were not found" });
    const existing = await ClassSubject.find({ school: req.user.school, academicYear, subject: subjectId, class: { $in: targets } }).select("class");
    const existingIds = new Set(existing.map((item) => item.class.toString()));
    const created = [];
    for (const targetClass of targets) {
      if (existingIds.has(targetClass)) continue;
      const requestedFrequency = Number(classFrequencies[targetClass] ?? weeklyPeriods ?? 5);
      if (!Number.isInteger(requestedFrequency) || requestedFrequency < 1 || requestedFrequency > 36) {
        return res.status(400).json({ message: `Weekly lectures for class ${targetClass} must be a whole number between 1 and 36.` });
      }
      created.push(await ClassSubject.create({
        school: req.user.school, academicYear, class: targetClass, subject: subjectId,
        weeklyPeriods: requestedFrequency,
      }));
    }
    if (!created.length) return res.status(409).json({ message: "This subject is already assigned to all selected classes" });
    res.status(201).json({ message: "Subject assigned to selected classes", mappings: created });
  } catch (error) { next(error); }
});

router.patch("/:mappingId/weekly-periods", principalOnly, async (req, res, next) => {
  try {
    const weeklyPeriods = Number(req.body?.weeklyPeriods);
    if (!Number.isInteger(weeklyPeriods) || weeklyPeriods < 1 || weeklyPeriods > 36) {
      return res.status(400).json({ message: "Weekly periods must be a whole number between 1 and 36." });
    }
    const mapping = await ClassSubject.findOneAndUpdate(
      { _id: req.params.mappingId, school: req.user.school },
      { $set: { weeklyPeriods } },
      { new: true, runValidators: true }
    ).populate("class", "name order").populate("subject", "name code");
    if (!mapping) return res.status(404).json({ message: "Subject-to-class assignment not found." });
    res.json({ message: "Weekly periods updated for this class.", mapping });
  } catch (error) { next(error); }
});

router.delete("/:mappingId", principalOnly, async (req, res, next) => {
  try {
    const mapping = await ClassSubject.findOneAndDelete({ _id: req.params.mappingId, school: req.user.school });
    if (!mapping) return res.status(404).json({ message: "Subject mapping not found" });
    await TeacherAssignment.deleteMany({ school: req.user.school, academicYear: mapping.academicYear, class: mapping.class, subject: mapping.subject });
    res.json({ message: "Subject removed from class successfully" });
  } catch (error) { next(error); }
});

export default router;
