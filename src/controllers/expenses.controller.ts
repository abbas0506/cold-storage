import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all expenses for a store
export const index = async (req: Request, res: Response) => {
    try {
        const { page, pageSize, skip } = getPaginationParams(req, 15);
        const storeId = Number(req.params.storeId);
        const q = req.query.q as string | undefined;
        const expenseTypeId = req.query.expenseTypeId ? Number(req.query.expenseTypeId) : undefined;
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;

        const whereClause: any = {
            storeId,
            ...(q ? {
                OR: [
                    { description: { contains: q, mode: "insensitive" } },
                    { expenseType: { name: { contains: q, mode: "insensitive" } } },
                ],
            } : {}),
            ...(expenseTypeId ? { expenseTypeId } : {}),
            ...((dateFrom || dateTo) ? {
                expenseDate: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
                },
            } : {}),
        };

        const [items, total] = await Promise.all([
            prisma.expense.findMany({
                skip,
                take: pageSize,
                where: whereClause,
                include: { expenseType: true },
                orderBy: { id: "desc" },
            }),
            prisma.expense.count({ where: whereClause }),
        ]);

        res.json(createPaginatedResponse(items, total, page, pageSize));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching expenses" });
    }
};

// Create a new expense
export const create = async (req: Request, res: Response) => {
    try {
        const storeId = Number(req.params.storeId);
        if (!req.params.storeId || Number.isNaN(storeId) || storeId <= 0) {
            return res.status(400).json({ message: "Invalid storeId" });
        }

        const { amount, expenseTypeId, paymentMethod, description, expenseDate } = req.body;

        const newExpense = await prisma.expense.create({
            data: {
                storeId,
                amount,
                expenseTypeId,
                paymentMethod,
                description,
                expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
            },
            include: { expenseType: true },
        });

        return res.status(201).json(newExpense);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get a single expense by ID
export const show = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const record = await prisma.expense.findUnique({ where: { id }, include: { expenseType: true } });

        if (!record) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching expense" });
    }
};

// Update an expense by ID
export const update = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { amount, expenseTypeId, paymentMethod, description, expenseDate } = req.body;

        const updatedExpense = await prisma.expense.update({
            where: { id },
            data: {
                amount,
                expenseTypeId,
                paymentMethod,
                description,
                expenseDate: expenseDate ? new Date(expenseDate) : undefined,
            },
            include: { expenseType: true },
        });

        res.json(updatedExpense);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Expense not found" });
        }
        res.status(500).json({ message: "Error updating expense" });
    }
};

// Delete an expense by ID
export const destroy = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        await prisma.expense.delete({ where: { id } });

        res.json({ message: "Expense deleted successfully" });
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Expense not found" });
        }
        res.status(500).json({ message: "Error deleting expense" });
    }
};
