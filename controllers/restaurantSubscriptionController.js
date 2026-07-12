import crypto from "crypto";

import SubscriptionPlan from "../models/SubscriptionPlan.js";
import RestaurantSubscription from "../models/RestaurantSubscription.js";
import PaymentTransaction from "../models/PaymentTransaction.js";

import razorpayInstance from "../utils/razorpayInstance.js";
import activateSubscriptionFromPayment from "../utils/activateSubscriptionFromPayment.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
LIST AVAILABLE PLANS (restaurant-facing, self-service)
GET /api/restaurants/plans
=========================================================
*/

export const getAvailablePlans = async (req, res, next) => {

    try {

        const plans = await SubscriptionPlan.find({ is_active: true })
            .sort({ price: 1 });

        sendResponse(res, 200, true, "Plans fetched successfully.", plans);

    } catch (error) { next(error) }

};

/*
=========================================================
GET MY RESTAURANT'S CURRENT SUBSCRIPTION
GET /api/restaurants/subscription
=========================================================
*/

export const getMySubscription = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;

        if (!restaurantId) {
            throw new Error("No restaurant is linked to this account.");
        }

        const subscription = await RestaurantSubscription.findOne({
            restaurant_id: restaurantId
        }).populate("plan_id");

        sendResponse(res, 200, true, "Subscription fetched successfully.", subscription);

    } catch (error) { next(error) }

};

/*
=========================================================
GET MY RESTAURANT'S PLAN FEATURES (any authenticated staff role)
GET /api/restaurants/subscription/features

Lighter than getMySubscription (which is Admin-only and returns
billing details) — this just returns the feature list so any
logged-in staff member's UI can gate itself, regardless of role.
=========================================================
*/

const isSubscriptionUsable = (subscription) => {

    if (!subscription) return false;

    if (!["Active", "Trial"].includes(subscription.status)) return false;

    if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
        return false;
    }

    return true;

};

export const getMyPlanFeatures = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;

        if (!restaurantId) {

            return sendResponse(res, 200, true, "No restaurant linked to this account.", {
                plan_name: null,
                features_included: [],
                status: "None",
                current_period_end: null
            });

        }

        const subscription = await RestaurantSubscription.findOne({
            restaurant_id: restaurantId
        }).populate("plan_id");

        const usable = isSubscriptionUsable(subscription) && subscription.plan_id;

        sendResponse(res, 200, true, "Plan features fetched successfully.", {
            plan_name: subscription?.plan_id?.plan_name || null,
            features_included: usable ? (subscription.plan_id.features_included || []) : [],
            status: subscription?.status || "None",
            current_period_end: subscription?.current_period_end || null
        });

    } catch (error) { next(error) }

};

/*
=========================================================
SUBSCRIBE TO A PLAN (self-service, first time or upgrade/downgrade)
POST /api/restaurants/subscription/subscribe
=========================================================
*/

export const subscribeToPlan = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;
        const { plan_id } = req.body;

        if (!restaurantId) {
            throw new Error("No restaurant is linked to this account.");
        }

        if (!plan_id) {
            throw new Error("A plan is required to subscribe.");
        }

        const plan = await SubscriptionPlan.findById(plan_id);

        if (!plan || !plan.is_active) {
            throw new Error("Selected plan is not available.");
        }

        if (plan.price > 0) {
            throw new Error("This plan requires payment. Use the checkout flow instead of direct subscribe.");
        }

        const periodStart = new Date();
        const periodEnd = new Date(periodStart);

        if (plan.billing_cycle === "Yearly") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        const subscription = await RestaurantSubscription.findOneAndUpdate(

            { restaurant_id: restaurantId },

            {
                $set: {
                    plan_id,
                    status: "Active",
                    current_period_start: periodStart,
                    current_period_end: periodEnd,
                    auto_renew: true,
                    last_payment_amount: plan.price,
                    last_payment_at: periodStart,
                    suspended_reason: ""
                }
            },

            { upsert: true, new: true, setDefaultsOnInsert: true }

        ).populate("plan_id");

        sendResponse(res, 200, true, "Subscribed successfully.", subscription);

    } catch (error) { next(error) }

};

/*
=========================================================
CREATE RAZORPAY ORDER FOR A PAID PLAN
POST /api/restaurants/subscription/create-order
=========================================================
*/

