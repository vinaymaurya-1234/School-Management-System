import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, default: "" },
  name: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  resourceType: { type: String, enum: ["image", "video", "raw"], required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, maxlength: 5000, default: "" },
  attachments: { type: [attachmentSchema], default: [] },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ school: 1, sender: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
