import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// GET /subscription-plans
export const index = async (req: Request, res: Response): Promise<void> => {
    try {
        const { page, pageSize, skip } = getPaginationParams(req, 20);
        const showInactive = req.query.showInactive === "true";

        const where = showInactive ? {} : { isActive: true };

        const [items, total] = await Promise.all([
            prisma.subscriptionPlan.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
            }),
            prisma.subscriptionPlan.count({ where }),
        ]);

        res.json(createPaginatedResponse(items, total, page, pageSize));
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
};

// GET /subscription-plans/:id
export const show = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id },
            include: { _count: { select: { subscriptions: true } } },
        });
        if (!plan) {
            res.status(404).json({ error: "Plan not found" });
            return;
        }
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch plan" });
    }
};

// POST /subscription-plans
export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, pricePerMonth, maxStores, maxUsersPerStore, durationDays, features } = req.body;

        if (!name || pricePerMonth == null) {
            res.status(400).json({ error: "name and pricePerMonth are required" });
            return;
        }

        const plan = await prisma.subscriptionPlan.create({
            data: {
                name,
                description,
                pricePerMonth: Number(pricePerMonth),
                maxStores: Number(maxStores) || 1,
                maxUsersPerStore: Number(maxUsersPerStore) || 5,
                durationDays: Number(durationDays) || 30,
                features: features ?? undefined,
            },
        });

        res.status(201).json(plan);
    } catch (error: any) {
        if (error.code === "P2002") {
            res.status(409).json({ error: "A plan with this name already exists" });
            return;
        }
        res.status(500).json({ error: "Failed to create plan" });
    }
};

// PUT /subscription-plans/:id
export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { name, description, pricePerMonth, maxStores, maxUsersPerStore, durationDays, features, isActive } = req.body;

        const plan = await prisma.subscriptionPlan.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(pricePerMonth !== undefined && { pricePerMonth: Number(pricePerMonth) }),
                ...(maxStores !== undefined && { maxStores: Number(maxStores) }),
                ...(maxUsersPerStore !== undefined && { maxUsersPerStore: Number(maxUsersPerStore) }),
                ...(durationDays !== undefined && { durationDays: Number(durationDays) }),
                ...(features !== undefined && { features }),
                ...(isActive !== undefined && { isActive: Boolean(isActive) }),
            },
        });

        res.json(plan);
    } catch (error: any) {
        if (error.code === "P2025") {
            res.status(404).json({ error: "Plan not found" });
            return;
        }
        res.status(500).json({ error: "Failed to update plan" });
    }
};

// DELETE /subscription-plans/:id  (soft delete)
export const destroy = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);

        // Check if any active subscriptions use this plan
        const activeCount = await prisma.subscription.count({
            where: { planId: id, status: "ACTIVE" },
        });
        if (activeCount > 0) {
            res.status(409).json({
                error: `Cannot delete: ${activeCount} active subscription(s) use this plan. Deactivate the plan instead.`,
            });
            return;
        }

        await prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } });
        res.json({ message: "Plan deactivated successfully" });
    } catch (error: any) {
        if (error.code === "P2025") {
            res.status(404).json({ error: "Plan not found" });
            return;
        }
        res.status(500).json({ error: "Failed to delete plan" });
    }
};
