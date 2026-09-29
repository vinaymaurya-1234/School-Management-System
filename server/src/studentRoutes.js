import { Router } from "express";
import Student from "./models/Student.js";
import User from "./models/User.js";
import { requireAuth } from "./middleware/auth.js";
import { ROLES } from "./config/permissions.js";

const router = Router();

function canManageStudents(role) {
  return [ROLES.PRINCIPAL, ROLES.ADMIN, ROLES.ACCOUNTANT].includes(role);
}

function serializeStudent(student) {
  return {
    id: student._id,
    userId: student.user?._id || student.user,
    school: student.school,
    admissionNumber: student.admissionNumber,
    name: student.name,
    dateOfBirth: student.dateOfBirth,
    gender: student.gender,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    guardianEmail: student.guardianEmail,
    address: student.address,
    admissionDate: student.admissionDate,
    active: student.active,
  };
}

router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    if (!canManageStudents(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to create students" });
    }

    const {
      admissionNumber,
      name,
      dateOfBirth,
      gender,
      guardianName,
      guardianPhone,
      guardianEmail,
      address,
      admissionDate,
      loginEmail,
      loginPassword,
    } = req.body || {};

    if (!admissionNumber || !name || !loginEmail || !loginPassword) {
      return res.status(400).json({
        message: "admissionNumber, name, loginEmail and loginPassword are required",
      });
    }

    const cleanAdmissionNumber = String(admissionNumber).trim();
    const cleanEmail = String(loginEmail).trim().toLowerCase();

    const [existingStudent, existingUser] = await Promise.all([
      Student.findOne({ school: req.user.school, admissionNumber: cleanAdmissionNumber }),
      User.findOne({ email: cleanEmail }),
    ]);

    if (existingStudent) {
      return res.status(409).json({ message: "Admission number already exists" });
    }

    if (existingUser) {
      return res.status(409).json({ message: "Login email already exists" });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      password: loginPassword,
      role: ROLES.STUDENT,
      school: req.user.school,
    });

    try {
      const student = await Student.create({
        user: user._id,
        school: req.user.school,
        admissionNumber: cleanAdmissionNumber,
        name: String(name).trim(),
        dateOfBirth,
        gender,
        guardianName,
        guardianPhone,
        guardianEmail,
        address,
        admissionDate,
      });

      return res.status(201).json({
        message: "Student user and profile created successfully",
        student: serializeStudent(student),
      });
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Student or login email already exists" });
    }
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const students = await Student.find({ school: req.user.school }).populate("user", "name email role active").sort({ name: 1 });
    res.json({ students: students.map(serializeStudent) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, school: req.user.school }).populate("user", "name email role active");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageStudents(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to update students" });
    }

    const allowedFields = [
      "name", "dateOfBirth", "gender", "guardianName", "guardianPhone",
      "guardianEmail", "address", "admissionDate", "active",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) updates[field] = req.body[field];
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      updates,
      { new: true, runValidators: true }
    ).populate("user", "name email role active");

    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student updated successfully", student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/deactivate", async (req, res, next) => {
  try {
    if (!canManageStudents(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to deactivate students" });
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      { active: false },
      { new: true }
    ).populate("user", "name email role active");

    if (!student) return res.status(404).json({ message: "Student not found" });

    await User.updateOne({ _id: student.user }, { active: false });

    res.json({ message: "Student and login deactivated successfully", student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

export default router;
