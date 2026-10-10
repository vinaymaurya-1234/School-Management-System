import mongoose from "mongoose";

const studentMarksSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true, index: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    marksObtained: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, required: true, min: 1 },
    remarks: { type: String, trim: true, maxlength: 300, default: "" },
    status: { type: String, enum: ["draft", "submitted"], default: "draft", index: true },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studentMarksSchema.index({ exam: 1, student: 1 }, { unique: true });

export default mongoose.model("StudentMarks", studentMarksSchema);
