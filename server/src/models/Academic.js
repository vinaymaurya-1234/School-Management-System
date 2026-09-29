import mongoose from "mongoose";

const academicYearSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  name: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false },
}, { timestamps: true });

const classSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  name: { type: String, required: true, trim: true },
  order: { type: Number, required: true },
}, { timestamps: true });

classSchema.index({ school: 1, academicYear: 1, name: 1 }, { unique: true });

const sectionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  name: { type: String, required: true, trim: true },
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

sectionSchema.index({ class: 1, name: 1 }, { unique: true });

const studentEnrollmentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
  status: { type: String, enum: ["active", "promoted", "failed", "transferred", "left"], default: "active" },
}, { timestamps: true });

studentEnrollmentSchema.index({ student: 1, academicYear: 1 }, { unique: true });
studentEnrollmentSchema.index({ school: 1, academicYear: 1, class: 1, section: 1 });

const teacherAssignmentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section" },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
  isClassTeacher: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, { timestamps: true });

export const AcademicYear = mongoose.model("AcademicYear", academicYearSchema);
export const SchoolClass = mongoose.model("Class", classSchema);
export const Section = mongoose.model("Section", sectionSchema);
export const StudentEnrollment = mongoose.model("StudentEnrollment", studentEnrollmentSchema);
export const TeacherAssignment = mongoose.model("TeacherAssignment", teacherAssignmentSchema);
