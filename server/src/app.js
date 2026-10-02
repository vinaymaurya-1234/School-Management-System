import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import academicRoutes from "./routes/academic.js";
import userRoutes from "./routes/users.js";
import teacherRoutes from "./routes/teachers.js";
import studentRoutes from "./routes/students.js";
import parentRoutes from "./routes/parents.js";
import subjectRoutes from "./routes/subjects.js";
import timetableRoutes from "./routes/timetable.js";
import attendanceRoutes from "./routes/attendance.js";
import teacherAttendanceRoutes from "./routes/teacherAttendance.js";
import operationsRoutes from "./routes/operations.js";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({
    ok: true,
    service: "school-management-system-server",
    database: dbState === 1 ? "connected" : "disconnected",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/users", userRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/teacher-attendance", teacherAttendanceRoutes);
app.use("/api/operations", operationsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

export default app;
