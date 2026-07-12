import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

import { createRestaurant, getRestaurantProfile, getRestaurantSettings, updateRestaurant, updateRestaurantSettings, uploadLogo } from "../controllers/restaurantController.js";

import {
  getAvailablePlans,
  getMySubscription,
  getMyPlanFeatures,
  subscribeToPlan,
  cancelSubscription,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getPaymentHistory
} from "../controllers/restaurantSubscriptionController.js";

const router =
  express.Router();

// http://localhost:5000/api/restaurants/create
router.post("/create", authMiddleware, roleMiddleware("Admin"), createRestaurant);

// http://localhost:5000/api/restaurants/profile
router.get("/profile", authMiddleware, getRestaurantProfile);

// http://localhost:5000/api/restaurants/update
router.put("/update", authMiddleware, roleMiddleware("Admin"), updateRestaurant);

// http://localhost:5000/api/restaurants/logo
router.post("/logo", authMiddleware, roleMiddleware("Admin"), upload.single("logo"), uploadLogo);

// http://localhost:5000/api/restaurants/settings
router.get("/settings", authMiddleware, roleMiddleware("Admin", "Manager"), getRestaurantSettings);

// http://localhost:5000/api/restaurants/settings
router.put("/settings", authMiddleware, roleMiddleware("Admin", "Manager"), updateRestaurantSettings);

/*
=========================================
SELF-SERVICE SUBSCRIPTION + PAYMENT (Admin only)
http://localhost:5000/api/restaurants/plans
http://localhost:5000/api/restaurants/subscription
=========================================
*/

router.get("/plans", authMiddleware, roleMiddleware("Admin"), getAvailablePlans);

router.get("/subscription", authMiddleware, roleMiddleware("Admin"), getMySubscription);

// Any logged-in staff member (not just Admin) needs this to gate their own UI
router.get("/subscription/features", authMiddleware, getMyPlanFeatures);

router.post("/subscription/subscribe", authMiddleware, roleMiddleware("Admin"), subscribeToPlan);

router.post("/subscription/create-order", authMiddleware, roleMiddleware("Admin"), createSubscriptionOrder);

router.post("/subscription/verify-payment", authMiddleware, roleMiddleware("Admin"), verifySubscriptionPayment);

router.get("/subscription/payments", authMiddleware, roleMiddleware("Admin"), getPaymentHistory);

router.put("/subscription/cancel", authMiddleware, roleMiddleware("Admin"), cancelSubscription);

export default router;