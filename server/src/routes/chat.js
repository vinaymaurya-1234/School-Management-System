import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { Readable } from "node:stream";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import { StudentEnrollment, TeacherAssignment, Section } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime)|application\/pdf)$/i;
    callback(allowed.test(file.mimetype) ? null : Object.assign(new Error("Only images, videos and PDF files are allowed"), { status: 400 }), allowed.test(file.mimetype));
  },
});
function chatFileBucket() {
  if (!mongoose.connection.db) throw new Error("MongoDB is not connected");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "chatUploads" });
}

router.use(requireAuth, (req, res, next) => {\n  if (!["principal", "teacher", "student", "parent"].includes(req.user.role)) {\n    return res.status(403).json({ message: "Chat is available to parents, teachers, students and the principal only" });\n  }\n  next();\n});

function sameId(a, b) { return String(a?._id || a) === String(b?._id || b); }
function safeUser(user) {
  return { id: String(user._id), name: user.name, role: user.role, active: user.active };
}
function safeMessage(message) {
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    sender: message.sender && typeof message.sender === "object" ? safeUser(message.sender) : String(message.sender),
    text: message.text || "",
    attachments: (message.attachments || []).map((file) => ({
      url: file.url, name: file.name, mimeType: file.mimeType, size: file.size,
      resourceType: file.resourceType,
    })),
    readBy: (message.readBy || []).map(String),
    createdAt: message.createdAt,
    editedAt: message.editedAt,
  };
}
function conversationSummary(conversation, currentUserId) {
  const participants = (conversation.participants || []).filter(Boolean);
  const others = participants.filter((person) => !sameId(person, currentUserId));
  return {
    id: String(conversation._id),
    type: conversation.type,
    title: conversation.title || "",
    groupType: conversation.groupType,
    participants: participants.map(safeUser),
    otherParticipant: conversation.type === "direct" ? safeUser(others[0] || participants[0]) : null,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview || "",
    createdAt: conversation.createdAt,
  };
}

async function canDirectMessage(sender, recipient) {
  if (sameId(sender, recipient)) return false;
  if (sender.role === "principal" || recipient.role === "principal") return true;
  const pair = [sender.role, recipient.role].sort().join(":");
  if (!["parent:teacher", "student:teacher", "teacher:teacher"].includes(pair)) return false;

  if (pair === "parent:teacher") {
    const parentUser = sender.role === "parent" ? sender : recipient;
    const teacherUser = sender.role === "teacher" ? sender : recipient;
    const parent = await Parent.findOne({ user: parentUser._id, school: parentUser.school }).select("children");
    if (!parent?.children?.length) return false;
    const children = await Student.find({ _id: { $in: parent.children }, school: parentUser.school }).select("user");
    const childUserIds = children.map((child) => child.user);
    const enrollments = await StudentEnrollment.find({ school: parentUser.school, student: { $in: childUserIds }, status: "active" }).select("class section");
    if (!enrollments.length) return false;
    const sectionIds = enrollments.map((enrollment) => enrollment.section);
    const classIds = enrollments.map((enrollment) => enrollment.class);
    const [classTeacherSection, assignment] = await Promise.all([
      Section.exists({ _id: { $in: sectionIds }, classTeacher: teacherUser._id, school: parentUser.school }),
      TeacherAssignment.exists({ school: parentUser.school, teacher: teacherUser._id, status: "active", $or: [{ class: { $in: classIds } }, { section: { $in: sectionIds } }] }),
    ]);
    return Boolean(classTeacherSection || assignment);
  }

  if (pair === "student:teacher") {
    const studentUser = sender.role === "student" ? sender : recipient;
    const teacherUser = sender.role === "teacher" ? sender : recipient;
    const enrollment = await StudentEnrollment.findOne({ school: studentUser.school, student: studentUser._id, status: "active" }).select("class section");
    if (!enrollment) return false;
    const [classTeacher, assignment] = await Promise.all([
      Section.exists({ _id: enrollment.section, classTeacher: teacherUser._id, school: studentUser.school }),
      TeacherAssignment.exists({ school: studentUser.school, teacher: teacherUser._id, status: "active", $or: [{ class: enrollment.class }, { section: enrollment.section }] }),
    ]);
    return Boolean(classTeacher || assignment);
  }
  return true;
}

async function getConversationForUser(conversationId, user) {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  return Conversation.findOne({
    _id: conversationId, school: user.school, isActive: true, participants: user._id,
  }).populate({ path: "participants", select: "name role active" });
}

function emitToConversation(req, conversationId, event, payload) {
  const io = req.app.get("io");
  if (io) io.to(`conversation:${conversationId}`).emit(event, payload);
}

