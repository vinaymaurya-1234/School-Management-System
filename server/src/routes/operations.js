import { Router } from "express";
import SchoolOperation from "../models/SchoolOperation.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
const MANAGEABLE = new Set([ROLES.PRINCIPAL]);
const MODULES = new Set(["subjects", "timetable", "attendance", "fees", "exams", "notices", "events", "payroll"]);

router.use(requireAuth);

function canManage(req) {
  return MANAGEABLE.has(req.user.role);
}

router.get("/:module", async (req, res, next) => {
  try {
    const { module } = req.params;
    if (!MODULES.has(module)) return res.status(400).json({ message: "Invalid operation module" });
    const filter = { school: req.user.school, module, active: true };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
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
    if (!canManage(req)) return res.status(403).json({ message: "Only the principal can manage this module" });
    const { module } = req.params;
    if (!MODULES.has(module)) return res.status(400).json({ message: "Invalid operation module" });
    const { title, data = {}, academicYear } = req.body || {};
    if (!title || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({ message: "title and object data are required" });
    }
    const record = await SchoolOperation.create({
      school: req.user.school,
      module,
      title: String(title).trim(),
      data,
      academicYear: academicYear || undefined,
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
