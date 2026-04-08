import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma/prisma";

// ─── SUPER_ADMIN: list all users ──────────────────────────────────────────────
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        systemRole: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        subscription: {
          select: { status: true, endDate: true, plan: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// ─── SUBSCRIBER: list users they created ──────────────────────────────────────
export const getMyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const createdById = req.user!.id;
    const users = await prisma.user.findMany({
      where: { createdById },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        storeAccess: {
          where: { isActive: true },
          select: { role: true, store: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// ─── SUBSCRIBER: create a store user (systemRole = USER) ──────────────────────
export const createUser = async (req: Request, res: Response): Promise<void> => {
  const creatorId = req.user!.id;
  const { username, password, name, phone, email } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "password must be at least 6 characters" });
    return;
  }

  try {
    // Check subscription user limits across all stores
    const subscription = await prisma.subscription.findUnique({
      where: { userId: creatorId },
      include: { plan: true },
    });
    if (!subscription) {
      res.status(403).json({ error: "No active subscription found" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        name,
        phone,
        email,
        systemRole: "USER",
        isActive: true,
        createdById: creatorId,
      },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        systemRole: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "Username or email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create user" });
  }
};

// ─── SUBSCRIBER: update one of their users ────────────────────────────────────
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const creatorId = req.user!.id;
  const userId = Number(req.params.id);
  const { name, phone, email, password, isActive } = req.body;

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.createdById !== creatorId) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password) {
      if (password.length < 6) {
        res.status(400).json({ error: "password must be at least 6 characters" });
        return;
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    res.status(500).json({ error: "Failed to update user" });
  }
};

// ─── SUBSCRIBER: deactivate / reactivate one of their users ───────────────────
export const toggleUserActive = async (req: Request, res: Response): Promise<void> => {
  const creatorId = req.user!.id;
  const userId = Number(req.params.id);

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.createdById !== creatorId) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !target.isActive },
      select: { id: true, username: true, isActive: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle user status" });
  }
};

// ─── SUPER_ADMIN: update any user ─────────────────────────────────────────────
export const adminUpdateUser = async (req: Request, res: Response): Promise<void> => {
  const userId = Number(req.params.id);
  const { name, phone, email, isActive, systemRole, password } = req.body;

  try {
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (systemRole !== undefined) updateData.systemRole = systemRole;
    if (password) {
      if (password.length < 6) {
        res.status(400).json({ error: "password must be at least 6 characters" });
        return;
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        systemRole: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    if (error.code === "P2025") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(500).json({ error: "Failed to update user" });
  }
};

// ─── SUPER_ADMIN: create any user (any systemRole) ────────────────────────────
export const adminCreateUser = async (req: Request, res: Response): Promise<void> => {
  const { username, password, name, phone, email, systemRole } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "password must be at least 6 characters" });
    return;
  }
  const validRoles = ["SUPER_ADMIN", "SUBSCRIBER", "USER"];
  const role = systemRole && validRoles.includes(systemRole) ? systemRole : "USER";

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        name,
        phone,
        email,
        systemRole: role,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        systemRole: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "Username or email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create user" });
  }
};

