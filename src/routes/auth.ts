import { Router } from "express";
import { register, login, changePassword } from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/change-password", authenticate, changePassword);

export default router;
