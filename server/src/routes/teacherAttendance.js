import { Router } from "express";
import TeacherAttendance from "../models/TeacherAttendance.js";
import Teacher from "../models/Teacher.js";
import School from "../models/School.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

function principalOnly(req, res, next) {
  if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can manage teacher attendance" });
  next();
}

function normalizeDate(value) {
  const date = new Date(`${String(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function schoolDateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normalizeIp(value = "") {
  return String(value).replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1");
}

function requestIp(req) {
  return normalizeIp(req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "");
}

async function getTeacher(req) {
  return Teacher.findOne({ user: req.user._id, school: req.user.school }).populate("user", "name email active");
}

async function getSchool(req) {
  return School.findById(req.user.school).select("name attendanceNetwork");
}

function networkCheck(school, req) {
  const mode = String(process.env.ATTENDANCE_MODE || "development").toLowerCase();
  const ip = requestIp(req);
  if (mode !== "production" || !school?.attendanceNetwork?.enabled) {
    return { allowed: true, verified: false, source: "development", ip, message: "Development attendance mode is active." };
  }
  const allowedIps = (school.attendanceNetwork.allowedIps || []).map(normalizeIp).filter(Boolean);
  const allowed = allowedIps.includes(ip);
  return {
    allowed,
    verified: allowed,
    source: "wifi",
    ip,
    message: allowed ? "School network verified." : `Connect to ${school.attendanceNetwork.networkName || "the school's authorized Wi-Fi"} to mark attendance.`,
  };
}

function currentTimeHHMM() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function statusForCheckIn(school) {
  const time = currentTimeHHMM();
  const lateAfter = school?.attendanceNetwork?.lateAfter || "08:15";
  return time > lateAfter ? "late" : "present";
}

async function getOrCreateTodaySession(schoolId) {
  const date = normalizeDate(schoolDateKey());
  return TeacherAttendance.findOneAndUpdate(
    { school: schoolId, date },
    { $setOnInsert: { school: schoolId, date, records: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

// Teacher self-service: check today's attendance status.
router.get("/me", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher access required" });
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
    const school = await getSchool(req);
    const date = normalizeDate(schoolDateKey());
    const session = await TeacherAttendance.findOne({ school: req.user.school, date });
    const record = session?.records?.find((item) => item.teacher.toString() === teacher._id.toString()) || null;
    const network = networkCheck(school, req);
    res.json({
      teacher: { id: teacher._id, name: teacher.user?.name || req.user.name, employeeId: teacher.employeeId },
      date: schoolDateKey(),
      record,
      network,
      window: {
        start: school?.attendanceNetwork?.checkInStart || "07:30",
        lateAfter: school?.attendanceNetwork?.lateAfter || "08:15",
        close: school?.attendanceNetwork?.checkInClose || "10:00",
      },
    });
  } catch (error) { next(error); }
});

router.post("/check-in", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher access required" });
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
    const school = await getSchool(req);
    const network = networkCheck(school, req);
    if (!network.allowed) return res.status(403).json({ code: "SCHOOL_NETWORK_REQUIRED", message: network.message, network });

    const time = currentTimeHHMM();
    const start = school?.attendanceNetwork?.checkInStart || "07:30";
    const close = school?.attendanceNetwork?.checkInClose || "10:00";
    if (time < start) return res.status(400).json({ message: `Teacher attendance opens at ${start}.`, network });
    if (time > close) return res.status(400).json({ message: "Today's check-in window is closed. Contact the principal for a manual adjustment.", network });

    const session = await getOrCreateTodaySession(req.user.school);
    let record = session.records.find((item) => item.teacher.toString() === teacher._id.toString());
    if (record?.checkIn) return res.status(409).json({ message: "Today's attendance is already checked in.", record, network });

    const now = new Date();
    if (!record) {
      record = { teacher: teacher._id, status: statusForCheckIn(school), checkIn: now, checkOut: null, source: network.source, verification: { networkVerified: network.verified, ipAddress: network.ip }, note: "", markedBy: req.user._id, manuallyAdjusted: false };
      session.records.push(record);
    } else {
      record.status = statusForCheckIn(school);
      record.checkIn = now;
      record.source = network.source;
      record.verification = { networkVerified: network.verified, ipAddress: network.ip };
      record.markedBy = req.user._id;
    }
    session.submittedAt = now;
    await session.save();
    res.json({ message: record.status === "late" ? "Check-in recorded as late." : "Attendance marked successfully.", record, network });
  } catch (error) { next(error); }
});

router.post("/check-out", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher access required" });
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
    const school = await getSchool(req);
    const network = networkCheck(school, req);
    if (!network.allowed) return res.status(403).json({ code: "SCHOOL_NETWORK_REQUIRED", message: network.message, network });

    const date = normalizeDate(schoolDateKey());
    const session = await TeacherAttendance.findOne({ school: req.user.school, date });
    const record = session?.records?.find((item) => item.teacher.toString() === teacher._id.toString());
    if (!record?.checkIn) return res.status(400).json({ message: "Check-in is required before check-out." });
    if (record.checkOut) return res.status(409).json({ message: "Today's attendance is already checked out.", record });

    record.checkOut = new Date();
    record.verification = { networkVerified: network.verified, ipAddress: network.ip };
    session.submittedAt = new Date();
    await session.save();
    res.json({ message: "Check-out recorded successfully.", record, network });
  } catch (error) { next(error); }
});

router.get("/history", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher access required" });
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
    const limit = Math.min(Math.max(Number(req.query.limit) || 31, 1), 90);
    const sessions = await TeacherAttendance.find({ school: req.user.school, "records.teacher": teacher._id }).sort({ date: -1 }).limit(limit);
    const history = sessions.map((session) => ({ date: session.date, record: session.records.find((item) => item.teacher.toString() === teacher._id.toString()) }));
    res.json({ history });
  } catch (error) { next(error); }
});

// Principal daily register and manual correction.
router.get("/", principalOnly, async (req, res, next) => {
  try {
    const date = normalizeDate(req.query.date || schoolDateKey());
    if (!date) return res.status(400).json({ message: "Invalid date" });
    const teachers = await Teacher.find({ school: req.user.school }).populate({ path: "user", select: "name email active role" }).sort({ createdAt: 1 });
    const session = await TeacherAttendance.findOne({ school: req.user.school, date });
    const recordMap = new Map((session?.records || []).map((record) => [record.teacher.toString(), record]));
    const items = teachers.filter((teacher) => teacher.user).map((teacher) => {
      const record = recordMap.get(teacher._id.toString());
      return {
        id: teacher._id, userId: teacher.user._id, name: teacher.user.name, email: teacher.user.email, active: teacher.user.active,
        employeeId: teacher.employeeId, designation: teacher.designation || "Teacher", department: teacher.department || "",
        status: record?.status || "not_marked", note: record?.note || "", checkIn: record?.checkIn || null, checkOut: record?.checkOut || null,
      };
    });
    res.json({ teachers: items, session });
  } catch (error) { next(error); }
});

router.post("/session", principalOnly, async (req, res, next) => {
  try {
    const { date, records = [] } = req.body || {};
    if (!date || !Array.isArray(records)) return res.status(400).json({ message: "date and records are required" });
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return res.status(400).json({ message: "Invalid date" });
    const teachers = await Teacher.find({ school: req.user.school }).select("_id");
    const validTeacherIds = new Set(teachers.map((teacher) => teacher._id.toString()));
    const validStatuses = new Set(["present", "absent", "late", "on_leave", "not_marked"]);
    const cleanRecords = records.filter((record) => validTeacherIds.has(String(record.teacher))).map((record) => ({
      teacher: record.teacher,
      status: validStatuses.has(record.status) && record.status !== "not_marked" ? record.status : "present",
      checkIn: record.checkIn || null,
      checkOut: record.checkOut || null,
      source: "admin",
      verification: { networkVerified: false, ipAddress: requestIp(req) },
      note: String(record.note || "").trim(),
      markedBy: req.user._id,
      manuallyAdjusted: true,
    }));
    const session = await TeacherAttendance.findOneAndUpdate(
      { school: req.user.school, date: normalizedDate },
      { $set: { markedBy: req.user._id, records: cleanRecords, submittedAt: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ message: "Teacher attendance saved successfully", session });
  } catch (error) { next(error); }
});

export default router;
