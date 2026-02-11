// src/controllers/storagePlans.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get allstorage contracts
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const storeId = Number(req.params.storeId);
    const farmers = await prisma.farmer.findMany({
      where: { storeId: storeId },
    });
    const farmerIds = farmers.map((f) => f.id);
    const [items, total] = await Promise.all([
      prisma.contract.findMany({
        skip,
        take: pageSize,
        where: { farmerId: { in: farmerIds } },
      }),
      prisma.contract.count({ where: { farmerId: { in: farmerIds } } }),
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
    const {
      farmerId,
      contractCode,
      startDate,
      expectedEndDate,
      actualEndDate,
      status,
      notes,
    } = req.body;
    const storeId = Number(req.params.storeId);
    if (!req.params.storeId) {
      return res.status(400).json({ message: "storeId param is missing" });
    }
    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }
    const newstoragePlan = await prisma.contract.create({
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
    return res.status(201).json(newstoragePlan);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a singlestorage contract by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.contract.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Storage contract not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetchingstorage contract" });
  }
};

// Update astorage contract by ID
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
