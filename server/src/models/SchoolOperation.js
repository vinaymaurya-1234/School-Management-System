import mongoose from "mongoose";

const schoolOperationSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    module: {
      type: String,
      required: true,
      enum: ["subjects", "timetable", "attendance", "fees", "exams", "notices", "events", "payroll"],
      index: true,
    },
    title: { type: String, required: true, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

schoolOperationSchema.index({ school: 1, module: 1, createdAt: -1 });

export default mongoose.model("SchoolOperation", schoolOperationSchema);
