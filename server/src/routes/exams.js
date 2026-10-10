import { Router } from "express";
import Exam from "../models/Exam.js";
import StudentMarks from "../models/StudentMarks.js";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import { AcademicYear, SchoolClass, Section, StudentEnrollment, TeacherAssignment } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

async function teacherOwnsExam(user, exam) {
  if (user.role === ROLES.PRINCIPAL) return true;
  if (user.role !== ROLES.TEACHER) return false;
  const assignments = await TeacherAssignment.find({
    school: user.school,
    academicYear: exam.academicYear,
    teacher: user._id,
    class: exam.class,
    section: exam.section,
    status: "active",
  }).populate("subject", "name");
  const wanted = String(exam.subjectName || "").trim().toLowerCase();
  return assignments.some((assignment) => String(assignment.subject?.name || "").trim().toLowerCase() === wanted);
}

async function loadExamForMarks(req, res) {
  const exam = await Exam.findOne({ _id: req.params.id, school: req.user.school });
  if (!exam) {
    res.status(404).json({ message: "Exam not found for this school" });
    return null;
  }
  if (!(await teacherOwnsExam(req.user, exam))) {
    res.status(403).json({ message: "Marks entry is available only for your assigned class, section and subject" });
    return null;
  }
  return exam;
}

router.get("/:id/marks", async (req, res, next) => {
  try {
    if (![ROLES.TEACHER, ROLES.PRINCIPAL].includes(req.user.role)) {
      return res.status(403).json({ message: "You cannot access marks entry" });
    }
    const exam = await loadExamForMarks(req, res);
    if (!exam) return;

    const enrollments = await StudentEnrollment.find({
      school: req.user.school,
      academicYear: exam.academicYear,
      class: exam.class,
      section: exam.section,
      status: "active",
    }).populate("student", "name email").sort({ createdAt: 1 });

    const studentIds = enrollments.map((item) => item.student?._id).filter(Boolean);
    const [records, profiles] = await Promise.all([
      StudentMarks.find({ exam: exam._id, student: { $in: studentIds } }).lean(),
      Student.find({ school: req.user.school, user: { $in: studentIds } }).select("user admissionNumber").lean(),
    ]);
    const recordByStudent = new Map(records.map((item) => [String(item.student), item]));
    const profileByUser = new Map(profiles.map((item) => [String(item.user), item]));
    const students = enrollments.filter((item) => item.student).map((item) => {
      const student = item.student;
      const profile = profileByUser.get(String(student._id));
      const record = recordByStudent.get(String(student._id));
      return {
        studentId: String(student._id),
        name: student.name,
        email: student.email,
        admissionNumber: profile?.admissionNumber || "",
        marksObtained: record?.marksObtained ?? "",
        remarks: record?.remarks || "",
        status: record?.status || "not-entered",
      };
    });

    res.json({
      exam: {
        _id: exam._id,
        subjectName: exam.subjectName,
        class: exam.class,
        section: exam.section,
        scheduledAt: exam.scheduledAt,
        maxMarks: exam.maxMarks || 100,
      },
      students,
      locked: records.some((item) => ["approved", "published"].includes(item.status)),
      summary: {
        total: students.length,
        entered: students.filter((item) => item.status !== "not-entered").length,
        submitted: students.filter((item) => item.status === "submitted").length,
        approved: students.filter((item) => item.status === "approved").length,
        published: students.filter((item) => item.status === "published").length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id/marks", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) {
      return res.status(403).json({ message: "Only the assigned teacher can enter and submit marks" });
    }
    const exam = await loadExamForMarks(req, res);
    if (!exam) return;
    const examDateKey = new Date(exam.scheduledAt).toISOString().slice(0, 10);
    const todayDateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (examDateKey > todayDateKey) return res.status(400).json({ message: "Marks entry opens on the scheduled exam date" });

    const { marks, submit = false } = req.body || {};
    if (!Array.isArray(marks) || !marks.length) {
      return res.status(400).json({ message: "Enter marks for at least one student" });
    }

    const enrollments = await StudentEnrollment.find({
      school: req.user.school,
      academicYear: exam.academicYear,
      class: exam.class,
      section: exam.section,
      status: "active",
    }).select("student");
    const enrolledIds = new Set(enrollments.map((item) => String(item.student)));
    const lockedMarks = await StudentMarks.findOne({
      school: req.user.school,
      exam: exam._id,
      student: { $in: marks.map((item) => item.studentId).filter(Boolean) },
      status: { $in: ["approved", "published"] },
    }).select("_id status");
    if (lockedMarks) return res.status(409).json({ message: "These marks have already been approved or published and can no longer be edited by the teacher" });
    const maxMarks = Number(exam.maxMarks || 100);
    const seen = new Set();
    for (const item of marks) {
      const studentId = String(item.studentId || "");
      const value = item.marksObtained === "" || item.marksObtained === null ? NaN : Number(item.marksObtained);
      if (!enrolledIds.has(studentId)) return res.status(400).json({ message: "A selected student does not belong to this exam's class and section" });
      if (seen.has(studentId)) return res.status(400).json({ message: "Duplicate student found in marks submission" });
      if (!Number.isFinite(value) || value < 0 || value > maxMarks) {
        return res.status(400).json({ message: `Marks must be between 0 and ${maxMarks}` });
      }
      if (item.remarks && String(item.remarks).length > 300) return res.status(400).json({ message: "Remarks cannot exceed 300 characters" });
      seen.add(studentId);
    }
    if (submit && (seen.size !== enrolledIds.size || [...enrolledIds].some((id) => !seen.has(id)))) {
      return res.status(400).json({ message: "Enter marks for every student before submitting this class" });
    }

    const status = submit ? "submitted" : "draft";
    const submittedAt = submit ? new Date() : null;
    await Promise.all(marks.map((item) => StudentMarks.findOneAndUpdate(
      { school: req.user.school, exam: exam._id, student: item.studentId },
      {
        $set: {
          academicYear: exam.academicYear,
          marksObtained: Number(item.marksObtained),
          maxMarks,
          remarks: String(item.remarks || "").trim(),
          status,
          enteredBy: req.user._id,
          submittedAt,
        },
        $setOnInsert: { school: req.user.school, exam: exam._id, student: item.studentId },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )));
    res.json({ message: submit ? "Marks submitted to the principal for review" : "Marks saved as draft", status, saved: marks.length });
  } catch (error) {
    next(error);
  }
});

async function activeYearForSchool(schoolId, academicYearId) {
  if (academicYearId) {
    return AcademicYear.findOne({ _id: academicYearId, school: schoolId });
  }
  return AcademicYear.findOne({ school: schoolId, isActive: true });
}

async function studentScope(userId, schoolId, academicYearId) {
  return StudentEnrollment.findOne({
    student: userId,
    school: schoolId,
    academicYear: academicYearId,
    status: "active",
  }).select("class section");
}

async function parentScope(userId, schoolId, academicYearId) {
  const parent = await Parent.findOne({ user: userId, school: schoolId }).select("children");
  if (!parent?.children?.length) return null;

  const children = await Student.find({
    _id: { $in: parent.children },
    school: schoolId,
    active: true,
  }).select("user");
  const childUserIds = children.map((child) => child.user);
  return StudentEnrollment.find({
    student: { $in: childUserIds },
    school: schoolId,
    academicYear: academicYearId,
    status: "active",
  }).select("class section student");
}

async function validateExamItems({ school, academicYear, classId, sectionId, items }) {
  const year = await AcademicYear.findOne({ _id: academicYear, school });
  const schoolClass = await SchoolClass.findOne({ _id: classId, school, academicYear });
  const section = await Section.findOne({ _id: sectionId, school, academicYear, class: classId });

  if (!year) return { error: [404, "Academic year not found"] };
  if (!schoolClass) return { error: [404, "Class not found"] };
  if (!section) return { error: [404, "Section does not belong to the selected class"] };
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return { error: [400, "Add between 1 and 30 exams"] };
  }

  const normalized = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    if (!item.subjectName?.trim() || !item.scheduledAt || !item.endsAt) {
      return { error: [400, `Exam ${index + 1}: subject, start time and end time are required`] };
    }

    const maxMarks = Number(item.maxMarks ?? 100);
    if (!Number.isFinite(maxMarks) || maxMarks < 1 || maxMarks > 1000) return { error: [400, `Exam ${index + 1}: maximum marks must be between 1 and 1000`] };
    const start = new Date(item.scheduledAt);
    const end = new Date(item.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { error: [400, `Exam ${index + 1}: invalid exam date or time`] };
    }
    if (end <= start) {
      return { error: [400, `Exam ${index + 1}: end time must be after the start time`] };
    }

    normalized.push({
      school,
      academicYear,
      class: classId,
      section: sectionId,
      subjectName: item.subjectName.trim(),
      maxMarks: Number(item.maxMarks || 100),
      scheduledAt: start,
      endsAt: end,
    });
  }

  return { year, normalized };
}

router.get("/", async (req, res, next) => {
  try {
    const year = await activeYearForSchool(req.user.school, req.query.academicYear);
    if (!year) return res.json({ exams: [], academicYear: null });

    const filter = { school: req.user.school, academicYear: year._id };

    if (req.user.role === ROLES.STUDENT) {
      const enrollment = await studentScope(req.user._id, req.user.school, year._id);
      if (!enrollment) return res.json({ exams: [], academicYear: year });
      filter.class = enrollment.class;
      filter.section = enrollment.section;
    }

    if (req.user.role === ROLES.PARENT) {
      const enrollments = await parentScope(req.user._id, req.user.school, year._id);
      if (!enrollments?.length) return res.json({ exams: [], academicYear: year });
      filter.$or = enrollments.map((item) => ({ class: item.class, section: item.section }));
    }

    if (req.query.classId && [ROLES.PRINCIPAL, ROLES.TEACHER].includes(req.user.role)) {
      filter.class = req.query.classId;
    }
    if (req.query.sectionId && [ROLES.PRINCIPAL, ROLES.TEACHER].includes(req.user.role)) {
      filter.section = req.query.sectionId;
    }

    if (req.user.role === ROLES.TEACHER) {
      const assignmentFilter = {
        school: req.user.school,
        academicYear: year._id,
        teacher: req.user._id,
        status: "active",
      };
      if (req.query.classId) assignmentFilter.class = req.query.classId;
      if (req.query.sectionId) assignmentFilter.section = req.query.sectionId;
      const assignments = await TeacherAssignment.find(assignmentFilter).populate("subject", "name");
      const assignedExamScopes = assignments.filter((item) => item.subject?.name).map((item) => ({
        classId: String(item.class),
        sectionId: String(item.section),
        subjectName: String(item.subject.name).trim().toLowerCase(),
      }));
      if (!assignedExamScopes.length) return res.json({ exams: [], academicYear: year });
      filter.$or = [...new Map(assignedExamScopes.map((item) => [`${item.classId}:${item.sectionId}`, { class: item.classId, section: item.sectionId }])).values()];
      const scheduled = await Exam.find(filter)
        .populate("class", "name")
        .populate("section", "name")
        .sort({ scheduledAt: 1, subjectName: 1 });
      const allowedSubjects = new Map();
      for (const item of assignedExamScopes) {
        const key = `${item.classId}:${item.sectionId}`;
        if (!allowedSubjects.has(key)) allowedSubjects.set(key, new Set());
        allowedSubjects.get(key).add(item.subjectName);
      }
      const exams = scheduled.filter((exam) => allowedSubjects.get(`${String(exam.class?._id)}:${String(exam.section?._id)}`)?.has(String(exam.subjectName || "").trim().toLowerCase()));
      return res.json({ exams, academicYear: year });
    }

    const exams = await Exam.find(filter)
      .populate("class", "name")
      .populate("section", "name")
      .sort({ scheduledAt: 1, subjectName: 1 });

    res.json({ exams, academicYear: year });
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) {
      return res.status(403).json({ message: "Only the principal can create exams" });
    }

    const { academicYear, classId, sectionId, items } = req.body || {};
    const result = await validateExamItems({ school: req.user.school, academicYear, classId, sectionId, items });
    if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });

    const documents = result.normalized.map((item) => ({ ...item, createdBy: req.user._id }));
    const exams = await Exam.insertMany(documents, { ordered: true });
    const populated = await Exam.find({ _id: { $in: exams.map((exam) => exam._id) } })
      .populate("class", "name")
      .populate("section", "name")
      .sort({ scheduledAt: 1, subjectName: 1 });

    res.status(201).json({ message: `${populated.length} exams scheduled successfully`, exams: populated });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) {
      return res.status(403).json({ message: "Only the principal can create exams" });
    }

    const { academicYear, classId, sectionId, subjectName, maxMarks, scheduledAt, endsAt } = req.body || {};
    const result = await validateExamItems({
      school: req.user.school,
      academicYear,
      classId,
      sectionId,
      items: [{ subjectName, maxMarks, scheduledAt, endsAt }],
    });
    if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });

    const exam = await Exam.create({ ...result.normalized[0], createdBy: req.user._id });
    const populated = await Exam.findById(exam._id)
      .populate("class", "name")
      .populate("section", "name");

    res.status(201).json({ message: "Exam scheduled successfully", exam: populated });
  } catch (error) {
    next(error);
  }
});

