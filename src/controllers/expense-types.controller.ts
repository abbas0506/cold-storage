import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";

// GET /expense-types
export const index = async (req: Request, res: Response): Promise<void> => {
    try {
        const items = await prisma.expenseType.findMany({ orderBy: { id: "asc" } });
        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching expense types" });
    }
};

// POST /expense-types
export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== "string" || name.trim() === "") {
            res.status(400).json({ message: "name is required" });
            return;
        }
        const record = await prisma.expenseType.create({ data: { name: name.trim() } });
        res.status(201).json(record);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// GET /expense-types/:id
export const show = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const record = await prisma.expenseType.findUnique({ where: { id } });
        if (!record) {
            res.status(404).json({ message: "Expense type not found" });
            return;
        }
        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching expense type" });
    }
};

// PUT /expense-types/:id
export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { name } = req.body;
        const record = await prisma.expenseType.update({
            where: { id },
            data: { name: name?.trim() },
        });
        res.json(record);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            res.status(404).json({ message: "Expense type not found" });
            return;
        }
        res.status(500).json({ message: "Error updating expense type" });
    }
};

// DELETE /expense-types/:id
export const destroy = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        await prisma.expenseType.delete({ where: { id } });
        res.json({ message: "Expense type deleted successfully" });
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            res.status(404).json({ message: "Expense type not found" });
            return;
        }
        res.status(500).json({ message: "Error deleting expense type" });
    }
};
