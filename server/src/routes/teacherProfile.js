import { Router } from "express";
import Teacher from "../models/Teacher.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher account required" });
  next();
});

function serialize(teacher) {
  return {
    id: teacher._id,
    name: teacher.user?.name || reqNameFallback(teacher),
    email: teacher.user?.email || "",
    active: teacher.user?.active,
    role: teacher.user?.role,
    employeeId: teacher.employeeId,
    phone: teacher.phone,
    gender: teacher.gender,
    dateOfBirth: teacher.dateOfBirth,
    joiningDate: teacher.joiningDate,
    designation: teacher.designation,
    department: teacher.department,
    qualification: teacher.qualification,
    specialization: teacher.specialization,
    address: teacher.address,
    emergencyContact: teacher.emergencyContact,
    createdAt: teacher.createdAt,
    school: teacher.school,
  };
}
function reqNameFallback(teacher) { return ""; }

router.get("/me", async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id, school: req.user.school })
      .populate({ path: "user", select: "name email role active" })
      .populate({ path: "school", select: "name code address" });
    if (!teacher) return res.status(404).json({ message: "Teacher profile has not been created by the school yet." });
    res.json({ teacher: serialize(teacher), school: teacher.school });
  } catch (error) { next(error); }
});

router.put("/me", async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id, school: req.user.school });
    if (!teacher) return res.status(404).json({ message: "Teacher profile has not been created by the school yet." });
    const { phone, address, emergencyContact } = req.body || {};
    if (phone !== undefined) teacher.phone = String(phone).trim().slice(0, 30);
    if (address !== undefined) teacher.address = String(address).trim().slice(0, 500);
    if (emergencyContact !== undefined) {
      teacher.emergencyContact = {
        name: String(emergencyContact?.name || "").trim().slice(0, 100),
        phone: String(emergencyContact?.phone || "").trim().slice(0, 30),
        relation: String(emergencyContact?.relation || "").trim().slice(0, 60),
      };
    }
    await teacher.save();
    const saved = await Teacher.findById(teacher._id)
      .populate({ path: "user", select: "name email role active" })
      .populate({ path: "school", select: "name code address" });
    res.json({ message: "Your contact details have been saved.", teacher: serialize(saved), school: saved.school });
  } catch (error) { next(error); }
});

export default router;
