import mongoose from "mongoose";

const attendanceNotificationSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceSession", required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  date: { type: Date, required: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  readAt: { type: Date, default: null },
}, { timestamps: true });

attendanceNotificationSchema.index({ parent: 1, student: 1, session: 1 }, { unique: true });
attendanceNotificationSchema.index({ school: 1, parent: 1, createdAt: -1 });

export default mongoose.model("AttendanceNotification", attendanceNotificationSchema);
