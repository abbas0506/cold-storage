import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";

// ─── GET /coldstores/:storeId/store-users ─────────────────────────────────────
export const getStoreUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);

        const storeUsers = await prisma.storeUser.findMany({
            where: { storeId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        phone: true,
                        email: true,
                        isActive: true,
                        lastLogin: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({ storeUsers });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch store users" });
    }
};

// ─── POST /coldstores/:storeId/store-users ────────────────────────────────────
// Assigns an existing user (created by the subscriber) to this store with a role.
export const addStoreUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const requesterId = req.user!.id;
        const { userId, role } = req.body;

        if (!userId || !role) {
            res.status(400).json({ error: "userId and role are required" });
            return;
        }
        if (!["ADMIN", "EMPLOYEE"].includes(role)) {
            res.status(400).json({ error: "role must be ADMIN or EMPLOYEE" });
            return;
        }

        // Verify the target user was created by this subscriber (or requester is SUPER_ADMIN)
        const targetUser = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!targetUser) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        if (
            req.user!.systemRole !== "SUPER_ADMIN" &&
            targetUser.createdById !== requesterId
        ) {
            res.status(403).json({ error: "You can only assign users you created" });
            return;
        }

        // Enforce maxUsersPerStore from the subscription plan
        if (req.user!.systemRole !== "SUPER_ADMIN") {
            const subscription = await prisma.subscription.findUnique({
                where: { userId: requesterId },
                include: { plan: true },
            });
            if (subscription) {
                const currentCount = await prisma.storeUser.count({ where: { storeId, isActive: true } });
                if (currentCount >= subscription.plan.maxUsersPerStore) {
                    res.status(429).json({
                        error: `User limit reached (${subscription.plan.maxUsersPerStore} per store). Upgrade your plan.`,
                    });
                    return;
                }
            }
        }

        const storeUser = await prisma.storeUser.upsert({
            where: { storeId_userId: { storeId, userId: Number(userId) } },
            create: { storeId, userId: Number(userId), role: role as "ADMIN" | "EMPLOYEE", isActive: true },
            update: { role: role as "ADMIN" | "EMPLOYEE", isActive: true },
            include: {
                user: { select: { id: true, username: true, name: true } },
            },
        });

        res.status(201).json(storeUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to assign user to store" });
    }
};

// ─── PUT /coldstores/:storeId/store-users/:userId ─────────────────────────────
export const updateStoreUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const userId = Number(req.params.userId);
        const { role, isActive } = req.body;

        const updateData: Record<string, any> = {};
        if (role !== undefined) {
            if (!["ADMIN", "EMPLOYEE"].includes(role)) {
                res.status(400).json({ error: "role must be ADMIN or EMPLOYEE" });
                return;
            }
            updateData.role = role;
        }
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);

        const storeUser = await prisma.storeUser.update({
            where: { storeId_userId: { storeId, userId } },
            data: updateData,
            include: {
                user: { select: { id: true, username: true, name: true } },
            },
        });

        res.json(storeUser);
    } catch (error: any) {
        if (error.code === "P2025") {
            res.status(404).json({ error: "Store user assignment not found" });
            return;
        }
        res.status(500).json({ error: "Failed to update store user" });
    }
};

// ─── DELETE /coldstores/:storeId/store-users/:userId ──────────────────────────
export const removeStoreUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        const userId = Number(req.params.userId);

        await prisma.storeUser.delete({
            where: { storeId_userId: { storeId, userId } },
        });

        res.json({ message: "User removed from store" });
    } catch (error: any) {
        if (error.code === "P2025") {
            res.status(404).json({ error: "Store user assignment not found" });
            return;
        }
        res.status(500).json({ error: "Failed to remove user from store" });
    }
};
