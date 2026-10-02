import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    isOptional: { type: Boolean, default: false },
  },
  { timestamps: true }
);

subjectSchema.index({ school: 1, academicYear: 1, name: 1 }, { unique: true });

const classSubjectSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    weeklyPeriods: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

classSubjectSchema.index({ class: 1, subject: 1 }, { unique: true });

export const Subject = mongoose.model("Subject", subjectSchema);
export const ClassSubject = mongoose.model("ClassSubject", classSubjectSchema);
