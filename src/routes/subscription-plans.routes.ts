import { Router } from "express";
import { requireSystemRole } from "../middleware/auth";
import {
    index,
    show,
    create,
    update,
    destroy,
} from "../controllers/subscription-plans.controller";

const router = Router();

// All subscription-plan routes require SUPER_ADMIN
router.use(requireSystemRole(["SUPER_ADMIN"]));

router.get("/", index);
router.get("/:id", show);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", destroy);

export default router;
