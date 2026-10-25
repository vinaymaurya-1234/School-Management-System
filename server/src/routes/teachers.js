import { Router } from "express";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();

function principalOnly(req, res, next) {
  if (req.user.role !== ROLES.PRINCIPAL) {
    return res.status(403).json({ message: "Only the principal can manage teachers" });
  }
  next();
}

function parseOptionalDate(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.status = 400;
    throw error;
  }

  return date;
}

function serializeTeacher(teacher) {
  return {
    id: teacher._id,
    user: teacher.user?._id || teacher.user,
    name: teacher.user?.name,
    email: teacher.user?.email,
    loginId: teacher.user?.loginId || null,
    mustChangePassword: Boolean(teacher.user?.mustChangePassword),
    active: teacher.user?.active,
    role: teacher.user?.role,
    responsibilities: teacher.user?.responsibilities || [],
    school: teacher.school,
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
    updatedAt: teacher.updatedAt,
  };
}

async function findTeacher(id, schoolId) {
  if (!mongoose.isValidObjectId(id)) return null;

  return Teacher.findOne({ _id: id, school: schoolId }).populate({
    path: "user",
    select: "name email role responsibilities active loginId mustChangePassword",
  });
}

router.use(requireAuth, principalOnly);


function temporaryPassword() { return randomBytes(9).toString("base64url"); }
async function uniqueTeacherLoginId() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const loginId = `TCH${new Date().getFullYear().toString().slice(-2)}${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!(await User.exists({ loginId }))) return loginId;
  }
  throw new Error("Could not generate a unique teacher login ID. Please try again.");
}

// Create teacher login and profile together, generating credentials like student/parent accounts.
router.post("/create-account", async (req, res, next) => {
  let user;
  try {
    const { name, email, phone, employeeId, designation = "Teacher", department = "Academic", qualification = "" } = req.body || {};
    if (!String(name || "").trim() || !String(email || "").trim() || !String(employeeId || "").trim()) {
      return res.status(400).json({ message: "Name, email and employee ID are required" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: "A user with this email already exists" });
    if (await Teacher.exists({ school: req.user.school, employeeId: String(employeeId).trim() })) return res.status(409).json({ message: "A teacher with this employee ID already exists" });
    const loginId = await uniqueTeacherLoginId();
    const password = temporaryPassword();
    user = await User.create({ name: String(name).trim(), email: normalizedEmail, loginId, password, mustChangePassword: true, role: ROLES.TEACHER, school: req.user.school });
    const teacher = await Teacher.create({ user: user._id, school: req.user.school, employeeId: String(employeeId).trim(), phone: String(phone || "").trim(), designation: String(designation || "Teacher").trim(), department: String(department || "Academic").trim(), qualification: String(qualification || "").trim() });
    const populated = await findTeacher(teacher._id, req.user.school);
    res.status(201).json({ message: "Teacher account created successfully", teacher: serializeTeacher(populated), credentials: { name: user.name, loginId, temporaryPassword: password } });
  } catch (error) {
    if (user?._id) await User.deleteOne({ _id: user._id, school: req.user.school }).catch(() => {});
    if (error?.code === 11000) return res.status(409).json({ message: "Email, login ID or employee ID already exists" });
    next(error);
  }
});

router.get("/credentials", async (req, res, next) => {
  try {
    const profiles = await Teacher.find({ school: req.user.school }).populate({ path: "user", select: "name email role active loginId mustChangePassword" }).sort({ createdAt: -1 });
    const teachers = profiles.filter((item) => item.user?.role === ROLES.TEACHER).map((item) => ({
      userId: item.user._id, teacherId: item._id, name: item.user.name, email: item.user.email,
      loginId: item.user.loginId || "", phone: item.phone || "", employeeId: item.employeeId,
      active: item.user.active !== false, mustChangePassword: Boolean(item.user.mustChangePassword),
    }));
    res.json({ teachers, count: teachers.length });
  } catch (error) { next(error); }
});

router.post("/credentials/:userId/reset", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, school: req.user.school, role: ROLES.TEACHER });
    if (!user) return res.status(404).json({ message: "Teacher account not found" });
    const profile = await Teacher.findOne({ user: user._id, school: req.user.school });
    if (!profile) return res.status(404).json({ message: "Teacher profile not found" });
    if (!user.loginId) user.loginId = await uniqueTeacherLoginId();
    const password = temporaryPassword();
    user.password = password;
    user.mustChangePassword = true;
    await user.save();
    res.json({ message: "Temporary teacher password reset", name: user.name, loginId: user.loginId, temporaryPassword: password });
  } catch (error) { next(error); }
});

// Create a teacher profile for an existing teacher login account.
router.post("/", async (req, res, next) => {
  try {
    const {
      userId,
      employeeId,
      phone,
      gender,
      dateOfBirth,
      joiningDate,
      designation,
      department,
      qualification,
      specialization,
      address,
      emergencyContact,
    } = req.body || {};

    if (!userId || !employeeId) {
      return res.status(400).json({ message: "userId and employeeId are required" });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const teacherUser = await User.findOne({
      _id: userId,
      school: req.user.school,
      role: ROLES.TEACHER,
    });

    if (!teacherUser) {
      return res.status(404).json({ message: "Teacher user not found in your school" });
    }

    const existingProfile = await Teacher.findOne({ user: teacherUser._id });
    if (existingProfile) {
      return res.status(409).json({ message: "Teacher profile already exists for this user" });
    }

    const normalizedEmployeeId = String(employeeId).trim();
    if (!normalizedEmployeeId) {
      return res.status(400).json({ message: "employeeId cannot be empty" });
    }

    const existingEmployee = await Teacher.findOne({
      school: req.user.school,
      employeeId: normalizedEmployeeId,
    });

    if (existingEmployee) {
      return res.status(409).json({ message: "A teacher with this employeeId already exists" });
    }

    const teacher = await Teacher.create({
      user: teacherUser._id,
      school: req.user.school,
      employeeId: normalizedEmployeeId,
      phone: String(phone || "").trim(),
      gender: gender || "",
      dateOfBirth: parseOptionalDate(dateOfBirth, "dateOfBirth"),
      joiningDate: parseOptionalDate(joiningDate, "joiningDate"),
      designation: String(designation || "Teacher").trim(),
      department: String(department || "").trim(),
      qualification: String(qualification || "").trim(),
      specialization: String(specialization || "").trim(),
      address: String(address || "").trim(),
      emergencyContact: {
        name: String(emergencyContact?.name || "").trim(),
        phone: String(emergencyContact?.phone || "").trim(),
        relation: String(emergencyContact?.relation || "").trim(),
      },
    });

    const populatedTeacher = await findTeacher(teacher._id, req.user.school);

    res.status(201).json({
      message: "Teacher profile created successfully",
      teacher: serializeTeacher(populatedTeacher),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Employee ID or teacher profile already exists" });
    }
    next(error);
  }
});

// List all teacher profiles belonging to the principal's school.
router.get("/", async (req, res, next) => {
  try {
    const { department, active } = req.query;
    const filter = { school: req.user.school };

    if (department) filter.department = String(department).trim();

    let teachers = await Teacher.find(filter)
      .populate({
        path: "user",
        select: "name email role responsibilities active",
      })
      .sort({ createdAt: -1 });

    if (active !== undefined) {
      if (!["true", "false"].includes(active)) {
        return res.status(400).json({ message: "active must be true or false" });
      }
      teachers = teachers.filter((teacher) => teacher.user?.active === (active === "true"));
    }

    res.json({ teachers: teachers.map(serializeTeacher), count: teachers.length });
  } catch (error) {
    next(error);
  }
});

// Get one teacher profile.
router.get("/:id", async (req, res, next) => {
  try {
    const teacher = await findTeacher(req.params.id, req.user.school);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

    res.json({ teacher: serializeTeacher(teacher) });
  } catch (error) {
    next(error);
  }
});

// Update teacher profile details and the linked teacher login account.
router.put("/:id", async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({
      _id: req.params.id,
      school: req.user.school,
    });

    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

    const {
      name,
      email,
      employeeId,
      phone,
      gender,
      dateOfBirth,
      joiningDate,
      designation,
      department,
      qualification,
      specialization,
      address,
      emergencyContact,
    } = req.body || {};

    const teacherUser = await User.findOne({
      _id: teacher.user,
      school: req.user.school,
      role: ROLES.TEACHER,
    });

    if (!teacherUser) {
      return res.status(404).json({ message: "Teacher login account not found" });
    }

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      teacherUser.name = normalizedName;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email cannot be empty" });
      }

      if (normalizedEmail !== teacherUser.email) {
        const existingUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: teacherUser._id },
        });

        if (existingUser) {
          return res.status(409).json({ message: "A user with this email already exists" });
        }
      }

      teacherUser.email = normalizedEmail;
    }

    if (employeeId !== undefined) {
      const normalizedEmployeeId = String(employeeId).trim();
      if (!normalizedEmployeeId) {
        return res.status(400).json({ message: "employeeId cannot be empty" });
      }

      const existingEmployee = await Teacher.findOne({
        school: req.user.school,
        employeeId: normalizedEmployeeId,
        _id: { $ne: teacher._id },
      });

      if (existingEmployee) {
        return res.status(409).json({ message: "A teacher with this employeeId already exists" });
      }

      teacher.employeeId = normalizedEmployeeId;
    }

    if (phone !== undefined) teacher.phone = String(phone).trim();
    if (gender !== undefined) teacher.gender = gender;
    if (dateOfBirth !== undefined) teacher.dateOfBirth = parseOptionalDate(dateOfBirth, "dateOfBirth");
    if (joiningDate !== undefined) teacher.joiningDate = parseOptionalDate(joiningDate, "joiningDate");
    if (designation !== undefined) teacher.designation = String(designation).trim();
    if (department !== undefined) teacher.department = String(department).trim();
    if (qualification !== undefined) teacher.qualification = String(qualification).trim();
    if (specialization !== undefined) teacher.specialization = String(specialization).trim();
    if (address !== undefined) teacher.address = String(address).trim();

    if (emergencyContact !== undefined) {
      teacher.emergencyContact = {
        name: String(emergencyContact?.name || "").trim(),
        phone: String(emergencyContact?.phone || "").trim(),
        relation: String(emergencyContact?.relation || "").trim(),
      };
    }

    await teacher.save();
    await teacherUser.save();

    const populatedTeacher = await findTeacher(teacher._id, req.user.school);

    res.json({
      message: "Teacher profile and login account updated successfully",
      teacher: serializeTeacher(populatedTeacher),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Employee ID or email already exists" });
    }
    next(error);
  }
});

export default router;
