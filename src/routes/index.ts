import { Router } from "express";
import authRouter from "./auth";
import { authenticate } from "../middleware/auth";

import usersRouter from "./users.routes";
import coldstoreRouter from "./coldstores.routes";
import roomRouter from "./rooms.routes";
import rackRouter from "./racks.routes";
import farmerRouter from "./farmers.routes";
import itemRouter from "./items.routes";
import ratePlanRouter from "./rate-plans.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", authenticate, usersRouter);
router.use("/coldstores", authenticate, coldstoreRouter);
router.use("/coldstores/:storeId/rooms", authenticate, roomRouter);
router.use(
  "/coldstores/:storeId/rooms/:roomId/racks",
  authenticate,
  rackRouter,
);
router.use("/coldstores/:storeId/farmers", authenticate, farmerRouter);
router.use("/coldstores/:storeId/items", authenticate, itemRouter);
router.use("/coldstores/:storeId/rate-plans", authenticate, ratePlanRouter);

export default router;
