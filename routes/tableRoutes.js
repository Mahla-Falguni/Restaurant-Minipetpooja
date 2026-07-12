import express from "express";

import { createTable, getTables, getTable, updateTable, deleteTable, updateTableStatus } from "../controllers/tableController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// http://localhost:5000/api/tables/create
router.post("/create", authMiddleware, createTable);

// http://localhost:5000/api/tables
router.get("/", authMiddleware, getTables);

// http://localhost:5000/api/tables/ID
router.get("/:id", authMiddleware, getTable);

// http://localhost:5000/api/tables/ID
router.put("/:id", authMiddleware, updateTable);

// http://localhost:5000/api/tables/ID
router.delete("/:id", authMiddleware, deleteTable);

// http://localhost:5000/api/tables/status/ID
router.patch("/status/:id", authMiddleware, updateTableStatus);

export default router;