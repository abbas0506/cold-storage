// src/controllers/ratePlans.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all rate plans
export const index = async (req: Request, res: Response) => {
  try {
    const storeId = Number(req.params.storeId);
    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }

    const { page, pageSize, skip } = getPaginationParams(req, 15);

    const [ratePlans, count] = await prisma.$transaction([
      prisma.ratePlan.findMany({
        where: {
          storeId: storeId,
        },
      }),

      prisma.ratePlan.count({
        where: {
          storeId: storeId,
        },
      }),
    ]);

    res.json(createPaginatedResponse(ratePlans, count, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching rate plans" });
  }
};

// Create a new rate plan
export const create = async (req: Request, res: Response) => {
  try {
    const {
      packagingType,
      rateType,
      rateAmount,
    } = req.body;
    const newRatePlan = await prisma.ratePlan.create({
      data: {
        storeId: Number(req.params.storeId),
        packagingType,
        rateType,
        rateAmount,
      },
    });

    return res.status(201).json(newRatePlan);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single rate plan by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.ratePlan.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Rate plan not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching rate plan" });
  }
};

// Update a rate plan by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      packagingType,
      rateType,
      rateAmount,
    } = req.body;


    const updatedRatePlan = await prisma.ratePlan.update({
      where: { id },
      data: {
        packagingType,
        rateType,
        rateAmount,
      },
    });

    res.json(updatedRatePlan);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Rate plan not found" });
    }
    res.status(500).json({ message: "Error updating rate plan" });
  }
};

// Delete a rate plan by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.ratePlan.delete({
      where: { id },
    });

    res.json({ message: "Rate plan deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Rate plan not found" });
    }
    res.status(500).json({ message: "Error deleting rate plan" });
  }
};
