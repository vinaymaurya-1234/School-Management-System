import { Router } from "express";
import { randomBytes } from "node:crypto";
import Student from "./models/Student.js";
import Parent from "./models/Parent.js";
import User from "./models/User.js";
import { requireAuth } from "./middleware/auth.js";
import { ROLES } from "./config/permissions.js";
import { AcademicYear, StudentEnrollment, SchoolClass, Section } from "./models/Academic.js";
import School from "./models/School.js";

const router = Router();
function canManageStudents(role) { return [ROLES.PRINCIPAL, ROLES.ADMIN, ROLES.ACCOUNTANT].includes(role); }
function serializeStudent(student) {
  const user = student.user && typeof student.user === "object" ? student.user : null;
  return {
    id: student._id,
    userId: user?._id || student.user,
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
    loginId: user?.loginId || null,
    loginEmail: user?.email || null,
    mustChangePassword: Boolean(user?.mustChangePassword),
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}
function temporaryPassword() {
  return randomBytes(9).toString("base64url");
}
function prefixFor(role) {
  return role === ROLES.STUDENT ? "STU" : role === ROLES.PARENT ? "PAR" : "USR";
}
async function uniqueLoginId(role) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const value = `${prefixFor(role)}${new Date().getFullYear().toString().slice(-2)}${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!(await User.exists({ loginId: value }))) return value;
  }
  throw new Error("Could not generate a unique login ID. Please try again.");
}
function generatedEmail(loginId) {
  return `${loginId.toLowerCase()}@accounts.school.local`;
}
function clean(value) { return String(value ?? "").trim(); }
function validEmail(value) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

router.use(requireAuth);

async function createStudentRecord(input, schoolId) {
  const admissionNumber = clean(input.admissionNumber);
  const name = clean(input.name || input.fullName);
  const guardianName = clean(input.guardianName || input.parentName);
  const guardianPhone = clean(input.guardianPhone || input.parentPhone || input.parentMobile);
  const parentEmail = clean(input.parentEmail || input.guardianEmail).toLowerCase();
  const studentEmail = clean(input.studentEmail || input.loginEmail).toLowerCase();
  const parentRelationship = clean(input.parentRelationship || input.relationship || "Parent");
  const academicYearId = clean(input.academicYear || input.academicYearId);
  const classId = clean(input.classId || input.class);
  const sectionId = clean(input.sectionId || input.section);
  const dateOfBirth = input.dateOfBirth || input.dob;
  const gender = clean(input.gender).toLowerCase();
  const admissionDate = input.admissionDate || new Date();

  if (!admissionNumber || !name || !dateOfBirth || !gender || !admissionDate || !academicYearId || !classId || !sectionId || !guardianName || !guardianPhone || !parentRelationship) {
    throw Object.assign(new Error("Required: student name, admission number, date of birth, gender, admission date, academic year, class, section, parent name, relationship and parent mobile"), { status: 400 });
  }
  if (!["male", "female", "other"].includes(gender)) throw Object.assign(new Error("Gender must be male, female or other"), { status: 400 });
  if (!validEmail(studentEmail) || !validEmail(parentEmail)) throw Object.assign(new Error("Enter a valid email address"), { status: 400 });
  if (!/^[+0-9()\s-]{7,20}$/.test(guardianPhone)) throw Object.assign(new Error("Enter a valid parent mobile number"), { status: 400 });

  const existingStudent = await Student.findOne({ school: schoolId, admissionNumber });
  if (existingStudent) throw Object.assign(new Error(`Admission number ${admissionNumber} already exists`), { status: 409 });

  const [year, schoolClass, sectionDoc] = await Promise.all([
    AcademicYear.findOne({ _id: academicYearId, school: schoolId }),
    SchoolClass.findOne({ _id: classId, school: schoolId, academicYear: academicYearId }),
    Section.findOne({ _id: sectionId, school: schoolId, academicYear: academicYearId, class: classId }),
  ]);
  if (!year) throw Object.assign(new Error("Academic year not found for this school"), { status: 400 });
  if (!schoolClass || !sectionDoc) throw Object.assign(new Error("Selected class and section do not match the academic year"), { status: 400 });

  const studentLoginId = await uniqueLoginId(ROLES.STUDENT);
  const studentPassword = temporaryPassword();
  const studentAccountEmail = studentEmail || generatedEmail(studentLoginId);
  if (await User.exists({ email: studentAccountEmail })) throw Object.assign(new Error("Student email is already in use. Leave it blank if the student has no individual email."), { status: 409 });

  let studentUser;
  let studentProfile;
  let parentUser;
  let parentProfile;
  let parentCreated = false;
  let studentCreated = false;
  let profileCreated = false;
  let enrollmentCreated = false;
  let parentProfileCreated = false;
  let parentPassword = null;

  try {
    studentUser = await User.create({
      name, email: studentAccountEmail, loginId: studentLoginId,
      password: studentPassword, mustChangePassword: true,
      role: ROLES.STUDENT, school: schoolId,
    });
    studentCreated = true;

    studentProfile = await Student.create({
      user: studentUser._id, school: schoolId, admissionNumber, name,
      dateOfBirth, gender, guardianName, guardianPhone,
      guardianEmail: parentEmail, address: clean(input.address), admissionDate,
    });
    profileCreated = true;

    // Reuse a parent account only when the registered phone matches within this school.
    parentProfile = await Parent.findOne({ school: schoolId, phone: guardianPhone }).populate("user");
    if (parentProfile?.user && parentProfile.user.role === ROLES.PARENT) {
      parentUser = parentProfile.user;
      if (!parentUser.loginId) {
        parentUser.loginId = await uniqueLoginId(ROLES.PARENT);
        await User.updateOne({ _id: parentUser._id, school: schoolId }, { $set: { loginId: parentUser.loginId } });
      }
      if (parentEmail && parentUser.email !== parentEmail && !parentUser.email.endsWith("@accounts.school.local")) {
        // Keep an existing verified login email unchanged; profile can be updated separately.
      }
      await Parent.updateOne({ _id: parentProfile._id }, { $addToSet: { children: studentProfile._id }, $set: { relationship: parentRelationship } });
    } else {
      const parentLoginId = await uniqueLoginId(ROLES.PARENT);
      parentPassword = temporaryPassword();
      const parentAccountEmail = parentEmail || generatedEmail(parentLoginId);
      const emailOwner = await User.findOne({ email: parentAccountEmail });
      if (emailOwner) {
        if (emailOwner.role !== ROLES.PARENT) throw Object.assign(new Error("Parent email is already used by another account"), { status: 409 });
        parentUser = emailOwner;
        if (!parentUser.loginId) {
          parentUser.loginId = await uniqueLoginId(ROLES.PARENT);
          await User.updateOne({ _id: parentUser._id, school: schoolId }, { $set: { loginId: parentUser.loginId } });
        }
        parentProfile = await Parent.findOne({ user: parentUser._id, school: schoolId });
        if (!parentProfile) {
          parentProfile = await Parent.create({ user: parentUser._id, school: schoolId, relationship: parentRelationship, phone: guardianPhone, children: [studentProfile._id] });
          parentProfileCreated = true;
        } else {
          await Parent.updateOne({ _id: parentProfile._id }, { $addToSet: { children: studentProfile._id }, $set: { phone: guardianPhone, relationship: parentRelationship } });
        }
        parentPassword = null;
      } else {
        parentUser = await User.create({
          name: guardianName, email: parentAccountEmail, loginId: parentLoginId,
          password: parentPassword, mustChangePassword: true,
          role: ROLES.PARENT, school: schoolId,
        });
        parentCreated = true;
        parentProfile = await Parent.create({
          user: parentUser._id, school: schoolId, relationship: parentRelationship,
          phone: guardianPhone, children: [studentProfile._id],
        });
        parentProfileCreated = true;
      }
    }

    await StudentEnrollment.create({
      school: schoolId, academicYear: academicYearId, student: studentUser._id,
      class: classId, section: sectionId, status: "active",
    });
    enrollmentCreated = true;

    return {
      student: serializeStudent({ ...studentProfile.toObject(), user: studentUser }),
      parent: {
        name: parentUser.name,
        loginId: parentUser.loginId,
        email: parentUser.email,
        reusedExistingAccount: !parentCreated && !parentPassword,
      },
      credentials: {
        student: { name, loginId: studentUser.loginId, temporaryPassword: studentPassword },
        parent: { name: parentUser.name, loginId: parentUser.loginId, temporaryPassword: parentPassword },
      },
    };
  } catch (error) {
    if (enrollmentCreated && studentUser) await StudentEnrollment.deleteOne({ school: schoolId, student: studentUser._id, academicYear: academicYearId }).catch(() => {});
    if (parentProfileCreated && parentProfile?._id) await Parent.deleteOne({ _id: parentProfile._id }).catch(() => {});
    if (parentCreated && parentUser?._id) {
      await Parent.deleteOne({ user: parentUser._id, school: schoolId }).catch(() => {});
      await User.deleteOne({ _id: parentUser._id }).catch(() => {});
    }
    if (profileCreated && studentProfile?._id) await Student.deleteOne({ _id: studentProfile._id }).catch(() => {});
    if (studentCreated && studentUser?._id) await User.deleteOne({ _id: studentUser._id }).catch(() => {});
    throw error;
  }
}

router.post("/", async (req, res, next) => {
  try {
    if (!canManageStudents(req.user.role)) return res.status(403).json({ message: "You do not have permission to create students" });
    const result = await createStudentRecord(req.body || {}, req.user.school);
    return res.status(201).json({ message: "Student, enrollment and account records created successfully", ...result });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Admission number, login ID or email already exists" });
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

router.post("/bulk-import", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can bulk import students" });
    const rows = Array.isArray(req.body?.students) ? req.body.students : [];
    if (!rows.length) return res.status(400).json({ message: "Upload a file containing at least one student row" });
    if (rows.length > 500) return res.status(400).json({ message: "Import is limited to 500 students per batch" });
    const imported = [];
    const errors = [];
    for (let index = 0; index < rows.length; index += 1) {
      try {
        const result = await createStudentRecord(rows[index], req.user.school);
        imported.push({ row: rows[index]?._sourceRow || index + 2, ...result });
      } catch (error) {
        errors.push({ row: rows[index]?._sourceRow || index + 2, admissionNumber: clean(rows[index]?.admissionNumber), message: error.message || "Unable to import this row" });
      }
    }
    res.status(imported.length ? 201 : 400).json({
      message: `Imported ${imported.length} of ${rows.length} student rows`,
      totalRows: rows.length, importedCount: imported.length, failedCount: errors.length,
      imported, errors,
    });
  } catch (error) { next(error); }
});

router.get("/credentials", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can view login credential records" });
    const [students, parents] = await Promise.all([
      Student.find({ school: req.user.school }).populate("user", "name email loginId role active mustChangePassword").sort({ name: 1 }),
      Parent.find({ school: req.user.school }).populate("user", "name email loginId role active mustChangePassword").populate("children", "name admissionNumber").sort({ createdAt: -1 }),
    ]);
    for (const student of students) {
      const account = student.user;
      if (account && !account.loginId) {
        account.loginId = await uniqueLoginId(account.role);
        await User.updateOne({ _id: account._id, school: req.user.school }, { $set: { loginId: account.loginId } });
      }
    }
    for (const parent of parents) {
      const account = parent.user;
      if (account && !account.loginId) {
        account.loginId = await uniqueLoginId(account.role);
        await User.updateOne({ _id: account._id, school: req.user.school }, { $set: { loginId: account.loginId } });
      }
    }
    res.json({
      students: students.map((student) => {
        const user = student.user || {};
        return { studentId: student._id, userId: user._id, name: student.name, admissionNumber: student.admissionNumber, loginId: user.loginId || null, email: user.email || "", active: user.active !== false && student.active !== false, mustChangePassword: Boolean(user.mustChangePassword), createdAt: student.createdAt };
      }),
      parents: parents.filter((parent) => parent.user).map((parent) => ({
        parentProfileId: parent._id, userId: parent.user._id, name: parent.user.name, loginId: parent.user.loginId || null,
        email: parent.user.email || "", phone: parent.phone, active: parent.user.active !== false,
        mustChangePassword: Boolean(parent.user.mustChangePassword),
        children: (parent.children || []).map((child) => ({ name: child.name, admissionNumber: child.admissionNumber })),
      })),
    });
  } catch (error) { next(error); }
});

router.post("/credentials/:userId/reset", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can reset student or parent credentials" });
    const account = await User.findOne({ _id: req.params.userId, school: req.user.school, role: { $in: [ROLES.STUDENT, ROLES.PARENT] } });
    if (!account) return res.status(404).json({ message: "Student or parent account not found" });
    const password = temporaryPassword();
    if (!account.loginId) account.loginId = await uniqueLoginId(account.role);
    account.password = password;
    account.mustChangePassword = true;
    await account.save();
    res.json({ message: "Temporary password reset. Share it privately; it will not be shown again.", loginId: account.loginId, temporaryPassword: password, name: account.name, role: account.role });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const students = await Student.find({ school: req.user.school }).populate("user", "name email role active loginId mustChangePassword").sort({ name: 1 });
    res.json({ students: students.map(serializeStudent) });
  } catch (error) { next(error); }
});

router.get("/me/profile", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.STUDENT) return res.status(403).json({ message: "This profile endpoint is for student accounts only" });
    const student = await Student.findOne({ user: req.user._id, school: req.user.school });
    if (!student) return res.status(404).json({ message: "Student profile has not been created by the school yet" });
    const enrollment = await StudentEnrollment.findOne({ student: req.user._id, school: req.user.school, status: "active" })
      .sort({ createdAt: -1 }).populate("academicYear", "name isActive startDate endDate")
      .populate("class", "name order").populate("section", "name classTeacher");
    const school = await School.findById(req.user.school).select("name code address activeAcademicYear");
    res.json({
      profile: serializeStudent(student),
      account: { id: req.user._id, name: req.user.name, email: req.user.email, loginId: req.user.loginId, active: req.user.active, role: req.user.role, createdAt: req.user.createdAt },
      school,
      academics: enrollment ? { academicYear: enrollment.academicYear, class: enrollment.class, section: enrollment.section, enrollmentStatus: enrollment.status, enrolledAt: enrollment.createdAt } : null,
      documents: [], documentUploadsAvailable: false,
    });
  } catch (error) { next(error); }
});

router.put("/me/profile", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.STUDENT) return res.status(403).json({ message: "This profile endpoint is for student accounts only" });
    const allowed = ["address", "guardianPhone", "guardianEmail"];
    const updates = {};
    for (const field of allowed) if (req.body?.[field] !== undefined) updates[field] = clean(req.body[field]);
    if (updates.guardianEmail) updates.guardianEmail = updates.guardianEmail.toLowerCase();
    if (updates.guardianPhone && !/^[+0-9()\s-]{7,20}$/.test(updates.guardianPhone)) return res.status(400).json({ message: "Enter a valid guardian phone number" });
    if (updates.guardianEmail && !validEmail(updates.guardianEmail)) return res.status(400).json({ message: "Enter a valid guardian email address" });
    const student = await Student.findOneAndUpdate({ user: req.user._id, school: req.user.school }, updates, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ message: "Student profile has not been created by the school yet" });
    res.json({ message: "Contact details updated successfully", profile: serializeStudent(student) });
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, school: req.user.school }).populate("user", "name email role active loginId mustChangePassword");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ student: serializeStudent(student) });
  } catch (error) { next(error); }
});
router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageStudents(req.user.role)) return res.status(403).json({ message: "You do not have permission to update students" });
    const allowedFields = ["name", "dateOfBirth", "gender", "guardianName", "guardianPhone", "guardianEmail", "address", "admissionDate", "active"];
    const updates = {};
    for (const field of allowedFields) if (req.body?.[field] !== undefined) updates[field] = req.body[field];
    const student = await Student.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, updates, { new: true, runValidators: true }).populate("user", "name email role active loginId mustChangePassword");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student updated successfully", student: serializeStudent(student) });
  } catch (error) { next(error); }
});
async function setStudentStatus(req, res, next, active) {
  try {
    if (!canManageStudents(req.user.role)) return res.status(403).json({ message: "You do not have permission to change student status" });
    const student = await Student.findOneAndUpdate({ _id: req.params.id, school: req.user.school }, { active }, { new: true }).populate("user", "name email role active loginId mustChangePassword");
    if (!student) return res.status(404).json({ message: "Student not found" });
    await User.updateOne({ _id: student.user?._id || student.user, school: req.user.school }, { active });
    res.json({ message: active ? "Student and login activated successfully" : "Student and login deactivated successfully", student: serializeStudent(student) });
  } catch (error) { next(error); }
}
router.patch("/:id/status", async (req, res, next) => {
  if (typeof req.body?.active !== "boolean") return res.status(400).json({ message: "active must be a boolean" });
  return setStudentStatus(req, res, next, req.body.active);
});
router.patch("/:id/deactivate", async (req, res, next) => setStudentStatus(req, res, next, false));
router.patch("/:id/activate", async (req, res, next) => setStudentStatus(req, res, next, true));

export default router;
