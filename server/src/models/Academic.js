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

// A teacher can work with multiple subjects/sections, but only inside one class
// for a given academic year. Repeated saves of the same assignment are idempotent.
teacherAssignmentSchema.pre("save", async function (next) {
  if (!this.isNew || this.status !== "active") return next();

  const TeacherAssignment = this.constructor;
  const baseFilter = {
    school: this.school,
    academicYear: this.academicYear,
    teacher: this.teacher,
    status: "active",
  };

  const existingSameAssignment = await TeacherAssignment.findOne({
    ...baseFilter,
    class: this.class || null,
    section: this.section || null,
    subject: this.subject || null,
    isClassTeacher: Boolean(this.isClassTeacher),
  }).select("_id");

  if (existingSameAssignment) {
    this._id = existingSameAssignment._id;
    this.isNew = false;
    return next();
  }

  if (this.class) {
    const existingDifferentClass = await TeacherAssignment.findOne({
      ...baseFilter,
      class: { $exists: true, $ne: this.class },
    }).select("class");

    if (existingDifferentClass) {
      const error = new Error("A teacher can be assigned to only one class per academic year. Multiple subjects and sections are allowed within that class.");
      error.status = 409;
      return next(error);
    }
  }

  return next();
});

// Hide already-existing duplicate rows from the UI while the database is repaired.
function refKey(value) {
  if (!value) return "";
  if (value._id) return value._id.toString();
  return value.toString();
}

teacherAssignmentSchema.post("find", function (docs) {
  const seen = new Set();
  for (let index = docs.length - 1; index >= 0; index -= 1) {
    const item = docs[index];
    const key = [
      refKey(item.teacher),
      refKey(item.academicYear),
      refKey(item.class),
      refKey(item.section),
      refKey(item.subject),
      Boolean(item.isClassTeacher),
      item.status,
    ].join("|");

    if (seen.has(key)) docs.splice(index, 1);
    else seen.add(key);
  }
});

export const AcademicYear = mongoose.model("AcademicYear", academicYearSchema);
export const SchoolClass = mongoose.model("Class", classSchema);
export const Section = mongoose.model("Section", sectionSchema);
export const StudentEnrollment = mongoose.model("StudentEnrollment", studentEnrollmentSchema);
export const TeacherAssignment = mongoose.model("TeacherAssignment", teacherAssignmentSchema);
