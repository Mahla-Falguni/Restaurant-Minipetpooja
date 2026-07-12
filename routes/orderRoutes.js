import express from "express";

import { createOrder, getOrders, getOrderById } from "../controllers/orderController.js";

import verifyJWT from "../middleware/verifyJWT.js";

const router = express.Router();

/*
=====================================
CUSTOMER ORDER API (public — QR menu flow)
=====================================
*/

router.post("/create", createOrder);

/*
=====================================
STAFF ORDER API (auth required)
=====================================
*/

router.get("/", verifyJWT, getOrders);

router.get("/:id", verifyJWT, getOrderById);

export default router;