export const createSubscriptionOrder = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;
        const { plan_id } = req.body;

        if (!restaurantId) {
            throw new Error("No restaurant is linked to this account.");
        }

        if (!plan_id) {
            throw new Error("A plan is required.");
        }

        const plan = await SubscriptionPlan.findById(plan_id);

        if (!plan || !plan.is_active) {
            throw new Error("Selected plan is not available.");
        }

        if (plan.price <= 0) {
            throw new Error("This plan is free — use the direct subscribe endpoint instead.");
        }

        // Razorpay wants the amount in the smallest currency unit (paise for INR)
        const amountInPaise = Math.round(plan.price * 100);

        const razorpayOrder = await razorpayInstance.orders.create({

            amount: amountInPaise,

            currency: "INR",

            receipt: `s_${restaurantId.toString().slice(-10)}_${Date.now().toString(36)}`,

            notes: {
                restaurant_id: restaurantId.toString(),
                plan_id: plan._id.toString(),
                plan_name: plan.plan_name
            }

        });

        await PaymentTransaction.create({

            restaurant_id: restaurantId,

            plan_id: plan._id,

            razorpay_order_id: razorpayOrder.id,

            amount: plan.price,

            currency: "INR",

            status: "Created"

        });

        sendResponse(res, 200, true, "Order created successfully.", {

            order_id: razorpayOrder.id,

            amount: razorpayOrder.amount,

            currency: razorpayOrder.currency,

            key_id: process.env.RAZORPAY_KEY_ID,

            plan: {
                id: plan._id,
                name: plan.plan_name,
                billing_cycle: plan.billing_cycle
            }

        });

    } catch (error) {

        next(error);

    }

};

/*
=========================================================
VERIFY PAYMENT & ACTIVATE SUBSCRIPTION
POST /api/restaurants/subscription/verify-payment
body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

Razorpay's checkout flow hands these three values back to the
frontend after a successful payment. We recompute the HMAC
signature server-side — this is the step that actually proves
the payment is genuine and wasn't spoofed from the browser.
=========================================================
*/

export const verifySubscriptionPayment = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            throw new Error("Incomplete payment details received.");
        }

        const transaction = await PaymentTransaction.findOne({
            razorpay_order_id,
            restaurant_id: restaurantId
        });

        if (!transaction) {
            throw new Error("No matching order found for this payment.");
        }

        // Recompute the expected signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
        const expectedSignature = crypto

            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)

            .update(`${razorpay_order_id}|${razorpay_payment_id}`)

            .digest("hex");

        if (expectedSignature !== razorpay_signature) {

            transaction.status = "Failed";
            transaction.failure_reason = "Signature mismatch";
            await transaction.save();

            throw new Error("Payment verification failed. If money was deducted, it will be auto-refunded.");

        }

        transaction.razorpay_payment_id = razorpay_payment_id;
        transaction.razorpay_signature = razorpay_signature;
        transaction.status = "Paid";
        await transaction.save();

        const subscription = await activateSubscriptionFromPayment(transaction);

        sendResponse(res, 200, true, "Payment verified. Subscription activated.", subscription);

    } catch (error) {

        next(error);

    }

};

/*
=========================================================
PAYMENT HISTORY (restaurant-facing)
GET /api/restaurants/subscription/payments
=========================================================
*/

export const getPaymentHistory = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;

        if (!restaurantId) {
            throw new Error("No restaurant is linked to this account.");
        }

        const payments = await PaymentTransaction.find({
            restaurant_id: restaurantId,
            status: "Paid"
        })
            .populate("plan_id", "plan_name billing_cycle")
            .sort({ createdAt: -1 });

        sendResponse(res, 200, true, "Payment history fetched successfully.", payments);

    } catch (error) {

        next(error);

    }

};

/*
=========================================================
CANCEL SUBSCRIPTION
PUT /api/restaurants/subscription/cancel
=========================================================
*/

export const cancelSubscription = async (req, res, next) => {

    try {

        const restaurantId = req.user.restaurant_id;

        if (!restaurantId) {
            throw new Error("No restaurant is linked to this account.");
        }

        const subscription = await RestaurantSubscription.findOne({
            restaurant_id: restaurantId
        });

        if (!subscription) {
            throw new Error("No active subscription found.");
        }

        subscription.auto_renew = false;
        subscription.status = "Cancelled";

        await subscription.save();

        sendResponse(res, 200, true, "Subscription cancelled successfully.", subscription);

    } catch (error) { next(error) }

};