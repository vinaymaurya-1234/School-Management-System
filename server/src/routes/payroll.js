import { Router } from "express";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import EmployeeSalaryStructure from "../models/EmployeeSalaryStructure.js";
import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

const PAYROLL_READERS = new Set([ROLES.PRINCIPAL, ROLES.ACCOUNTANT]);
const PAYROLL_ADMINS = new Set([ROLES.PRINCIPAL]);

function requirePayrollReader(req, res, next) {
  if (!PAYROLL_READERS.has(req.user.role)) {
    return res.status(403).json({ message: "Payroll access is restricted to the principal and accountant" });
  }
  next();
}

function requirePayrollAdmin(req, res, next) {
  if (!PAYROLL_ADMINS.has(req.user.role)) {
    return res.status(403).json({ message: "Only the principal can manage staff profiles and salary structures" });
  }
  next();
}

function validObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return date;
}

function validateComponents(value, fieldName) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 30) {
    const error = new Error(`${fieldName} must be an array of up to 30 components`);
    error.status = 400;
    throw error;
  }
  return value.map((item, index) => {
    const name = String(item?.name || "").trim();
    const amount = Number(item?.amount);
    if (!name || name.length > 80 || !Number.isFinite(amount) || amount < 0 || amount > 100000000) {
      const error = new Error(`${fieldName} item ${index + 1} requires a name and a valid non-negative amount`);
      error.status = 400;
      throw error;
    }
    return { name, amount: Math.round((amount + Number.EPSILON) * 100) / 100 };
  });
}

async function employeeInSchool(employeeId, schoolId) {
  if (!validObjectId(employeeId)) return null;
  return Employee.findOne({ _id: employeeId, school: schoolId });
}

async function populateEmployee(query) {
  return query
    .populate("user", "name email role active")
    .populate({ path: "teacher", populate: { path: "user", select: "name email role active" } });
}

function serializeEmployee(employee, currentStructure = null) {
  return {
    id: String(employee._id),
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    designation: employee.designation,
    department: employee.department,
    category: employee.category,
    employmentType: employee.employmentType,
    joiningDate: employee.joiningDate,
    exitDate: employee.exitDate,
    active: employee.active,
    user: employee.user?._id ? {
      id: String(employee.user._id),
      name: employee.user.name,
      email: employee.user.email,
      role: employee.user.role,
      active: employee.user.active,
    } : null,
    teacherId: employee.teacher?._id ? String(employee.teacher._id) : employee.teacher ? String(employee.teacher) : null,
    currentSalaryStructure: currentStructure ? {
      id: String(currentStructure._id),
      basicSalary: currentStructure.basicSalary,
      allowances: currentStructure.allowances,
      recurringDeductions: currentStructure.recurringDeductions,
      effectiveFrom: currentStructure.effectiveFrom,
      statutorySettings: currentStructure.statutorySettings,
    } : null,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

async function currentStructureMap(schoolId, employees, asOf = new Date()) {
  if (!employees.length) return new Map();
  const ids = employees.map((employee) => employee._id);
  const structures = await EmployeeSalaryStructure.find({
    school: schoolId,
    employee: { $in: ids },
    status: "active",
    effectiveFrom: { $lte: asOf },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: asOf } }],
  }).sort({ effectiveFrom: -1, createdAt: -1 });
  const map = new Map();
  for (const structure of structures) {
    const id = String(structure.employee);
    if (!map.has(id)) map.set(id, structure);
  }
  return map;
}

// List employee profiles for this school only. Salary values are visible only to payroll roles.
router.get("/staff", requirePayrollReader, async (req, res, next) => {
  try {
    const filter = { school: req.user.school };
    if (req.query.active !== undefined) {
      if (!["true", "false"].includes(String(req.query.active))) {
        return res.status(400).json({ message: "active must be true or false" });
      }
      filter.active = String(req.query.active) === "true";
    }
    if (req.query.category) {
      const allowed = ["teaching", "administration", "finance", "support", "other"];
      if (!allowed.includes(String(req.query.category))) return res.status(400).json({ message: "Invalid staff category" });
      filter.category = String(req.query.category);
    }
    const search = String(req.query.q || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { employeeId: { $regex: escaped, $options: "i" } },
        { designation: { $regex: escaped, $options: "i" } },
        { department: { $regex: escaped, $options: "i" } },
      ];
    }
    const employees = await populateEmployee(Employee.find(filter).sort({ name: 1 }));
    const structures = await currentStructureMap(req.user.school, employees);
    res.json({
      employees: employees.map((employee) => serializeEmployee(employee, structures.get(String(employee._id)) || null)),
      count: employees.length,
    });
  } catch (error) {
    next(error);
  }
});

