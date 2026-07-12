import express from "express";

import { submitFeedback, getFeedbacks, getFeedbackByOrder, } from "../controllers/feedbackController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Public — customer submits feedback from QR menu after billing, no login needed
// http://localhost:5000/api/feedback
router.post("/", submitFeedback);

// Public — customer/staff can check if feedback already exists for an order
// http://localhost:5000/api/feedback/order/:orderId
router.get("/order/:orderId", getFeedbackByOrder);

// Private — restaurant dashboard views all feedback
// http://localhost:5000/api/feedback
router.get("/", authMiddleware, getFeedbacks);

export default router;
