import { Router } from "express";
import Event from "../models/Event.js";
import { AcademicYear } from "../models/Academic.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";

const router = Router();
router.use(requireAuth);

const EVENT_TYPES = new Set(["School Event", "Holiday", "PTM", "Exam", "Meeting", "Activity"]);
const AUDIENCES = new Set(["Entire school", "Teachers", "Students", "Parents", "Specific classes"]);

function canManage(req) {
  return req.user.role === ROLES.PRINCIPAL;
}

function getNationalHolidays(year) {
  return [
    {
      _id: `national-${year}-01-26`,
      title: "Republic Day",
      date: `${year}-01-26`,
      startTime: "",
      endTime: "",
      type: "Holiday",
      location: "",
      audience: "Entire school",
      description: "India's Republic Day.",
      isSystemHoliday: true,
    },
    {
      _id: `national-${year}-08-15`,
      title: "Independence Day",
      date: `${year}-08-15`,
      startTime: "",
      endTime: "",
      type: "Holiday",
      location: "",
      audience: "Entire school",
      description: "India's Independence Day.",
      isSystemHoliday: true,
    },
    {
      _id: `national-${year}-10-02`,
      title: "Gandhi Jayanti",
      date: `${year}-10-02`,
      startTime: "",
      endTime: "",
      type: "Holiday",
      location: "",
      audience: "Entire school",
      description: "Gandhi Jayanti.",
      isSystemHoliday: true,
    },
  ];
}

function validateTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null;
  if (endTime <= startTime) return "End time must be later than start time";
  return null;
}

function cleanPayload(body = {}) {
  const title = String(body.title || "").trim();
  const date = String(body.date || "").trim();
  const startTime = String(body.startTime || "").trim();
  const endTime = String(body.endTime || "").trim();
  const type = String(body.type || "School Event").trim();
  const audience = String(body.audience || "Entire school").trim();
  const location = String(body.location || "").trim();
  const description = String(body.description || "").trim();

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "title and a valid date are required" };
  }
  if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) return { error: "Invalid start time" };
  if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) return { error: "Invalid end time" };
  if (!EVENT_TYPES.has(type)) return { error: "Invalid event type" };
  if (!AUDIENCES.has(audience)) return { error: "Invalid audience" };

  const timeError = validateTimeRange(startTime, endTime);
  if (timeError) return { error: timeError };

  return { value: { title, date, startTime, endTime, type, audience, location, description } };
}

router.get("/", async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "Invalid calendar year" });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const records = await Event.find({
      school: req.user.school,
      active: true,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate("createdBy", "name email")
      .populate("academicYear", "name")
      .sort({ date: 1, startTime: 1, createdAt: 1 });

    const systemHolidays = getNationalHolidays(year);
    const combined = [...records.map((record) => ({
      ...record.toObject(),
      isSystemHoliday: false,
    })), ...systemHolidays];

    combined.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime || "").localeCompare(String(b.startTime || "")));
    res.json({ records: combined, count: combined.length, year });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: "Only the principal can create school events" });

    const parsed = cleanPayload(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const activeAcademicYear = await AcademicYear.findOne({ school: req.user.school, isActive: true }).select("_id");
    const record = await Event.create({
      school: req.user.school,
      academicYear: activeAcademicYear?._id || null,
      createdBy: req.user._id,
      ...parsed.value,
    });

    res.status(201).json({ message: "Event created successfully", record });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: "Only the principal can update school events" });

    const parsed = cleanPayload(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const record = await Event.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school, active: true },
      parsed.value,
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ message: "Event not found" });

    res.json({ message: "Event updated successfully", record });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: "Only the principal can delete school events" });

    const record = await Event.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school, active: true },
      { active: false },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: "Event not found" });

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
