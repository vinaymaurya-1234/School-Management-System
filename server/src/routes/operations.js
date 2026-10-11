import { Router } from "express";
import SchoolOperation from "../models/SchoolOperation.js";
import { AcademicYear, Section, StudentEnrollment, TeacherAssignment, SchoolClass } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
const MANAGEABLE = new Set([ROLES.PRINCIPAL]);
const MODULES = new Set(["subjects", "timetable", "attendance", "fees", "exams", "notices", "events", "payroll", "communication", "assignments"]);

router.use(requireAuth);

function canManage(req) {
  return MANAGEABLE.has(req.user.role);
}

async function activeYearFor(school) {
  return AcademicYear.findOne({ school, isActive: true }).sort({ startDate: -1 });
}

router.get("/:module", async (req, res, next) => {
  try {
    const { module } = req.params;
    if (!MODULES.has(module)) return res.status(400).json({ message: "Invalid operation module" });
    const filter = { school: req.user.school, module, active: true };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;

    if (module === "notices") {
      // Audience is enforced server-side so users cannot see notices for another role.
      const roleAudience = {
        [ROLES.TEACHER]: ["teachers", "all"],
        [ROLES.STUDENT]: ["students", "all"],
        [ROLES.PARENT]: ["parents", "all"],
      };
      if (roleAudience[req.user.role]) {
        filter["data.audienceKey"] = { $in: roleAudience[req.user.role] };
      } else if (!canManage(req)) {
        return res.status(403).json({ message: "You cannot view school notices" });
      }
    }

    if (module === "assignments" && req.user.role === ROLES.TEACHER) {
      // Teachers only see assignments they authored.
      filter.createdBy = req.user._id;
    } else if (module === "assignments" && req.user.role === ROLES.STUDENT) {
      // Never accept a student ID from the client; scope results to the signed-in student's active enrollment.
      const year = await activeYearFor(req.user.school);
      if (!year) return res.json({ records: [], count: 0 });
      const enrollment = await StudentEnrollment.findOne({
        school: req.user.school,
        academicYear: year._id,
        student: req.user._id,
        status: "active",
      }).select("class section academicYear");
      if (!enrollment) return res.json({ records: [], count: 0 });
      filter.academicYear = enrollment.academicYear;
      filter["data.classId"] = String(enrollment.class);
      filter["data.sectionId"] = String(enrollment.section);
    } else if (!canManage(req) && ![ROLES.TEACHER, ROLES.STUDENT].includes(req.user.role)) {
      return res.status(403).json({ message: "You cannot view this module" });
    }

    const records = await SchoolOperation.find(filter)
      .populate("createdBy", "name email")
      .populate("academicYear", "name")
      .sort({ createdAt: -1 });
    res.json({ records, count: records.length });
  } catch (error) {
    next(error);
  }
});

router.post("/:module", async (req, res, next) => {
  try {
    const { module } = req.params;
    if (!MODULES.has(module)) return res.status(400).json({ message: "Invalid operation module" });
    if (module === "notices" && !canManage(req)) {
      return res.status(403).json({ message: "Only the principal can publish school notices" });
    }
    if (!canManage(req) && !(req.user.role === ROLES.TEACHER && ["communication", "assignments"].includes(module))) {
      return res.status(403).json({ message: "You cannot create records in this module" });
    }

    const { title, data = {}, academicYear } = req.body || {};
    if (!title?.trim?.() || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({ message: "title and object data are required" });
    }

    let resolvedYear = academicYear || null;
    if (module === "notices") {
      const audienceKey = String(data.audienceKey || "").toLowerCase();
      const allowedAudiences = new Set(["teachers", "students", "parents", "all"]);
      const noticeCategories = new Set(["General Notice", "Holiday", "Examination", "Event", "Meeting", "Fee Update", "Urgent Notice"]);
      if (!allowedAudiences.has(audienceKey)) {
        return res.status(400).json({ message: "Choose who should receive this notice" });
      }
      if (!noticeCategories.has(String(data.category || ""))) {
        return res.status(400).json({ message: "Choose a valid notice subject" });
      }
      data.audienceKey = audienceKey;
      data.audience = ({ teachers: "Teachers", students: "Students", parents: "Parents", all: "All" })[audienceKey];
      data.category = String(data.category);
    }

    if (module === "assignments" && req.user.role === ROLES.TEACHER) {
      const { classId, sectionId, message, dueDate, subject } = data;
      if (!classId || !sectionId || !String(message || "").trim()) {
        return res.status(400).json({ message: "Subject, class, section and assignment instructions are required" });
      }
      const year = resolvedYear
        ? await AcademicYear.findOne({ _id: resolvedYear, school: req.user.school })
        : await activeYearFor(req.user.school);
      if (!year || !year.isActive) return res.status(400).json({ message: "Select the active academic year" });

      const [schoolClass, section] = await Promise.all([
        SchoolClass.findOne({ _id: classId, school: req.user.school, academicYear: year._id }),
        Section.findOne({ _id: sectionId, school: req.user.school, academicYear: year._id, class: classId }),
      ]);
      if (!schoolClass || !section) return res.status(400).json({ message: "Choose a valid class and section" });

      const assignment = await TeacherAssignment.findOne({
        school: req.user.school,
        academicYear: year._id,
        teacher: req.user._id,
        class: classId,
        section: sectionId,
        status: "active",
      });
      if (!assignment) return res.status(403).json({ message: "You can only assign work to classes and sections in your teaching load" });

      resolvedYear = year._id;
      data.className = schoolClass.name;
      data.sectionName = section.name;
      data.classId = String(schoolClass._id);
      data.sectionId = String(section._id);
      data.message = String(message).trim();
      data.subject = String(subject || title).trim();
      data.dueDate = dueDate || null;
      data.teacherName = req.user.name || "";
      data.audience = "Students";
    }

    const record = await SchoolOperation.create({
      school: req.user.school,
      module,
      title: String(title).trim(),
      data,
      academicYear: resolvedYear || undefined,
      createdBy: req.user._id,
    });
    res.status(201).json({ message: `${module} record created successfully`, record });
  } catch (error) {
    next(error);
  }
});

router.put("/:module/:id", async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: "Only the principal can manage this module" });
    const { module, id } = req.params;
    if (!MODULES.has(module)) return res.status(400).json({ message: "Invalid operation module" });
    const updates = {};
    if (req.body?.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body?.data !== undefined) updates.data = req.body.data;
    if (req.body?.academicYear !== undefined) updates.academicYear = req.body.academicYear || undefined;
    const record = await SchoolOperation.findOneAndUpdate(
      { _id: id, school: req.user.school, module, active: true },
      updates,
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Record updated successfully", record });
  } catch (error) {
    next(error);
  }
});

router.delete("/:module/:id", async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: "Only the principal can manage this module" });
    const { module, id } = req.params;
    if (!MODULES.has(module)) return res.status(400).json({ message: "Invalid operation module" });
    const record = await SchoolOperation.findOneAndUpdate(
      { _id: id, school: req.user.school, module, active: true },
      { active: false },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Record archived successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
