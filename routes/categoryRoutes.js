import express from "express";

import { createCategory, getCategories, getCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// http://localhost:5000/api/categories/create    
router.post("/create", authMiddleware, upload.single("image"), createCategory);

// http://localhost:5000/api/categories
router.get("/", authMiddleware, getCategories);


router.get("/:id", authMiddleware, getCategory);


router.put("/:id", authMiddleware, updateCategory);

// http://localhost:5000/api/categories/:id
router.delete("/:id", authMiddleware, deleteCategory);

export default router;