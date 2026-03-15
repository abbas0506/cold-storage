import { Router } from "express";
import { login, changePassword, me } from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.post("/change-password", authenticate, changePassword);
router.get("/me", authenticate, me);

export default router;
