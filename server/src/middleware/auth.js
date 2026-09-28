import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;

    if (!token) return res.status(401).json({ message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select("-password");

    if (!user || !user.active) {
      return res.status(401).json({ message: "User account is inactive or missing" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
    const { hasPermission } = require("../config/permissions.js");
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ message: "Insufficient permission" });
    }
    next();
  };
}
