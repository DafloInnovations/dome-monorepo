import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  closeGame,
  confirmPlayer,
  createGame,
  declinePlayer,
  getGame,
  joinGame,
  listGames,
  myGames,
} from "../services/connect.service";

const router = Router();

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

const createGameSchema = z.object({
  facilityId: z.string().min(1),
  slotId: z.string().optional(),
  sport: z.string().min(1),
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  playersNeeded: z.number().int().min(2).max(10),
  skillLevel: z.string().min(1),
  description: z.string().max(500).optional(),
});

// GET /api/v1/connect/games/mine — must be registered before /:id
router.get("/games/mine", authenticate, async (req, res, next) => {
  try {
    res.json({ data: await myGames(req.user!.sub as string) });
  } catch (err) { next(err); }
});

// GET /api/v1/connect/games
router.get("/games", async (req, res, next) => {
  try {
    const { sport, date, city, lat, lng, radius, page, limit } =
      req.query as Record<string, string | undefined>;
    const result = await listGames({
      sport,
      date,
      city,
      lat: lat !== undefined ? Number(lat) : undefined,
      lng: lng !== undefined ? Number(lng) : undefined,
      radiusKm: radius !== undefined ? Number(radius) : undefined,
      page: page !== undefined ? Number(page) : 1,
      limit: limit !== undefined ? Number(limit) : 20,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/connect/games/:id
router.get("/games/:id", async (req, res, next) => {
  try {
    res.json({ data: await getGame(param(req.params["id"]!)) });
  } catch (err) { next(err); }
});

// POST /api/v1/connect/games
router.post("/games", authenticate, validate(createGameSchema), async (req, res, next) => {
  try {
    const game = await createGame(req.user!.sub as string, req.body as z.infer<typeof createGameSchema>);
    res.status(201).json({ data: game });
  } catch (err) { next(err); }
});

// POST /api/v1/connect/games/:id/join
router.post("/games/:id/join", authenticate, async (req, res, next) => {
  try {
    const result = await joinGame(req.user!.sub as string, param(req.params["id"]!));
    res.json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/v1/connect/games/:id/players/:userId/confirm
router.put("/games/:id/players/:userId/confirm", authenticate, async (req, res, next) => {
  try {
    const result = await confirmPlayer(
      req.user!.sub as string,
      param(req.params["id"]!),
      param(req.params["userId"]!)
    );
    res.json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/v1/connect/games/:id/players/:userId/decline
router.put("/games/:id/players/:userId/decline", authenticate, async (req, res, next) => {
  try {
    const result = await declinePlayer(
      req.user!.sub as string,
      param(req.params["id"]!),
      param(req.params["userId"]!)
    );
    res.json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/v1/connect/games/:id/close
router.put("/games/:id/close", authenticate, async (req, res, next) => {
  try {
    res.json({ data: await closeGame(req.user!.sub as string, param(req.params["id"]!)) });
  } catch (err) { next(err); }
});

export default router;
