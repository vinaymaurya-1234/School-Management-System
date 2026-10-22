import { Router } from "express";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import EmployeeSalaryStructure from "../models/EmployeeSalaryStructure.js";
import PayrollRun from "../models/PayrollRun.js";
import TeacherAttendance from "../models/TeacherAttendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
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

// List active teacher profiles not yet linked to a payroll employee record.
router.get("/staff/candidates", requirePayrollAdmin, async (req, res, next) => {
  try {
    const search = String(req.query.q || "").trim();
    const filter = { school: req.user.school };
    const teachers = await Teacher.find(filter).populate("user", "name email role active").sort({ employeeId: 1 }).lean();
    const linkedIds = await Employee.find({ school: req.user.school, $or: [
      { teacher: { $in: teachers.map((teacher) => teacher._id) } },
      { user: { $in: teachers.map((teacher) => teacher.user?._id).filter(Boolean) } },
    ] }).select("teacher user").lean();
    const linkedTeachers = new Set(linkedIds.map((item) => String(item.teacher || "")));
    const linkedUsers = new Set(linkedIds.map((item) => String(item.user || "")));
    const candidates = teachers.filter((teacher) =>
      teacher.user?.active !== false &&
      !linkedTeachers.has(String(teacher._id)) &&
      !linkedUsers.has(String(teacher.user?._id || ""))
    ).filter((teacher) => {
      if (!search) return true;
      const haystack = [teacher.user?.name, teacher.employeeId, teacher.designation, teacher.department, teacher.specialization, teacher.user?.email, teacher.phone].join(" ").toLowerCase();
      return haystack.includes(search.toLowerCase());
    }).map((teacher) => ({
      teacherId: String(teacher._id),
      userId: String(teacher.user?._id || teacher.user || ""),
      employeeId: teacher.employeeId,
      name: teacher.user?.name || "",
      email: teacher.user?.email || "",
      phone: teacher.phone || "",
      designation: teacher.designation || "Teacher",
      department: teacher.department || "",
      category: "teaching",
      joiningDate: teacher.joiningDate || null,
      gender: teacher.gender || "",
      dateOfBirth: teacher.dateOfBirth || null,
      qualification: teacher.qualification || "",
      specialization: teacher.specialization || "",
      address: teacher.address || "",
      emergencyContact: teacher.emergencyContact || {},
    }));
    res.json({ candidates, count: candidates.length });
  } catch (error) { next(error); }
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
    const pfRate = statutorySettings.pfRate === undefined ? 12 : Number(statutorySettings.pfRate);
    if (!Number.isFinite(pfRate) || pfRate < 0 || pfRate > 100) {
      return res.status(400).json({ message: "pfRate must be between 0 and 100" });
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
        pfEnabled: statutorySettings.pfEnabled !== false,
        pfRate,
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


const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const monthBounds = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1)),
  end: new Date(Date.UTC(year, month, 0)),
  next: new Date(Date.UTC(year, month, 1)),
});
const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
const dayCountInclusive = (start, end) => Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

