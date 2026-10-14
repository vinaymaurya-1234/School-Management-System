import express from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { AcademicYear, SchoolClass, Section, StudentEnrollment } from "../models/Academic.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import { FeeStructure, FeeAccount, FeePayment } from "../models/Fees.js";

const router = express.Router();
router.use(requireAuth);

const financeRole = req => ["principal", "accountant"].includes(req.user?.role);
const financeOnly = (req, res, next) => financeRole(req) ? next() : res.status(403).json({ message: "Only Principal or Accountant can manage school fee records." });
const idIsValid = value => mongoose.isValidObjectId(value);
const safeAmount = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value) * 100) / 100 : 0;

async function visibleStudentIds(req) {
  if (financeRole(req)) return null;
  if (req.user.role === "student") return [String(req.user._id)];
  if (req.user.role === "parent") {
    const parent = await Parent.findOne({ user: req.user._id, school: req.user.school }).select("children").populate({ path: "children", select: "user" });
    return (parent?.children || []).map(child => String(child.user?._id || child.user)).filter(Boolean);
  }
  return [];
}

async function paymentTotals(accountIds, reservePending = false) {
  const match = reservePending
    ? { account: { $in: accountIds }, $or: [
        { status: "verified" },
        { status: "pending_verification" },
        { status: "pending_gateway", createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } },
      ] }
    : { account: { $in: accountIds }, status: "verified" };
  const rows = await FeePayment.aggregate([
    { $match: match },
    { $group: { _id: { account: "$account", instalmentId: "$instalmentId" }, paid: { $sum: "$amount" } } },
  ]);
  return new Map(rows.map(row => [`${row._id.account}:${row._id.instalmentId}`, row.paid]));
}

function accountView(account, totals) {
  const doc = account.toObject ? account.toObject() : account;
  const instalments = (doc.instalments || []).map(item => {
    const paid = totals.get(`${doc._id}:${item._id}`) || 0;
    const balance = Math.max(0, Math.round((item.amount - paid) * 100) / 100);
    const status = balance <= 0 ? "paid" : paid > 0 ? "partial" : new Date(item.dueDate) < new Date() ? "overdue" : "pending";
    return { ...item, paid, balance, status };
  });
  const totalAmount = instalments.reduce((sum, item) => sum + item.amount, 0) + (doc.adjustments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paidAmount = instalments.reduce((sum, item) => sum + item.paid, 0);
  return { ...doc, instalments, totalAmount, paidAmount, balance: Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100) };
}

router.get("/options", financeOnly, async (req, res, next) => {
  try {
    const [academicYears, classes] = await Promise.all([
      AcademicYear.find({ school: req.user.school }).sort({ startDate: -1 }).lean(),
      SchoolClass.find({ school: req.user.school }).sort({ order: 1, name: 1 }).populate("academicYear", "name isActive").lean(),
    ]);
    const sections = await Section.find({ school: req.user.school }).populate("class", "name academicYear").lean();
    res.json({ academicYears, classes, sections });
  } catch (error) { next(error); }
});

router.get("/students", financeOnly, async (req, res, next) => {
  try {
    const filter = { school: req.user.school, status: "active" };
    if (req.query.academicYear && idIsValid(req.query.academicYear)) filter.academicYear = req.query.academicYear;
    if (req.query.class && idIsValid(req.query.class)) filter.class = req.query.class;
    if (req.query.section && idIsValid(req.query.section)) filter.section = req.query.section;
    const enrollments = await StudentEnrollment.find(filter)
      .populate("student", "name email role")
      .populate("class", "name")
      .populate("section", "name")
      .lean();
    const profiles = await Student.find({ school: req.user.school, user: { $in: enrollments.map(row => row.student?._id).filter(Boolean) }, active: true }).select("user admissionNumber name").lean();
    const byUser = new Map(profiles.map(profile => [String(profile.user), profile]));
    res.json(enrollments.filter(row => row.student).map(row => ({
      studentId: String(row.student._id), name: row.student.name, email: row.student.email,
      classId: row.class?._id, className: row.class?.name || "—", sectionId: row.section?._id, sectionName: row.section?.name || "—",
      academicYearId: row.academicYear, admissionNumber: byUser.get(String(row.student._id))?.admissionNumber || "—",
    })));
  } catch (error) { next(error); }
});

