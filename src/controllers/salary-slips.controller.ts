import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// GET /coldstores/:storeId/employees/:employeeId/salary-slips
export const index = async (req: Request, res: Response): Promise<void> => {
    try {
        const { page, pageSize, skip } = getPaginationParams(req, 12);
        const employeeId = Number(req.params.employeeId);

        const [items, total] = await Promise.all([
            prisma.salarySlip.findMany({
                where: { employeeId },
                skip,
                take: pageSize,
                orderBy: [{ year: "desc" }, { month: "desc" }],
            }),
            prisma.salarySlip.count({ where: { employeeId } }),
        ]);

        res.json(createPaginatedResponse(items, total, page, pageSize));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching salary slips" });
    }
};

// POST /coldstores/:storeId/employees/:employeeId/salary-slips
// Generates a DRAFT salary slip for a given year/month.
export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const employeeId = Number(req.params.employeeId);
        const { year, month, bonus, otherDeductions, note } = req.body;

        if (!year || !month) {
            res.status(400).json({ message: "year and month are required" });
            return;
        }

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) {
            res.status(404).json({ message: "Employee not found" });
            return;
        }

        // Prevent duplicate slips for the same period
        const existing = await prisma.salarySlip.findUnique({
            where: { employeeId_year_month: { employeeId, year: Number(year), month: Number(month) } },
        });
        if (existing) {
            res.status(409).json({ message: "Salary slip already exists for this period", slip: existing });
            return;
        }

        const bonusAmt = Number(bonus ?? 0);
        const deductionsAmt = Number(otherDeductions ?? 0);
        // totalAdvances stays 0 at generation — updated when individual advance ledger entries are linked
        const netPayable = employee.baseSalary + bonusAmt - deductionsAmt;

        const slip = await prisma.salarySlip.create({
            data: {
                employeeId,
                year: Number(year),
                month: Number(month),
                baseSalary: employee.baseSalary,
                bonus: bonusAmt,
                totalAdvances: 0,
                otherDeductions: deductionsAmt,
                netPayable,
                status: "DRAFT",
                note,
            },
        });

        res.status(201).json(slip);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// GET /coldstores/:storeId/employees/:employeeId/salary-slips/:id
export const show = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const record = await prisma.salarySlip.findUnique({
            where: { id },
            include: { employee: true },
        });
        if (!record) {
            res.status(404).json({ message: "Salary slip not found" });
            return;
        }
        res.json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching salary slip" });
    }
};

// PUT /coldstores/:storeId/employees/:employeeId/salary-slips/:id
// Updates a DRAFT slip (adjust bonus, deductions) or approves it.
export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { bonus, totalAdvances, otherDeductions, status, note } = req.body;

        const slip = await prisma.salarySlip.findUnique({ where: { id } });
        if (!slip) {
            res.status(404).json({ message: "Salary slip not found" });
            return;
        }

        if (slip.status === "PAID" || slip.status === "CANCELLED") {
            res.status(400).json({ message: `Cannot edit a ${slip.status} salary slip` });
            return;
        }

        const newBonus = bonus != null ? Number(bonus) : slip.bonus;
        const newAdvances = totalAdvances != null ? Number(totalAdvances) : slip.totalAdvances;
        const newDeductions = otherDeductions != null ? Number(otherDeductions) : slip.otherDeductions;
        const newNetPayable = slip.baseSalary + newBonus - newAdvances - newDeductions;

        const updated = await prisma.salarySlip.update({
            where: { id },
            data: {
                bonus: newBonus,
                totalAdvances: newAdvances,
                otherDeductions: newDeductions,
                netPayable: newNetPayable,
                status: status ?? undefined,
                note,
            },
        });

        res.json(updated);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            res.status(404).json({ message: "Salary slip not found" });
            return;
        }
        res.status(500).json({ message: "Error updating salary slip" });
    }
};

// PATCH /coldstores/:storeId/employees/:employeeId/salary-slips/:id/pay
// Marks slip as PAID, records a ledger credit entry, and reduces employee.balance.
export const pay = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const slip = await prisma.salarySlip.findUnique({ where: { id } });
        if (!slip) {
            res.status(404).json({ message: "Salary slip not found" });
            return;
        }
        if (slip.status !== "APPROVED") {
            res.status(400).json({ message: "Only APPROVED slips can be paid" });
            return;
        }

        const [updatedSlip] = await prisma.$transaction([
            prisma.salarySlip.update({
                where: { id },
                data: { status: "PAID", paidDate: new Date() },
            }),
            // Credit entry: salary disbursed, reduces remaining balance owed to employee
            prisma.employeeLedger.create({
                data: {
                    employeeId: slip.employeeId,
                    debit: 0,
                    credit: slip.netPayable,
                    note: `Salary slip #${id} paid for ${slip.year}-${String(slip.month).padStart(2, "0")}`,
                },
            }),
            prisma.employee.update({
                where: { id: slip.employeeId },
                data: { balance: { decrement: slip.netPayable } },
            }),
        ]);

        res.json(updatedSlip);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// PATCH /coldstores/:storeId/employees/:employeeId/salary-slips/:id/cancel
export const cancel = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const slip = await prisma.salarySlip.findUnique({ where: { id } });
        if (!slip) {
            res.status(404).json({ message: "Salary slip not found" });
            return;
        }
        if (slip.status === "PAID") {
            res.status(400).json({ message: "Cannot cancel a paid salary slip" });
            return;
        }

        const updated = await prisma.salarySlip.update({
            where: { id },
            data: { status: "CANCELLED" },
        });

        res.json(updated);
    } catch (error: any) {
        console.error(error);
        if (error.code === "P2025") {
            res.status(404).json({ message: "Salary slip not found" });
            return;
        }
        res.status(500).json({ message: "Error cancelling salary slip" });
    }
};
