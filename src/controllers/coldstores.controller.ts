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
    const { user, name, address, rooms } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: user.username,
          password: user.password,
        },
      });

      const newColdStore = await tx.coldStore.create({
        data: {
          name,
          address,
          hashCode: `${name}-${Date.now()}`,
          userId: Number(newUser.id),
        },
      });

      const floorLabels = [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
      ];

      for (const room of rooms) {
        const newRoom = await tx.room.create({
          data: {
            name: room.name,
            tempMin: room.tempMin,
            tempMax: room.tempMax,
            storeId: Number(newColdStore.id),
          },
        });

        const numOfRacks = Number(room.numOfRacks) || 0;
        const numOfFloors = Number(room.numOfFloors) || 0;
        const roomCapacity = Number(room.capacity) || 0;

        const rackCapacity =
          roomCapacity > 0 && numOfRacks > 0 && numOfFloors > 0
            ? roomCapacity / (numOfRacks * numOfFloors)
            : 0;

        // Prepare all racks in memory first
        const racksData: any[] = [];

        for (let floor = 1; floor <= numOfFloors; floor++) {
          for (let rack = 1; rack <= numOfRacks; rack++) {
            racksData.push({
              name: `${rack}${floorLabels[floor - 1]}-L`,
              capacity: rackCapacity,
              roomId: Number(newRoom.id),
            });

            racksData.push({
              name: `${rack}${floorLabels[floor - 1]}-R`,
              capacity: rackCapacity,
              roomId: Number(newRoom.id),
            });
          }
        }

        // Insert all racks in one query
        if (racksData.length > 0) {
          await tx.rack.createMany({
            data: racksData,
          });
        }
      }

      return newColdStore;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single cold store by ID
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.coldStore.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ message: "Cold store not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching cold store" });
  }
};

// Update a cold store by ID
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, address, phone } = req.body;

    const updatedColdStore = await prisma.coldStore.update({
      where: { id },
      data: { name, address, phone },
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
