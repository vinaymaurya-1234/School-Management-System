import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    type: {
      type: String,
      enum: ["School Event", "Holiday", "PTM", "Exam", "Meeting", "Activity"],
      default: "School Event",
    },
    location: { type: String, trim: true, maxlength: 180, default: "" },
    audience: {
      type: String,
      enum: ["Entire school", "Teachers", "Students", "Parents", "Specific classes"],
      default: "Entire school",
    },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

eventSchema.index({ school: 1, date: 1, active: 1 });
eventSchema.index({ school: 1, academicYear: 1, date: 1 });

export default mongoose.model("Event", eventSchema);
