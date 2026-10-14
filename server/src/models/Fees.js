import mongoose from "mongoose";

const instalmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  dueDate: { type: Date, required: true },
}, { _id: true });

const feeStructureSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  name: { type: String, required: true, trim: true },
  components: [{ name: { type: String, required: true, trim: true }, amount: { type: Number, required: true, min: 0 } }],
  instalments: { type: [instalmentSchema], validate: value => value.length > 0 },
  totalAmount: { type: Number, required: true, min: 0.01 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

feeStructureSchema.index({ school: 1, academicYear: 1, class: 1, name: 1 }, { unique: true });

const feeAccountSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
  feeStructure: { type: mongoose.Schema.Types.ObjectId, ref: "FeeStructure", required: true },
  instalments: [{
    structureInstalmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
  }],
  adjustments: [{ label: String, amount: { type: Number, required: true }, reason: String, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, createdAt: { type: Date, default: Date.now } }],
  status: { type: String, enum: ["active", "closed"], default: "active" },
}, { timestamps: true });

feeAccountSchema.index({ school: 1, academicYear: 1, student: 1, feeStructure: 1 }, { unique: true });

const feePaymentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: "FeeAccount", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  instalmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ["offline", "online"], required: true },
  offlineMethod: { type: String, enum: ["cash", "upi", "bank_transfer", "cheque", null], default: null },
  reference: { type: String, trim: true },
  status: { type: String, enum: ["pending_verification", "pending_gateway", "verified", "rejected", "reversed"], default: "pending_verification" },
  gatewayOrderId: String,
  gatewayPaymentId: String,
  receiptNumber: { type: String, unique: true, sparse: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  verifiedAt: Date,
  notes: { type: String, trim: true },
}, { timestamps: true });

feePaymentSchema.index({ school: 1, gatewayOrderId: 1 }, { sparse: true });

export const FeeStructure = mongoose.models.FeeStructure || mongoose.model("FeeStructure", feeStructureSchema);
export const FeeAccount = mongoose.models.FeeAccount || mongoose.model("FeeAccount", feeAccountSchema);
export const FeePayment = mongoose.models.FeePayment || mongoose.model("FeePayment", feePaymentSchema);