async function calculatePayrollPreview(schoolId, year, month) {
  const { start, end, next } = monthBounds(year, month);
  const periodDays = end.getUTCDate();
  const employees = await Employee.find({ school: schoolId, active: true }).sort({ name: 1 }).lean();
  const employeeIds = employees.map((item) => item._id);
  const structures = await EmployeeSalaryStructure.find({
    school: schoolId, employee: { $in: employeeIds }, status: "active",
    effectiveFrom: { $lt: next },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: start } }],
  }).sort({ effectiveFrom: -1, createdAt: -1 }).lean();
  const structureMap = new Map();
  for (const structure of structures) {
    const key = String(structure.employee);
    if (!structureMap.has(key)) structureMap.set(key, structure);
  }

  const teacherIds = employees.map((item) => item.teacher).filter(Boolean);
  const attendanceSessions = teacherIds.length ? await TeacherAttendance.find({
    school: schoolId, date: { $gte: start, $lt: next }, "records.teacher": { $in: teacherIds },
  }).select("date records").lean() : [];
  const attendanceByTeacherDate = new Map();
  for (const session of attendanceSessions) {
    const dateKey = dayKey(session.date);
    for (const record of session.records || []) {
      attendanceByTeacherDate.set(`${String(record.teacher)}:${dateKey}`, record.status);
    }
  }

  const userIds = employees.map((item) => item.user).filter(Boolean);
  const leaveRows = userIds.length ? await LeaveRequest.find({
    school: schoolId, teacher: { $in: userIds }, status: "approved",
    startDate: { $lt: next }, endDate: { $gte: start },
  }).select("teacher leaveType startDate endDate totalDays halfDay").lean() : [];
  const leaveByUserDate = new Map();
  for (const leave of leaveRows) {
    const clippedStart = new Date(Math.max(new Date(leave.startDate).getTime(), start.getTime()));
    const clippedEnd = new Date(Math.min(new Date(leave.endDate).getTime(), end.getTime()));
    for (let cursor = new Date(clippedStart); cursor <= clippedEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = `${String(leave.teacher)}:${dayKey(cursor)}`;
      const paid = ["casual", "sick", "earned"].includes(leave.leaveType);
      leaveByUserDate.set(key, { paid, leaveType: leave.leaveType });
    }
  }

  return employees.map((employee) => {
    const structure = structureMap.get(String(employee._id));
    if (!structure) return {
      employee: employee._id, employeeId: employee.employeeId, name: employee.name, designation: employee.designation,
      needsSalarySetup: true, calculationNotes: ["No salary structure effective in this payroll month."],
    };
    const structureStart = new Date(Math.max(new Date(structure.effectiveFrom).getTime(), start.getTime(), employee.joiningDate ? new Date(employee.joiningDate).getTime() : start.getTime()));
    const structureEnd = new Date(Math.min(structure.effectiveTo ? new Date(structure.effectiveTo).getTime() : end.getTime(), employee.exitDate ? new Date(employee.exitDate).getTime() : end.getTime(), end.getTime()));
    const eligibleDays = dayCountInclusive(new Date(Date.UTC(structureStart.getUTCFullYear(), structureStart.getUTCMonth(), structureStart.getUTCDate())), new Date(Date.UTC(structureEnd.getUTCFullYear(), structureEnd.getUTCMonth(), structureEnd.getUTCDate())));
    const basicSalary = Number(structure.basicSalary || 0);
    const allowances = (structure.allowances || []).map((item) => ({ name: item.name, amount: Number(item.amount || 0) }));
    const configuredDeductions = (structure.recurringDeductions || []).map((item) => ({ name: item.name, amount: Number(item.amount || 0) }));
    const pfEnabled = structure.statutorySettings?.pfEnabled !== false;
    const pfRate = Number(structure.statutorySettings?.pfRate ?? 12);
    // PF is calculated from this salary structure's configured percentage, not a fixed amount.
    // Confirm employee EPF eligibility and applicable wage ceiling before approving payroll.
    const recurringDeductions = configuredDeductions.filter((item) => !(/^pf$/i.test(item.name.trim()) || /^provident fund$/i.test(item.name.trim())));
    const fullGross = basicSalary + allowances.reduce((sum, item) => sum + item.amount, 0);
    const grossSalary = roundMoney(fullGross * eligibleDays / periodDays);
    const perDayRate = roundMoney(fullGross / periodDays);
    let presentDays = 0, lateDays = 0, absentDays = 0, paidLeaveDays = 0, unpaidLeaveDays = 0, unmarkedDays = 0;
    const notes = [];
    if (!employee.teacher) notes.push("No linked teacher profile; teacher attendance was not applied.");
    for (let day = 1; day <= periodDays; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCDay() === 0 || date < structureStart || date > structureEnd) continue;
      const key = dayKey(date);
      const leave = employee.user ? leaveByUserDate.get(`${String(employee.user)}:${key}`) : null;
      if (leave) {
        if (leave.paid) paidLeaveDays += 1; else unpaidLeaveDays += 1;
        continue;
      }
      if (!employee.teacher) { unmarkedDays += 1; continue; }
      const status = attendanceByTeacherDate.get(`${String(employee.teacher)}:${key}`);
      if (status === "present") presentDays += 1;
      else if (status === "late") { lateDays += 1; presentDays += 1; }
      else if (status === "absent") absentDays += 1;
      else if (status === "on_leave") { paidLeaveDays += 1; }
      else unmarkedDays += 1;
    }
    if (unmarkedDays) notes.push(`${unmarkedDays} day(s) have no attendance record and are not automatically deducted.`);
    notes.push("Casual, sick and earned leave are treated as paid; emergency/other approved leave is treated as unpaid for payroll.");
    notes.push("Late attendance counts as present; statutory flags are not automatically calculated.");
    const attendanceDeduction = roundMoney(absentDays * perDayRate);
    const unpaidLeaveDeduction = roundMoney(unpaidLeaveDays * perDayRate);
    const pfDeduction = pfEnabled ? roundMoney(basicSalary * (pfRate / 100) * eligibleDays / periodDays) : 0;
    const otherDeductions = roundMoney(recurringDeductions.reduce((sum, item) => sum + item.amount, 0) * eligibleDays / periodDays);
    const totalDeductions = roundMoney(attendanceDeduction + unpaidLeaveDeduction + pfDeduction + otherDeductions);
    if (pfEnabled) notes.push(`Employee PF calculated at ${pfRate}% of basic salary, prorated for ${eligibleDays} eligible calendar day(s); verify EPF eligibility and applicable wage ceiling before payroll approval.`);
    return {
      employee: employee._id, employeeId: employee.employeeId, name: employee.name, designation: employee.designation,
      salaryStructure: structure._id, basicSalary: roundMoney(basicSalary * eligibleDays / periodDays),
      allowances: allowances.map((item) => ({ ...item, amount: roundMoney(item.amount * eligibleDays / periodDays) })),
      recurringDeductions, pfDeduction, periodDays, eligibleDays, perDayRate, presentDays, lateDays, absentDays, paidLeaveDays, unpaidLeaveDays, unmarkedDays,
      grossSalary, attendanceDeduction, unpaidLeaveDeduction, otherDeductions, totalDeductions,
      netPayable: Math.max(0, roundMoney(grossSalary - totalDeductions)), calculationNotes: notes, needsSalarySetup: false,
    };
  });
}

