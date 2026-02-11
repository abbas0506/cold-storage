import { Router } from "express";
import {
  index,
  create,
  show,
  update,
  destroy,
} from "../controllers/contracts.controller";

const router = Router({ mergeParams: true });

// get all cold stores
router.get("/", index);
router.post("/", create);
router.get("/:id", show);
router.put("/:id", update);
router.delete("/:id", destroy);

export default router;
