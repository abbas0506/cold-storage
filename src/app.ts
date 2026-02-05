import express from "express";
import apiRouter from "./routes";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => res.json({ message: "Cold Storage API" }));
app.use("/api", apiRouter);

export default app;
