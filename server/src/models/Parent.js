import mongoose from "mongoose";

const parentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    relationship: { type: String, trim: true, default: "Parent" },
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student", index: true }],
    phone: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Parent", parentSchema);
