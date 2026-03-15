// src/controllers/coldStores.controller.ts
import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";

// ─── Helper: build WHERE clause based on caller's role ───────────────────────
async function buildStoreWhere(req: Request) {
  if (req.user!.systemRole === "SUPER_ADMIN") return {};

  if (req.user!.systemRole === "SUBSCRIBER") {
    return { subscription: { userId: req.user!.id } };
  }

  // USER: only stores they are directly assigned to
  const storeUsers = await prisma.storeUser.findMany({
    where: { userId: req.user!.id, isActive: true },
    select: { storeId: true },
  });
  return { id: { in: storeUsers.map((su) => su.storeId) } };
}

// GET /coldstores
export const index = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req, 15);
    const where = await buildStoreWhere(req);

    const [items, total] = await Promise.all([
      prisma.coldStore.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          subscription: {
            select: { status: true, plan: { select: { name: true } } },
          },
        },
      }),
      prisma.coldStore.count({ where }),
    ]);

    res.json(createPaginatedResponse(items, total, page, pageSize));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching cold stores" });
  }
};

// POST /coldstores
export const create = async (req: Request, res: Response) => {
  try {
    const { name, address, rooms } = req.body;

    if (req.user == null) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Only SUBSCRIBER (or SUPER_ADMIN) can create stores
    if (req.user.systemRole === "USER") {
      return res.status(403).json({ message: "Only subscribers can create cold stores" });
    }

    let subscriptionId: number | undefined;

    if (req.user.systemRole === "SUBSCRIBER") {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user.id },
        include: { plan: true },
      });

      if (!subscription || subscription.status !== "ACTIVE") {
        return res.status(403).json({ message: "Active subscription required to create a store" });
      }

      if (subscription.endDate < new Date()) {
        return res.status(403).json({ message: "Subscription has expired" });
      }

      const storeCount = await prisma.coldStore.count({
        where: { subscriptionId: subscription.id },
      });
      if (storeCount >= subscription.plan.maxStores) {
        return res.status(429).json({
          message: `Store limit reached (${subscription.plan.maxStores}). Upgrade your plan.`,
        });
      }

      subscriptionId = subscription.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const newColdStore = await tx.coldStore.create({
        data: {
          name,
          address,
          hashCode: `${name}-${Date.now()}`,
          subscriptionId,
        },
      });

      const floorLabels = [
        "A", "B", "C", "D", "E", "F", "G", "H",
        "I", "J", "K", "L", "M", "N", "O", "P",
      ];

      for (const room of rooms ?? []) {
        const numOfRacks = Number(room.numOfRacks) || 0;
        const numOfFloors = Number(room.numOfFloors) || 0;
        const roomCapacity = Number(room.roomCapacity) || 0;

        const newRoom = await tx.room.create({
          data: {
            name: room.name,
            tempMin: room.tempMin,
            tempMax: room.tempMax,
            storeId: Number(newColdStore.id),
            numOfFloors,
            numOfRacks,
            roomCapacity,
          },
        });

        const rackCapacity =
          roomCapacity > 0 && numOfRacks > 0 && numOfFloors > 0
            ? roomCapacity / (numOfRacks * numOfFloors)
            : 0;

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

        if (racksData.length > 0) {
          await tx.rack.createMany({ data: racksData });
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

// GET /coldstores/:id
export const show = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const record = await prisma.coldStore.findUnique({ where: { id } });

    if (!record) {
      return res.status(404).json({ message: "Cold store not found" });
    }

    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching cold store" });
  }
};

// PUT /coldstores/:id
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
      return res.status(404).json({ message: "Cold store not found" });
    }
    res.status(500).json({ message: "Error updating cold store" });
  }
};

// DELETE /coldstores/:id
export const destroy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.coldStore.delete({ where: { id } });

    res.json({ message: "Cold store deleted successfully" });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Cold store not found" });
    }
    res.status(500).json({ message: "Error deleting cold store" });
  }
};
