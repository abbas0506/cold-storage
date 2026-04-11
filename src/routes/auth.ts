import { Router } from "express";
import { login, register, changePassword, me } from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/change-password", authenticate, changePassword);
router.get("/me", authenticate, me);

export default router;
