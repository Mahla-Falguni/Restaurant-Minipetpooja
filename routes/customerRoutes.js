import express from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import checkRole from "../middleware/checkRoleMiddleware.js";
import requireFeature from "../middleware/checkPlanFeature.js";

import { createCustomer, getCustomers, getCustomerProfile, updateCustomer, getUpcomingBirthdays } from "../controllers/customerController.js";
import { earnLoyaltyPoints, redeemLoyaltyPoints, adjustLoyaltyPoints, grantBirthdayBonus, getCustomerAnalytics } from "../controllers/loyaltyController.js";

const router = express.Router();

router.use(verifyJWT);

// Entire customer/CRM module (profiles, loyalty, birthday rewards,
// analytics) is gated behind the "Customer CRM" plan feature.
router.use(requireFeature("Customer CRM"));

/*
=========================================
CUSTOMER CRUD
=========================================
*/

router.post("/create", checkRole("Waiter", "Cashier", "Manager", "Admin"), createCustomer);

router.get("/list", checkRole("Waiter", "Cashier", "Manager", "Admin"), getCustomers);

router.get("/birthdays", checkRole("Manager", "Admin"), getUpcomingBirthdays);

router.get("/:id", checkRole("Waiter", "Cashier", "Manager", "Admin"), getCustomerProfile);

router.put("/:id", checkRole("Cashier", "Manager", "Admin"), updateCustomer);

/*
=========================================
LOYALTY POINTS
=========================================
*/

router.post("/loyalty/earn", checkRole("Cashier", "Manager", "Admin"), earnLoyaltyPoints);

router.post("/loyalty/redeem", checkRole("Cashier", "Manager", "Admin"), redeemLoyaltyPoints);

router.post("/loyalty/adjust", checkRole("Manager", "Admin"), adjustLoyaltyPoints);

/*
=========================================
BIRTHDAY REWARDS
=========================================
*/

router.post("/loyalty/birthday-bonus/:customer_id", checkRole("Manager", "Admin"), grantBirthdayBonus);

/*
=========================================
ANALYTICS
=========================================
*/

router.get("/analytics/summary", checkRole("Manager", "Admin"), getCustomerAnalytics);

export default router;