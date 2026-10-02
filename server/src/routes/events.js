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

function systemHoliday(id, title, date, description, category = "National") {
  return {
    _id: `system-${category.toLowerCase()}-${id}`,
    title,
    date,
    startTime: "",
    endTime: "",
    type: "Holiday",
    location: "",
    audience: "Entire school",
    description,
    isSystemHoliday: true,
    holidayCategory: category,
  };
}

function getNationalHolidays(year) {
  return [
    systemHoliday(`${year}-01-26`, "Republic Day", `${year}-01-26`, "India's Republic Day."),
    systemHoliday(`${year}-08-15`, "Independence Day", `${year}-08-15`, "India's Independence Day."),
    systemHoliday(`${year}-10-02`, "Gandhi Jayanti", `${year}-10-02`, "Mahatma Gandhi's birthday."),
  ];
}

// Festival dates are year-specific because many Indian festivals follow lunar calendars.
// These dates are seeded for the current 2026-27 school year and are based on official
// Indian holiday calendars. Schools can still add their own local/regional holidays.
function getFestivalHolidays(year) {
  const festivalsByYear = {
    2026: [
      ["makar-sankranti", "Makar Sankranti", "2026-01-14"],
      ["maha-shivratri", "Maha Shivratri", "2026-02-15"],
      ["holi", "Holi", "2026-03-04"],
      ["ram-navami", "Ram Navami", "2026-03-26"],
      ["mahavir-jayanti", "Mahavir Jayanti", "2026-03-31"],
      ["good-friday", "Good Friday", "2026-04-03"],
      ["buddha-purnima", "Buddha Purnima", "2026-05-01"],
      ["eid-ul-fitr", "Eid-ul-Fitr", "2026-03-21"],
      ["bakrid", "Eid-ul-Zuha (Bakrid)", "2026-05-27"],
      ["muharram", "Muharram", "2026-06-26"],
      ["eid-milad", "Eid-e-Milad", "2026-08-26"],
      ["janmashtami", "Janmashtami", "2026-09-04"],
      ["ganesh-chaturthi", "Ganesh Chaturthi", "2026-09-14"],
      ["dussehra", "Dussehra", "2026-10-20"],
      ["diwali", "Diwali (Deepavali)", "2026-11-08"],
      ["guru-nanak-jayanti", "Guru Nanak Jayanti", "2026-11-24"],
      ["christmas", "Christmas Day", "2026-12-25"],
    ],
    2027: [
      ["maha-shivratri", "Maha Shivratri", "2027-02-26"],
      ["holi", "Holi", "2027-03-23"],
      ["good-friday", "Good Friday", "2027-03-26"],
      ["mahavir-jayanti", "Mahavir Jayanti", "2027-04-19"],
      ["eid-ul-zuhа", "Eid-ul-Zuha (Bakrid)", "2027-05-17"],
      ["buddha-purnima", "Buddha Purnima", "2027-05-20"],
      ["janmashtami", "Janmashtami", "2027-08-25"],
      ["dussehra", "Dussehra", "2027-10-09"],
      ["diwali", "Diwali (Deepavali)", "2027-10-29"],
      ["guru-nanak-jayanti", "Guru Nanak Jayanti", "2027-11-14"],
      ["christmas", "Christmas Day", "2027-12-25"],
    ],
  };

  return (festivalsByYear[year] || []).map(([id, title, date]) =>
    systemHoliday(`${year}-${id}`, title, date, `${title} holiday.`, "Festival")
  );
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

    const systemHolidays = [
      ...getNationalHolidays(year),
      ...getFestivalHolidays(year),
    ];

    const combined = [
      ...records.map((record) => ({
        ...record.toObject(),
        isSystemHoliday: false,
      })),
      ...systemHolidays,
    ];

    combined.sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.startTime || "").localeCompare(String(b.startTime || ""))
    );

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
