import mongoose from "mongoose";

const timetableEntrySchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    day: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      required: true,
    },
    periodNumber: { type: Number, required: true, min: 1 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, trim: true },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
  },
  { timestamps: true }
);

// A section can only have one lesson in a period.
timetableEntrySchema.index(
  { section: 1, day: 1, periodNumber: 1 },
  { unique: true }
);

// A teacher cannot teach two sections in the same period.
timetableEntrySchema.index(
  { teacher: 1, day: 1, periodNumber: 1 },
  { unique: true }
);

export default mongoose.model("TimetableEntry", timetableEntrySchema);