// Create a staff record. Existing user and teacher links are optional; no duplicate login is created.
router.post("/staff", requirePayrollAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const employeeId = String(body.employeeId || "").trim();
    const name = String(body.name || "").trim();
    const designation = String(body.designation || "").trim();
    const allowedCategories = ["teaching", "administration", "finance", "support", "other"];
    const allowedEmploymentTypes = ["full_time", "part_time", "contract"];
    if (!employeeId || employeeId.length > 40 || !name || name.length > 120 || !designation || designation.length > 100) {
      return res.status(400).json({ message: "employeeId, name and designation are required and must be within the allowed lengths" });
    }
    if (body.category !== undefined && !allowedCategories.includes(body.category)) return res.status(400).json({ message: "Invalid staff category" });
    if (body.employmentType !== undefined && !allowedEmploymentTypes.includes(body.employmentType)) return res.status(400).json({ message: "Invalid employment type" });

    let user = null;
    let teacher = null;
    if (body.userId) {
      if (!validObjectId(body.userId)) return res.status(400).json({ message: "Invalid userId" });
      user = await User.findOne({ _id: body.userId, school: req.user.school }).select("name email role active");
      if (!user) return res.status(400).json({ message: "Linked user must belong to your school" });
      if (!user.active) return res.status(400).json({ message: "An inactive user cannot be linked to a new staff profile" });
    }
    if (body.teacherId) {
      if (!validObjectId(body.teacherId)) return res.status(400).json({ message: "Invalid teacherId" });
      teacher = await Teacher.findOne({ _id: body.teacherId, school: req.user.school }).populate("user", "name email role active");
      if (!teacher) return res.status(400).json({ message: "Linked teacher must belong to your school" });
      if (user && String(teacher.user?._id || teacher.user) !== String(user._id)) {
        return res.status(400).json({ message: "The selected user and teacher profile do not match" });
      }
      user = user || teacher.user;
    }
    if (user && !body.teacherId && user.role === ROLES.TEACHER) {
      teacher = await Teacher.findOne({ user: user._id, school: req.user.school });
    }
    const normalizedEmployeeId = employeeId;
    const existing = await Employee.findOne({ school: req.user.school, employeeId: normalizedEmployeeId });
    if (existing) return res.status(409).json({ message: "This employee ID is already used in your school" });
    if (user && await Employee.exists({ school: req.user.school, user: user._id })) {
      return res.status(409).json({ message: "This login account is already linked to a staff profile" });
    }
    if (teacher && await Employee.exists({ school: req.user.school, teacher: teacher._id })) {
      return res.status(409).json({ message: "This teacher profile is already linked to a staff profile" });
    }

    const employee = await Employee.create({
      school: req.user.school,
      user: user?._id || null,
      teacher: teacher?._id || null,
      employeeId: normalizedEmployeeId,
      name,
      email: String(body.email ?? user?.email ?? "").trim().toLowerCase(),
      phone: String(body.phone || "").trim(),
      designation,
      department: String(body.department || "").trim(),
      category: body.category || (user?.role === ROLES.TEACHER ? "teaching" : user?.role === ROLES.ACCOUNTANT ? "finance" : "other"),
      employmentType: body.employmentType || "full_time",
      joiningDate: body.joiningDate ? parseDate(body.joiningDate, "joiningDate") : null,
      exitDate: body.exitDate ? parseDate(body.exitDate, "exitDate") : null,
      active: body.active === undefined ? true : body.active === true,
      notes: String(body.notes || "").trim(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    const populated = await populateEmployee(Employee.findOne({ _id: employee._id, school: req.user.school }));
    res.status(201).json({ message: "Staff profile created", employee: serializeEmployee(populated) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Employee ID or linked account is already in use" });
    next(error);
  }
});

// Update staff details without changing or deleting the linked login account.
router.put("/staff/:id", requirePayrollAdmin, async (req, res, next) => {
  try {
    const employee = await employeeInSchool(req.params.id, req.user.school);
    if (!employee) return res.status(404).json({ message: "Staff profile not found" });
    const body = req.body || {};
    const fields = ["name", "email", "phone", "designation", "department", "category", "employmentType", "notes"];
    for (const field of fields) {
      if (body[field] === undefined) continue;
      if (["name", "designation"].includes(field) && !String(body[field]).trim()) {
        return res.status(400).json({ message: `${field} cannot be empty` });
      }
      if (field === "category" && !["teaching", "administration", "finance", "support", "other"].includes(body[field])) return res.status(400).json({ message: "Invalid staff category" });
      if (field === "employmentType" && !["full_time", "part_time", "contract"].includes(body[field])) return res.status(400).json({ message: "Invalid employment type" });
      employee[field] = field === "email" ? String(body[field]).trim().toLowerCase() : typeof body[field] === "string" ? body[field].trim() : body[field];
    }
    if (body.joiningDate !== undefined) employee.joiningDate = body.joiningDate ? parseDate(body.joiningDate, "joiningDate") : null;
    if (body.exitDate !== undefined) employee.exitDate = body.exitDate ? parseDate(body.exitDate, "exitDate") : null;
    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") return res.status(400).json({ message: "active must be a boolean" });
      employee.active = body.active;
    }
    employee.updatedBy = req.user._id;
    await employee.save();
    const populated = await populateEmployee(Employee.findOne({ _id: employee._id, school: req.user.school }));
    res.json({ message: "Staff profile updated", employee: serializeEmployee(populated) });
  } catch (error) {
    next(error);
  }
});

// Read the effective salary structure and revision history for a staff member.
router.get("/staff/:id/salary-structures", requirePayrollReader, async (req, res, next) => {
  try {
    const employee = await employeeInSchool(req.params.id, req.user.school);
    if (!employee) return res.status(404).json({ message: "Staff profile not found" });
    const asOf = req.query.asOf ? parseDate(req.query.asOf, "asOf") : new Date();
    const structures = await EmployeeSalaryStructure.find({
      school: req.user.school,
      employee: employee._id,
    }).sort({ effectiveFrom: -1, createdAt: -1 });
    const effective = structures.find((item) =>
      item.status === "active" &&
      item.effectiveFrom <= asOf &&
      (!item.effectiveTo || item.effectiveTo >= asOf)
    ) || null;
    res.json({ employeeId: String(employee._id), effectiveStructure: effective, history: structures });
  } catch (error) {
    next(error);
  }
});

// Create an effective-dated salary revision. Past structures are preserved for history.
router.put("/staff/:id/salary-structure", requirePayrollAdmin, async (req, res, next) => {
  try {
    const employee = await employeeInSchool(req.params.id, req.user.school);
    if (!employee) return res.status(404).json({ message: "Staff profile not found" });
    if (!employee.active) return res.status(400).json({ message: "An inactive employee cannot receive a new salary structure" });
    const body = req.body || {};
    const basicSalary = Number(body.basicSalary);
    if (!Number.isFinite(basicSalary) || basicSalary < 0 || basicSalary > 100000000) {
      return res.status(400).json({ message: "basicSalary must be a valid non-negative amount" });
    }
    const effectiveFrom = parseDate(body.effectiveFrom, "effectiveFrom");
    const allowances = validateComponents(body.allowances ?? [], "allowances");
    const recurringDeductions = validateComponents(body.recurringDeductions ?? [], "recurringDeductions");
    const statutorySettings = body.statutorySettings || {};
    for (const field of ["pfEnabled", "esicEnabled", "professionalTaxEnabled", "tdsEnabled"]) {
      if (statutorySettings[field] !== undefined && typeof statutorySettings[field] !== "boolean") {
        return res.status(400).json({ message: `${field} must be a boolean` });
      }
    }
    const existingSameDate = await EmployeeSalaryStructure.findOne({
      school: req.user.school,
      employee: employee._id,
      effectiveFrom,
      status: "active",
    });
    if (existingSameDate) return res.status(409).json({ message: "A salary structure already exists for this effective date" });

    const nextFuture = await EmployeeSalaryStructure.findOne({
      school: req.user.school,
      employee: employee._id,
      status: "active",
      effectiveFrom: { $gt: effectiveFrom },
    }).sort({ effectiveFrom: 1 });
    const effectiveTo = nextFuture ? new Date(nextFuture.effectiveFrom.getTime() - 86400000) : null;
    const created = await EmployeeSalaryStructure.create({
      school: req.user.school,
      employee: employee._id,
      basicSalary: Math.round((basicSalary + Number.EPSILON) * 100) / 100,
      allowances,
      recurringDeductions,
      statutorySettings: {
        pfEnabled: statutorySettings.pfEnabled === true,
        esicEnabled: statutorySettings.esicEnabled === true,
        professionalTaxEnabled: statutorySettings.professionalTaxEnabled === true,
        tdsEnabled: statutorySettings.tdsEnabled === true,
        notes: String(statutorySettings.notes || "").trim(),
      },
      effectiveFrom,
      effectiveTo,
      status: "active",
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    // Close the preceding open-ended structure immediately before the new effective date.
    await EmployeeSalaryStructure.updateMany({
      school: req.user.school,
      employee: employee._id,
      status: "active",
      effectiveFrom: { $lt: effectiveFrom },
      $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: effectiveFrom } }],
    }, { $set: { effectiveTo: new Date(effectiveFrom.getTime() - 86400000) } });

    res.status(201).json({ message: "Salary structure saved", salaryStructure: created });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A salary structure already exists for this effective date" });
    next(error);
  }
});

export default router;
