import express from "express";

import verifySuperAdmin from "../middleware/verifySuperAdmin.js";

import { superAdminLogin, createSuperAdmin, getSuperAdminProfile, superAdminLogout, superAdminForgotPassword, superAdminVerifyResetToken, superAdminResetPassword } from "../controllers/superAdminAuthController.js";
import { getAllRestaurants, getRestaurantDetail, suspendRestaurant, reactivateRestaurant, deactivateStaffAccount, getActivityLog, getRestaurantReportSummary } from "../controllers/restaurantManagementController.js";
import { createPlan, getPlans, getAllPlansAdmin, getPlanById, updatePlan, togglePlanStatus, assignSubscription, getExpiringSubscriptions } from "../controllers/subscriptionController.js";
import { getPlatformOverview } from "../controllers/platformAnalyticsController.js";

const router = express.Router();

/*
=========================================
AUTH (login + password reset are public, rest are protected)
=========================================
*/

router.post("/auth/login", superAdminLogin);

// http://localhost:5000/api/super-admin/auth/forgot-password
router.post("/auth/forgot-password", superAdminForgotPassword);

// http://localhost:5000/api/super-admin/auth/verify-reset-token/:token
router.get("/auth/verify-reset-token/:token", superAdminVerifyResetToken);

// http://localhost:5000/api/super-admin/auth/reset-password/:token
router.post("/auth/reset-password/:token", superAdminResetPassword);

router.use(verifySuperAdmin);
router.post("/auth/create", createSuperAdmin);
router.get("/auth/me", getSuperAdminProfile);
router.post("/auth/logout", superAdminLogout);


/*
=========================================
RESTAURANT MANAGEMENT
=========================================
*/

router.get("/restaurants", getAllRestaurants);
router.get("/restaurants/:id", getRestaurantDetail);
router.put("/restaurants/:id/suspend", suspendRestaurant);
router.put("/restaurants/:id/reactivate", reactivateRestaurant);
router.put("/restaurants/:restaurantId/staff/:staffId/deactivate", deactivateStaffAccount);
router.get("/activity-log", getActivityLog);
router.get("/restaurants/:id/report", getRestaurantReportSummary);

/*
=========================================
SUBSCRIPTIONS & PLANS
=========================================
*/

router.post("/plans", createPlan);
router.get("/plans", getPlans);
router.get("/plans/all", getAllPlansAdmin);
router.get("/plans/:id", getPlanById);
router.put("/plans/:id", updatePlan);
router.put("/plans/:id/toggle", togglePlanStatus);
router.put("/restaurants/:id/subscription", assignSubscription);
router.get("/subscriptions/expiring", getExpiringSubscriptions);

/*
=========================================
PLATFORM ANALYTICS
=========================================
*/

router.get("/analytics/overview", getPlatformOverview);

export default router;