import { Router } from "express";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";
import { StudentEnrollment, Section } from "../models/Academic.js";
import TimetableEntry from "../models/Timetable.js";

const router = Router();
router.use(requireAuth);

async function getParentForUser(user) {
  return Parent.findOne({ user: user._id, school: user.school }).populate({
    path: "children",
    populate: { path: "user", select: "name email active" },
  });
}

router.get("/me", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PARENT) return res.status(403).json({ message: "Parent access required" });
    const parent = await getParentForUser(req.user);
    if (!parent) return res.status(404).json({ message: "Parent profile not found" });
    res.json({ parent });
  } catch (error) { next(error); }
});

router.get("/me/children", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PARENT) return res.status(403).json({ message: "Parent access required" });
    const parent = await getParentForUser(req.user);
    if (!parent) return res.status(404).json({ message: "Parent profile not found" });
    res.json({ children: parent.children || [] });
  } catch (error) { next(error); }
});

router.post("/link-student", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can link a parent" });
    const { parentUserId, studentId, relationship, phone } = req.body || {};
    const [parentUser, student] = await Promise.all([
      User.findOne({ _id: parentUserId, school: req.user.school, role: ROLES.PARENT }),
      Student.findOne({ _id: studentId, school: req.user.school }),
    ]);
    if (!parentUser) return res.status(404).json({ message: "Parent user not found" });
    if (!student) return res.status(404).json({ message: "Student not found" });
    const parent = await Parent.findOneAndUpdate(
      { user: parentUser._id, school: req.user.school },
      { $setOnInsert: { user: parentUser._id, school: req.user.school }, $set: { relationship: relationship || "Parent", phone: phone || "" }, $addToSet: { children: student._id } },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: "Parent linked to student successfully", parent });
  } catch (error) { next(error); }
});

router.get("/me/children/:studentId/timetable", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PARENT) return res.status(403).json({ message: "Parent access required" });
    const parent = await Parent.findOne({ user: req.user._id, school: req.user.school }).select("children");
    if (!parent?.children?.some((id) => id.toString() === req.params.studentId)) return res.status(403).json({ message: "You are not linked to this student" });
    const student = await Student.findOne({ _id: req.params.studentId, school: req.user.school });
    if (!student) return res.status(404).json({ message: "Student not found" });
    const enrollment = await StudentEnrollment.findOne({ school: req.user.school, student: student.user, status: "active" }).sort({ createdAt: -1 });
    if (!enrollment) return res.json({ entries: [] });
    const entries = await TimetableEntry.find({ school: req.user.school, academicYear: enrollment.academicYear, section: enrollment.section, status: "published" })
      .populate("teacher", "name")
      .populate("subject", "name code")
      .populate("section", "name")
      .sort({ day: 1, periodNumber: 1 });
    res.json({ entries });
  } catch (error) { next(error); }
});

export default router;
