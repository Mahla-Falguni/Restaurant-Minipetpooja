import express from "express";

import { createMenuItem, getMenuItems, getMenuItem, updateMenuItem, deleteMenuItem, toggleAvailability, toggleBestSeller, toggleRecommended, softDeleteMenu, restoreMenu, bulkUpdateStatus } from "../controllers/menuController.js";
import { getRestaurantByTable, getPublicMenu } from "../controllers/menuController.js";
import { createOrder } from "../controllers/orderController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

/*
============================
CREATE MENU ITEM
============================
*/

router.post("/create", authMiddleware, upload.single("image"), createMenuItem);

/*
============================
GET ALL MENU
============================
*/

router.get("/", authMiddleware, getMenuItems);

/*
============================
GET SINGLE MENU
============================
*/

router.get("/:id", authMiddleware, getMenuItem);

router.put("/:id", authMiddleware, upload.single("image"), updateMenuItem);

router.delete("/:id", authMiddleware, deleteMenuItem);

router.patch("/availability/:id", authMiddleware, toggleAvailability);

router.patch("/best-seller/:id", authMiddleware, toggleBestSeller);

router.patch("/recommended/:id", authMiddleware, toggleRecommended);

router.patch("/soft-delete/:id", authMiddleware, softDeleteMenu);

router.patch("/restore/:id", authMiddleware, restoreMenu);

router.patch("/bulk-status", authMiddleware, bulkUpdateStatus);


/*
===================================
CUSTOMER QR ROUTES
===================================
*/

router.get("/table/:tableCode", getRestaurantByTable);

router.get("/menu/:restaurantId", getPublicMenu);

router.post("/orders", createOrder);

export default router;

