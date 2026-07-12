import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import LoyaltyTransaction from "../models/LoyaltyTransaction.js";
import Order from "../models/Order.js";

import sendResponse from "../utils/sendResponse.js";
import { calculateEarnedPoints } from "../utils/membershipTiers.js";

/*
=========================================================
EARN POINTS (called after payment completion)
POST /api/customer/loyalty/earn
=========================================================
*/

export const earnLoyaltyPoints = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { customer_id, order_id } = req.body;

        if (!customer_id || !order_id) {
            throw new Error("Customer ID and Order ID are required.");
        }

        const customer = await Customer.findById(customer_id).session(session);

        if (!customer) throw new Error("Customer not found.");

        const order = await Order.findById(order_id).session(session);

        if (!order) throw new Error("Order not found.");

        if (order.payment_status !== "Paid") {
            throw new Error("Points can only be earned on fully paid orders.");
        }

        const alreadyEarned = await LoyaltyTransaction.findOne({
            order_id: order._id,
            type: "Earned"
        }).session(session);

        if (alreadyEarned) {
            throw new Error("Points have already been credited for this order.");
        }

        const points = calculateEarnedPoints(order.grand_total, customer.membership_tier);

        customer.loyalty_points += points;

        await customer.save({ session });

        const transaction = await LoyaltyTransaction.create(

            [{
                restaurant_id: order.restaurant_id,
                customer_id: customer._id,
                order_id: order._id,
                type: "Earned",
                points,
                balance_after: customer.loyalty_points,
                remarks: `Earned on order #${order.order_number}`,
                created_by: req.user?.id || null
            }],

            { session }

        );

        await session.commitTransaction();
        session.endSession();

        sendResponse(res, 200, true, `${points} points credited.`, {
            customer,
            transaction: transaction[0]
        });

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        next(error);

    }

};

/*
=========================================================
REDEEM POINTS
POST /api/customer/loyalty/redeem
=========================================================
*/

export const redeemLoyaltyPoints = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { customer_id, points, order_id, remarks } = req.body;

        if (!customer_id) throw new Error("Customer ID is required.");

        if (!points || points <= 0) {
            throw new Error("Points to redeem must be greater than zero.");
        }

        const customer = await Customer.findById(customer_id).session(session);

        if (!customer) throw new Error("Customer not found.");

        if (customer.loyalty_points < points) {
            throw new Error(
                `Insufficient points. Available: ${customer.loyalty_points}, requested: ${points}.`
            );
        }

        customer.loyalty_points -= points;

        await customer.save({ session });

        const transaction = await LoyaltyTransaction.create(

            [{
                restaurant_id: customer.restaurant_id,
                customer_id: customer._id,
                order_id: order_id || null,
                type: "Redeemed",
                points: -Math.abs(points),
                balance_after: customer.loyalty_points,
                remarks: remarks || "Points redeemed against bill",
                created_by: req.user.id
            }],

            { session }

        );

        await session.commitTransaction();
        session.endSession();

        // 1 point = ₹1 discount — expose this so the cashier can
        // apply it as `additional_discount` in checkoutOrder()

        const discountValue = points;

        sendResponse(res, 200, true, `${points} points redeemed.`, {
            customer,
            transaction: transaction[0],
            discount_value: discountValue
        });

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        next(error);

    }

};

/*
=========================================================
MANUAL ADJUSTMENT (Manager/Admin only)
POST /api/customer/loyalty/adjust
=========================================================
*/

export const adjustLoyaltyPoints = async (req, res, next) => {

    try {

        const { customer_id, points, remarks } = req.body;

        if (!customer_id || points === undefined || points === 0) {
            throw new Error("Customer ID and a non-zero points value are required.");
        }

        if (!remarks || !remarks.trim()) {
            throw new Error("A remark is required for manual adjustments.");
        }

        const customer = await Customer.findById(customer_id);

        if (!customer) throw new Error("Customer not found.");

        const newBalance = customer.loyalty_points + Number(points);

        if (newBalance < 0) {
            throw new Error("Adjustment would result in a negative point balance.");
        }

        customer.loyalty_points = newBalance;

        await customer.save();

        const transaction = await LoyaltyTransaction.create({
            restaurant_id: customer.restaurant_id,
            customer_id: customer._id,
            type: "Adjusted",
            points: Number(points),
            balance_after: customer.loyalty_points,
            remarks,
            created_by: req.user.id
        });

        sendResponse(res, 200, true, "Loyalty points adjusted successfully.", {
            customer,
            transaction
        });

    } catch (error) { next(error); }

};

/*
=========================================================
GRANT BIRTHDAY BONUS
POST /api/customer/loyalty/birthday-bonus/:customer_id
=========================================================
*/

export const grantBirthdayBonus = async (req, res, next) => {

    try {

        const { customer_id } = req.params;
        const BONUS_POINTS = 100;
        const customer = await Customer.findById(customer_id);

        if (!customer) throw new Error("Customer not found.");

        const currentYear = new Date().getFullYear();

        if (customer.last_birthday_reward_year === currentYear) {
            throw new Error("Birthday bonus has already been granted this year.");
        }

        customer.loyalty_points += BONUS_POINTS;
        customer.last_birthday_reward_year = currentYear;

        await customer.save();

        const transaction = await LoyaltyTransaction.create({

            restaurant_id: customer.restaurant_id,
            customer_id: customer._id,
            type: "Birthday Bonus",
            points: BONUS_POINTS,
            balance_after: customer.loyalty_points,
            remarks: `Birthday bonus for ${currentYear}`,
            created_by: req.user.id
        });

        sendResponse(res, 200, true, `Birthday bonus of ${BONUS_POINTS} points granted.`, {
            customer,
            transaction
        });

    } catch (error) { next(error); }

};

/*
=========================================================
CUSTOMER ANALYTICS
GET /api/customer/analytics
=========================================================
*/

export const getCustomerAnalytics = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;
        const restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);

        const totalCustomers = await Customer.countDocuments({
            restaurant_id: restaurantId,
            is_active: true
        });

        const tierBreakdown = await Customer.aggregate([

            { $match: { restaurant_id: restaurantObjectId, is_active: true } },

            {
                $group: {
                    _id: "$membership_tier",
                    count: { $sum: 1 },
                    total_spent: { $sum: "$total_spent" }
                }
            },

            { $sort: { total_spent: -1 } }

        ]);

        const topCustomers = await Customer.find({
            restaurant_id: restaurantId,
            is_active: true
        })

            .sort({ total_spent: -1 })
            .limit(10)
            .select("name phone total_spent total_orders membership_tier");

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const newCustomersLast30Days = await Customer.countDocuments({
            restaurant_id: restaurantId,
            createdAt: { $gte: thirtyDaysAgo }
        });

        const repeatCustomers = await Customer.countDocuments({
            restaurant_id: restaurantId,
            total_orders: { $gt: 1 }
        });

        sendResponse(res, 200, true, "Customer analytics fetched successfully.", {
            total_customers: totalCustomers,
            tier_breakdown: tierBreakdown,
            top_customers: topCustomers,
            new_customers_last_30_days: newCustomersLast30Days,
            repeat_customers: repeatCustomers,
            repeat_rate: totalCustomers > 0
                ? Number(((repeatCustomers / totalCustomers) * 100).toFixed(1))
                : 0
        });

    } catch (error) { next(error); }

};