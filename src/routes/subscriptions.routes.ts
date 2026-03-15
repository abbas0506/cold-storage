import { Router } from "express";
import { requireSystemRole } from "../middleware/auth";
import {
    index,
    show,
    create,
    update,
    mySubscription,
} from "../controllers/subscriptions.controller";

const router = Router();

// SUPER_ADMIN endpoints
router.get("/", requireSystemRole(["SUPER_ADMIN"]), index);
router.get("/my", requireSystemRole(["SUBSCRIBER"]), mySubscription);
router.get("/:id", requireSystemRole(["SUPER_ADMIN"]), show);
router.post("/", requireSystemRole(["SUPER_ADMIN"]), create);
router.put("/:id", requireSystemRole(["SUPER_ADMIN"]), update);

export default router;
