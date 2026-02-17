import { Router } from "express";
import {
    generateLedgerReport,
    generateDetailedLedgerReport,
} from "../controllers/ledger.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

/**
 * @route   GET /api/ledger/report
 * @desc    Generate ledger report PDF
 * @access  Private
 * @query   from - Start date (optional)
 * @query   to - End date (optional)
 * @query   accountName - Account name (optional)
 */
router.get("/report", authenticate, generateLedgerReport);

/**
 * @route   GET /api/ledger/detailed-report
 * @desc    Generate detailed multi-page ledger report PDF
 * @access  Private
 * @query   from - Start date (optional)
 * @query   to - End date (optional)
 */
router.get("/detailed-report", authenticate, generateDetailedLedgerReport);

export default router;
