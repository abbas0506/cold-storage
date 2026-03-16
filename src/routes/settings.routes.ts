import { Router } from "express";
import { index, showByKey, upsert, destroy } from "../controllers/settings.controller";
import { requireSystemRole } from "../middleware/auth";

const router = Router();

const adminOnly = requireSystemRole(["SUPER_ADMIN"]);

router.get("/", index);
router.get("/:key", showByKey);
router.put("/:key", adminOnly, upsert);
router.delete("/:key", adminOnly, destroy);

export default router;
