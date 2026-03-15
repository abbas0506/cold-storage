import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// ─── JWT authentication ────────────────────────────────────────────────────────
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as {
      sub: number;
      username: string;
      systemRole: "SUPER_ADMIN" | "SUBSCRIBER" | "USER";
    };
    req.user = { id: payload.sub, username: payload.username, systemRole: payload.systemRole };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ─── System-role guard ────────────────────────────────────────────────────────
/**
 * Restricts a route to users whose systemRole is in the given list.
 * Usage: requireSystemRole(["SUPER_ADMIN"])
 */
export const requireSystemRole = (
  roles: Array<"SUPER_ADMIN" | "SUBSCRIBER" | "USER">,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.systemRole)) {
      res.status(403).json({ error: "Insufficient privileges" });
      return;
    }
    next();
  };
};

// ─── Store access guard ───────────────────────────────────────────────────────
/**
 * Verifies the authenticated user has access to req.params.storeId.
 *
 * - SUPER_ADMIN  : always allowed
 * - SUBSCRIBER   : store must belong to their subscription (always treated as ADMIN)
 * - USER         : must have an active StoreUser entry; optionally check minimum role
 *
 * Sets req.storeRole for downstream handlers.
 */
export const requireStoreAccess = (minRole?: "ADMIN" | "EMPLOYEE") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // SUPER_ADMIN bypasses all store-level checks
    if (req.user.systemRole === "SUPER_ADMIN") {
      req.storeRole = "ADMIN";
      next();
      return;
    }

    const storeId = Number(req.params.storeId);
    if (!storeId || isNaN(storeId)) {
      res.status(400).json({ error: "Invalid storeId" });
      return;
    }

    if (req.user.systemRole === "SUBSCRIBER") {
      // Verify the store belongs to this subscriber's subscription
      const store = await prisma.coldStore.findFirst({
        where: {
          id: storeId,
          subscription: { userId: req.user.id },
        },
      });
      if (!store) {
        res.status(403).json({ error: "Access denied to this store" });
        return;
      }
      req.storeRole = "ADMIN";
      next();
      return;
    }

    // USER: consult StoreUser table
    const storeUser = await prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: req.user.id } },
    });
    if (!storeUser || !storeUser.isActive) {
      res.status(403).json({ error: "Access denied to this store" });
      return;
    }
    if (minRole === "ADMIN" && storeUser.role !== "ADMIN") {
      res.status(403).json({ error: "Admin access required for this operation" });
      return;
    }
    req.storeRole = storeUser.role as "ADMIN" | "EMPLOYEE";
    next();
  };
};

