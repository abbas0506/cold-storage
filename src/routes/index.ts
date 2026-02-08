import { Router } from "express";
import authRouter from "./auth";
import { authenticate } from "../middleware/auth";

import usersRouter from "./users.routes";
import coldstoreRouter from "./coldstores.routes";
import roomRouter from "./rooms.routes";
import farmerRouter from "./farmers.routes";
import itemRouter from "./items.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", authenticate, usersRouter);
router.use("/coldstores", authenticate, coldstoreRouter);
router.use("/rooms", authenticate, roomRouter);
router.use("/farmers", authenticate, farmerRouter);
router.use("/items", authenticate, itemRouter);

export default router;
