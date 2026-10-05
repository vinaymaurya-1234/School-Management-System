import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    // scheduledAt is the exam start time.
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    // Exam end time. Kept separate so the schedule represents the full exam window.
    endsAt: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

examSchema.index({ school: 1, academicYear: 1, class: 1, section: 1, scheduledAt: 1 });

export default mongoose.model("Exam", examSchema);
