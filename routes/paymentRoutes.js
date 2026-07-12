import express from "express";

import { createPayment, markPaymentPaid, getPayments } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create", createPayment);
router.patch("/paid/:id", markPaymentPaid);
router.get("/", getPayments);

export default router;