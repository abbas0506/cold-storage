import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";

// GET /settings
export const index = async (req: Request, res: Response): Promise<void> => {
    try {
        const items = await prisma.settings.findMany({ orderBy: { key: "asc" } });
        // Return as a key-value map for convenience
        const map: Record<string, string> = {};
        for (const s of items) map[s.key] = s.value;
        res.json({ items, map });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching settings" });
    }
};

// GET /settings/:key
export const showByKey = async (req: Request, res: Response): Promise<void> => {
    try {
        const key = req.params.key;
        const record = await prisma.settings.findFirst({ where: { key } });
        if (!record) {
            res.status(404).json({ message: "Setting not found" });
            return;
        }
        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching setting" });
    }
};

// PUT /settings/:key  (upsert)
export const upsert = async (req: Request, res: Response): Promise<void> => {
    try {
        const key = req.params.key;
        const { value } = req.body;
        if (value === undefined || value === null) {
            res.status(400).json({ message: "value is required" });
            return;
        }
        const existing = await prisma.settings.findFirst({ where: { key } });
        let record;
        if (existing) {
            record = await prisma.settings.update({ where: { id: existing.id }, data: { value: String(value) } });
        } else {
            record = await prisma.settings.create({ data: { key, value: String(value) } });
        }
        res.json(record);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: "Error upserting setting" });
    }
};

// DELETE /settings/:key
export const destroy = async (req: Request, res: Response): Promise<void> => {
    try {
        const key = req.params.key;
        const existing = await prisma.settings.findFirst({ where: { key } });
        if (!existing) {
            res.status(404).json({ message: "Setting not found" });
            return;
        }
        await prisma.settings.delete({ where: { id: existing.id } });
        res.json({ message: "Setting deleted successfully" });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: "Error deleting setting" });
    }
};
