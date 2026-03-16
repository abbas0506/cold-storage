import { Router } from "express";
import { index, create, show, destroy } from "../controllers/employee-ledger.controller";

const router = Router({ mergeParams: true });

router.get("/", index);
router.post("/", create);
router.get("/:id", show);
router.delete("/:id", destroy);

export default router;
