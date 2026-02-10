// src/controllers/items.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all items
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const storeId = Number(req.params.storeId);
    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }
    const [items, total] = await Promise.all([
      prisma.item.findMany({
        skip,
        take: pageSize,
        where: { storeId: storeId },
      }),
      prisma.item.count({ where: { storeId: storeId } }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching items" });
  }
};

// Create a new item
export const create = async (req: Request, res: Response) => {
  try {
    const storeId = Number(req.params.storeId);
    const { name, description } = req.body;

    if (Number.isNaN(storeId) || storeId <= 0) {
      return res.status(400).json({ message: "Invalid storeId" });
    }
    const newitem = await prisma.item.create({
      data: { name, description, storeId },
    });

    return res.status(201).json(newitem);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single item by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.item.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching item" });
  }
};

// Update a item by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;

    const updateditem = await prisma.item.update({
      where: { id },
      data: { name, description },
    });

    res.json(updateditem);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(500).json({ message: "Error updating item" });
  }
};

// Delete a item by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.item.delete({
      where: { id },
    });

    res.json({ message: "Item deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(500).json({ message: "Error deleting item" });
  }
};
