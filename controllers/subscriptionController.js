import SubscriptionPlan from "../models/SubscriptionPlan.js";
import RestaurantSubscription from "../models/RestaurantSubscription.js";
import Restaurant from "../models/Restaurant.js";

import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
CREATE SUBSCRIPTION PLAN
POST /api/super-admin/plans
=========================================================
*/

export const createPlan = async (req, res, next) => {

    try {

        const {
            plan_name, billing_cycle, price,
            max_branches, max_staff_accounts, features_included
        } = req.body;

        if (!plan_name || !billing_cycle || price === undefined) {
            throw new Error("Plan name, billing cycle, and price are required.");
        }

        const plan = await SubscriptionPlan.create({
            plan_name: plan_name.trim(),
            billing_cycle,
            price,
            max_branches: max_branches || 1,
            max_staff_accounts: max_staff_accounts || 10,
            features_included: features_included || []
        });

        sendResponse(res, 201, true, "Subscription plan created successfully.", plan);

    } catch (error) { next(error) }

};

/*
=========================================================
LIST PLANS
GET /api/super-admin/plans
=========================================================
*/

export const getPlans = async (req, res, next) => {

    try {

        const plans = await SubscriptionPlan.find({ is_active: true })
            .sort({ price: 1 });
        sendResponse(res, 200, true, "Plans fetched successfully.", plans);

    } catch (error) { next(error) }

};

/*
=========================================================
LIST ALL PLANS — ADMIN VIEW (includes inactive, with subscriber counts)
GET /api/super-admin/plans/all
=========================================================
*/

export const getAllPlansAdmin = async (req, res, next) => {

    try {

        const plans = await SubscriptionPlan.find().sort({ price: 1 });

        const counts = await RestaurantSubscription.aggregate([

            { $match: { status: { $ne: "Cancelled" } } },

            {
                $group: {
                    _id: "$plan_id",
                    subscriber_count: { $sum: 1 }
                }
            }

        ]);

        const countMap = {};

        for (const c of counts) {
            countMap[c._id.toString()] = c.subscriber_count;
        }

        const enriched = plans.map((p) => ({
            ...p.toObject(),
            subscriber_count: countMap[p._id.toString()] || 0
        }));

        sendResponse(res, 200, true, "Plans fetched successfully.", enriched);

    } catch (error) { next(error) }

};

/*
=========================================================
GET SINGLE PLAN BY ID
GET /api/super-admin/plans/:id
=========================================================
*/

export const getPlanById = async (req, res, next) => {

    try {

        const { id } = req.params;
        const plan = await SubscriptionPlan.findById(id);

        if (!plan) {
            throw new Error("Subscription plan not found.");
        }

        sendResponse(res, 200, true, "Plan fetched successfully.", plan);

    } catch (error) { next(error) }

};

/*
=========================================================
UPDATE PLAN
PUT /api/super-admin/plans/:id
=========================================================
*/

export const updatePlan = async (req, res, next) => {

    try {

        const { id } = req.params;

        const {
            plan_name, billing_cycle, price,
            max_branches, max_staff_accounts, features_included
        } = req.body;

        const plan = await SubscriptionPlan.findById(id);

        if (!plan) {
            throw new Error("Subscription plan not found.");
        }

        if (plan_name !== undefined) plan.plan_name = plan_name.trim();
        if (billing_cycle !== undefined) plan.billing_cycle = billing_cycle;
        if (price !== undefined) plan.price = price;
        if (max_branches !== undefined) plan.max_branches = max_branches;
        if (max_staff_accounts !== undefined) plan.max_staff_accounts = max_staff_accounts;
        if (features_included !== undefined) plan.features_included = features_included;

        await plan.save();

        sendResponse(res, 200, true, "Plan updated successfully.", plan);

    } catch (error) { next(error) }

};

/*
=========================================================
TOGGLE PLAN ACTIVE / INACTIVE
PUT /api/super-admin/plans/:id/toggle
=========================================================
*/

export const togglePlanStatus = async (req, res, next) => {

    try {

        const { id } = req.params;
        const plan = await SubscriptionPlan.findById(id);

        if (!plan) {
            throw new Error("Subscription plan not found.");
        }

        plan.is_active = !plan.is_active;

        await plan.save();

        sendResponse(res, 200, true, `Plan ${plan.is_active ? "activated" : "deactivated"} successfully.`, plan);

    } catch (error) { next(error) }

};

/*
=========================================================
ASSIGN / CHANGE A RESTAURANT'S PLAN
PUT /api/super-admin/restaurants/:id/subscription
=========================================================
*/

export const assignSubscription = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { plan_id, current_period_end } = req.body;

        if (!plan_id || !current_period_end) {
            throw new Error("Plan ID and period end date are required.");
        }

        const restaurant = await Restaurant.findById(id);

        if (!restaurant) {
            throw new Error("Restaurant not found.");
        }

        const plan = await SubscriptionPlan.findById(plan_id);

        if (!plan) {
            throw new Error("Subscription plan not found.");
        }

        const subscription = await RestaurantSubscription.findOneAndUpdate(

            { restaurant_id: id },

            {
                $set: {
                    plan_id,
                    status: "Active",
                    current_period_start: new Date(),
                    current_period_end: new Date(current_period_end)
                }
            },

            { upsert: true, new: true, setDefaultsOnInsert: true }

        ).populate("plan_id");

        sendResponse(res, 200, true, "Subscription updated successfully.", subscription);

    } catch (error) { next(error) }

};

/*
=========================================================
SUBSCRIPTIONS EXPIRING SOON (renewal follow-ups)
GET /api/super-admin/subscriptions/expiring?days=7
=========================================================
*/

export const getExpiringSubscriptions = async (req, res, next) => {

    try {

        const days = Number(req.query.days) || 7;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + days);

        const expiring = await RestaurantSubscription.find({
            status: "Active",
            current_period_end: { $lte: cutoff, $gte: new Date() }
        })
            .populate("restaurant_id", "restaurant_name email phone")
            .populate("plan_id", "plan_name price")
            .sort({ current_period_end: 1 });

        sendResponse(res, 200, true, "Expiring subscriptions fetched successfully.", expiring);

    } catch (error) { next(error) }

};