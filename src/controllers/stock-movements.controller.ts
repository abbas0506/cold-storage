// src/controllers/storagePlans.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get allstorage contracts
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const contractId = Number(req.params.contractId);

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where: {
          contractLine: {
            contractId: contractId,
          },
        },
        include: {
          contractLine: true, // optional
        },
      }),
      prisma.stockMovement.count({
        where: {
          contractLine: {
            contractId: contractId,
          },
        },
      }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetchingstorage contracts" });
  }
};

// Create a newstorage contract
export const create = async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.contractId);
    const { lines } = req.body;

    if (!req.params.contractId) {
      return res.status(400).json({ message: "contract Id param is missing" });
    }
    if (Number.isNaN(contractId) || contractId <= 0) {
      return res.status(400).json({ message: "Invalid contract Id" });
    }

    for (const line of lines) {
      await prisma.stockMovement.create({
        data: {
          contractLineId: contractId,
          movementType: "IN",
          rackId: line.rackId,
          quantity: line.quantity,
          movementDate: line.movementDate,
          referenceNote: line.referenceNote,
        },
      });
    }
    return res.status(201).json("Successfully created stock movements");
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a singlestorage contract by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.stockMovement.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Stock movement not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching stock movement" });
  }
};

// Update a stock movement by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      farmerId,
      contractCode,
      startDate,
      expectedEndDate,
      actualEndDate,
      status,
      notes,
      items,
    } = req.body;

    const updatedstoragePlan = await prisma.contract.update({
      where: { id },
      data: {
        farmerId,
        contractCode,
        startDate,
        expectedEndDate,
        actualEndDate,
        status,
        notes,
      },
    });

    for (const line of items) {
      if (line.id) {
        // Update existing line item
        await prisma.contractLine.update({
          where: { id: line.id },
          data: {
            itemId: line.itemId,
            quantity: line.quantity,
            packagingType: line.packagingType,
            unitRate: line.unitRate,
          },
        });
      } else {
        // Create new line item
        await prisma.contractLine.create({
          data: {
            contractId: updatedstoragePlan.id,
            itemId: line.itemId,
            quantity: line.quantity,
            packagingType: line.packagingType,
            unitRate: line.unitRate,
          },
        });
      }
    }
    res.json(updatedstoragePlan);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Storage contract not found" });
    }
    res.status(500).json({ message: "Error updatingstorage contract" });
  }
};

// Delete astorage contract by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.contract.delete({
      where: { id },
    });

    res.json({ message: "Storage contract deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Storage contract not found" });
    }
    res.status(500).json({ message: "Error deletingstorage contract" });
  }
};
