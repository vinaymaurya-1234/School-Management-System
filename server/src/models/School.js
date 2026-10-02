import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true },
    activeAcademicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear" },
    attendanceNetwork: {
      enabled: { type: Boolean, default: false },
      allowedIps: { type: [String], default: [] },
      networkName: { type: String, trim: true, default: "School Wi-Fi" },
      checkInStart: { type: String, default: "00:00" },
      lateAfter: { type: String, default: "08:15" },
      checkInClose: { type: String, default: "23:59" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);