router.get("/users", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);
    const roles = ["principal", "teacher", "student", "parent"];
    const requestedRole = String(req.query.role || "");
    const filter = { school: req.user.school, active: true, role: { $in: roles }, _id: { $ne: req.user._id } };
    if (roles.includes(requestedRole)) filter.role = requestedRole;
    if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const users = await User.find(filter).select("name role active").sort({ name: 1 }).limit(60);
    const eligible = [];
    for (const candidate of users) {
      if (await canDirectMessage(req.user, candidate)) eligible.push(safeUser(candidate));
    }
    res.json({ users: eligible });
  } catch (error) { next(error); }
});

router.get("/conversations", async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      school: req.user.school, participants: req.user._id, isActive: true,
    }).populate({ path: "participants", select: "name role active" }).sort({ lastMessageAt: -1 }).limit(100);
    const ids = conversations.map((item) => item._id);
    const latestMessages = ids.length ? await Message.aggregate([
      { $match: { school: req.user.school, conversation: { $in: ids }, deletedAt: null } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversation", message: { $first: "$$ROOT" } } },
    ]) : [];
    const latestByConversation = new Map(latestMessages.map((row) => [String(row._id), row.message]));
    const unread = ids.length ? await Message.aggregate([
      { $match: { school: req.user.school, conversation: { $in: ids }, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null } },
      { $group: { _id: "$conversation", count: { $sum: 1 } } },
    ]) : [];
    const unreadByConversation = new Map(unread.map((row) => [String(row._id), row.count]));
    res.json({ conversations: conversations.map((item) => ({
      ...conversationSummary(item, req.user._id),
      lastMessage: latestByConversation.has(String(item._id)) ? safeMessage(latestByConversation.get(String(item._id))) : null,
      unreadCount: unreadByConversation.get(String(item._id)) || 0,
    })) });
  } catch (error) { next(error); }
});

router.post("/conversations/direct", async (req, res, next) => {
  try {
    const recipientId = String(req.body?.recipientId || "");
    if (!mongoose.isValidObjectId(recipientId)) return res.status(400).json({ message: "Choose a valid person to chat with" });
    const recipient = await User.findOne({ _id: recipientId, school: req.user.school, active: true }).select("name role active school");
    if (!recipient) return res.status(404).json({ message: "User not found in this school" });
    if (!(await canDirectMessage(req.user, recipient))) return res.status(403).json({ message: "You can only message an authorized school contact" });
    const existing = await Conversation.findOne({
      school: req.user.school, type: "direct", participants: { $all: [req.user._id, recipient._id], $size: 2 }, isActive: true,
    }).populate({ path: "participants", select: "name role active" });
    if (existing) return res.json({ conversation: conversationSummary(existing, req.user._id) });
    const conversation = await Conversation.create({
      school: req.user.school, type: "direct", participants: [req.user._id, recipient._id], createdBy: req.user._id,
    });
    const populated = await Conversation.findById(conversation._id).populate({ path: "participants", select: "name role active" });
    res.status(201).json({ conversation: conversationSummary(populated, req.user._id) });
  } catch (error) { next(error); }
});

router.post("/conversations/group", async (req, res, next) => {
  try {
    if (!["principal", "teacher"].includes(req.user.role)) return res.status(403).json({ message: "Only the principal or a teacher can create a group" });
    const title = String(req.body?.title || "").trim();
    const type = ["custom", "class", "teachers", "school"].includes(req.body?.groupType) ? req.body.groupType : "custom";
    const ids = Array.isArray(req.body?.participantIds) ? [...new Set(req.body.participantIds.map(String))] : [];
    if (!title || title.length > 100) return res.status(400).json({ message: "Group name is required (maximum 100 characters)" });
    if (!ids.includes(String(req.user._id))) ids.push(String(req.user._id));
    if (ids.length < 2 || ids.length > 100 || ids.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: "Choose between 2 and 100 valid group members" });
    const participants = await User.find({ _id: { $in: ids }, school: req.user.school, active: true }).select("_id role");
    if (participants.length !== ids.length) return res.status(400).json({ message: "Every group member must be an active user from your school" });
    if (type === "teachers" && participants.some((person) => person.role !== "teacher" && !sameId(person, req.user))) return res.status(400).json({ message: "A teachers group can contain teachers and its creator only" });
    const conversation = await Conversation.create({
      school: req.user.school, type: "group", title, groupType: type,
      participants: participants.map((person) => person._id), createdBy: req.user._id,
    });
    const populated = await Conversation.findById(conversation._id).populate({ path: "participants", select: "name role active" });
    res.status(201).json({ conversation: conversationSummary(populated, req.user._id) });
  } catch (error) { next(error); }
});

router.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    const before = req.query.before && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before) : null;
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 40, 1), 100);
    const filter = { school: req.user.school, conversation: conversation._id, deletedAt: null };
    if (before) filter.createdAt = { $lt: before };
    const messages = await Message.find(filter).populate({ path: "sender", select: "name role active" }).sort({ createdAt: -1 }).limit(limit);
    res.json({ messages: messages.reverse().map(safeMessage), hasMore: messages.length === limit });
  } catch (error) { next(error); }
});

