import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import School from "./models/School.js";
import { requireAuth } from "./middleware/auth.js";
import { ROLES } from "./config/permissions.js";

const router = Router();

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign(
    { userId: user._id.toString(), role: user.role, schoolId: user.school.toString() },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    responsibilities: user.responsibilities,
    school: user.school,
    active: user.active,
  };
}

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.active) return res.status(401).json({ message: "Invalid email or password" });

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) return res.status(401).json({ message: "Invalid email or password" });

    const token = signToken(user);
    return res.json({ message: "Login successful", token, user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const school = await School.findById(req.user.school).select("name code address activeAcademicYear");
  res.json({ user: serializeUser(req.user), school });
});

router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (name !== undefined) {
      const value = String(name).trim();
      if (!value) return res.status(400).json({ message: "Name cannot be empty" });
      req.user.name = value;
    }
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) return res.status(400).json({ message: "Email cannot be empty" });
      const owner = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user._id } });
      if (owner) return res.status(409).json({ message: "A user with this email already exists" });
      req.user.email = normalizedEmail;
    }
    if (password !== undefined) {
      if (String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      req.user.password = String(password);
    }
    await req.user.save();
    res.json({ message: "Profile updated successfully", user: serializeUser(req.user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A user with this email already exists" });
    next(error);
  }
});

// Used only for the first setup. It works only when the database has no users.
router.post("/bootstrap", async (req, res, next) => {
  try {
    const existingUser = await User.exists({});
    if (existingUser) return res.status(409).json({ message: "Initial setup is already completed" });

    const setupKey = process.env.BOOTSTRAP_KEY;
    if (!setupKey || req.body?.setupKey !== setupKey) return res.status(403).json({ message: "Invalid setup key" });

    const { name, email, password, schoolName, schoolCode, address } = req.body || {};
    if (!name || !email || !password || !schoolName || !schoolCode) {
      return res.status(400).json({ message: "name, email, password, schoolName and schoolCode are required" });
    }

    const school = await School.create({
      name: String(schoolName).trim(),
      code: String(schoolCode).trim().toUpperCase(),
      address: String(address || "").trim(),
    });

    const principal = await User.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password,
      role: ROLES.PRINCIPAL,
      school: school._id,
    });

    const token = signToken(principal);
    res.status(201).json({ message: "School and principal created successfully", token, user: serializeUser(principal) });
  } catch (error) {
    next(error);
  }
});

export default router;
