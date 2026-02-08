import { Router } from "express";
import { prisma } from "../prisma/prisma";
import { createPaginatedResponse, getPaginationParams } from "../utils";
import { createRoom } from "../controllers/rooms.controller";
const router = Router();

// get all Rooms
router.get("/", async (req, res) => {
  const { page, pageSize, skip } = getPaginationParams(req, 15);
  const { storeId } = req.body;
  if (!storeId) {
    return res.status(400).json({ message: "Store Id required!" });
  }
  const [items, total] = await Promise.all([
    prisma.room.findMany({
      skip,
      take: pageSize,
      where: { storeId: Number(storeId) },
    }),
    prisma.room.count({ where: { storeId: Number(storeId) } }),
  ]);

  res.json(createPaginatedResponse(items, total, page, pageSize));
});

// create Room
router.post("/", createRoom);

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const { storeId } = req.body;
  if (!storeId) {
    return res.status(400).json({ message: "Store Id is required" });
  }
  const store = await prisma.room.findUnique({
    where: { id: Number(id) },
  });
  res.json(store);
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const updatedStore = await prisma.room.update({
      where: { id: Number(id) },
      data: req.body,
    });

    res.json(updatedStore);
  } catch (error) {
    res.status(404).json({ message: "Room not found" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const store = await prisma.room.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Room deleted successfully", store });
  } catch (error) {
    res.status(404).json({ message: "Room not found" });
  }
});

export default router;
