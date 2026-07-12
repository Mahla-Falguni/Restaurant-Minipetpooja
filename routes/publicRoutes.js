import express from "express";

import { getRestaurantByTable } from "../controllers/menuController.js";

const router = express.Router();

/*
===================================
CUSTOMER QR ROUTES
===================================
*/

router.get("/table/:tableCode", getRestaurantByTable);

export default router;