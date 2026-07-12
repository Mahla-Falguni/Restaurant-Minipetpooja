import express from "express";

import razorpayWebhookHandler from "../controllers/razorpayWebhookController.js";

const router = express.Router();

// http://localhost:5000/api/webhooks/razorpay
// No authMiddleware — Razorpay's server calls this directly, it can't send our JWT.
router.post("/razorpay", razorpayWebhookHandler);

export default router;