import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "half_day"],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const attendanceSessionSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    date: { type: Date, required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    records: { type: [attendanceRecordSchema], default: [] },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

attendanceSessionSchema.index({ school: 1, academicYear: 1, section: 1, date: 1 }, { unique: true });

export default mongoose.model("AttendanceSession", attendanceSessionSchema);