router.put("/:id/marks/review", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can review or publish marks" });
    const exam = await Exam.findOne({ _id: req.params.id, school: req.user.school });
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    const action = req.body?.action;
    if (!["approve", "publish"].includes(action)) return res.status(400).json({ message: "Choose approve or publish" });

    const enrollments = await StudentEnrollment.find({
      school: req.user.school,
      academicYear: exam.academicYear,
      class: exam.class,
      section: exam.section,
      status: "active",
    }).select("student");
    const studentIds = enrollments.map((item) => item.student);
    const records = await StudentMarks.find({ school: req.user.school, exam: exam._id, student: { $in: studentIds } });
    if (!studentIds.length || records.length !== studentIds.length) {
      return res.status(400).json({ message: "Every active student must have marks entered before review" });
    }
    if (action === "approve") {
      if (records.some((item) => !["submitted", "approved"].includes(item.status))) {
        return res.status(400).json({ message: "All marks must be submitted by the teacher before approval" });
      }
      await StudentMarks.updateMany({ school: req.user.school, exam: exam._id, student: { $in: studentIds }, status: "submitted" }, { $set: { status: "approved" } });
      return res.json({ message: "Marks approved. You can now publish the results.", status: "approved" });
    }
    if (records.some((item) => item.status !== "approved" && item.status !== "published")) {
      return res.status(400).json({ message: "Approve all submitted marks before publishing results" });
    }
    await StudentMarks.updateMany({ school: req.user.school, exam: exam._id, student: { $in: studentIds }, status: "approved" }, { $set: { status: "published" } });
    res.json({ message: "Results published for students in this class and section", status: "published" });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL) {
      return res.status(403).json({ message: "Only the principal can remove exams" });
    }
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, school: req.user.school });
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json({ message: "Exam removed successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
