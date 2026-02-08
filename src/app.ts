import express from "express";
import cors from "cors";
import apiRouter from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => res.json({ message: "Cold Storage API" }));
app.get("/api/health", (_req, res) => res.json({ status: "OK" }));
app.use("/api", apiRouter);

export default app;
