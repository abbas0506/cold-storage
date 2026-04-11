import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// ─── Free-trial plan name (created by seed) ──────────────────────────────────
const FREE_TRIAL_PLAN_NAME = "Free Trial";
const FREE_TRIAL_DAYS = 7;

export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, password, name, email, phone } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "password must be at least 6 characters" });
    return;
  }

  // Validate username format (alphanumeric + underscore only)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: "username can only contain letters, numbers, and underscores" });
    return;
  }

  try {
    // Check duplicate username
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    // Check duplicate email (if provided)
    if (email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
    }

    // Find or create the free trial plan
    let trialPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: FREE_TRIAL_PLAN_NAME, isActive: true },
    });

    if (!trialPlan) {
      // Create it on-demand if not seeded yet
      trialPlan = await prisma.subscriptionPlan.create({
        data: {
          name: FREE_TRIAL_PLAN_NAME,
          description: "7-day free trial for new accounts",
          pricePerMonth: 0,
          maxStores: 1,
          maxUsersPerStore: 3,
          durationDays: FREE_TRIAL_DAYS,
          isActive: true,
        },
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        name: name || null,
        email: email || null,
        phone: phone || null,
        systemRole: "SUBSCRIBER",
        isActive: true,
      },
    });

    // Create 7-day trial subscription
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + FREE_TRIAL_DAYS);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: trialPlan.id,
        status: "ACTIVE",
        startDate,
        endDate,
        notes: "Free 7-day trial",
      },
    });

    const token = jwt.sign(
      { sub: user.id, username: user.username, systemRole: user.systemRole },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        systemRole: user.systemRole,
        lastLogin: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is disabled. Contact your administrator." });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // For subscribers – block login if subscription is not active
    if (user.systemRole === "SUBSCRIBER") {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
      });
      if (!subscription || subscription.status !== "ACTIVE") {
        res.status(403).json({ error: "Subscription is inactive. Contact support." });
        return;
      }
      if (subscription.endDate < new Date()) {
        // Auto-expire
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "EXPIRED" },
        });
        res.status(403).json({ error: "Subscription has expired. Please renew." });
        return;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = jwt.sign(
      { sub: user.id, username: user.username, systemRole: user.systemRole },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        systemRole: user.systemRole,
        lastLogin: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "newPassword must be at least 6 characters" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hash } });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to change password" });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        systemRole: true,
        lastLogin: true,
        storeAccess: {
          where: { isActive: true },
          select: { storeId: true, role: true, store: { select: { id: true, name: true } } },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            plan: { select: { name: true, maxStores: true, maxUsersPerStore: true } },
          },
        },
      },
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

