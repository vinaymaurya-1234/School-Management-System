import mongoose from "mongoose";

const academicYearSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const classSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

classSchema.index({ school: 1, academicYear: 1, name: 1 }, { unique: true });

const sectionSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    name: { type: String, required: true, trim: true },
    classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

sectionSchema.index({ class: 1, name: 1 }, { unique: true });

export const AcademicYear = mongoose.model("AcademicYear", academicYearSchema);
export const SchoolClass = mongoose.model("Class", classSchema);
export const Section = mongoose.model("Section", sectionSchema);
