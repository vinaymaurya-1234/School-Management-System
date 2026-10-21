import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  leaveType: { type: String, enum: ["casual", "sick", "earned", "emergency", "other"], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  halfDay: { type: Boolean, default: false },
  totalDays: { type: Number, required: true, min: 0.5 },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, trim: true, default: "", maxlength: 1000 },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

leaveRequestSchema.index({ school: 1, teacher: 1, startDate: 1, endDate: 1, status: 1 });
leaveRequestSchema.index({ school: 1, status: 1, createdAt: -1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
