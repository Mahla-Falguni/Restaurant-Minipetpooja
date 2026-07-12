import express from "express";

import { getKitchenOrders, acceptOrder, startPreparing, markReady, serveOrder, completeOrder, rejectOrder, getKitchenDashboardStats } from "../controllers/kitchenController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requireFeature from "../middleware/checkPlanFeature.js";

const router = express.Router();

router.use(authMiddleware);

// Entire Kitchen Display System module is gated behind the "KDS" plan feature.
router.use(requireFeature("KDS"));

router.get("/orders", getKitchenOrders);

router.patch("/accept/:id", acceptOrder);

router.patch("/preparing/:id", startPreparing);

router.patch("/ready/:id", markReady);

router.patch("/serve/:id", serveOrder);

router.patch("/complete/:id", completeOrder);

router.patch("/reject/:id", rejectOrder);

router.get("/dashboard", getKitchenDashboardStats);

export default router;