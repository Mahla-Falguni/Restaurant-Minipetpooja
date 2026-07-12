import express from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import checkRole from "../middleware/checkRoleMiddleware.js";
import requireFeature from "../middleware/checkPlanFeature.js";

import { createTable, getTables, updateTable, updateTableStatus, getFloorOverview } from "../controllers/tableController.js";

import { createReservation, getAvailableTables, getReservations, getTodaysReservations, confirmReservation, seatReservation, completeReservation, cancelReservation, markNoShow, rescheduleReservation } from "../controllers/reservationController.js";

const router = express.Router();

router.use(verifyJWT);

/*
=========================================
TABLES
=========================================
*/

router.post("/tables", checkRole("Manager", "Admin"), createTable);

router.get("/tables", checkRole("Waiter", "Cashier", "Manager", "Admin"), getTables);

router.get("/tables/floor-overview", checkRole("Waiter", "Cashier", "Manager", "Admin"), getFloorOverview);

router.put("/tables/:id", checkRole("Manager", "Admin"), updateTable);

router.put("/tables/:id/status", checkRole("Waiter", "Cashier", "Manager", "Admin"), updateTableStatus);

/*
=========================================
RESERVATIONS
=========================================
*/

router.post("/", checkRole("Waiter", "Cashier", "Manager", "Admin"), requireFeature("Reservations"), createReservation);

router.get("/available-tables", checkRole("Waiter", "Cashier", "Manager", "Admin"), requireFeature("Reservations"), getAvailableTables);

router.get("/today", checkRole("Waiter", "Cashier", "Manager", "Admin"), requireFeature("Reservations"), getTodaysReservations);

router.get("/", checkRole("Waiter", "Cashier", "Manager", "Admin"), requireFeature("Reservations"), getReservations);

// Confirm/Cancel are restricted to Manager and Admin only — Cashier and
// Waiter can view reservations but cannot make this call.
router.put("/:id/confirm", checkRole("Manager", "Admin"), requireFeature("Reservations"), confirmReservation);

router.put("/:id/seat", checkRole("Waiter", "Cashier", "Manager", "Admin"), requireFeature("Reservations"), seatReservation);

router.put("/:id/complete", checkRole("Waiter", "Cashier", "Manager", "Admin"), requireFeature("Reservations"), completeReservation);

router.put("/:id/cancel", checkRole("Manager", "Admin"), requireFeature("Reservations"), cancelReservation);

router.put("/:id/no-show", checkRole("Cashier", "Manager", "Admin"), requireFeature("Reservations"), markNoShow);

router.put("/:id/reschedule", checkRole("Cashier", "Manager", "Admin"), requireFeature("Reservations"), rescheduleReservation);

export default router;