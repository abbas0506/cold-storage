import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";

export async function createRoom(req: Request, res: Response) {
  const { rooms, storeId } = req.body;
  if (!storeId) {
    return res.status(400).json({ message: "Store Id required!" });
  }
  try {
    for (const room of rooms) {
      const r = await prisma.room.create({
        data: {
          roomName: room.roomName,
          temperatureMin: room.temperatureMin,
          temperatureMax: room.temperatureMax,
          storeId: Number(storeId),
        },
      });

      const numberOfRack = room.numberOfRacks || 0;
      const numberOfFloors = room.numberOfFloors || 0;
    }
    res.json({ message: "Rooms created successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error creating Room", error });
  }
}
