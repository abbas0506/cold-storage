// src/controllers/racks.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all racks
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const [items, total] = await Promise.all([
      prisma.rack.findMany({ skip, take: pageSize }),
      prisma.rack.count(),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching racks" });
  }
};

// Create a new rack
export const create = async (req: Request, res: Response) => {
  const roomId = Number(req.params.roomId);

  try {
    const { name, capacity } = req.body;
    const newrack = await prisma.rack.create({
      data: { name, capacity, roomId },
    });

    return res.status(201).json(newrack);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single rack by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.rack.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Rack not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching rack" });
  }
};

// Update a rack by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, capacity } = req.body;

    const updatedrack = await prisma.rack.update({
      where: { id },
      data: { name, capacity },
    });

    res.json(updatedrack);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Rack not found" });
    }
    res.status(500).json({ message: "Error updating rack" });
  }
};

// Delete a rack by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.rack.delete({
      where: { id },
    });

    res.json({ message: "Rack deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Rack not found" });
    }
    res.status(500).json({ message: "Error deleting rack" });
  }
};
