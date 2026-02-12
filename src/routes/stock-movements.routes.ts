import { Router } from "express";
import {
  index,
  create,
  show,
  update,
  destroy,
  getRacksFormItemLine,
} from "../controllers/stock-movements.controller";

const router = Router({ mergeParams: true });

// get all cold stores
router.get("/", index);
router.post("/", create);
router.get("/:id", show);
router.get("/racks/:lineId", getRacksFormItemLine);
router.put("/:id", update);
router.delete("/:id", destroy);

export default router;
