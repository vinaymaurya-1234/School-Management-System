import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { Readable } from "node:stream";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import { StudentEnrollment, TeacherAssignment, Section, SchoolClass } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";
import ConversationMember from "../models/ConversationMember.js";

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

router.use(requireAuth, (req, res, next) => {
  if (!["principal", "teacher", "student", "parent", "accountant"].includes(req.user.role)) {
    return res.status(403).json({ message: "Chat is available to authorized school accounts only" });
  }
  next();
});

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
  if (sender.role === "parent" && recipient.role === "accountant" || sender.role === "accountant" && recipient.role === "parent") {
    const parentUser = sender.role === "parent" ? sender : recipient;
    return Boolean(await Parent.exists({ user: parentUser._id, school: parentUser.school, children: { $exists: true, $ne: [] } }));
  }
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
    const roles = req.user.role === "parent" ? ["principal", "teacher", "accountant"] : ["principal", "teacher", "student", "parent"];
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


async function syncClassGroupsForUser(user) {
  // A principal should never be a member of automatically managed student/parent class groups.
  // Reconcile existing groups even when the principal is the account opening the inbox.
  if (user.role === "principal") {
    const classGroups = await Conversation.find({
      school: user.school,
      type: "group",
      groupType: { $in: ["class", "parent-class"] },
      participants: user._id,
    }).select("_id participants");
    for (const conversation of classGroups) {
      conversation.participants = conversation.participants.filter((participant) => !sameId(participant, user._id));
      await conversation.save();
      await ConversationMember.updateOne(
        { school: user.school, conversation: conversation._id, user: user._id, leftAt: null },
        { $set: { leftAt: new Date() } },
      );
    }
    return;
  }
  if (!["student", "parent", "teacher"].includes(user.role)) return;
  let enrollments = [];
  if (user.role === "student") {
    enrollments = await StudentEnrollment.find({ school: user.school, student: user._id, status: "active" });
  } else if (user.role === "parent") {
    const parent = await Parent.findOne({ user: user._id, school: user.school }).select("children");
    const children = parent?.children?.length ? await Student.find({ _id: { $in: parent.children }, school: user.school, active: true }).select("user") : [];
    enrollments = children.length ? await StudentEnrollment.find({ school: user.school, student: { $in: children.map((child) => child.user) }, status: "active" }) : [];
  } else {
    const assignments = await TeacherAssignment.find({ school: user.school, teacher: user._id, status: "active" }).select("academicYear class section");
    const sectionIds = assignments.map((item) => item.section).filter(Boolean);
    const classIds = assignments.map((item) => item.class).filter(Boolean);
    enrollments = await StudentEnrollment.find({ school: user.school, status: "active", $or: [{ section: { $in: sectionIds } }, { class: { $in: classIds } }] });
  }
  const enrollmentKeys = [...new Map(enrollments.map((item) => [String(item.section), item])).values()];
  for (const enrollment of enrollmentKeys) {
    const [section, klass, classEnrollments, assignments] = await Promise.all([
      Section.findOne({ _id: enrollment.section, school: user.school }),
      SchoolClass.findOne({ _id: enrollment.class, school: user.school }),
      StudentEnrollment.find({ school: user.school, academicYear: enrollment.academicYear, class: enrollment.class, section: enrollment.section, status: "active" }).select("student"),
      TeacherAssignment.find({ school: user.school, academicYear: enrollment.academicYear, status: "active", $or: [{ class: enrollment.class }, { section: enrollment.section }] }).select("teacher"),
    ]);
    if (!section || !klass || !classEnrollments.length) continue;
    const studentIds = [...new Set(classEnrollments.map((row) => String(row.student)))];
    const students = await User.find({ _id: { $in: studentIds }, school: user.school, role: "student", active: true }).select("_id role");
    const studentDocs = await Student.find({ user: { $in: students.map((item) => item._id) }, school: user.school, active: true }).select("_id user");
    const parentDocs = studentDocs.length ? await Parent.find({ children: { $in: studentDocs.map((item) => item._id) }, school: user.school }).select("user children") : [];
    const parentIds = [...new Set(parentDocs.map((item) => String(item.user)))];
    const teachers = await User.find({ _id: { $in: [...assignments.map((item) => item.teacher), section.classTeacher].filter(Boolean) }, school: user.school, role: "teacher", active: true }).select("_id role");
    const parents = await User.find({ _id: { $in: parentIds }, school: user.school, role: "parent", active: true }).select("_id role");
    // Principals are not members of automatic student or parent class groups.
    const definitions = [
      { groupType: "class", title: `Class ${klass.name} - ${section.name}`, members: [...students, ...teachers] },
      { groupType: "parent-class", title: `Class ${klass.name} - ${section.name} Parents`, members: [...parents, ...teachers] },
    ];
    for (const definition of definitions) {
      const ids = [...new Map(definition.members.map((item) => [String(item._id), item])).values()];
      if (!ids.some((item) => sameId(item, user))) continue;
      let conversation = await Conversation.findOne({
        school: user.school, type: "group", groupType: definition.groupType,
        academicYear: enrollment.academicYear, section: enrollment.section, isActive: true,
      });
      if (!conversation) {
        conversation = await Conversation.create({
          school: user.school, type: "group", groupType: definition.groupType,
          title: definition.title, academicYear: enrollment.academicYear, class: enrollment.class,
          section: enrollment.section, participants: ids.map((item) => item._id), createdBy: user._id,
        });
      } else {
        const nextIds = ids.map((item) => String(item._id));
        const previousIds = (conversation.participants || []).map(String);
        for (const oldId of previousIds.filter((id) => !nextIds.includes(id))) {
          await ConversationMember.updateOne({ conversation: conversation._id, user: oldId, leftAt: null }, { $set: { leftAt: new Date() } });
        }
        for (const person of ids) {
          const existingMembership = await ConversationMember.findOne({ conversation: conversation._id, user: person._id });
          if (existingMembership?.leftAt) {
            existingMembership.joinedAt = new Date();
            existingMembership.leftAt = null;
            existingMembership.roleAtJoin = person.role;
            await existingMembership.save();
          } else {
            await ConversationMember.updateOne({ conversation: conversation._id, user: person._id }, {
              $setOnInsert: { school: user.school, joinedAt: new Date(), roleAtJoin: person.role },
              $set: { leftAt: null },
            }, { upsert: true });
          }
        }
        conversation.participants = ids.map((item) => item._id);
        conversation.title = definition.title;
        await conversation.save();
      }
      for (const person of ids) {
        await ConversationMember.updateOne({ conversation: conversation._id, user: person._id }, {
          $setOnInsert: { school: user.school, joinedAt: new Date(), roleAtJoin: person.role },
          $set: { leftAt: null },
        }, { upsert: true });
      }
    }
  }
}

