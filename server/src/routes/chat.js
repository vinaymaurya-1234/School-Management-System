import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
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
router.use(requireAuth);

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
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (attachments.some((file) =>
      !file?.url || !file?.name || !file?.publicId ||
      !["image/", "video/"].some((type) => String(file.mimeType).startsWith(type)) && file.mimeType !== "application/pdf" ||
      !cloudName || !String(file.url).startsWith(`https://res.cloudinary.com/${cloudName}/`) ||
      !String(file.publicId).startsWith(`school-chat/${req.user.school}/`) ||
      !Number.isFinite(Number(file.size)) || Number(file.size) > 30 * 1024 * 1024
    )) {
      return res.status(400).json({ message: "One or more attachments are invalid or were not uploaded to this school's file storage" });
    }
    const message = await Message.create({
      school: req.user.school, conversation: conversation._id, sender: req.user._id,
      text, attachments: attachments.map((file) => ({
        url: String(file.url), publicId: String(file.publicId || ""), name: String(file.name).slice(0, 255),
        mimeType: String(file.mimeType), size: Math.max(0, Number(file.size) || 0),
        resourceType: file.mimeType.startsWith("image/") ? "image" : file.mimeType.startsWith("video/") ? "video" : "raw",
      })),
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
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: "File sharing is not configured yet. Add the free Cloudinary credentials to the server environment." });
    }
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const resourceType = req.file.mimetype.startsWith("image/") ? "image" : req.file.mimetype.startsWith("video/") ? "video" : "raw";
    const publicId = `${req.user.school}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)}`;
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        resource_type: resourceType, public_id: publicId, type: "authenticated", overwrite: false,
        folder: "school-chat", tags: [String(req.user.school)],
      }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(req.file.buffer);
    });
    const signedUrl = cloudinary.url(result.public_id, { resource_type: resourceType, type: "authenticated", sign_url: true, secure: true, format: result.format });
    res.status(201).json({ attachment: {
      url: signedUrl, publicId: result.public_id, name: req.file.originalname.slice(0, 255),
      mimeType: req.file.mimetype, size: req.file.size, resourceType,
    } });
  } catch (error) { next(error); }
});

export default router;
