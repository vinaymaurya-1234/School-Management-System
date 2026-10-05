import { Router } from "express";
import TeacherAttendance from "../models/TeacherAttendance.js";
import TeacherAttendanceRequest from "../models/TeacherAttendanceRequest.js";
import Teacher from "../models/Teacher.js";
import School from "../models/School.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

const WINDOW = { start: "07:00", onTimeUntil: "07:15", close: "08:00" };

function principalOnly(req, res, next) {
  if (req.user.role !== ROLES.PRINCIPAL) return res.status(403).json({ message: "Only the principal can review teacher attendance" });
  next();
}

function normalizeDate(value) {
  const date = new Date(`${String(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function schoolDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
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

function statusForCheckIn() {
  return currentTimeHHMM() <= WINDOW.onTimeUntil ? "present" : "late";
}

function windowForResponse() {
  return { start: WINDOW.start, lateAfter: WINDOW.onTimeUntil, close: WINDOW.close, description: "07:00–07:15 on time · 07:16–08:00 late · after 08:00 closed" };
}

function isPastCheckInWindow(date) {
  const today = schoolDateKey();
  const key = schoolDateKey(date);
  if (key < today) return true;
  if (key > today) return false;
  return currentTimeHHMM() > WINDOW.close;
}

async function getOrCreateSession(schoolId, date) {
  return TeacherAttendance.findOneAndUpdate(
    { school: schoolId, date },
    { $setOnInsert: { school: schoolId, date, records: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function ensureAbsentRecords(schoolId, date) {
  if (!isPastCheckInWindow(date)) return null;
  const teachers = await Teacher.find({ school: schoolId }).select("_id");
  if (!teachers.length) return null;

  const session = await getOrCreateSession(schoolId, date);
  const existing = new Set(session.records.map((record) => String(record.teacher)));
  let changed = false;

  for (const teacher of teachers) {
    if (existing.has(String(teacher._id))) continue;
    session.records.push({
      teacher: teacher._id,
      status: "absent",
      checkIn: null,
      checkOut: null,
      source: "development",
      verification: { networkVerified: false, ipAddress: "" },
      note: "No check-in recorded before the attendance window closed.",
      markedBy: null,
      manuallyAdjusted: false,
    });
    changed = true;
  }

  if (changed) await session.save();
  return session;
}

function applyApprovalToRecord(session, request, decisionStatus) {
  let record = session.records.find((item) => item.teacher.toString() === request.teacher.toString());

  if (!record) {
    record = {
      teacher: request.teacher,
      status: decisionStatus,
      checkIn: null,
      checkOut: null,
      source: "admin",
      verification: { networkVerified: false, ipAddress: "" },
      note: `Approved attendance request: ${request.reason}`,
      markedBy: request.reviewedBy || null,
      manuallyAdjusted: true,
    };
    session.records.push(record);
    return record;
  }

  // Principal approval is authoritative. Keep any real check-in/check-out timestamps,
  // but replace the attendance classification with the approved classification.
  record.status = decisionStatus;
  record.source = "admin";
  record.note = `Approved attendance request: ${request.reason}`;
  record.markedBy = request.reviewedBy || record.markedBy || null;
  record.manuallyAdjusted = true;
  return record;
}

async function syncApprovedRequests(schoolId, date, existingSession = null) {
  const approved = await TeacherAttendanceRequest.find({ school: schoolId, date, status: "approved" }).sort({ reviewedAt: 1, updatedAt: 1 });
  if (!approved.length) return existingSession;

  const session = existingSession || await getOrCreateSession(schoolId, date);
  let changed = false;

  for (const request of approved) {
    // Older approved requests may not have decisionStatus. Treat those as present;
    // all new approvals always persist the explicit decision below.
    const decisionStatus = ["present", "late", "on_leave"].includes(request.decisionStatus) ? request.decisionStatus : "present";
    const before = session.records.find((item) => item.teacher.toString() === request.teacher.toString());
    const beforeStatus = before?.status;
    const beforeManual = before?.manuallyAdjusted;
    const beforeSource = before?.source;
    applyApprovalToRecord(session, request, decisionStatus);
    if (!before || beforeStatus !== decisionStatus || !beforeManual || beforeSource !== "admin") changed = true;
  }

  if (changed) {
    const latest = approved[approved.length - 1];
    session.markedBy = latest.reviewedBy || session.markedBy;
    session.submittedAt = new Date();
    await session.save();
  }
  return session;
}

router.get("/me", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher access required" });
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
    const school = await getSchool(req);
    const date = normalizeDate(schoolDateKey());
    let session = await ensureAbsentRecords(req.user.school, date);
    session = await syncApprovedRequests(req.user.school, date, session);
    const record = session?.records?.find((item) => item.teacher.toString() === teacher._id.toString()) || null;
    const network = networkCheck(school, req);
    const request = await TeacherAttendanceRequest.findOne({ school: req.user.school, teacher: teacher._id, date }).sort({ createdAt: -1 });
    res.json({ teacher: { id: teacher._id, name: teacher.user?.name || req.user.name, employeeId: teacher.employeeId }, date: schoolDateKey(), record, request, network, window: windowForResponse() });
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
    if (time < WINDOW.start) return res.status(400).json({ message: `Teacher attendance opens at ${WINDOW.start}.`, network });
    if (time > WINDOW.close) return res.status(400).json({ code: "CHECK_IN_WINDOW_CLOSED", message: "Today's check-in window is closed. Send an attendance request to the principal with your reason.", network });

    const date = normalizeDate(schoolDateKey());
    const session = await getOrCreateSession(req.user.school, date);
    let record = session.records.find((item) => item.teacher.toString() === teacher._id.toString());
    if (record?.checkIn) return res.status(409).json({ message: "Today's attendance is already checked in.", record, network });

    const now = new Date();
    const status = statusForCheckIn();
    if (!record) {
      record = { teacher: teacher._id, status, checkIn: now, checkOut: null, source: network.source, verification: { networkVerified: network.verified, ipAddress: network.ip }, note: "", markedBy: req.user._id, manuallyAdjusted: false };
      session.records.push(record);
    } else {
      record.status = status;
      record.checkIn = now;
      record.checkOut = null;
      record.source = network.source;
      record.verification = { networkVerified: network.verified, ipAddress: network.ip };
      record.note = "";
      record.markedBy = req.user._id;
      record.manuallyAdjusted = false;
    }
    session.submittedAt = now;
    await session.save();
    res.json({ message: status === "late" ? "Check-in recorded as late." : "Attendance marked successfully.", record, network });
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

router.post("/request", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher access required" });
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

    const date = normalizeDate(req.body?.date || schoolDateKey());
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "Please provide a reason for the attendance request." });

    const existing = await TeacherAttendanceRequest.findOne({ school: req.user.school, teacher: teacher._id, date, status: "pending" });
    if (existing) return res.status(409).json({ message: "An attendance request is already pending for this date.", request: existing });

    const request = await TeacherAttendanceRequest.create({ school: req.user.school, teacher: teacher._id, date, reason });
    res.status(201).json({ message: "Attendance request sent to the principal.", request });
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

router.get("/", principalOnly, async (req, res, next) => {
  try {
    const date = normalizeDate(req.query.date || schoolDateKey());
    if (!date) return res.status(400).json({ message: "Invalid date" });

    let session = await ensureAbsentRecords(req.user.school, date);
    session = await syncApprovedRequests(req.user.school, date, session);

    const teachers = await Teacher.find({ school: req.user.school }).populate({ path: "user", select: "name email active role" }).sort({ createdAt: 1 });
    const recordMap = new Map((session?.records || []).map((record) => [record.teacher.toString(), record]));
    const items = teachers.filter((teacher) => teacher.user).map((teacher) => {
      const record = recordMap.get(teacher._id.toString());
      return {
        id: teacher._id,
        userId: teacher.user._id,
        name: teacher.user.name,
        email: teacher.user.email,
        active: teacher.user.active,
        employeeId: teacher.employeeId,
        designation: teacher.designation || "Teacher",
        department: teacher.department || "",
        status: record?.status || "not_marked",
        note: record?.note || "",
        checkIn: record?.checkIn || null,
        checkOut: record?.checkOut || null,
        verification: record?.verification || null,
      };
    });

    res.json({ teachers: items, session, window: windowForResponse() });
  } catch (error) { next(error); }
});

router.get("/requests", principalOnly, async (req, res, next) => {
  try {
    const filter = { school: req.user.school, status: "pending" };
    if (req.query.date) {
      const date = normalizeDate(req.query.date);
      if (!date) return res.status(400).json({ message: "Invalid date" });
      filter.date = date;
    }
    const requests = await TeacherAttendanceRequest.find(filter)
      .populate({ path: "teacher", populate: { path: "user", select: "name email" } })
      .sort({ createdAt: -1 });
    res.json({ requests });
  } catch (error) { next(error); }
});

router.patch("/requests/:id/approve", principalOnly, async (req, res, next) => {
  try {
    const request = await TeacherAttendanceRequest.findOne({ _id: req.params.id, school: req.user.school, status: "pending" });
    if (!request) return res.status(404).json({ message: "Attendance request not found or already reviewed." });

    const decisionStatus = ["present", "late", "on_leave"].includes(req.body?.status) ? req.body.status : null;
    if (!decisionStatus) return res.status(400).json({ message: "Choose present, late or on leave when approving the request." });

    request.status = "approved";
    request.decisionStatus = decisionStatus;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = String(req.body?.reviewNote || "").trim();
    await request.save();

    const session = await getOrCreateSession(req.user.school, request.date);
    const record = applyApprovalToRecord(session, request, decisionStatus);
    session.markedBy = req.user._id;
    session.submittedAt = new Date();
    await session.save();

    res.json({ message: `Attendance request approved as ${decisionStatus}.`, request, record, session });
  } catch (error) { next(error); }
});

router.patch("/requests/:id/reject", principalOnly, async (req, res, next) => {
  try {
    const request = await TeacherAttendanceRequest.findOne({ _id: req.params.id, school: req.user.school, status: "pending" });
    if (!request) return res.status(404).json({ message: "Attendance request not found or already reviewed." });

    request.status = "rejected";
    request.decisionStatus = null;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = String(req.body?.reviewNote || "").trim();
    await request.save();

    // Rejection does not let the principal manually turn a teacher into another status.
    // If the window is closed and an absent record exists, it remains absent.
    const session = await TeacherAttendance.findOne({ school: req.user.school, date: request.date });
    res.json({ message: "Attendance request rejected. Teacher remains absent unless a valid attendance record already exists.", request, session });
  } catch (error) { next(error); }
});

export default router;