router.get("/conversations", async (req, res, next) => {
  try {
    await syncClassGroupsForUser(req.user);
    const conversations = await Conversation.find({
      school: req.user.school, participants: req.user._id, isActive: true,
    }).populate({ path: "participants", select: "name role active" }).sort({ lastMessageAt: -1 }).limit(100);
    const ids = conversations.map((item) => item._id);
    // Legacy memberships start at migration time; older history is not exposed to newly
    // registered members and is not included in unread counters or inbox previews.
    for (const conversation of conversations) {
      await ConversationMember.updateOne(
        { conversation: conversation._id, user: req.user._id },
        { $setOnInsert: { school: req.user.school, joinedAt: new Date(), roleAtJoin: req.user.role } },
        { upsert: true },
      );
    }
    const memberships = ids.length ? await ConversationMember.find({
      school: req.user.school, user: req.user._id, conversation: { $in: ids }, leftAt: null,
    }).select("conversation joinedAt") : [];
    const visibleHistory = memberships.map((membership) => ({ conversation: membership.conversation, createdAt: { $gte: membership.joinedAt } }));
    const latestMessages = visibleHistory.length ? await Message.aggregate([
      { $match: { school: req.user.school, deletedAt: null, $or: visibleHistory } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversation", message: { $first: "$$ROOT" } } },
    ]) : [];
    const latestByConversation = new Map(latestMessages.map((row) => [String(row._id), row.message]));
    const unread = visibleHistory.length ? await Message.aggregate([
      { $match: { school: req.user.school, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deletedAt: null, $or: visibleHistory } },
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
    const type = String(req.body?.groupType || "custom");
    if (!["custom", "teachers"].includes(type)) return res.status(400).json({ message: "Class and parent groups are created automatically from active school records" });
    const ids = Array.isArray(req.body?.participantIds) ? [...new Set(req.body.participantIds.map(String))] : [];
    if (!title || title.length > 100) return res.status(400).json({ message: "Group name is required (maximum 100 characters)" });
    if (!ids.includes(String(req.user._id))) ids.push(String(req.user._id));
    if (ids.length < 2 || ids.length > 100 || ids.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: "Choose between 2 and 100 valid group members" });
    const participants = await User.find({ _id: { $in: ids }, school: req.user.school, active: true }).select("_id role");
    if (type !== "custom" && type !== "teachers") return res.status(400).json({ message: "Class and school groups are managed automatically from school records" });
    if (participants.length !== ids.length) return res.status(400).json({ message: "Every group member must be an active user from your school" });
    if (type === "teachers" && participants.some((person) => person.role !== "teacher" && !sameId(person, req.user))) return res.status(400).json({ message: "A teachers group can contain teachers and its creator only" });
    if (type === "custom" && participants.some((person) => !["teacher", "principal"].includes(person.role))) return res.status(400).json({ message: "Custom groups may only contain teachers and the principal. Class and parent groups are managed automatically." });
    const conversation = await Conversation.create({
      school: req.user.school, type: "group", title, groupType: type,
      participants: participants.map((person) => person._id), createdBy: req.user._id,
    });
    await Promise.all(participants.map((person) => ConversationMember.updateOne({ conversation: conversation._id, user: person._id }, { $setOnInsert: { school: req.user.school, joinedAt: new Date(), roleAtJoin: person.role } }, { upsert: true })));
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
    const membership = await ConversationMember.findOne({ conversation: conversation._id, user: req.user._id, school: req.user.school, leftAt: null }).select("joinedAt");
    const joinedAt = membership?.joinedAt || new Date();
    const filter = { school: req.user.school, conversation: conversation._id, deletedAt: null, createdAt: { $gte: joinedAt } };
    if (before) filter.createdAt.$lt = before;
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
    const membership = await ConversationMember.findOne({ conversation: conversation._id, user: req.user._id, school: req.user.school, leftAt: null });
    if (!membership) return res.status(403).json({ message: "You are not an active member of this conversation" });
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

router.patch("/conversations/:conversationId/messages/:messageId", async (req, res, next) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(404).json({ message: "Message not found" });
    const message = await Message.findOne({
      _id: req.params.messageId, school: req.user.school, conversation: conversation._id,
      sender: req.user._id, deletedAt: null,
    }).populate({ path: "sender", select: "name role active" });
    if (!message) return res.status(404).json({ message: "Message not found or you cannot edit it" });
    const text = String(req.body?.text || "").trim().slice(0, 5000);
    if (!text && !(message.attachments || []).length) return res.status(400).json({ message: "An edited message cannot be empty" });
    message.text = text;
    message.editedAt = new Date();
    await message.save();
    const serialized = safeMessage(message);
    emitToConversation(req, conversation._id, "message:updated", serialized);
    res.json({ message: serialized });
  } catch (error) { next(error); }
});

router.delete("/conversations/:conversationId/messages/:messageId", async (req, res, next) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.user);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(404).json({ message: "Message not found" });
    const message = await Message.findOne({
      _id: req.params.messageId, school: req.user.school, conversation: conversation._id,
      sender: req.user._id, deletedAt: null,
    });
    if (!message) return res.status(404).json({ message: "Message not found or you cannot delete it" });
    message.deletedAt = new Date();
    message.text = "";
    message.attachments = [];
    await message.save();
    const payload = { id: String(message._id), conversationId: String(conversation._id), deletedAt: message.deletedAt };
    emitToConversation(req, conversation._id, "message:deleted", payload);
    const latest = await Message.findOne({ school: req.user.school, conversation: conversation._id, deletedAt: null }).sort({ createdAt: -1 });
    await Conversation.updateOne({ _id: conversation._id, school: req.user.school }, {
      $set: { lastMessageAt: latest?.createdAt || null, lastMessagePreview: latest ? (latest.text || latest.attachments?.[0]?.name || "Attachment") : "" },
    });
    res.json({ ok: true, message: payload });
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
      Readable.from([req.file.buffer]).pipe(uploadStream);
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
