import { Router } from "express";
import mongoose from "mongoose";
import LeaveRequest from "../models/LeaveRequest.js";
import LeavePolicy from "../models/LeavePolicy.js";
import Teacher from "../models/Teacher.js";
import Employee from "../models/Employee.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const BALANCE_TYPES = new Set(["casual", "sick", "earned"]);
const TYPES = new Set(["casual", "sick", "earned", "emergency", "other"]);
const validId = (value) => mongoose.isValidObjectId(value);
const dateOnly = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};
const daysBetween = (start, end) => Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
const yearBounds = (year) => ({ start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) });
const schoolToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
};
const errorResponse = (res, status, message) => res.status(status).json({ message });

async function teacherProfile(req) {
  const teacher = await Teacher.findOne({ user: req.user._id, school: req.user.school }).select("_id employeeId designation department");
  const employee = await Employee.findOne({ school: req.user.school, user: req.user._id, active: true }).select("employeeId designation department");
  return { teacher, employee };
}
function serializeRequest(item) {
  const teacher = item.teacher && typeof item.teacher === "object" ? item.teacher : null;
  return {
    id: String(item._id), teacher: teacher ? { id: String(teacher._id), name: teacher.name, email: teacher.email, role: teacher.role } : { id: String(item.teacher) },
    leaveType: item.leaveType, startDate: item.startDate, endDate: item.endDate, halfDay: item.halfDay,
    totalDays: item.totalDays, reason: item.reason, status: item.status, reviewedAt: item.reviewedAt,
    reviewNote: item.reviewNote, createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}
async function getBalance(school, teacherId) {
  const policy = await LeavePolicy.findOne({ school }).lean();
  const currentYear = new Date().getFullYear();
  const bounds = yearBounds(currentYear);
  const approved = await LeaveRequest.find({ school, teacher: teacherId, status: "approved", leaveType: { $in: [...BALANCE_TYPES] }, startDate: { $gte: bounds.start, $lt: bounds.end } }).select("leaveType totalDays").lean();
  const used = { casual: 0, sick: 0, earned: 0 };
  for (const item of approved) used[item.leaveType] += Number(item.totalDays || 0);
  const quotas = policy?.quotas || { casual: 0, sick: 0, earned: 0 };
  return {
    configured: Boolean(policy && [...BALANCE_TYPES].some((type) => Number(quotas[type]) > 0)),
    leaveTypes: Object.fromEntries([...BALANCE_TYPES].map((type) => [type, { quota: Number(quotas[type] || 0), used: used[type], remaining: Math.max(0, Number(quotas[type] || 0) - used[type]) }])),
    policyConfigured: Boolean(policy),
  };
}
async function populateRequests(query) {
  return query.populate({ path: "teacher", select: "name email role active" }).sort({ createdAt: -1 });
}

// Teacher: own leave requests and balance.
router.get("/mine", async (req, res, next) => {
  if (req.user.role !== "teacher") return errorResponse(res, 403, "Only teachers can access their leave applications");
  try {
    const requests = await populateRequests(LeaveRequest.find({ school: req.user.school, teacher: req.user._id }).limit(200));
    res.json({ requests: requests.map(serializeRequest), balance: await getBalance(req.user.school, req.user._id) });
  } catch (error) { next(error); }
});

// Teacher: apply for leave.
router.post("/", async (req, res, next) => {
  if (req.user.role !== "teacher") return errorResponse(res, 403, "Only teachers can apply for leave");
  try {
    const { teacher, employee } = await teacherProfile(req);
    if (!teacher && !employee) return errorResponse(res, 403, "Your teacher/staff profile is not linked. Please contact the principal.");
    const leaveType = String(req.body?.leaveType || "").toLowerCase();
    const startDate = dateOnly(req.body?.startDate);
    const endDate = dateOnly(req.body?.endDate);
    const reason = String(req.body?.reason || "").trim();
    const halfDay = req.body?.halfDay === true;
    if (!TYPES.has(leaveType)) return errorResponse(res, 400, "Choose a valid leave type");
    if (!startDate || !endDate || endDate < startDate) return errorResponse(res, 400, "Enter valid leave dates; end date cannot be before start date");
    if (halfDay && startDate.getTime() !== endDate.getTime()) return errorResponse(res, 400, "Half-day leave must be for a single date");
    if (reason.length < 5 || reason.length > 1000) return errorResponse(res, 400, "Reason must be between 5 and 1000 characters");
    const todayUtc = schoolToday();
    if (startDate < todayUtc && !(["emergency", "sick"].includes(leaveType) && /emergency|medical|hospital|illness|sick|fever|urgent/i.test(reason))) {
      return errorResponse(res, 400, "Past-date leave is allowed only for emergency or medical reasons. Mention the emergency/medical reason.");
    }
    const totalDays = halfDay ? 0.5 : daysBetween(startDate, endDate);
    if (totalDays <= 0 || totalDays > 366) return errorResponse(res, 400, "A leave request cannot exceed 366 days");
    const overlap = await LeaveRequest.exists({
      school: req.user.school, teacher: req.user._id, status: { $in: ["pending", "approved"] },
      startDate: { $lte: endDate }, endDate: { $gte: startDate },
    });
    if (overlap) return errorResponse(res, 409, "These dates overlap an existing pending or approved leave request");
    const request = await LeaveRequest.create({ school: req.user.school, teacher: req.user._id, leaveType, startDate, endDate, halfDay, totalDays, reason });
    const populated = await LeaveRequest.findById(request._id).populate({ path: "teacher", select: "name email role active" });
    res.status(201).json({ message: "Leave application submitted to the principal", request: serializeRequest(populated), balance: await getBalance(req.user.school, req.user._id) });
  } catch (error) { next(error); }
});

// Teacher: withdraw only a pending application.
router.post("/:id/cancel", async (req, res, next) => {
  if (req.user.role !== "teacher") return errorResponse(res, 403, "Only teachers can withdraw their own applications");
  if (!validId(req.params.id)) return errorResponse(res, 400, "Invalid leave request");
  try {
    const request = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school, teacher: req.user._id, status: "pending" },
      { $set: { status: "cancelled", cancelledAt: new Date() } }, { new: true },
    );
    if (!request) return errorResponse(res, 409, "Request not found or it has already been reviewed");
    res.json({ message: "Leave request withdrawn", request: serializeRequest(request) });
  } catch (error) { next(error); }
});

