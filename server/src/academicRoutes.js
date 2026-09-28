import { Router } from "express";
import { AcademicYear, SchoolClass, Section } from "./models/Academic.js";
import { requireAuth, requirePermission } from "./middleware/auth.js";
import { PERMISSIONS, ROLES } from "./config/permissions.js";

const router = Router();
router.use(requireAuth);

function canManageAcademic(req) {
  return req.user.role === ROLES.PRINCIPAL;
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
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: "name, startDate and endDate are required" });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: "startDate must be before endDate" });
    }

    if (isActive) {
      await AcademicYear.updateMany({ school: req.user.school }, { $set: { isActive: false } });
    }

    const year = await AcademicYear.create({
      school: req.user.school,
      name: String(name).trim(),
      startDate,
      endDate,
      isActive,
    });

    res.status(201).json({ year });
  } catch (error) {
    next(error);
  }
});

router.get("/classes", async (req, res, next) => {
  try {
    const filter = { school: req.user.school };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    const classes = await SchoolClass.find(filter).sort({ order: 1 });
    res.json({ classes });
  } catch (error) {
    next(error);
  }
});

router.post("/classes", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can create classes" });

    const { academicYear, name, order } = req.body || {};
    if (!academicYear || !name || order === undefined) {
      return res.status(400).json({ message: "academicYear, name and order are required" });
    }

    const year = await AcademicYear.findOne({ _id: academicYear, school: req.user.school });
    if (!year) return res.status(404).json({ message: "Academic year not found" });

    const schoolClass = await SchoolClass.create({
      school: req.user.school,
      academicYear,
      name: String(name).trim(),
      order: Number(order),
    });

    res.status(201).json({ class: schoolClass });
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

    const sections = await Section.find(filter)
      .populate("class", "name order")
      .populate("classTeacher", "name email")
      .sort({ name: 1 });

    res.json({ sections });
  } catch (error) {
    next(error);
  }
});

router.post("/sections", async (req, res, next) => {
  try {
    if (!canManageAcademic(req)) return res.status(403).json({ message: "Only the principal can create sections" });

    const { academicYear, class: classId, name, classTeacher } = req.body || {};
    if (!academicYear || !classId || !name) {
      return res.status(400).json({ message: "academicYear, class and name are required" });
    }

    const schoolClass = await SchoolClass.findOne({ _id: classId, school: req.user.school, academicYear });
    if (!schoolClass) return res.status(404).json({ message: "Class not found for the academic year" });

    const section = await Section.create({
      school: req.user.school,
      academicYear,
      class: classId,
      name: String(name).trim(),
      classTeacher: classTeacher || undefined,
    });

    res.status(201).json({ section });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This section already exists for the class" });
    next(error);
  }
});

export default router;
