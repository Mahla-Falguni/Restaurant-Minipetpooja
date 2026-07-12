import express from "express";

import { updateOrderStatus, getOrderTimeline, trackOrder } from "../controllers/orderTimelineController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.patch("/status/:id", authMiddleware, updateOrderStatus);

router.get("/timeline/:id", authMiddleware, getOrderTimeline);

router.get("/track/:orderNumber", trackOrder);

export default router;