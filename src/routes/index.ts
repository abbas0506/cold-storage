import { Router } from "express";
import usersRouter from "./users";
import authRouter from "./auth";
import coldstoreRouter from "./coldstore";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", authenticate, usersRouter);
router.use("/coldstore", coldstoreRouter);

export default router;
