import mongoose from "mongoose";

const teachingAssignmentSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    canEnterMarks: { type: Boolean, default: true },
    canManageAssignments: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teachingAssignmentSchema.index(
  { teacher: 1, section: 1, subject: 1 },
  { unique: true }
);

export default mongoose.model("TeachingAssignment", teachingAssignmentSchema);
