import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Conversation from "./models/Conversation.js";

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await connectDB();

    // Migrate legacy User email indexes so accounts without an email can be created.
    // Older non-sparse unique email indexes treat missing email values as null and
    // reject subsequent email-less teacher accounts.
    await User.collection.updateMany({ email: "" }, { $unset: { email: "" } });
    const userIndexes = await User.collection.indexes();
    const emailIndexes = userIndexes.filter((index) =>
      index.key && Object.keys(index.key).length === 1 && index.key.email === 1
    );
    const hasCorrectSparseUniqueEmailIndex = emailIndexes.some((index) => index.sparse === true && index.unique === true);
    if (!hasCorrectSparseUniqueEmailIndex) {
      for (const index of emailIndexes) await User.collection.dropIndex(index.name);
      await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true, name: "email_1" });
      console.log("Migrated User.email index to sparse unique; email is optional.");
    }
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
      },
      maxHttpBufferSize: 1e6,
    });

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token || !process.env.JWT_SECRET) return next(new Error("Authentication required"));
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.userId).select("name role school active mustChangePassword");
        if (!user || !user.active || user.mustChangePassword) return next(new Error("Active school account required"));
        socket.data.userId = String(user._id);
        socket.data.schoolId = String(user.school);
        next();
      } catch {
        next(new Error("Invalid or expired session"));
      }
    });

    io.on("connection", (socket) => {
      socket.join(`user:${socket.data.userId}`);
      socket.on("conversation:join", async (conversationId, acknowledge) => {
        try {
          const conversation = await Conversation.findOne({
            _id: conversationId,
            school: socket.data.schoolId,
            participants: socket.data.userId,
            isActive: true,
          }).select("_id");
          if (!conversation) {
            if (typeof acknowledge === "function") acknowledge({ ok: false, message: "Conversation not found" });
            return;
          }
          socket.join(`conversation:${conversation._id}`);
          if (typeof acknowledge === "function") acknowledge({ ok: true });
        } catch {
          if (typeof acknowledge === "function") acknowledge({ ok: false, message: "Could not join conversation" });
        }
      });
      socket.on("conversation:leave", (conversationId) => {
        if (typeof conversationId === "string") socket.leave(`conversation:${conversationId}`);
      });
      socket.on("typing:start", async (conversationId) => {
        if (typeof conversationId !== "string") return;
        const allowed = await Conversation.exists({ _id: conversationId, school: socket.data.schoolId, participants: socket.data.userId, isActive: true });
        if (allowed) socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, userId: socket.data.userId, typing: true });
      });
      socket.on("typing:stop", async (conversationId) => {
        if (typeof conversationId !== "string") return;
        const allowed = await Conversation.exists({ _id: conversationId, school: socket.data.schoolId, participants: socket.data.userId, isActive: true });
        if (allowed) socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, userId: socket.data.userId, typing: false });
      });
    });

    app.set("io", io);
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
