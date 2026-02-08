// src/controllers/coldStores.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all cold stores
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const [items, total] = await Promise.all([
      prisma.coldStore.findMany({ skip, take: pageSize }),
      prisma.coldStore.count(),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching cold stores" });
  }
};

// Create a new cold store
export const create = async (req: Request, res: Response) => {
  try {
    const { name, address } = req.body;

    const newUser = await prisma.user.create({
      data: {
        username: "baoo@dhsak",
        password: "12345678",
      },
    });

    const newColdStore = await prisma.coldStore.create({
      data: {
        name: name,
        address: address,
        hashCode: `${name}-${Date.now()}`,
        userId: Number(newUser.id), // Use the ID of the newly created user
      },
    });

    const { rooms, tempMin, tempMax } = req.body;
    if (!newColdStore.id) {
      return res.status(400).json({ message: "Store Id required!" });
    }
    try {
      for (const room of rooms) {
        const newRoom = await prisma.room.create({
          data: {
            name: room.name,
            tempMin: room.tempMin,
            tempMax: room.tempMax,
            storeId: Number(newColdStore.id),
          },
        });

        const numberOfRacks = room.numberOfRacks || 0;
        const numberOfFloors = room.numberOfFloors || 0;

        const floorLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

        for (let floor = 1; floor <= numberOfFloors; floor++) {
          for (let rack = 1; rack <= numberOfRacks; rack++) {
            await prisma.rack.create({
              data: {
                name: `${floorLabels[floor - 1]} ${rack}-L`,
                roomId: Number(newRoom.id),
              },
            });
          }
        }
      }
      res.json({ message: "Rooms created successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Error creating Room", error });
    }

    res.status(201).json(newColdStore);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single cold store by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const coldStore = await prisma.coldStore.findUnique({
      where: { id },
    });

    if (!coldStore) {
      return res.status(404).json({ message: "Cold store not found" });
    }

    res.json(coldStore);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching cold store" });
  }
};

// Update a cold store by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, address } = req.body;

    const updatedColdStore = await prisma.coldStore.update({
      where: { id },
      data: { name, address },
    });

    res.json(updatedColdStore);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      // Prisma "record not found" error
      return res.status(404).json({ message: "Cold store not found" });
    }
    res.status(500).json({ message: "Error updating cold store" });
  }
};

// Delete a cold store by ID
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.coldStore.delete({
      where: { id },
    });

    res.json({ message: "Cold store deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Cold store not found" });
    }
    res.status(500).json({ message: "Error deleting cold store" });
  }
};
