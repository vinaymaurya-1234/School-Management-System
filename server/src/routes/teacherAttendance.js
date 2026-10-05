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
  return { allowed, verified: allowed, source: "wifi", ip, message: allowed ? "School network verified." : `Connect to ${school.attendanceNetwork.networkName || "the school's authorized Wi-Fi"} to mark attendance.` };
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

// Attendance records are updated with targeted MongoDB operations only. We do
// not load the whole daily session, change it in memory and save it, because a
// stale session can overwrite another teacher's approved attendance.
async function ensureAbsentRecords(schoolId, date) {
  if (!isPastCheckInWindow(date)) return TeacherAttendance.findOne({ school: schoolId, date });

  const teachers = await Teacher.find({ school: schoolId }).select("_id");
  if (!teachers.length) return TeacherAttendance.findOne({ school: schoolId, date });

  await getOrCreateSession(schoolId, date);

  for (const teacher of teachers) {
    await TeacherAttendance.updateOne(
      { school: schoolId, date, "records.teacher": { $ne: teacher._id } },
      {
        $push: {
          records: {
            teacher: teacher._id,
            status: "absent",
            checkIn: null,
            checkOut: null,
            source: "development",
            verification: { networkVerified: false, ipAddress: "" },
            note: "No check-in recorded before the attendance window closed.",
            markedBy: null,
            manuallyAdjusted: false,
          },
        },
      },
    );
  }

  return TeacherAttendance.findOne({ school: schoolId, date });
}

async function persistApprovedAttendance(schoolId, request, decisionStatus) {
  const note = `Approved attendance request: ${request.reason}`;
  const updateFields = {
    "records.$.status": decisionStatus,
    "records.$.source": "admin",
    "records.$.note": note,
    "records.$.markedBy": request.reviewedBy || null,
    "records.$.manuallyAdjusted": true,
    submittedAt: new Date(),
    markedBy: request.reviewedBy || null,
  };

  // First try to update the existing teacher record atomically.
  const update = await TeacherAttendance.updateOne(
    { school: schoolId, date: request.date, "records.teacher": request.teacher },
    { $set: updateFields },
  );

  // If the record does not exist yet, create the daily session if necessary and
  // append only this teacher. If another request inserts it concurrently, the
  // final targeted update wins instead of saving a stale whole-session object.
  if (update.matchedCount === 0) {
    await getOrCreateSession(schoolId, request.date);
    const appendResult = await TeacherAttendance.updateOne(
      { school: schoolId, date: request.date, "records.teacher": { $ne: request.teacher } },
      {
        $push: {
          records: {
            teacher: request.teacher,
            status: decisionStatus,
            checkIn: null,
            checkOut: null,
            source: "admin",
            verification: { networkVerified: false, ipAddress: "" },
            note,
            markedBy: request.reviewedBy || null,
            manuallyAdjusted: true,
          },
        },
        $set: { submittedAt: new Date(), markedBy: request.reviewedBy || null },
      },
    );

    if (appendResult.matchedCount === 0) {
      await TeacherAttendance.updateOne(
        { school: schoolId, date: request.date, "records.teacher": request.teacher },
        { $set: updateFields },
      );
    }
  }

  // Verify the exact record that was just approved before returning success.
  const session = await TeacherAttendance.findOne({ school: schoolId, date: request.date });
  const record = session?.records?.find((item) => String(item.teacher) === String(request.teacher)) || null;
  if (!record || record.status !== decisionStatus) {
    throw new Error("Attendance approval could not be persisted to the daily register.");
  }

  return { session, record };
}

// Approved requests are the authoritative exception decision. This is used as
// a read-time safety net so an already-approved request can never appear as
// absent because of an old/missing daily record.
async function getApprovedDecisionMap(schoolId, date) {
  const approved = await TeacherAttendanceRequest.find({ school: schoolId, date, status: "approved" }).select("teacher decisionStatus reviewedBy reviewedAt reason");
  return new Map(
    approved
      .filter((request) => ["present", "late", "on_leave"].includes(request.decisionStatus))
      .map((request) => [String(request.teacher), request]),
  );
}

