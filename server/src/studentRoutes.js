import { Router } from "express";
import Student from "./models/Student.js";
import { requireAuth } from "./middleware/auth.js";
import { ROLES } from "./config/permissions.js";

const router = Router();

function canManageStudents(role) {
  return [ROLES.PRINCIPAL, ROLES.ADMIN, ROLES.ACCOUNTANT].includes(role);
}

function serializeStudent(student) {
  return {
    id: student._id,
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
    } = req.body || {};

    if (!admissionNumber || !name) {
      return res.status(400).json({ message: "admissionNumber and name are required" });
    }

    const existingStudent = await Student.findOne({
      school: req.user.school,
      admissionNumber: String(admissionNumber).trim(),
    });

    if (existingStudent) {
      return res.status(409).json({ message: "Admission number already exists" });
    }

    const student = await Student.create({
      school: req.user.school,
      admissionNumber: String(admissionNumber).trim(),
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
      message: "Student created successfully",
      student: serializeStudent(student),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const students = await Student.find({ school: req.user.school }).sort({ name: 1 });
    res.json({ students: students.map(serializeStudent) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, school: req.user.school });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

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
      "name",
      "dateOfBirth",
      "gender",
      "guardianName",
      "guardianPhone",
      "guardianEmail",
      "address",
      "admissionDate",
      "active",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) updates[field] = req.body[field];
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      updates,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

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
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student deactivated successfully", student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

export default router;
