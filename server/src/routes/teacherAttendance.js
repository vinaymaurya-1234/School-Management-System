import { Router } from "express";
import TeacherAttendance from "../models/TeacherAttendance.js";
import Teacher from "../models/Teacher.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

function principalOnly(req, res, next) {
  if (req.user.role !== ROLES.PRINCIPAL) {
    return res.status(403).json({ message: "Only the principal can manage teacher attendance" });
  }
  next();
}

function normalizeDate(value) {
  const date = new Date(`${String(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.use(principalOnly);

router.get("/", async (req, res, next) => {
  try {
    const date = normalizeDate(req.query.date || new Date().toISOString().slice(0, 10));
    if (!date) return res.status(400).json({ message: "Invalid date" });

    const teachers = await Teacher.find({ school: req.user.school })
      .populate({ path: "user", select: "name email active role" })
      .sort({ createdAt: 1 });

    const session = await TeacherAttendance.findOne({ school: req.user.school, date });
    const recordMap = new Map((session?.records || []).map((record) => [record.teacher.toString(), record]));

    const items = teachers
      .filter((teacher) => teacher.user)
      .map((teacher) => {
        const record = recordMap.get(teacher._id.toString());
        return {
          id: teacher._id,
          userId: teacher.user._id,
          name: teacher.user.name,
          email: teacher.user.email,
          active: teacher.user.active,
          employeeId: teacher.employeeId,
          designation: teacher.designation || "Teacher",
          department: teacher.department || "",
          status: record?.status || "present",
          note: record?.note || "",
        };
      });

    res.json({ teachers: items, session });
  } catch (error) {
    next(error);
  }
});

router.post("/session", async (req, res, next) => {
  try {
    const { date, records = [] } = req.body || {};
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ message: "date and records are required" });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return res.status(400).json({ message: "Invalid date" });

    const teachers = await Teacher.find({ school: req.user.school }).select("_id");
    const validTeacherIds = new Set(teachers.map((teacher) => teacher._id.toString()));
    const validStatuses = new Set(["present", "absent", "late", "on_leave"]);

    const cleanRecords = records
      .filter((record) => validTeacherIds.has(String(record.teacher)))
      .map((record) => ({
        teacher: record.teacher,
        status: validStatuses.has(record.status) ? record.status : "present",
        note: String(record.note || "").trim(),
      }));

    const session = await TeacherAttendance.findOneAndUpdate(
      { school: req.user.school, date: normalizedDate },
      { $set: { markedBy: req.user._id, records: cleanRecords, submittedAt: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ message: "Teacher attendance saved successfully", session });
  } catch (error) {
    next(error);
  }
});

export default router;
