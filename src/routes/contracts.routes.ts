import { Router } from "express";
import {
  index,
  create,
  show,
  update,
  destroy,
  updateFbrInvoice,
  generateContractReport,
  getFineCalculations,
  updateStatus,
} from "../controllers/contracts.controller";

const router = Router({ mergeParams: true });

// Contract routes
router.get("/", index);
router.post("/", create);
router.get("/:id/report", generateContractReport); // More specific route first
router.put("/:id/fbr-invoice", updateFbrInvoice);
router.get("/:id", show);
router.put("/:id", update);
router.delete("/:id", destroy);
router.get("/:id/fine", getFineCalculations); // New route for fine calculations
router.post("/:id/status", updateStatus); // New route for updating contract status

export default router;
