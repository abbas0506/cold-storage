import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// GET /coldstores/:storeId/employees/:employeeId/ledger
export const index = async (req: Request, res: Response): Promise<void> => {
    try {
        const { page, pageSize, skip } = getPaginationParams(req, 20);
        const employeeId = Number(req.params.employeeId);

        const [items, total] = await Promise.all([
            prisma.employeeLedger.findMany({
                where: { employeeId },
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
            }),
            prisma.employeeLedger.count({ where: { employeeId } }),
        ]);

        res.json(createPaginatedResponse(items, total, page, pageSize));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching employee ledger entries" });
    }
};

// POST /coldstores/:storeId/employees/:employeeId/ledger
// Creates a ledger entry and updates Employee.balance atomically.
// debit > 0  → company owes employee more  (e.g. salary credited)
// credit > 0 → employee owes company more  (e.g. advance taken, deduction)
export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const employeeId = Number(req.params.employeeId);
        const { debit, credit, note } = req.body;

        const debitAmt = Number(debit ?? 0);
        const creditAmt = Number(credit ?? 0);

        if (debitAmt < 0 || creditAmt < 0) {
            res.status(400).json({ message: "debit and credit must be non-negative" });
            return;
        }
        if (debitAmt === 0 && creditAmt === 0) {
            res.status(400).json({ message: "At least one of debit or credit must be greater than 0" });
            return;
        }

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) {
            res.status(404).json({ message: "Employee not found" });
            return;
        }

        const [entry] = await prisma.$transaction([
            prisma.employeeLedger.create({
                data: { employeeId, debit: debitAmt, credit: creditAmt, note },
            }),
            prisma.employee.update({
                where: { id: employeeId },
                data: { balance: { increment: debitAmt - creditAmt } },
            }),
        ]);

        res.status(201).json(entry);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// GET /coldstores/:storeId/employees/:employeeId/ledger/:id
export const show = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const record = await prisma.employeeLedger.findUnique({ where: { id } });
        if (!record) {
            res.status(404).json({ message: "Ledger entry not found" });
            return;
        }
        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching ledger entry" });
    }
};

// DELETE /coldstores/:storeId/employees/:employeeId/ledger/:id
// Reverses the balance effect before deletion.
export const destroy = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const entry = await prisma.employeeLedger.findUnique({ where: { id } });
        if (!entry) {
            res.status(404).json({ message: "Ledger entry not found" });
            return;
        }

        await prisma.$transaction([
            prisma.employeeLedger.delete({ where: { id } }),
            prisma.employee.update({
                where: { id: entry.employeeId },
                // Reverse the effect: undo (debit - credit)
                data: { balance: { decrement: entry.debit - entry.credit } },
            }),
        ]);

        res.json({ message: "Ledger entry deleted and balance reversed" });
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            res.status(404).json({ message: "Ledger entry not found" });
            return;
        }
        res.status(500).json({ message: "Error deleting ledger entry" });
    }
};
