import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    storeSummaryReport,
    roomOccupancyReport,
    stockInventoryReport,
    stockMovementReport,
    revenueReport,
    contractsReport,
    paymentsReport,
    outstandingDuesReport,
    ratePlansReport,
    expiringContractsReport,
    farmerDirectoryReport,
    farmerStatementReport,
    farmerContractsReport,
} from "../controllers/reports.controller";

const router = Router({ mergeParams: true });

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS / STORE-LEVEL REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/reports/store-summary
 * @desc    Summary of all cold stores (capacity, utilization, revenue, farmers)
 * @access  Private
 */
router.get("/store-summary", authenticate, storeSummaryReport);

/**
 * @route   GET /api/reports/stores/:storeId/room-occupancy
 * @desc    Room-by-room occupancy with rack details for a store
 * @access  Private
 */
router.get("/stores/:storeId/room-occupancy", authenticate, roomOccupancyReport);

/**
 * @route   GET /api/reports/stores/:storeId/stock-inventory
 * @desc    Current stock across all racks/rooms for a store
 * @access  Private
 */
router.get("/stores/:storeId/stock-inventory", authenticate, stockInventoryReport);

/**
 * @route   GET /api/reports/stores/:storeId/stock-movements
 * @desc    Stock IN/OUT movement history for a store
 * @query   from - Start date (optional)
 * @query   to   - End date (optional)
 * @query   type - Movement type: IN | OUT (optional)
 * @access  Private
 */
router.get("/stores/:storeId/stock-movements", authenticate, stockMovementReport);

/**
 * @route   GET /api/reports/stores/:storeId/revenue
 * @desc    Revenue report — contracts, tax, payments, outstanding
 * @query   from - Start date (optional)
 * @query   to   - End date (optional)
 * @access  Private
 */
router.get("/stores/:storeId/revenue", authenticate, revenueReport);

/**
 * @route   GET /api/reports/stores/:storeId/contracts
 * @desc    All contracts for a store with item details
 * @query   status - Contract status: ACTIVE | COMPLETED | CANCELLED (optional)
 * @query   from   - Start date (optional)
 * @query   to     - End date (optional)
 * @access  Private
 */
router.get("/stores/:storeId/contracts", authenticate, contractsReport);

/**
 * @route   GET /api/reports/stores/:storeId/payments
 * @desc    Payments collection report with method breakdown
 * @query   from   - Start date (optional)
 * @query   to     - End date (optional)
 * @query   method - Payment method: CASH | BANK | EASYPaisa | JAZZCASH | CHEQUE (optional)
 * @access  Private
 */
router.get("/stores/:storeId/payments", authenticate, paymentsReport);

/**
 * @route   GET /api/reports/stores/:storeId/outstanding-dues
 * @desc    Farmers with unpaid balances, sorted by highest due
 * @access  Private
 */
router.get("/stores/:storeId/outstanding-dues", authenticate, outstandingDuesReport);

/**
 * @route   GET /api/reports/stores/:storeId/rate-plans
 * @desc    All rate plans for a store
 * @access  Private
 */
router.get("/stores/:storeId/rate-plans", authenticate, ratePlansReport);

/**
 * @route   GET /api/reports/stores/:storeId/expiring-contracts
 * @desc    Active contracts expiring within N days
 * @query   days - Number of days to look ahead (default: 30)
 * @access  Private
 */
router.get("/stores/:storeId/expiring-contracts", authenticate, expiringContractsReport);

// ═══════════════════════════════════════════════════════════════════════════════
// FARMER-LEVEL REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/reports/stores/:storeId/farmer-directory
 * @desc    Directory of all farmers with balance and contract info
 * @access  Private
 */
router.get("/stores/:storeId/farmer-directory", authenticate, farmerDirectoryReport);

/**
 * @route   GET /api/reports/farmers/:farmerId/statement
 * @desc    Full account statement for a farmer (info, contracts, payments, ledger)
 * @query   from - Start date (optional)
 * @query   to   - End date (optional)
 * @access  Private
 */
router.get("/farmers/:farmerId/statement", authenticate, farmerStatementReport);

/**
 * @route   GET /api/reports/farmers/:farmerId/contracts
 * @desc    All contracts for a farmer with line items and stock movement details
 * @query   status - Contract status filter (optional)
 * @access  Private
 */
router.get("/farmers/:farmerId/contracts", authenticate, farmerContractsReport);

export default router;
