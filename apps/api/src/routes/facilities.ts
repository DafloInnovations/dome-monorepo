import { Router } from "express";
import {
  getFacility,
  getFacilitySlots,
  listFacilities,
} from "../services/facilities.service";

const router = Router();

// GET /api/v1/facilities
// Query: sport, lat, lng, radius, date, city, province, page, limit
router.get("/", async (req, res, next) => {
  try {
    const { sport, lat, lng, radius, date, city, province, page, limit } =
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
