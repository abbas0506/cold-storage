import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// GET /coldstores/:storeId/employees
export const index = async (req: Request, res: Response): Promise<void> => {
    try {
        const { page, pageSize, skip } = getPaginationParams(req, 15);
        const storeId = Number(req.params.storeId);
        const showInactive = req.query.showInactive === "true";

        const where: any = { storeId };
        if (!showInactive) where.active = true;

        const [items, total] = await Promise.all([
            prisma.employee.findMany({ where, skip, take: pageSize, orderBy: { id: "desc" } }),
            prisma.employee.count({ where }),
        ]);

        res.json(createPaginatedResponse(items, total, page, pageSize));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching employees" });
    }
};

// POST /coldstores/:storeId/employees
export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = Number(req.params.storeId);
        if (!storeId || isNaN(storeId) || storeId <= 0) {
            res.status(400).json({ message: "Invalid storeId" });
            return;
        }

        const { name, phone, joiningDate, designation, baseSalary, advanceLimit } = req.body;

        if (baseSalary == null) {
            res.status(400).json({ message: "baseSalary is required" });
            return;
        }

        const record = await prisma.employee.create({
            data: {
                storeId,
                name,
                phone,
                joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
                designation,
                baseSalary: Number(baseSalary),
                advanceLimit: advanceLimit != null ? Number(advanceLimit) : 0,
            },
        });

        res.status(201).json(record);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// GET /coldstores/:storeId/employees/:id
export const show = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const record = await prisma.employee.findUnique({
            where: { id },
            include: {
                ledger: { orderBy: { createdAt: "desc" }, take: 10 },
                salarySlips: { orderBy: { createdAt: "desc" }, take: 12 },
            },
        });

        if (!record) {
            res.status(404).json({ message: "Employee not found" });
            return;
        }

        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching employee" });
    }
};

// PUT /coldstores/:storeId/employees/:id
export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { name, phone, joiningDate, designation, baseSalary, advanceLimit, active } = req.body;

        const record = await prisma.employee.update({
            where: { id },
            data: {
                name,
                phone,
                joiningDate: joiningDate ? new Date(joiningDate) : undefined,
                designation,
                baseSalary: baseSalary != null ? Number(baseSalary) : undefined,
                advanceLimit: advanceLimit != null ? Number(advanceLimit) : undefined,
                active,
            },
        });

        res.json(record);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            res.status(404).json({ message: "Employee not found" });
            return;
        }
        res.status(500).json({ message: "Error updating employee" });
    }
};

// DELETE /coldstores/:storeId/employees/:id  (soft-delete — marks inactive)
export const destroy = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const record = await prisma.employee.update({
            where: { id },
            data: { active: false },
        });
        res.json({ message: "Employee deactivated", employee: record });
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            res.status(404).json({ message: "Employee not found" });
            return;
        }
        res.status(500).json({ message: "Error deactivating employee" });
    }
};
