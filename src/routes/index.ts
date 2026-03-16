import { Router } from "express";
import authRouter from "./auth";
import { authenticate, requireStoreAccess } from "../middleware/auth";

import usersRouter from "./users.routes";
import coldstoreRouter from "./coldstores.routes";
import roomRouter from "./rooms.routes";
import rackRouter from "./racks.routes";
import farmerRouter from "./farmers.routes";
import itemRouter from "./items.routes";
import ratePlanRouter from "./rate-plans.routes";
import contractRouter from "./contracts.routes";
import payementRouter from "./payments.routes";
import stockMovementRouter from "./stock-movements.routes";
import statisticsRouter from "./statistics.routes";
import ledgerRouter from "./ledger.routes";
import reportsRouter from "./reports.routes";
import expensesRouter from "./expenses.routes";
import subscriptionPlansRouter from "./subscription-plans.routes";
import subscriptionsRouter from "./subscriptions.routes";
import storeUsersRouter from "./store-users.routes";
import settingsRouter from "./settings.routes";
import expenseTypesRouter from "./expense-types.routes";
import employeesRouter from "./employees.routes";
import employeeLedgerRouter from "./employee-ledger.routes";
import salarySlipsRouter from "./salary-slips.routes";

const router = Router();

// ─── Public auth ──────────────────────────────────────────────────────────────
router.use("/auth", authRouter);

// ─── Subscription management (SUPER_ADMIN) ────────────────────────────────────
router.use("/subscription-plans", authenticate, subscriptionPlansRouter);
router.use("/subscriptions", authenticate, subscriptionsRouter);

// ─── User management ──────────────────────────────────────────────────────────
router.use("/users", authenticate, usersRouter);

// ─── Cold stores (top-level) ──────────────────────────────────────────────────
router.use("/coldstores", authenticate, coldstoreRouter);

// ─── Store-scoped resources (all require valid store access) ──────────────────
const storeAccess = requireStoreAccess();

router.use("/coldstores/:storeId/store-users", authenticate, storeAccess, storeUsersRouter);
router.use("/coldstores/:storeId/rooms", authenticate, storeAccess, roomRouter);
router.use(
  "/coldstores/:storeId/rooms/:roomId/racks",
  authenticate,
  storeAccess,
  rackRouter,
);
router.use("/coldstores/:storeId/farmers", authenticate, storeAccess, farmerRouter);
router.use("/coldstores/:storeId/items", authenticate, storeAccess, itemRouter);
router.use("/coldstores/:storeId/rate-plans", authenticate, storeAccess, ratePlanRouter);
router.use("/coldstores/:storeId/contracts", authenticate, storeAccess, contractRouter);
router.use("/coldstores/:storeId/payments", authenticate, storeAccess, payementRouter);
router.use(
  "/coldstores/:storeId/contracts/:contractId/stock-movements",
  authenticate,
  storeAccess,
  stockMovementRouter,
);
router.use("/coldstores/:storeId/expenses", authenticate, storeAccess, expensesRouter);

// ─── Employee management (store-scoped) ──────────────────────────────────────
router.use("/coldstores/:storeId/employees", authenticate, storeAccess, employeesRouter);
router.use(
  "/coldstores/:storeId/employees/:employeeId/ledger",
  authenticate,
  storeAccess,
  employeeLedgerRouter,
);
router.use(
  "/coldstores/:storeId/employees/:employeeId/salary-slips",
  authenticate,
  storeAccess,
  salarySlipsRouter,
);

// ─── Cross-store resources ────────────────────────────────────────────────────
router.use("/statistics", authenticate, statisticsRouter);
router.use("/ledger", authenticate, ledgerRouter);
router.use("/reports", reportsRouter);
router.use("/expense-types", authenticate, expenseTypesRouter);
router.use("/settings", authenticate, settingsRouter);

export default router;
