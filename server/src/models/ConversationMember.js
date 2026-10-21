import mongoose from "mongoose";

const conversationMemberSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  joinedAt: { type: Date, required: true, default: Date.now },
  leftAt: { type: Date, default: null },
  roleAtJoin: { type: String, default: "" },
}, { timestamps: true });

conversationMemberSchema.index({ conversation: 1, user: 1 }, { unique: true });
conversationMemberSchema.index({ school: 1, user: 1, leftAt: 1 });

export default mongoose.model("ConversationMember", conversationMemberSchema);
