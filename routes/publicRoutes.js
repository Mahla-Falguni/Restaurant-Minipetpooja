import express from "express";

import { getRestaurantByTable, getPublicMenu } from "../controllers/menuController.js";
import { getPublicRestaurants, getPublicRestaurantTables, createPublicReservation } from "../controllers/publicController.js";

const router = express.Router();

/*
===================================
CUSTOMER QR ROUTES
===================================
*/

router.get("/table/:tableCode", getRestaurantByTable);
router.get("/menu/:restaurantId", getPublicMenu);

/*
===================================
PUBLIC RESTAURANT & RESERVATION ROUTES
===================================
*/
router.get("/restaurants", getPublicRestaurants);
router.get("/restaurants/:id/tables", getPublicRestaurantTables);
router.post("/reservations", createPublicReservation);

export default router;