// src/controllers/rooms.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// Get all rooms
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const storeId = Number(req.params.storeId);
    // find the cold store to ensure it exists and to get its rooms
    const coldstore = await prisma.coldStore.findUnique({
      where: { id: storeId },
      include: { rooms: true },
    });
    if (!coldstore) {
      return res.status(404).json({ message: "Cold store not found" });
    }
    // use the rooms from the cold store to create a paginated response
    const [items, total] = await Promise.all([
      prisma.room.findMany({
        skip,
        take: pageSize,
        include: {
          racks: true,
        },
        where: { storeId: Number(req.params.storeId) },
      }),
      prisma.room.count({ where: { storeId: Number(req.params.storeId) } }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching rooms" });
  }
};

// Create a new room
export const create = async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);

  try {
    const { name, tempMin, tempMax, numOfFloors, numOfRacks, roomCapacity } =
      req.body;

    const rackCapacity =
      roomCapacity > 0 && numOfRacks > 0 && numOfFloors > 0
        ? roomCapacity / ((numOfRacks * 2) * numOfFloors)
        : 0;

    const floorLabels = Array.from({ length: numOfFloors }, (_, i) =>
      String.fromCharCode(65 + i)
    );
    const result = await prisma.$transaction(async (tx) => {
      const newRoom = await tx.room.create({
        data: {
          name,
          tempMin,
          tempMax,
          numOfFloors,
          numOfRacks,
          roomCapacity,
          storeId,
        },
      });

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
      return res.status(201).json(newRoom);
    });
    res.status(201).json(result);
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
    const { name, tempMin, tempMax, numOfFloors, numOfRacks, roomCapacity } =
      req.body;

    const updatedroom = await prisma.room.update({
      where: { id },
      data: { name, tempMin, tempMax, numOfFloors, numOfRacks, roomCapacity },
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
