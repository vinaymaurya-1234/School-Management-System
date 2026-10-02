import mongoose from "mongoose";

const teacherAttendanceRecordSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "on_leave"],
      default: "present",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const teacherAttendanceSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    records: {
      type: [teacherAttendanceRecordSchema],
      default: [],
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

teacherAttendanceSchema.index({ school: 1, date: 1 }, { unique: true });

export default mongoose.model("TeacherAttendance", teacherAttendanceSchema);
