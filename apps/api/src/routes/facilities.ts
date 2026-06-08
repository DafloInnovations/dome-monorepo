import { Router } from "express";
import {
  getFacility,
  getFacilitySlots,
  getAvailableCourts,
  listFacilities,
} from "../services/facilities.service";
import { getFacilityEquipment } from "../services/equipment.service";

const router = Router();

// GET /api/v1/facilities
// Query: sport, lat, lng, radius, date, city, province, page, limit
router.get("/", async (req, res, next) => {
  try {
    const { sport, lat, lng, radius, date, city, province, page, limit, sort } =
      req.query as Record<string, string | undefined>;

    const result = await listFacilities({
      sport,
      lat: lat !== undefined ? Number(lat) : undefined,
      lng: lng !== undefined ? Number(lng) : undefined,
      radiusKm: radius !== undefined ? Number(radius) : undefined,
      date,
      city,
      province,
      page: page !== undefined ? Math.max(1, Number(page)) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
      sort: sort as "distance" | "rating" | "price" | undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/facilities/:id
router.get("/:id", async (req, res, next) => {
  try {
    const data = await getFacility(req.params["id"]!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/facilities/:id/available-courts?date=YYYY-MM-DD&startTime=HH:mm&duration=60&sport=BADMINTON
router.get("/:id/available-courts", async (req, res, next) => {
  try {
    const { date, startTime, duration, sport } = req.query as Record<string, string | undefined>;
    if (!date || !startTime || !duration) {
      res.status(400).json({ message: "date, startTime, and duration are required" });
      return;
    }
    const durationMins = Number(duration);
    if (!Number.isInteger(durationMins) || durationMins < 30 || durationMins > 480) {
      res.status(400).json({ message: "duration must be an integer between 30 and 480 minutes" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: "date must be YYYY-MM-DD" });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(startTime)) {
      res.status(400).json({ message: "startTime must be HH:mm" });
      return;
    }
    const data = await getAvailableCourts(req.params["id"]!, date, startTime, durationMins, sport);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/facilities/:id/equipment?sport=
router.get("/:id/equipment", async (req, res, next) => {
  try {
    const { sport } = req.query as { sport?: string };
    const data = await getFacilityEquipment(req.params["id"]!, sport);
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/v1/facilities/:id/slots?date=YYYY-MM-DD
router.get("/:id/slots", async (req, res, next) => {
  try {
    const { date } = req.query as { date?: string };
    if (!date) {
      res.status(400).json({ message: "date query param is required (YYYY-MM-DD)" });
      return;
    }
    const data = await getFacilitySlots(req.params["id"]!, date);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
