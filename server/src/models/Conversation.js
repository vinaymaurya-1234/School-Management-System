import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  type: { type: String, enum: ["direct", "group"], required: true, default: "direct" },
  title: { type: String, trim: true, maxlength: 100, default: "" },
  groupType: { type: String, enum: ["custom", "class", "teachers", "school", "parent-class"], default: "custom" },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", default: null },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", default: null },
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", default: null },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, maxlength: 160, default: "" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

conversationSchema.index({ school: 1, participants: 1, lastMessageAt: -1 });
conversationSchema.index({ school: 1, type: 1, groupType: 1 });
conversationSchema.index({ school: 1, academicYear: 1, section: 1, groupType: 1 });

export default mongoose.model("Conversation", conversationSchema);
