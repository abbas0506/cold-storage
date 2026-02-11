// src/controllers/storagePlans.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get allstorage contracts
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const contractId = Number(req.params.contractId);
    const contractLines = await prisma.contractLine.findMany({
      where: { contractId: contractId },
    });
    const [items, total] = await Promise.all([
      prisma.contractLine.findMany({
        skip,
        take: pageSize,
        where: { contractId: contractId },
      }),
      prisma.contractLine.count({ where: { contractId: contractId } }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching contract lines" });
  }
};

// Create a new contract line
export const create = async (req: Request, res: Response) => {
  try {
    const {
      contractId,
      itemId,
      packagingType,
      quantity,
      unitRate,
      lateCharges,
      remarks,
    } = req.body;
    const storeId = Number(req.params.storeId);
    if (!req.params.storeId) {
      return res.status(400).json({ message: "Store Id param is missing" });
    }
    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }
    const newRecord = await prisma.contractLine.create({
      data: {
        contractId,
        itemId,
        packagingType,
        quantity,
        unitRate,
        lateCharges,
        remarks,
      },
    });

    return res.status(201).json(newRecord);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a singlestorage contract by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.contractLine.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Contract line not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching contract line" });
  }
};

// Update a contract line by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      contractId,
      itemId,
      packagingType,
      quantity,
      unitRate,
      lateCharges,
      remarks,
    } = req.body;

    const updatedRecord = await prisma.contractLine.update({
      where: { id },
      data: {
        contractId,
        itemId,
        packagingType,
        quantity,
        unitRate,
        lateCharges,
        remarks,
      },
    });

    res.json(updatedRecord);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Contract line not found" });
    }
    res.status(500).json({ message: "Error updating contract line" });
  }
};

// Delete a contract line by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.contractLine.delete({
      where: { id },
    });

    res.json({ message: "Contract line deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Contract line not found" });
    }
    res.status(500).json({ message: "Error deletingstorage contract" });
  }
};
