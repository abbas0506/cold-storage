import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "User already exists" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hash },
    });

    const token = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, lastLogin: new Date() },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
};