router.get("/me", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.TEACHER) return res.status(403).json({ message: "Teacher access required" });
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
    const school = await getSchool(req);
    const date = normalizeDate(schoolDateKey());
    const session = await ensureAbsentRecords(req.user.school, date);
    const record = session?.records?.find((item) => String(item.teacher) === String(teacher._id)) || null;
    const approvedMap = await getApprovedDecisionMap(req.user.school, date);
    const approvedRequest = approvedMap.get(String(teacher._id));
    const authoritativeRecord = approvedRequest && (!record || record.status === "absent")
      ? { ...(record?.toObject?.() || record || {}), teacher: teacher._id, status: approvedRequest.decisionStatus, source: "admin", manuallyAdjusted: true, note: `Approved attendance request: ${approvedRequest.reason}`, markedBy: approvedRequest.reviewedBy, checkIn: record?.checkIn || null, checkOut: record?.checkOut || null }
      : record;
    const network = networkCheck(school, req);
    const request = await TeacherAttendanceRequest.findOne({ school: req.user.school, teacher: teacher._id, date }).sort({ createdAt: -1 });
    res.json({ teacher: { id: teacher._id, name: teacher.user?.name || req.user.name, employeeId: teacher.employeeId }, date: schoolDateKey(), record: authoritativeRecord, request, network, window: windowForResponse() });
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
    const now = new Date();
    const status = statusForCheckIn();
    const existingSession = await TeacherAttendance.findOne({ school: req.user.school, date }).select("records");
    const existingRecord = existingSession?.records?.find((item) => String(item.teacher) === String(teacher._id));
    if (existingRecord?.checkIn) return res.status(409).json({ message: "Today's attendance is already checked in.", record: existingRecord, network });

    if (existingRecord) {
      const update = await TeacherAttendance.updateOne(
        { school: req.user.school, date, "records.teacher": teacher._id },
        {
          $set: {
            "records.$.status": status,
            "records.$.checkIn": now,
            "records.$.checkOut": null,
            "records.$.source": network.source,
            "records.$.verification": { networkVerified: network.verified, ipAddress: network.ip },
            "records.$.note": "",
            "records.$.markedBy": req.user._id,
            "records.$.manuallyAdjusted": false,
            submittedAt: now,
          },
        },
      );
      if (!update.matchedCount) return res.status(409).json({ message: "Attendance changed while checking in. Please try again." });
    } else {
      await getOrCreateSession(req.user.school, date);
      const update = await TeacherAttendance.updateOne(
        { school: req.user.school, date, "records.teacher": { $ne: teacher._id } },
        {
          $push: { records: { teacher: teacher._id, status, checkIn: now, checkOut: null, source: network.source, verification: { networkVerified: network.verified, ipAddress: network.ip }, note: "", markedBy: req.user._id, manuallyAdjusted: false } },
          $set: { submittedAt: now },
        },
      );
      if (!update.matchedCount) return res.status(409).json({ message: "Attendance changed while checking in. Please try again." });
    }

    const session = await TeacherAttendance.findOne({ school: req.user.school, date });
    const record = session?.records?.find((item) => String(item.teacher) === String(teacher._id));
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
    const now = new Date();
    const update = await TeacherAttendance.updateOne(
      { school: req.user.school, date, records: { $elemMatch: { teacher: teacher._id, checkIn: { $ne: null }, checkOut: null } } },
      { $set: { "records.$.checkOut": now, "records.$.verification": { networkVerified: network.verified, ipAddress: network.ip }, submittedAt: now } },
    );
    if (!update.matchedCount) {
      const session = await TeacherAttendance.findOne({ school: req.user.school, date });
      const record = session?.records?.find((item) => String(item.teacher) === String(teacher._id));
      if (!record?.checkIn) return res.status(400).json({ message: "Check-in is required before check-out." });
      if (record.checkOut) return res.status(409).json({ message: "Today's attendance is already checked out.", record });
      return res.status(409).json({ message: "Attendance changed while checking out. Please try again." });
    }
    const session = await TeacherAttendance.findOne({ school: req.user.school, date });
    const record = session?.records?.find((item) => String(item.teacher) === String(teacher._id));
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
    const history = sessions.map((session) => ({ date: session.date, record: session.records.find((item) => String(item.teacher) === String(teacher._id)) }));
    res.json({ history });
  } catch (error) { next(error); }
});

router.get("/", principalOnly, async (req, res, next) => {
  try {
    const date = normalizeDate(req.query.date || schoolDateKey());
    if (!date) return res.status(400).json({ message: "Invalid date" });
    const session = await ensureAbsentRecords(req.user.school, date);
    const approvedMap = await getApprovedDecisionMap(req.user.school, date);
    const teachers = await Teacher.find({ school: req.user.school }).populate({ path: "user", select: "name email active role" }).sort({ createdAt: 1 });
    const recordMap = new Map((session?.records || []).map((record) => [String(record.teacher), record]));
    const items = teachers.filter((teacher) => teacher.user).map((teacher) => {
      const record = recordMap.get(String(teacher._id));
      const approvedRequest = approvedMap.get(String(teacher._id));
      const approvedStatus = approvedRequest?.decisionStatus;
      const status = approvedStatus && (!record || record.status === "absent") ? approvedStatus : (record?.status || "not_marked");
      const note = approvedStatus && (!record || record.status === "absent") ? `Approved attendance request: ${approvedRequest.reason}` : (record?.note || "");
      return { id: teacher._id, userId: teacher.user._id, name: teacher.user.name, email: teacher.user.email, active: teacher.user.active, employeeId: teacher.employeeId, designation: teacher.designation || "Teacher", department: teacher.department || "", status, note, checkIn: record?.checkIn || null, checkOut: record?.checkOut || null, verification: record?.verification || null };
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
    const requests = await TeacherAttendanceRequest.find(filter).populate({ path: "teacher", populate: { path: "user", select: "name email" } }).sort({ createdAt: -1 });
    res.json({ requests });
  } catch (error) { next(error); }
});

router.patch("/requests/:id/approve", principalOnly, async (req, res, next) => {
  try {
    const request = await TeacherAttendanceRequest.findOne({ _id: req.params.id, school: req.user.school, status: "pending" });
    if (!request) return res.status(404).json({ message: "Attendance request not found or already reviewed." });

    const decisionStatus = ["present", "late", "on_leave"].includes(req.body?.status) ? req.body.status : null;
    if (!decisionStatus) return res.status(400).json({ message: "Choose present, late or on leave when approving the request." });

    // Prepare the request decision first, but only mark it approved after the
    // daily attendance record has been verified in MongoDB.
    request.decisionStatus = decisionStatus;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = String(req.body?.reviewNote || "").trim();

    const persisted = await persistApprovedAttendance(req.user.school, request, decisionStatus);
    request.status = "approved";
    await request.save();

    res.json({ message: `Attendance request approved as ${decisionStatus}.`, request, record: persisted.record, session: persisted.session });
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
    const session = await TeacherAttendance.findOne({ school: req.user.school, date: request.date });
    res.json({ message: "Attendance request rejected. Teacher remains absent unless a valid attendance record already exists.", request, session });
  } catch (error) { next(error); }
});

export default router;