router.post("/conversations/:id/messages", async (req, res, next) => {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    const text = String(req.body?.text || "").trim().slice(0, 5000);
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 5) : [];
    if (!text && !attachments.length) return res.status(400).json({ message: "Write a message or attach a file" });
    const bucket = chatFileBucket();
    const storedAttachments = [];
    for (const attachment of attachments) {
      const fileId = String(attachment?.publicId || "");
      if (!mongoose.isValidObjectId(fileId)) return res.status(400).json({ message: "An attachment was not uploaded to MongoDB yet" });
      const storedFile = await mongoose.connection.db.collection("chatUploads.files").findOne({
        _id: new mongoose.Types.ObjectId(fileId),
        "metadata.schoolId": String(req.user.school),
        "metadata.conversationId": String(conversation._id),
      });
      if (!storedFile) return res.status(400).json({ message: "An attachment is not available for this conversation" });
      storedAttachments.push({
        url: `/chat/files/${storedFile._id}`,
        publicId: String(storedFile._id),
        name: String(storedFile.metadata?.originalName || storedFile.filename || "attachment").slice(0, 255),
        mimeType: String(storedFile.metadata?.mimeType || "application/octet-stream"),
        size: Number(storedFile.length) || 0,
        resourceType: String(storedFile.metadata?.resourceType || "raw"),
      });
    }
    const message = await Message.create({
      school: req.user.school, conversation: conversation._id, sender: req.user._id,
      text, attachments: storedAttachments,
      readBy: [req.user._id],
    });
    await Conversation.updateOne({ _id: conversation._id, school: req.user.school }, {
      $set: { lastMessageAt: message.createdAt, lastMessagePreview: text || (attachments.length ? `Attachment: ${attachments[0].name}` : "") },
    });
    const populated = await Message.findById(message._id).populate({ path: "sender", select: "name role active" });
    const serialized = safeMessage(populated);
    emitToConversation(req, conversation._id, "message:new", serialized);
    res.status(201).json({ message: serialized });
  } catch (error) { next(error); }
});

router.post("/conversations/:id/read", async (req, res, next) => {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    await Message.updateMany({
      school: req.user.school, conversation: conversation._id, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null,
    }, { $addToSet: { readBy: req.user._id } });
    emitToConversation(req, conversation._id, "message:read", { conversationId: String(conversation._id), userId: String(req.user._id) });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose an image, video or PDF file" });
    const conversationId = String(req.body?.conversationId || "");
    const conversation = await getConversationForUser(conversationId, req.user);
    if (!conversation) return res.status(404).json({ message: "Choose a conversation before uploading a file" });
    const resourceType = req.file.mimetype.startsWith("image/") ? "image" : req.file.mimetype.startsWith("video/") ? "video" : "raw";
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "attachment";
    const bucket = chatFileBucket();
    const uploadStream = bucket.openUploadStream(safeName, {
      contentType: req.file.mimetype,
      metadata: {
        schoolId: String(req.user.school),
        conversationId: String(conversation._id),
        uploadedBy: String(req.user._id),
        originalName: req.file.originalname.slice(0, 255),
        mimeType: req.file.mimetype,
        resourceType,
      },
    });
    await new Promise((resolve, reject) => {
      uploadStream.once("finish", resolve);
      uploadStream.once("error", reject);
      Readable.from(req.file.buffer).pipe(uploadStream);
    });
    const fileId = String(uploadStream.id);
    res.status(201).json({ attachment: {
      url: `/chat/files/${fileId}`,
      publicId: fileId,
      name: req.file.originalname.slice(0, 255),
      mimeType: req.file.mimetype,
      size: req.file.size,
      resourceType,
    } });
  } catch (error) { next(error); }
});

router.get("/files/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "File not found" });
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const file = await mongoose.connection.db.collection("chatUploads.files").findOne({
      _id: fileId,
      "metadata.schoolId": String(req.user.school),
    });
    if (!file || !mongoose.isValidObjectId(file.metadata?.conversationId)) return res.status(404).json({ message: "File not found" });
    const conversation = await Conversation.findOne({
      _id: file.metadata.conversationId,
      school: req.user.school,
      participants: req.user._id,
      isActive: true,
    }).select("_id");
    if (!conversation) return res.status(403).json({ message: "You do not have access to this file" });
    res.setHeader("Content-Type", file.metadata?.mimeType || file.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(file.length));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.metadata?.originalName || file.filename || "attachment")}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    chatFileBucket().openDownloadStream(fileId).on("error", next).pipe(res);
  } catch (error) { next(error); }
});

export default router;
