import mongoose from "mongoose";

const salaryComponentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0, max: 100000000 },
  },
  { _id: false }
);

const employeeSalaryStructureSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    currency: { type: String, default: "INR", enum: ["INR"] },
    basicSalary: { type: Number, required: true, min: 0, max: 100000000 },
    allowances: { type: [salaryComponentSchema], default: [] },
    recurringDeductions: { type: [salaryComponentSchema], default: [] },
    statutorySettings: {
      pfEnabled: { type: Boolean, default: false },
      esicEnabled: { type: Boolean, default: false },
      professionalTaxEnabled: { type: Boolean, default: false },
      tdsEnabled: { type: Boolean, default: false },
      notes: { type: String, trim: true, default: "", maxlength: 1000 },
    },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    status: { type: String, enum: ["active", "superseded"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

employeeSalaryStructureSchema.index({ school: 1, employee: 1, effectiveFrom: -1 });
// Multiple effective-dated structures are retained so historical and future revisions
// can coexist. Payroll selects the structure effective for the requested pay period.

export default mongoose.model("EmployeeSalaryStructure", employeeSalaryStructureSchema);
