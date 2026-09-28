import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const databaseStatus = dbState === 1 ? "connected" : "disconnected";

  res.json({
    ok: true,
    service: "school-management-system-server",
    database: databaseStatus,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

export default app;
