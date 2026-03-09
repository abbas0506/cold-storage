import { Router } from "express";
import authRouter from "./auth";
import { authenticate } from "../middleware/auth";

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

const router = Router();

router.use("/auth", authRouter);
router.use("/users", authenticate, usersRouter);
router.use("/coldstores", authenticate, coldstoreRouter);
router.use("/coldstores/:storeId/rooms", authenticate, roomRouter);
router.use(
  "/coldstores/:storeId/rooms/:roomId/racks",
  authenticate,
  rackRouter,
);
router.use("/coldstores/:storeId/farmers", authenticate, farmerRouter);
router.use("/coldstores/:storeId/items", authenticate, itemRouter);
router.use("/coldstores/:storeId/rate-plans", authenticate, ratePlanRouter);
router.use("/coldstores/:storeId/contracts", authenticate, contractRouter);
router.use("/coldstores/:storeId/payments", authenticate, payementRouter);
router.use(
  "/coldstores/:storeId/contracts/:contractId/stock-movements",
  authenticate,
  stockMovementRouter,
);
router.use("/statistics", authenticate, statisticsRouter);
router.use("/ledger", authenticate, ledgerRouter);
router.use("/coldstores/:storeId/expenses", authenticate, expensesRouter);
router.use("/reports", reportsRouter);

export default router;