router.get("/summary", async (req, res, next) => {
  try {
    const visibleIds = await visibleStudentIds(req);
    const filter = { school: req.user.school, status: "active" };
    if (visibleIds) filter.student = { $in: visibleIds };
    const accounts = await FeeAccount.find(filter).populate("student", "name email").populate("class", "name").populate("section", "name").populate("feeStructure", "name").sort({ createdAt: -1 });
    const totals = await paymentTotals(accounts.map(account => account._id));
    const rows = accounts.map(account => accountView(account, totals));
    const payments = await FeePayment.find({ school: req.user.school, ...(visibleIds ? { student: { $in: visibleIds } } : {}) })
      .populate("student", "name").populate("account", "feeStructure").sort({ createdAt: -1 }).limit(100).lean();
    const now = new Date();
    const summary = {
      feesAssigned: rows.reduce((sum, item) => sum + item.totalAmount, 0),
      collected: rows.reduce((sum, item) => sum + item.paidAmount, 0),
      outstanding: rows.reduce((sum, item) => sum + item.balance, 0),
      overdueAccounts: rows.filter(item => item.instalments.some(inst => inst.balance > 0 && new Date(inst.dueDate) < now)).length,
    };
    res.json({ summary, accounts: rows, payments: payments.map(item => ({ ...item, verified: item.status === "verified" })), available: true });
  } catch (error) { next(error); }
});

router.get("/structures", financeOnly, async (req, res, next) => {
  try {
    const structures = await FeeStructure.find({ school: req.user.school }).populate("academicYear", "name").populate("class", "name").sort({ createdAt: -1 }).lean();
    res.json(structures);
  } catch (error) { next(error); }
});

