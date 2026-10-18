import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    employeeId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    designation: { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, trim: true, default: "" },
    category: { type: String, enum: ["teaching", "administration", "finance", "support", "other"], default: "other" },
    employmentType: { type: String, enum: ["full_time", "part_time", "contract"], default: "full_time" },
    joiningDate: { type: Date, default: null },
    exitDate: { type: Date, default: null },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "", maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

employeeSchema.index({ school: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ school: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } });
employeeSchema.index({ school: 1, teacher: 1 }, { unique: true, partialFilterExpression: { teacher: { $type: "objectId" } } });

export default mongoose.model("Employee", employeeSchema);
