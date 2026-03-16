import { Router } from "express";
import { index, create, show, update, pay, cancel } from "../controllers/salary-slips.controller";

const router = Router({ mergeParams: true });

router.get("/", index);
router.post("/", create);
router.get("/:id", show);
router.put("/:id", update);
router.patch("/:id/pay", pay);
router.patch("/:id/cancel", cancel);

export default router;
