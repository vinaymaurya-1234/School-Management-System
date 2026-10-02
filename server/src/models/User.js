import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { RESPONSIBILITIES, ROLES } from "../config/permissions.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    responsibilities: {
      type: [String],
      enum: Object.values(RESPONSIBILITIES),
      default: [],
    },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function savePassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
