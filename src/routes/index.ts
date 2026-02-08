import { Router } from "express";
import authRouter from "./auth";
import { authenticate } from "../middleware/auth";

import usersRouter from "./users.routes";
import coldstoreRouter from "./coldstores.routes";
import roomRouter from "./rooms.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", authenticate, usersRouter);
router.use("/coldstores", authenticate, coldstoreRouter);
router.use("/rooms", authenticate, roomRouter);

export default router;
