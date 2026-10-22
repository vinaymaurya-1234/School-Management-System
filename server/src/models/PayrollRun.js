import mongoose from "mongoose";

const payrollRunItemSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  employeeId: { type: String, required: true },
  name: { type: String, required: true },
  designation: { type: String, default: "" },
  salaryStructure: { type: mongoose.Schema.Types.ObjectId, ref: "EmployeeSalaryStructure", required: true },
  basicSalary: { type: Number, required: true, min: 0 },
  allowances: { type: [{ name: String, amount: Number }], default: [] },
  recurringDeductions: { type: [{ name: String, amount: Number }], default: [] },
  periodDays: { type: Number, required: true },
  perDayRate: { type: Number, required: true },
  presentDays: { type: Number, default: 0 },
  lateDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  paidLeaveDays: { type: Number, default: 0 },
  unpaidLeaveDays: { type: Number, default: 0 },
  unmarkedDays: { type: Number, default: 0 },
  grossSalary: { type: Number, required: true },
  attendanceDeduction: { type: Number, default: 0 },
  unpaidLeaveDeduction: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netPayable: { type: Number, required: true },
  calculationNotes: { type: [String], default: [] },
  paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
  paidAmount: { type: Number, default: 0 },
  payments: { type: [{ amount: Number, date: Date, method: String, reference: String, note: String, recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } }], default: [] },
}, { _id: true });

const payrollRunSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  year: { type: Number, required: true, min: 2000, max: 2200 },
  month: { type: Number, required: true, min: 1, max: 12 },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  status: { type: String, enum: ["draft", "approved"], default: "draft" },
  items: { type: [payrollRunItemSchema], default: [] },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

payrollRunSchema.index({ school: 1, year: 1, month: 1 }, { unique: true });
export default mongoose.model("PayrollRun", payrollRunSchema);
