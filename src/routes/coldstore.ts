import { Router } from "express";
import { prisma } from "../prisma/prisma";
const router = Router();

router.get("/", async (_req, res) => {
  const store = await prisma.coldStore.findMany({});
  res.json(store);
});

router.post("/", async (req, res) => {
  const { name, address, city } = req.body;
  const row = await prisma.coldStore.create({
    data: {
      storeName: name,
      address: address,
      city: city,
    },
  });
  res.json(row);
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const store = await prisma.coldStore.findUnique({
    where: { storeId: Number(id) },
  });
  res.json(store);
});

export default router;
