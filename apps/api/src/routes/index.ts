import { Router } from "express";
import authRouter from "./auth";
import bookingsRouter from "./bookings";
import chatRouter from "./chat";
import facilitiesRouter from "./facilities";
import openGamesRouter from "./open-games";
import paymentsRouter from "./payments";
import reviewsRouter from "./reviews";
import slotsRouter from "./slots";
import { facilitySlotRouter } from "./slots";
import usersRouter from "./users";
import vendorsRouter from "./vendors";

export const router = Router();

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/facilities", facilitiesRouter);
router.use("/facilities/:facilityId/slots", facilitySlotRouter);
router.use("/slots", slotsRouter);
router.use("/bookings", bookingsRouter);
router.use("/payments", paymentsRouter);
router.use("/vendors", vendorsRouter);
router.use("/reviews", reviewsRouter);
router.use("/open-games", openGamesRouter);
router.use("/chat", chatRouter);