// Principal: school-wide queue and leave quota policy.
router.get("/", async (req, res, next) => {
  if (req.user.role !== "principal") return errorResponse(res, 403, "Only the principal can review school leave requests");
  try {
    const status = String(req.query.status || "pending");
    const allowed = ["pending", "approved", "rejected", "cancelled", "all"];
    if (!allowed.includes(status)) return errorResponse(res, 400, "Invalid status filter");
    const filter = { school: req.user.school };
    if (status !== "all") filter.status = status;
    const requests = await populateRequests(LeaveRequest.find(filter).limit(300));
    const policy = await LeavePolicy.findOne({ school: req.user.school }).lean();
    res.json({ requests: requests.map(serializeRequest), policy: policy?.quotas || { casual: 0, sick: 0, earned: 0 }, policyConfigured: Boolean(policy) });
  } catch (error) { next(error); }
});

router.put("/policy", async (req, res, next) => {
  if (req.user.role !== "principal") return errorResponse(res, 403, "Only the principal can configure leave quotas");
  try {
    const quotas = req.body?.quotas || {};
    const normalized = {};
    for (const type of BALANCE_TYPES) {
      const amount = Number(quotas[type]);
      if (!Number.isFinite(amount) || amount < 0 || amount > 366 || Math.round(amount * 2) !== amount * 2) {
        return errorResponse(res, 400, "Each Casual, Sick and Earned quota must be between 0 and 366, in half-day increments");
      }
      normalized[type] = amount;
    }
    const policy = await LeavePolicy.findOneAndUpdate(
      { school: req.user.school },
      { $set: { quotas: normalized, updatedBy: req.user._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    res.json({ message: "Leave quotas saved", policy: policy.quotas });
  } catch (error) { next(error); }
});

// Principal: approve or reject a pending request exactly once.
router.post("/:id/decision", async (req, res, next) => {
  if (req.user.role !== "principal") return errorResponse(res, 403, "Only the principal can review leave requests");
  if (!validId(req.params.id)) return errorResponse(res, 400, "Invalid leave request");
  const decision = String(req.body?.decision || "");
  const reviewNote = String(req.body?.reviewNote || "").trim();
  if (!["approved", "rejected"].includes(decision)) return errorResponse(res, 400, "Choose approve or reject");
  if (decision === "rejected" && !reviewNote) return errorResponse(res, 400, "A rejection reason is required");
  if (reviewNote.length > 1000) return errorResponse(res, 400, "Review note cannot exceed 1000 characters");
  try {
    const request = await LeaveRequest.findOne({ _id: req.params.id, school: req.user.school, status: "pending" });
    if (!request) return errorResponse(res, 409, "Request not found or already reviewed");
    if (decision === "approved") {
      const overlap = await LeaveRequest.exists({
        _id: { $ne: request._id }, school: req.user.school, teacher: request.teacher, status: "approved",
        startDate: { $lte: request.endDate }, endDate: { $gte: request.startDate },
      });
      if (overlap) return errorResponse(res, 409, "This request overlaps another approved leave and cannot be approved");
      if (BALANCE_TYPES.has(request.leaveType)) {
        const policy = await LeavePolicy.findOne({ school: req.user.school }).lean();
        if (!policy) return errorResponse(res, 409, "Configure Casual, Sick and Earned leave quotas before approving balance-based leave");
        const quota = Number(policy.quotas?.[request.leaveType] || 0);
        const leaveYear = new Date(request.startDate).getUTCFullYear();
        const bounds = yearBounds(leaveYear);
        const usedRows = await LeaveRequest.find({ school: req.user.school, teacher: request.teacher, leaveType: request.leaveType, status: "approved", startDate: { $gte: bounds.start, $lt: bounds.end }, _id: { $ne: request._id } }).select("totalDays").lean();
        const used = usedRows.reduce((sum, row) => sum + Number(row.totalDays || 0), 0);
        if (used + request.totalDays > quota) return errorResponse(res, 409, `Insufficient ${request.leaveType} leave balance. Available: ${Math.max(0, quota - used)} day(s)`);
      }
    }
    const updated = await LeaveRequest.findOneAndUpdate(
      { _id: request._id, school: req.user.school, status: "pending" },
      { $set: { status: decision, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote } },
      { new: true, runValidators: true },
    ).populate({ path: "teacher", select: "name email role active" });
    if (!updated) return errorResponse(res, 409, "This request has already been reviewed");
    res.json({ message: decision === "approved" ? "Leave approved" : "Leave rejected", request: serializeRequest(updated) });
  } catch (error) { next(error); }
});

export default router;
