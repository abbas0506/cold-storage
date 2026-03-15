import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// ─── SUPER_ADMIN: list all subscriptions ──────────────────────────────────────
export const index = async (req: Request, res: Response): Promise<void> => {
    try {
        const { page, pageSize, skip } = getPaginationParams(req, 20);
        const statusFilter = req.query.status as string | undefined;

        const where = statusFilter ? { status: statusFilter as any } : {};

        const [items, total] = await Promise.all([
            prisma.subscription.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { id: true, username: true, name: true, email: true, isActive: true } },
                    plan: { select: { id: true, name: true, pricePerMonth: true } },
                    _count: { select: { coldStores: true } },
                },
            }),
            prisma.subscription.count({ where }),
        ]);

        res.json(createPaginatedResponse(items, total, page, pageSize));
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
};

// ─── SUPER_ADMIN: get single subscription ─────────────────────────────────────
export const show = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const subscription = await prisma.subscription.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, username: true, name: true, email: true, phone: true } },
                plan: true,
                coldStores: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        _count: { select: { storeUsers: true } },
                    },
                },
            },
        });
        if (!subscription) {
            res.status(404).json({ error: "Subscription not found" });
            return;
        }
        res.json(subscription);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subscription" });
    }
};

// ─── SUPER_ADMIN: create subscriber + subscription in one step ────────────────
export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            username,
            password,
            name,
            phone,
            email,
            planId,
            startDate,
            notes,
        } = req.body;

        if (!username || !password || !planId || !startDate) {
            res.status(400).json({ error: "username, password, planId and startDate are required" });
            return;
        }

        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } });
        if (!plan || !plan.isActive) {
            res.status(404).json({ error: "Subscription plan not found or inactive" });
            return;
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            res.status(409).json({ error: "Username already taken" });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);

        const hash = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username,
                    password: hash,
                    name,
                    phone,
                    email,
                    systemRole: "SUBSCRIBER",
                    isActive: true,
                },
            });

            const subscription = await tx.subscription.create({
                data: {
                    userId: user.id,
                    planId: Number(planId),
                    status: "ACTIVE",
                    startDate: start,
                    endDate: end,
                    notes,
                },
                include: {
                    user: { select: { id: true, username: true, name: true, systemRole: true } },
                    plan: { select: { id: true, name: true } },
                },
            });

            return subscription;
        });

        res.status(201).json(result);
    } catch (error: any) {
        if (error.code === "P2002") {
            res.status(409).json({ error: "Username or email already exists" });
            return;
        }
        console.error(error);
        res.status(500).json({ error: "Failed to create subscription" });
    }
};

// ─── SUPER_ADMIN: update subscription (change plan, status, dates) ─────────────
export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { planId, status, startDate, endDate, notes } = req.body;

        // If changing to a new plan, recalculate end date
        let computedEndDate: Date | undefined;
        if (planId && startDate) {
            const plan = await prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } });
            if (plan) {
                const s = new Date(startDate);
                computedEndDate = new Date(s);
                computedEndDate.setDate(computedEndDate.getDate() + plan.durationDays);
            }
        }

        const subscription = await prisma.subscription.update({
            where: { id },
            data: {
                ...(planId !== undefined && { planId: Number(planId) }),
                ...(status !== undefined && { status }),
                ...(startDate !== undefined && { startDate: new Date(startDate) }),
                ...(endDate !== undefined
                    ? { endDate: new Date(endDate) }
                    : computedEndDate
                        ? { endDate: computedEndDate }
                        : {}),
                ...(notes !== undefined && { notes }),
            },
            include: {
                user: { select: { id: true, username: true, name: true } },
                plan: { select: { id: true, name: true } },
            },
        });

        res.json(subscription);
    } catch (error: any) {
        if (error.code === "P2025") {
            res.status(404).json({ error: "Subscription not found" });
            return;
        }
        res.status(500).json({ error: "Failed to update subscription" });
    }
};

// ─── SUBSCRIBER: get own subscription ─────────────────────────────────────────
export const mySubscription = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: {
                plan: true,
                coldStores: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        _count: { select: { storeUsers: true } },
                    },
                },
            },
        });
        if (!subscription) {
            res.status(404).json({ error: "No subscription found" });
            return;
        }
        res.json(subscription);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subscription" });
    }
};
