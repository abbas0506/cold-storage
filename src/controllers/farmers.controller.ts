// src/controllers/farmers.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all farmers
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const storeId = Number(req.params.storeId);
    const [items, total] = await Promise.all([
      prisma.farmer.findMany({
        skip,
        take: pageSize,
        where: { storeId: storeId },
      }),
      prisma.farmer.count({ where: { storeId: storeId } }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching farmers" });
  }
};

// Create a new farmer
export const create = async (req: Request, res: Response) => {
  try {
    const { name, phone, cnic, address, marka } = req.body;
    const storeId = Number(req.params.storeId);
    if (!req.params.storeId) {
      return res.status(400).json({ message: "storeId param is missing" });
    }
    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }
    const newFarmer = await prisma.farmer.create({
      data: { name, phone, cnic, address, marka, storeId },
    });
    return res.status(201).json(newFarmer);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single farmer by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.farmer.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "farmer not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching farmer" });
  }
};

// Update a farmer by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, cnic, address, marka } = req.body;

    const updatedfarmer = await prisma.farmer.update({
      where: { id },
      data: { name, phone, cnic, address, marka },
    });

    res.json(updatedfarmer);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "farmer not found" });
    }
    res.status(500).json({ message: "Error updating farmer" });
  }
};

// Delete a farmer by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.farmer.delete({
      where: { id },
    });

    res.json({ message: "farmer deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "farmer not found" });
    }
    res.status(500).json({ message: "Error deleting farmer" });
  }
};
