import mongoose from "mongoose";

const teacherAttendanceRequestSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    date: { type: Date, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    decisionStatus: { type: String, enum: ["present", "late", "on_leave"], default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

teacherAttendanceRequestSchema.index({ school: 1, teacher: 1, date: 1, status: 1 });

export default mongoose.model("TeacherAttendanceRequest", teacherAttendanceRequestSchema);
