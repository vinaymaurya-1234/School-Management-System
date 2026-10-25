import { Router } from "express";
import TimetableEntry from "../models/Timetable.js";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import {
  AcademicYear,
  Section,
  StudentEnrollment,
  TeacherAssignment,
} from "../models/Academic.js";
import { ClassSubject } from "../models/Subject.js";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "../config/permissions.js";
const router = Router();
router.use(requireAuth);
const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const DEFAULT_START_TIME = "07:15";
const DEFAULT_PERIOD_MINUTES = 40;
const DEFAULT_PERIODS_PER_DAY = 8;
const DEFAULT_BREAK_AFTER = 4;
const DEFAULT_BREAK_MINUTES = 20;
const DEFAULT_SATURDAY_PERIODS = 4;
function buildPeriodTimes({ startTime, periodMinutes, periodsPerDay, breakAfter, breakMinutes }) {
  const [hours, minutes] = String(startTime || DEFAULT_START_TIME).split(":").map(Number);
  let cursor = hours * 60 + minutes;
  const total = Math.max(1, Math.min(12, Number(periodsPerDay) || DEFAULT_PERIODS_PER_DAY));
  const breakAt = Math.max(0, Math.min(total, Number(breakAfter) || 0));
  const length = Math.max(20, Math.min(90, Number(periodMinutes) || DEFAULT_PERIOD_MINUTES));
  const pause = Math.max(0, Math.min(90, Number(breakMinutes) || 0));
  const format = (value) => String(Math.floor(value / 60) % 24).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
  return Array.from({ length: total }, (_, index) => {
    if (breakAt > 0 && index === breakAt) cursor += pause;
    const startTime = format(cursor);
    cursor += length;
    return [startTime, format(cursor)];
  });
}
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
async function studentEnrollmentForUser(userId, schoolId, academicYear) {
  return StudentEnrollment.findOne({
    school: schoolId,
    academicYear,
    student: userId,
    status: "active",
  });
}
async function parentChildUserIds(userId, schoolId) {
  const parent = await Parent.findOne({
    user: userId,
    school: schoolId,
  }).select("children");
  if (!parent) return [];
  const children = await Student.find({
    _id: { $in: parent.children || [] },
    school: schoolId,
  }).select("user");
  return children.map((child) => child.user);
}
router.get("/", async (req, res, next) => {
  try {
    const year = req.query.academicYear
      ? await AcademicYear.findOne({
          _id: req.query.academicYear,
          school: req.user.school,
        })
      : await AcademicYear.findOne({ school: req.user.school, isActive: true });
    if (!year) return res.json({ entries: [] });
    const filter = { school: req.user.school, academicYear: year._id };
    if (req.user.role !== ROLES.PRINCIPAL) filter.status = "published";
    if (req.query.sectionId && req.user.role === ROLES.PRINCIPAL)
      filter.section = req.query.sectionId;
    if (req.query.teacherId && req.user.role === ROLES.PRINCIPAL)
      filter.teacher = req.query.teacherId;
    if (req.user.role === ROLES.TEACHER) filter.teacher = req.user._id;
    if (req.user.role === ROLES.STUDENT) {
      const enrollment = await studentEnrollmentForUser(
        req.user._id,
        req.user.school,
        year._id,
      );
      if (!enrollment) return res.json({ entries: [] });
      filter.section = enrollment.section;
    }
    if (req.user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: req.user._id, school: req.user.school }).select("children");
      const childIds = (parent?.children || []).map((id) => id.toString());
      if (!childIds.length) return res.json({ entries: [] });
      // The picker sends a Student document ID, never trust it unless it belongs to this parent.
      if (req.query.studentId) {
        if (!childIds.includes(String(req.query.studentId))) {
          return res.status(403).json({ message: "You can only view a timetable for your linked child." });
        }
        const child = await Student.findOne({ _id: req.query.studentId, school: req.user.school }).select("user");
        if (!child) return res.status(404).json({ message: "Linked student not found." });
        const enrollment = await StudentEnrollment.findOne({
          school: req.user.school, academicYear: year._id, student: child.user, status: "active",
        }).select("section");
        if (!enrollment) return res.json({ entries: [] });
        filter.section = enrollment.section;
      } else {
        const children = await Student.find({ _id: { $in: childIds }, school: req.user.school }).select("user");
        const enrollments = await StudentEnrollment.find({
          school: req.user.school, academicYear: year._id,
          student: { $in: children.map((child) => child.user) }, status: "active",
        }).select("section");
        filter.section = { $in: enrollments.map((item) => item.section) };
      }
    }
    const entries = await TimetableEntry.find(filter)
      .populate("teacher", "name email")
      .populate("subject", "name code")
      .populate("section", "name class")
      .sort({ day: 1, periodNumber: 1 });
    res.json({ entries, academicYear: year });
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL)
      return res
        .status(403)
        .json({ message: "Only the principal can set the timetable" });
    const {
      academicYear,
      section,
      teacher,
      subject,
      day,
      periodNumber,
      startTime,
      endTime,
      room,
      status = "draft",
    } = req.body || {};
    if (
      !academicYear ||
      !section ||
      !teacher ||
      !subject ||
      !day ||
      !periodNumber ||
      !startTime ||
      !endTime
    )
      return res
        .status(400)
        .json({
          message:
            "academicYear, section, teacher, subject, day, periodNumber, startTime and endTime are required",
        });
    const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    if (day === "saturday" && Number(periodNumber) > DEFAULT_SATURDAY_PERIODS) {
      return res.status(400).json({ message: `Saturday is a half-day. Only the first ${DEFAULT_SATURDAY_PERIODS} periods can be scheduled.` });
    }
    if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(startTime) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(endTime) || minutes(endTime) <= minutes(startTime)) {
      return res.status(400).json({ message: "Enter a valid start and end time." });
    }
    const durationEntries = await TimetableEntry.find({ school: req.user.school, academicYear }).select("startTime endTime").lean();
    const expectedDuration = durationEntries.length ? minutes(durationEntries[0].endTime) - minutes(durationEntries[0].startTime) : DEFAULT_PERIOD_MINUTES;
    if (minutes(endTime) - minutes(startTime) !== expectedDuration) {
      return res.status(400).json({ message: "All school periods must have the same duration." });
    }
    const existingSection = await Section.findOne({
      _id: section,
      school: req.user.school,
      academicYear,
    });
    const existingTeacher = await User.findOne({
      _id: teacher,
      school: req.user.school,
      role: ROLES.TEACHER,
      active: true,
    });
    if (!existingSection)
      return res.status(404).json({ message: "Section not found" });
    if (!existingTeacher)
      return res.status(404).json({ message: "Teacher not found" });
    const assignment = await TeacherAssignment.findOne({
      school: req.user.school, academicYear, teacher, class: existingSection.class,
      subject, status: "active",
      $or: [{ section }, { section: { $exists: false } }, { section: null }],
    });
    if (!assignment) {
      return res.status(400).json({
        message: "This teacher is not assigned to teach this subject for the selected class/section. Update Teacher Assignments first.",
      });
    }
    const classSubject = await ClassSubject.findOne({
      school: req.user.school, academicYear, class: existingSection.class, subject,
    });
    if (!classSubject) {
      return res.status(400).json({ message: "This subject is not mapped to the selected class for this academic year." });
    }
    const existingSlot = await TimetableEntry.findOne({
      school: req.user.school, academicYear, periodNumber: Number(periodNumber),
      $or: [{ startTime: { $ne: startTime } }, { endTime: { $ne: endTime } }],
    }).select("startTime endTime periodNumber");
    if (existingSlot) {
      return res.status(409).json({
        message: `Period ${periodNumber} already uses ${existingSlot.startTime}–${existingSlot.endTime} elsewhere in the school. Use the same timings for every class.`,
      });
    }
    const conflict = await TimetableEntry.findOne({
      school: req.user.school,
      academicYear,
      day,
      periodNumber,
      $or: [{ section }, { teacher }],
    });
    if (conflict)
      return res
        .status(409)
        .json({
          message:
            conflict.section.toString() === section.toString()
              ? "This section already has a lesson in that period"
              : "This teacher is already teaching another section in that period",
        });
    const entry = await TimetableEntry.create({
      school: req.user.school,
      academicYear,
      section,
      teacher,
      subject,
      day,
      periodNumber: Number(periodNumber),
      startTime,
      endTime,
      room,
      status,
    });
    res.status(201).json({ message: "Timetable entry created", entry });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({
          message:
            "Timetable conflict: the section or teacher is already booked in that period",
        });
    next(error);
  }
});
router.post("/auto-generate", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL)
      return res.status(403).json({ message: "Only the principal can generate timetables" });

    const { academicYear, section, periods: requestedPeriods, saturdayPeriods: requestedSaturdayPeriods } = req.body || {};
    if (!academicYear || !section)
      return res.status(400).json({ message: "academicYear and section are required" });

    const sectionDoc = await Section.findOne({
      _id: section, school: req.user.school, academicYear,
    });
    if (!sectionDoc) return res.status(404).json({ message: "Section not found" });

    const schedulePeriods = Array.isArray(requestedPeriods) && requestedPeriods.length
      ? requestedPeriods.map((slot) => [String(slot.startTime || ""), String(slot.endTime || "")])
      : buildPeriodTimes({ startTime: DEFAULT_START_TIME, periodMinutes: DEFAULT_PERIOD_MINUTES, periodsPerDay: DEFAULT_PERIODS_PER_DAY, breakAfter: DEFAULT_BREAK_AFTER, breakMinutes: DEFAULT_BREAK_MINUTES });
    if (
      schedulePeriods.length < 1 || schedulePeriods.length > 12 ||
      schedulePeriods.some(([start, end]) => !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(start) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(end) || start >= end) ||
      schedulePeriods.some((slot, index) => index > 0 && slot[0] < schedulePeriods[index - 1][1]) ||
      new Set(schedulePeriods.map(([start, end]) => {
        const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
        return minutes(end) - minutes(start);
      })).size !== 1
    ) {
      return res.status(400).json({ message: "All periods must have the same duration, be in chronological order, and not overlap. Set valid start/end times." });
    }

    const publishedSchoolEntries = await TimetableEntry.find({
      school: req.user.school, academicYear, status: "published",
    }).select("periodNumber startTime endTime").lean();
    for (const slot of publishedSchoolEntries) {
      const requestedSlot = schedulePeriods[Number(slot.periodNumber) - 1];
      if (requestedSlot && (requestedSlot[0] !== slot.startTime || requestedSlot[1] !== slot.endTime)) {
        return res.status(409).json({
          message: `Period ${slot.periodNumber} is already published at ${slot.startTime}–${slot.endTime}. Unpublish existing school timetables before changing the bell schedule.`,
        });
      }
    }
    // One bell schedule for the whole school: when draft schedules exist, update
    // every draft entry's clock times together so classes never drift apart.
    for (let index = 0; index < schedulePeriods.length; index += 1) {
      const [startTime, endTime] = schedulePeriods[index];
      await TimetableEntry.updateMany(
        { school: req.user.school, academicYear, periodNumber: index + 1, status: "draft" },
        { $set: { startTime, endTime } },
      );
    }

    const saturdayLimit = Math.max(1, Math.min(schedulePeriods.length, Number(requestedSaturdayPeriods) || DEFAULT_SATURDAY_PERIODS));
    const publishedEntries = await TimetableEntry.countDocuments({
      school: req.user.school, academicYear, section, status: "published",
    });
    if (publishedEntries) {
      return res.status(409).json({
        message: "This section already has published periods. Unpublish or remove them before regenerating the timetable.",
      });
    }

    const mappings = await ClassSubject.find({
      school: req.user.school, academicYear, class: sectionDoc.class,
    }).populate("subject", "name code").lean();

    const assignments = await TeacherAssignment.find({
      school: req.user.school, academicYear, class: sectionDoc.class, status: "active",
    }).populate("teacher", "name").lean();

    if (!mappings.length)
      return res.status(400).json({
        message: "No subjects are mapped to this class yet. Add subjects and teacher assignments first.",
      });

    const missingTeachers = [];
    const usableMappings = [];
    for (const mapping of mappings) {
      const candidates = assignments.filter((item) =>
        String(item.subject?._id || item.subject) === String(mapping.subject?._id) &&
        (!item.section || String(item.section?._id || item.section) === String(section))
      );
      const assignment = candidates.find((item) => item.teacher?._id || item.teacher);
      if (!assignment?.teacher) missingTeachers.push(mapping.subject?.name || "Unknown subject");
      else usableMappings.push({ mapping, teacherId: assignment.teacher._id || assignment.teacher });
    }

    // Re-generation replaces only this section's draft entries; published entries are protected above.
    await TimetableEntry.deleteMany({
      school: req.user.school, academicYear, section, status: "draft",
    });

    const existing = await TimetableEntry.find({
      school: req.user.school, academicYear, section: { $ne: section },
    }).lean();

    const sectionBusy = new Set();
    const teacherBusy = new Set(existing.map(
      (item) => `${String(item.teacher)}:${item.day}:${item.periodNumber}`
    ));
    const placedSubjectsByDay = new Map(DAYS.map((day) => [day, new Set()]));
    const subjectAtSlot = new Map();
    const created = [];
    const conflicts = [];

    // Place subjects across the week. Each subject appears at most once per day by default.
    // Candidate periods are scored to avoid adjacent repeats and keep the day reasonably balanced.
    const dayLoads = new Map(DAYS.map((day) => [day, 0]));
    const periodLoads = new Map(DAYS.map((day) => [day, new Array(schedulePeriods.length).fill(0)]));
    for (const { mapping, teacherId } of usableMappings) {
      const weeklyPeriods = Math.max(1, Number(mapping.weeklyPeriods) || 1);
      if (weeklyPeriods > DAYS.length) {
        conflicts.push(`${mapping.subject?.name || "Subject"}: requested ${weeklyPeriods} periods, but the one-per-day rule allows at most ${DAYS.length} per week.`);
      }
      const target = Math.min(weeklyPeriods, DAYS.length);
      let placed = 0;
      while (placed < target) {
        const subjectId = String(mapping.subject?._id);
        const dayCandidates = DAYS
          .filter((day) => !placedSubjectsByDay.get(day).has(subjectId))
          .sort((a, b) => {
            const dayLoadDiff = dayLoads.get(a) - dayLoads.get(b);
            return dayLoadDiff || DAYS.indexOf(a) - DAYS.indexOf(b);
          });
        let choice = null;
        for (const day of dayCandidates) {
          const periodCount = day === "saturday" ? saturdayLimit : schedulePeriods.length;
          const periodCandidates = schedulePeriods.slice(0, periodCount).map((slot, index) => ({ slot, index, score: 0 }))
            .filter(({ index }) => {
              if (day === "saturday" && index >= saturdayLimit) return false;
              const periodNumber = index + 1;
              return !sectionBusy.has(`${day}:${periodNumber}`) &&
                !teacherBusy.has(`${String(teacherId)}:${day}:${periodNumber}`);
            })
            .map((candidate) => {
              const p = candidate.index;
              const previous = subjectAtSlot.get(`${day}:${p}`);
              const next = subjectAtSlot.get(`${day}:${p + 2}`);
              candidate.score =
                (previous === subjectId ? 100 : 0) +
                (next === subjectId ? 100 : 0) +
                periodLoads.get(day)[p] * 2 +
                Math.abs(p - Math.floor((periodCount - 1) / 2)) * 0.1;
              return candidate;
            })
            .sort((a, b) => a.score - b.score);
          if (periodCandidates.length) {
            choice = { day, ...periodCandidates[0] };
            break;
          }
        }
        if (!choice) break;

        const periodNumber = choice.index + 1;
        const [startTime, endTime] = schedulePeriods[choice.index];
        const entry = await TimetableEntry.create({
          school: req.user.school, academicYear, section, teacher: teacherId,
          subject: mapping.subject._id, day: choice.day, periodNumber,
          startTime, endTime, room: "", status: "draft",
        });
        sectionBusy.add(`${choice.day}:${periodNumber}`);
        teacherBusy.add(`${String(teacherId)}:${choice.day}:${periodNumber}`);
        placedSubjectsByDay.get(choice.day).add(subjectId);
        subjectAtSlot.set(`${choice.day}:${periodNumber}`, subjectId);
        dayLoads.set(choice.day, dayLoads.get(choice.day) + 1);
        periodLoads.get(choice.day)[choice.index] += 1;
        created.push(entry);
        placed += 1;
      }
      if (placed < target) {
        conflicts.push(`${mapping.subject?.name || "Subject"}: only ${placed}/${target} periods could be scheduled due to teacher/section conflicts.`);
      }
    }

    return res.status(201).json({
      message: "Balanced draft timetable generated. Review it before publishing.",
      createdCount: created.length, missingTeachers, conflicts,\n      availableSlots: 5 * schedulePeriods.length + saturdayLimit,\n      unfilledSlots: Math.max(0, 5 * schedulePeriods.length + saturdayLimit - created.length),
    });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({
        message: "A timetable conflict occurred while generating the schedule. Refresh and try again.",
      });
    next(error);
  }
});
router.patch("/:id/publish", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL)
      return res
        .status(403)
        .json({ message: "Only the principal can publish a timetable" });
    const entry = await TimetableEntry.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      { status: "published" },
      { new: true },
    );
    if (!entry)
      return res.status(404).json({ message: "Timetable entry not found" });
    res.json({ message: "Timetable entry published", entry });
  } catch (error) {
    next(error);
  }
});
router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PRINCIPAL)
      return res
        .status(403)
        .json({ message: "Only the principal can delete timetable entries" });
    const entry = await TimetableEntry.findOneAndDelete({
      _id: req.params.id,
      school: req.user.school,
    });
    if (!entry)
      return res.status(404).json({ message: "Timetable entry not found" });
    res.json({ message: "Timetable entry deleted" });
  } catch (error) {
    next(error);
  }
});
export default router;
