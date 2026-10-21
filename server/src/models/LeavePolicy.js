import mongoose from "mongoose";

const leavePolicySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, unique: true, index: true },
  quotas: {
    casual: { type: Number, default: 0, min: 0, max: 366 },
    sick: { type: Number, default: 0, min: 0, max: 366 },
    earned: { type: Number, default: 0, min: 0, max: 366 },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

export default mongoose.model("LeavePolicy", leavePolicySchema);
