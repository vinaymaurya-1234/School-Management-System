import { Router } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import User from "./models/User.js";
import School from "./models/School.js";
import { requireAuth } from "./middleware/auth.js";
import { ROLES } from "./config/permissions.js";

const router = Router();

function createLoginId(role) {
  const prefix = role === ROLES.STUDENT ? "STU" : role === ROLES.PARENT ? "PAR" : role === ROLES.TEACHER ? "TCH" : role === ROLES.ACCOUNTANT ? "ACC" : "SCH";
  return `${prefix}${new Date().getFullYear().toString().slice(-2)}${randomBytes(4).toString("hex").toUpperCase()}`;
}

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
    loginId: user.loginId || null,
    mustChangePassword: Boolean(user.mustChangePassword),
    role: user.role,
    responsibilities: user.responsibilities,
    school: user.school,
    active: user.active,
  };
}

router.post("/login", async (req, res, next) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.email || req.body?.loginId || "").trim();
    const password = String(req.body?.password || "");
    if (!identifier || !password) return res.status(400).json({ message: "Login ID or email and password are required" });

    // Backward-compatible lookup: old accounts continue to use email + password,
    // while newly generated accounts can use login ID + password.
    const normalizedIdentifier = identifier.trim();
    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier.toLowerCase() },
        { loginId: normalizedIdentifier.toUpperCase() },
      ],
    }).select("+password");

    if (!user || !user.active) return res.status(401).json({ message: "Invalid login ID/email or password" });
    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) return res.status(401).json({ message: "Invalid login ID/email or password" });

    if (!user.loginId) {
      let candidate;
      do { candidate = createLoginId(user.role); } while (await User.exists({ loginId: candidate }));
      user.loginId = candidate;
      await user.save();
    }

    const token = signToken(user);
    return res.json({ message: "Login successful", token, user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/first-password", requireAuth, async (req, res, next) => {
  try {
    if (!req.user.mustChangePassword) return res.status(400).json({ message: "Password change is not required for this account" });
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    if (password.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
    req.user.password = password;
    req.user.mustChangePassword = false;
    await req.user.save();
    return res.json({ message: "Password updated successfully", user: serializeUser(req.user) });
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
    const { name, email, password, currentPassword } = req.body || {};
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
    if (password !== undefined && String(password).length) {
      if (String(password).length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      if (!currentPassword) return res.status(400).json({ message: "Current password is required to change your password" });
      const account = await User.findById(req.user._id).select("+password");
      const passwordMatches = await account.comparePassword(String(currentPassword));
      if (!passwordMatches) return res.status(401).json({ message: "Current password is incorrect" });
      account.password = String(password);
      await account.save();
      req.user = account;
    }
    await req.user.save();
    res.json({ message: "Profile updated successfully", user: serializeUser(req.user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A user with this email or login ID already exists" });
    next(error);
  }
});

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
      loginId: createLoginId(ROLES.PRINCIPAL),
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