router.post("/structures", financeOnly, async (req, res, next) => {
  try {
    const { academicYear, class: classId, name, components, instalments } = req.body;
    if (!idIsValid(academicYear) || !idIsValid(classId) || !String(name || "").trim() || !Array.isArray(components) || !components.length || !Array.isArray(instalments) || !instalments.length) {
      return res.status(400).json({ message: "Academic year, class, name, fee components and at least one instalment are required." });
    }
    const [year, schoolClass] = await Promise.all([
      AcademicYear.findOne({ _id: academicYear, school: req.user.school }),
      SchoolClass.findOne({ _id: classId, school: req.user.school, academicYear }),
    ]);
    if (!year || !schoolClass) return res.status(400).json({ message: "Choose a valid academic year and class from this school." });
    if (components.some(item => !String(item.name || "").trim() || !Number.isFinite(Number(item.amount)) || Number(item.amount) < 0)) {
      return res.status(400).json({ message: "Each fee component needs a name and a valid non-negative amount." });
    }
    const cleanComponents = components.map(item => ({ name: String(item.name).trim(), amount: Math.round(Number(item.amount) * 100) / 100 }));
    const cleanInstalments = instalments.map(item => ({ name: String(item.name || "").trim(), amount: Number(item.amount), dueDate: new Date(item.dueDate) }));
    if (cleanInstalments.some(item => !item.name || !Number.isFinite(item.amount) || item.amount <= 0 || Number.isNaN(item.dueDate.getTime()))) {
      return res.status(400).json({ message: "Each instalment needs a name, positive amount and due date." });
    }
    const totalAmount = Math.round(cleanComponents.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const instalmentTotal = Math.round(cleanInstalments.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    if (Math.abs(totalAmount - instalmentTotal) > 0.01) return res.status(400).json({ message: "The instalment total must equal the total of all fee components." });
    const structure = await FeeStructure.create({ school: req.user.school, academicYear, class: classId, name: String(name).trim(), components: cleanComponents, instalments: cleanInstalments, totalAmount, createdBy: req.user._id });
    res.status(201).json(structure);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A fee structure with this name already exists for this class and academic year." });
    next(error);
  }
});

router.post("/accounts/assign", financeOnly, async (req, res, next) => {
  try {
    const { studentId, feeStructureId } = req.body;
    if (!idIsValid(studentId) || !idIsValid(feeStructureId)) return res.status(400).json({ message: "Choose a valid student and fee structure." });
    const structure = await FeeStructure.findOne({ _id: feeStructureId, school: req.user.school, active: true });
    if (!structure) return res.status(400).json({ message: "Choose an active fee structure from this school." });
    const enrollment = await StudentEnrollment.findOne({
      school: req.user.school,
      student: studentId,
      academicYear: structure.academicYear,
      class: structure.class,
      status: "active",
    });
    if (!enrollment) {
      return res.status(400).json({ message: "The selected student must have an active enrollment in the fee structure's class and academic year." });
    }
    const account = await FeeAccount.create({
      school: req.user.school, academicYear: enrollment.academicYear, student: studentId, class: enrollment.class, section: enrollment.section,
      feeStructure: structure._id,
      instalments: structure.instalments.map(item => ({ structureInstalmentId: item._id, name: item.name, amount: item.amount, dueDate: item.dueDate })),
    });
    res.status(201).json(account);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This fee structure is already assigned to the student for this academic year." });
    next(error);
  }
});

router.post("/payments/offline", financeOnly, async (req, res, next) => {
  try {
    const { accountId, instalmentId, amount, offlineMethod, reference, notes } = req.body;
    const value = safeAmount(amount);
    const account = await FeeAccount.findOne({ _id: accountId, school: req.user.school, status: "active" });
    if (!account || !idIsValid(instalmentId) || !account.instalments.some(item => String(item._id) === String(instalmentId)) || !value) return res.status(400).json({ message: "Choose a valid fee account, instalment and positive payment amount." });
    if (!["cash", "upi", "bank_transfer", "cheque"].includes(offlineMethod)) return res.status(400).json({ message: "Choose a valid offline payment method." });
    const totals = await paymentTotals([account._id], true);
    const item = account.instalments.find(inst => String(inst._id) === String(instalmentId));
    const paid = totals.get(`${account._id}:${item._id}`) || 0;
    if (value > item.amount - paid + 0.001) return res.status(400).json({ message: "Payment amount exceeds the remaining instalment balance." });
    const payment = await FeePayment.create({ school: req.user.school, account: account._id, student: account.student, instalmentId, amount: value, method: "offline", offlineMethod, reference: String(reference || "").trim(), notes: String(notes || "").trim(), status: "pending_verification", recordedBy: req.user._id });
    res.status(201).json(payment);
  } catch (error) { next(error); }
});

router.post("/payments/:paymentId/verify", financeOnly, async (req, res, next) => {
  try {
    const payment = await FeePayment.findOne({ _id: req.params.paymentId, school: req.user.school });
    if (!payment) return res.status(404).json({ message: "Payment record not found." });
    if (payment.status !== "pending_verification") return res.status(409).json({ message: "Only offline payments awaiting verification can be verified." });
    payment.status = "verified";
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = new Date();
    payment.receiptNumber = `RCP-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    await payment.save();
    res.json(payment);
  } catch (error) { next(error); }
});

router.post("/payments/:paymentId/reject", financeOnly, async (req, res, next) => {
  try {
    const payment = await FeePayment.findOne({ _id: req.params.paymentId, school: req.user.school });
    if (!payment) return res.status(404).json({ message: "Payment record not found." });
    if (payment.status !== "pending_verification") return res.status(409).json({ message: "Only unverified offline payments can be rejected." });
    payment.status = "rejected";
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = new Date();
    payment.notes = [payment.notes, String(req.body.reason || "Rejected by finance team")].filter(Boolean).join(" · ");
    await payment.save();
    res.json(payment);
  } catch (error) { next(error); }
});

router.post("/payments/online/order", async (req, res, next) => {
  try {
    if (!["parent", "student"].includes(req.user.role)) return res.status(403).json({ message: "Online fee payment is available to Parent and Student accounts." });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: "Online payments are not configured yet. Add Razorpay keys on the server to enable checkout." });
    const { accountId, instalmentId, amount } = req.body;
    const visibleIds = await visibleStudentIds(req);
    const account = await FeeAccount.findOne({ _id: accountId, school: req.user.school, student: { $in: visibleIds || [] }, status: "active" });
    if (!account) return res.status(404).json({ message: "Fee account not found for this login." });
    const instalment = account.instalments.find(item => String(item._id) === String(instalmentId));
    const value = safeAmount(amount);
    if (!instalment || !value) return res.status(400).json({ message: "Choose an instalment and enter a positive amount." });
    const totals = await paymentTotals([account._id], true);
    const paid = totals.get(`${account._id}:${instalment._id}`) || 0;
    if (value > instalment.amount - paid + 0.001) return res.status(400).json({ message: "Payment amount exceeds the remaining instalment balance." });
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: Math.round(value * 100), currency: "INR", receipt: `fee-${String(account._id).slice(-10)}-${Date.now()}`, notes: { schoolId: String(req.user.school), accountId: String(account._id), instalmentId: String(instalment._id) } }) });
    const order = await response.json();
    if (!response.ok) return res.status(502).json({ message: order.error?.description || "Payment gateway could not create an order." });
    const payment = await FeePayment.create({ school: req.user.school, account: account._id, student: account.student, instalmentId, amount: value, method: "online", status: "pending_gateway", gatewayOrderId: order.id, recordedBy: req.user._id });
    res.status(201).json({ keyId: process.env.RAZORPAY_KEY_ID, order, paymentId: payment._id, amount: value, studentName: req.user.name });
  } catch (error) { next(error); }
});

router.post("/payments/online/verify", async (req, res, next) => {
  try {
    if (!["parent", "student"].includes(req.user.role)) return res.status(403).json({ message: "Only Parent or Student can complete their online payment." });
    const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const visibleIds = await visibleStudentIds(req);
    const payment = await FeePayment.findOne({ _id: paymentId, school: req.user.school, student: { $in: visibleIds || [] }, method: "online" });
    if (!payment || payment.status !== "pending_gateway" || payment.gatewayOrderId !== razorpay_order_id) return res.status(400).json({ message: "Pending payment order could not be matched." });
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const provided = Buffer.from(String(razorpay_signature || ""));
    const expectedBuffer = Buffer.from(expected);
    if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) return res.status(400).json({ message: "Payment signature verification failed." });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: "Payment gateway verification is not configured on the server." });
    const gatewayAuth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const gatewayResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, { headers: { Authorization: `Basic ${gatewayAuth}` } });
    const gatewayPayment = await gatewayResponse.json();
    if (!gatewayResponse.ok || gatewayPayment.order_id !== razorpay_order_id || gatewayPayment.status !== "captured" || Number(gatewayPayment.amount) !== Math.round(payment.amount * 100)) {
      return res.status(409).json({ message: "The gateway has not confirmed a captured payment matching this fee instalment. Check payment status before retrying." });
    }
    payment.status = "verified";
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.reference = razorpay_payment_id;
    payment.verifiedAt = new Date();
    payment.receiptNumber = `RCP-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    await payment.save();
    res.json({ ok: true, payment, receiptNumber: payment.receiptNumber });
  } catch (error) { next(error); }
});

router.get("/payments/:paymentId/receipt", async (req, res, next) => {
  try {
    const visibleIds = await visibleStudentIds(req);
    const payment = await FeePayment.findOne({ _id: req.params.paymentId, school: req.user.school, ...(visibleIds ? { student: { $in: visibleIds } } : {}) }).populate("student", "name").populate("account", "academicYear");
    if (!payment) return res.status(404).json({ message: "Receipt record not found." });
    if (payment.status !== "verified" || !payment.receiptNumber) return res.status(409).json({ message: "A receipt is available only after payment verification." });
    res.json({ receiptNumber: payment.receiptNumber, student: payment.student?.name, amount: payment.amount, method: payment.method === "online" ? "Online" : payment.offlineMethod, reference: payment.reference, paidAt: payment.verifiedAt, status: payment.status });
  } catch (error) { next(error); }
});

export default router;
