import { Router } from "express";
import { requireSystemRole } from "../middleware/auth";
import {
    getUsers,
    getMyUsers,
    createUser,
    updateUser,
    toggleUserActive,
    adminUpdateUser,
    adminCreateUser,
} from "../controllers/users.controller";

const router = Router();

// SUPER_ADMIN: view all users / create any user / update any user
router.get("/", requireSystemRole(["SUPER_ADMIN"]), getUsers);
router.post("/admin", requireSystemRole(["SUPER_ADMIN"]), adminCreateUser);
router.put("/admin/:id", requireSystemRole(["SUPER_ADMIN"]), adminUpdateUser);

// SUBSCRIBER: manage their own created users
router.get("/my", requireSystemRole(["SUBSCRIBER"]), getMyUsers);
router.post("/", requireSystemRole(["SUBSCRIBER"]), createUser);
router.put("/:id", requireSystemRole(["SUBSCRIBER"]), updateUser);
router.patch("/:id/toggle-active", requireSystemRole(["SUBSCRIBER"]), toggleUserActive);

export default router;

