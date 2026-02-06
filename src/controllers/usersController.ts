import { Request, Response } from "express";
import { prisma } from "../prisma/prisma";

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        lastLogin: true,
        fcmToken: true,
        role: true,
        updatedAt: true,
      },
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
