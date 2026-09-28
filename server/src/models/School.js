import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true },
    activeAcademicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear" },
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);
