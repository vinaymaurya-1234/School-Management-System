import { Router } from "express";
import { AcademicYear, SchoolClass, TeacherAssignment } from "../models/Academic.js";
import { ClassSubject, Subject } from "../models/Subject.js";
import User from "../models/User.js";
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
    const { academicYear, name, code, isOptional = false, classId, weeklyPeriods = 5, teacherId, sectionId } = req.body || {};
    if (!academicYear || !name || !classId) return res.status(400).json({ message: "academicYear, name and classId are required" });
    const [year, schoolClass] = await Promise.all([
      AcademicYear.findOne({ _id: academicYear, school: req.user.school }),
      SchoolClass.findOne({ _id: classId, school: req.user.school, academicYear }),
    ]);
    if (!year) return res.status(404).json({ message: "Academic year not found" });
    if (!schoolClass) return res.status(404).json({ message: "Class not found for the academic year" });

    let subject = await Subject.findOne({ school: req.user.school, academicYear, name: String(name).trim() });
    if (!subject) subject = await Subject.create({ school: req.user.school, academicYear, name: String(name).trim(), code: String(code || "").trim().toUpperCase(), isOptional });

    const mapping = await ClassSubject.create({ school: req.user.school, academicYear, class: classId, subject: subject._id, weeklyPeriods: Number(weeklyPeriods) || 5 });

    if (teacherId) {
      const teacher = await User.findOne({ _id: teacherId, school: req.user.school, role: ROLES.TEACHER, active: true });
      if (!teacher) return res.status(404).json({ message: "Teacher not found" });

      // Use the TeacherAssignment document's save lifecycle instead of
      // findOneAndUpdate(). This keeps the single-class-per-teacher rule
      // active even when assignments are created from the Subjects module.
      const existing = await TeacherAssignment.findOne({
        school: req.user.school,
        academicYear,
        teacher: teacherId,
        class: classId,
        section: sectionId || null,
        subject: subject._id,
        status: "active",
      });

      if (!existing) {
        const assignment = new TeacherAssignment({
          school: req.user.school,
          academicYear,
          teacher: teacherId,
          class: classId,
          section: sectionId || undefined,
          subject: subject._id,
          isClassTeacher: false,
        });
        await assignment.save();
      }
    }

    res.status(201).json({ message: "Subject mapped successfully", subject, mapping });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This subject is already mapped to the selected class" });
    next(error);
  }
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
