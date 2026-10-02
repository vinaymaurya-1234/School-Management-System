import { Router } from "express";
import User from "../models/User.js";
import { RESPONSIBILITIES, ROLES } from "../config/permissions.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    responsibilities: user.responsibilities,
    school: user.school,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function principalOnly(req, res, next) {
  if (req.user.role !== ROLES.PRINCIPAL) {
    return res.status(403).json({ message: "Only the principal can manage users" });
  }
  next();
}

function validateResponsibilities(responsibilities) {
  if (!Array.isArray(responsibilities)) return false;
  return responsibilities.every((item) => Object.values(RESPONSIBILITIES).includes(item));
}

router.use(requireAuth, principalOnly);

// List users belonging to the logged-in principal's school.
router.get("/", async (req, res, next) => {
  try {
    const { role, active } = req.query;
    const filter = { school: req.user.school };

    if (role) {
      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      filter.role = role;
    }

    if (active !== undefined) {
      if (!["true", "false"].includes(active)) {
        return res.status(400).json({ message: "active must be true or false" });
      }
      filter.active = active === "true";
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ users: users.map(serializeUser), count: users.length });
  } catch (error) {
    next(error);
  }
});

// Create a user inside the principal's school.
router.post("/", async (req, res, next) => {
  try {
    const { name, email, password, role, responsibilities = [] } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "name, email, password and role are required",
      });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (role === ROLES.PRINCIPAL) {
      return res.status(400).json({ message: "A principal cannot be created through user management" });
    }

    if (!validateResponsibilities(responsibilities)) {
      return res.status(400).json({ message: "Invalid responsibilities" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      role,
      responsibilities,
      school: req.user.school,
    });

    res.status(201).json({
      message: "User created successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }
    next(error);
  }
});

// Get one user, restricted to the logged-in principal's school.
router.get("/:id", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

// Update user details, role and additional responsibilities.
router.put("/:id", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user._id.equals(req.user._id)) {
      return res.status(400).json({ message: "Use account settings to update the principal account" });
    }

    const { name, email, password, role, responsibilities, active } = req.body || {};

    if (name !== undefined) user.name = String(name).trim();

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const emailOwner = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (emailOwner) return res.status(409).json({ message: "A user with this email already exists" });
      user.email = normalizedEmail;
    }

    if (password !== undefined) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      user.password = password;
    }

    if (role !== undefined) {
      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      if (role === ROLES.PRINCIPAL) {
        return res.status(400).json({ message: "A managed user cannot be changed to principal" });
      }
      user.role = role;
    }

    if (responsibilities !== undefined) {
      if (!validateResponsibilities(responsibilities)) {
        return res.status(400).json({ message: "Invalid responsibilities" });
      }
      user.responsibilities = responsibilities;
    }

    if (active !== undefined) {
      if (typeof active !== "boolean") {
        return res.status(400).json({ message: "active must be a boolean" });
      }
      user.active = active;
    }

    await user.save();

    res.json({ message: "User updated successfully", user: serializeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }
    next(error);
  }
});

// Soft-delete/deactivate a user rather than removing historical records.
router.delete("/:id", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, school: req.user.school });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user._id.equals(req.user._id)) {
      return res.status(400).json({ message: "The principal cannot deactivate their own account" });
    }

    user.active = false;
    await user.save();

    res.json({ message: "User deactivated successfully", user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
