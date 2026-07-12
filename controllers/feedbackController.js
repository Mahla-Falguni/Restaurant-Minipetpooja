import Feedback from "../models/Feedback.js";
import Order from "../models/Order.js";

import sendResponse from "../utils/sendResponse.js";

/*
===================================
SUBMIT FEEDBACK 
POST /api/feedback
===================================
*/

export const submitFeedback = async (req, res, next) => {
    try {
        const { order_id, customer_name, rating, review } = req.body;

        if (!order_id || !rating) {
            return sendResponse(res, 400, false, "order_id and rating are required.");
        }

        const order = await Order.findById(order_id);
        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        // Prevent duplicate feedback for the same order
        const existing = await Feedback.findOne({ order_id });
        if (existing) {
            return sendResponse(res, 409, false, "Feedback already submitted for this order.");
        }

        const feedback = await Feedback.create({
            restaurant_id: order.restaurant_id,
            order_id,
            customer_name: customer_name || order.customer_name,
            rating,
            review,
        });

        sendResponse(res, 201, true, "Thank you for your feedback!", feedback);
    } catch (error) { next(error); }
};

/*
===================================
GET ALL FEEDBACK FOR LOGGED-IN RESTAURANT
GET /api/feedback
===================================
*/

export const getFeedbacks = async (req, res, next) => {
    try {
        const restaurant_id = req.user.restaurant_id || req.query.restaurant_id;

        const feedbacks = await Feedback.find({ restaurant_id })
            .populate("order_id", "order_number")
            .sort({ createdAt: -1 });

        sendResponse(res, 200, true, "Feedback fetched", feedbacks);
    } catch (error) {
        next(error);
    }
};

/*
===================================
GET SINGLE FEEDBACK BY ORDER ID
GET /api/feedback/order/:orderId
===================================
*/

export const getFeedbackByOrder = async (req, res, next) => {
    try {
        const feedback = await Feedback.findOne({ order_id: req.params.orderId });

        if (!feedback) {
            return sendResponse(res, 404, false, "No feedback found for this order.");
        }

        sendResponse(res, 200, true, "Feedback found", feedback);
    } catch (error) { next(error); }
};