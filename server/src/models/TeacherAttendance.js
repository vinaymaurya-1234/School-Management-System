import mongoose from "mongoose";

const teacherAttendanceRecordSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    status: { type: String, enum: ["present", "absent", "late", "on_leave"], default: "present" },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    source: { type: String, enum: ["wifi", "admin", "development"], default: "wifi" },
    verification: {
      networkVerified: { type: Boolean, default: false },
      ipAddress: { type: String, default: "" },
    },
    note: { type: String, trim: true, default: "" },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    manuallyAdjusted: { type: Boolean, default: false },
  },
  { _id: false }
);

const teacherAttendanceSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    date: { type: Date, required: true },
    records: { type: [teacherAttendanceRecordSchema], default: [] },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

teacherAttendanceSchema.index({ school: 1, date: 1 }, { unique: true });

export default mongoose.model("TeacherAttendance", teacherAttendanceSchema);
