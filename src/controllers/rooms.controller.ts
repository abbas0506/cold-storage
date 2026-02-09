// src/controllers/rooms.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all rooms
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const [items, total] = await Promise.all([
      prisma.room.findMany({ skip, take: pageSize }),
      prisma.room.count(),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching rooms" });
  }
};

// Create a new room
export const create = async (req: Request, res: Response) => {
  try {
    const storeId = Number(req.params.storeId);
    const { name, tempMin, tempMax } = req.body;

    const newroom = await prisma.room.create({
      data: { name, tempMin, tempMax, storeId },
    });

    return res.status(201).json(newroom);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single room by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.room.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching room" });
  }
};

// Update a room by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, tempMin, tempMax } = req.body;

    const updatedroom = await prisma.room.update({
      where: { id },
      data: { name, tempMin, tempMax },
    });

    res.json(updatedroom);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Room not found" });
    }
    res.status(500).json({ message: "Error updating room" });
  }
};

// Delete a room by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.room.delete({
      where: { id },
    });

    res.json({ message: "Room deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Room not found" });
    }
    res.status(500).json({ message: "Error deleting room" });
  }
};
