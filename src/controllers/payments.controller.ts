// src/controllers/farmers.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all farmers
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const storeId = Number(req.params.storeId);
    const farmers = await prisma.farmer.findMany({
      where: { storeId: storeId },
    });
    const farmerIds = farmers.map((f) => f.id);
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        skip,
        take: pageSize,
        where: { farmerId: { in: farmerIds } },
        include: {
          farmer: true,
        },
        orderBy: {
          id: 'desc',
        }
      }),
      prisma.payment.count({ where: { farmerId: { in: farmerIds } } }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching farmers" });
  }
};

// Create a new payment
export const create = async (req: Request, res: Response) => {
  try {
    const { paymentDate, amount, paymentMethod, transactionRef, remarks, farmerId } = req.body;
    const storeId = Number(req.params.storeId);
    if (!req.params.storeId) {
      return res.status(400).json({ message: "storeId param is missing" });
    }
    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }
    const newPayment = await prisma.payment.create({
      data: { paymentDate: new Date(paymentDate), amount, paymentMethod, transactionRef, remarks, farmerId },
    });

    const ledgerEntry = await prisma.ledger.create({
      data: {
        farmerId: farmerId,
        debit: 0,
        credit: amount,
        description: `Payment received: ${paymentMethod} - ${transactionRef}`,
      },
    });

    // update the payment with the ledger entry ID
    await prisma.payment.update({
      where: { id: newPayment.id },
      data: { ledgerId: ledgerEntry.id },
    });

    return res.status(201).json(newPayment);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single payment by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.payment.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "payment not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching payment" });
  }
};

// Update a payment by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { paymentDate, amount, paymentMethod, transactionRef, remarks, farmerId } = req.body;

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { paymentDate: new Date(paymentDate), amount, paymentMethod, transactionRef, remarks, farmerId },
    });

    res.json(updatedPayment);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "payment not found" });
    }
    res.status(500).json({ message: "Error updating payment" });
  }
};

// Delete a payment by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.payment.delete({
      where: { id },
    });

    res.json({ message: "payment deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "payment not found" });
    }
    res.status(500).json({ message: "Error deleting payment" });
  }
};