// Preview uses current approved attendance, leave and effective salary records; it never writes a payroll run.
router.get("/monthly", requirePayrollReader, async (req, res, next) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Provide a valid year and month (1–12)." });
    }
    const run = await PayrollRun.findOne({ school: req.user.school, year, month }).lean();
    if (run) return res.json({ run, preview: false });
    const items = await calculatePayrollPreview(req.user.school, year, month);
    res.json({ year, month, status: "preview", preview: true, items });
  } catch (error) { next(error); }
});

// Generate one immutable snapshot per school and month. Re-running returns the existing run.
router.post("/monthly/generate", requirePayrollAdmin, async (req, res, next) => {
  try {
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Provide a valid year and month (1–12)." });
    }
    const existing = await PayrollRun.findOne({ school: req.user.school, year, month });
    if (existing) return res.status(409).json({ message: "Payroll for this month has already been generated.", run: existing });
    const preview = await calculatePayrollPreview(req.user.school, year, month);
    const missing = preview.filter((item) => item.needsSalarySetup);
    if (missing.length) return res.status(409).json({ message: `Set salary structures for all staff before generating payroll. Missing: ${missing.map((item) => item.name).join(", ")}`, missingStaff: missing });
    const { start, end } = monthBounds(year, month);
    const run = await PayrollRun.create({
      school: req.user.school, year, month, periodStart: start, periodEnd: end, generatedBy: req.user._id,
      items: preview.map(({ needsSalarySetup, eligibleDays, ...item }) => item),
    });
    res.status(201).json({ message: "Monthly payroll generated as a draft. Review and approve before recording payments.", run });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Payroll for this month already exists." });
    next(error);
  }
});

router.post("/monthly/:id/approve", requirePayrollAdmin, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(400).json({ message: "Invalid payroll run." });
    const run = await PayrollRun.findOne({ _id: req.params.id, school: req.user.school });
    if (!run) return res.status(404).json({ message: "Payroll run not found." });
    if (run.status === "approved") return res.status(409).json({ message: "This payroll is already approved." });
    run.status = "approved"; run.approvedBy = req.user._id; run.approvedAt = new Date();
    await run.save();
    res.json({ message: "Payroll approved.", run });
  } catch (error) { next(error); }
});

router.post("/monthly/:id/items/:itemId/payment", requirePayrollAdmin, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id) || !validObjectId(req.params.itemId)) return res.status(400).json({ message: "Invalid payroll or item ID." });
    const run = await PayrollRun.findOne({ _id: req.params.id, school: req.user.school });
    if (!run) return res.status(404).json({ message: "Payroll run not found." });
    if (run.status !== "approved") return res.status(409).json({ message: "Approve payroll before recording a payment." });
    const item = run.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Payroll staff item not found." });
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || "bank_transfer");
    const allowedMethods = ["bank_transfer", "cash", "upi", "cheque", "other"];
    if (!Number.isFinite(amount) || amount <= 0 || !allowedMethods.includes(method)) return res.status(400).json({ message: "Enter a positive payment amount and a valid method." });
    if (roundMoney(item.paidAmount + amount) > item.netPayable) return res.status(400).json({ message: "Payment exceeds the remaining payable salary." });
    item.payments.push({ amount: roundMoney(amount), date: req.body?.date ? parseDate(req.body.date, "payment date") : new Date(), method, reference: String(req.body?.reference || "").trim().slice(0, 120), note: String(req.body?.note || "").trim().slice(0, 500), recordedBy: req.user._id });
    item.paidAmount = roundMoney(item.paidAmount + amount);
    item.paymentStatus = item.paidAmount >= item.netPayable ? "paid" : "partial";
    await run.save();
    res.json({ message: "Payment recorded.", run });
  } catch (error) { next(error); }
});

export default router;
