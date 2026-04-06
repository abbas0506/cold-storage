import { Router } from "express";
import {
  index,
  create,
  show,
  update,
  destroy,
  getPaymentStats,
} from "../controllers/payments.controller";

const router = Router({ mergeParams: true });

// stats must come before /:id to avoid route conflict
router.get("/stats", getPaymentStats);
router.get("/", index);
router.post("/", create);
router.get("/:id", show);
router.put("/:id", update);
router.delete("/:id", destroy);

export default router;
