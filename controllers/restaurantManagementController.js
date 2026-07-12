import mongoose from "mongoose";

import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import RestaurantSubscription from "../models/RestaurantSubscription.js";
import PlatformActivityLog from "../models/PlatformActivityLog.js";

import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
Helper — log a super admin action
=========================================================
*/

const logActivity = async (superAdminId, action, targetRestaurantId, details, req) => {

    try {

        await PlatformActivityLog.create({
            super_admin_id: superAdminId,
            action,
            target_restaurant_id: targetRestaurantId || null,
            details: details || "",
            ip_address: req.ip || ""
        });

    } catch (err) {
        console.error("Failed to log platform activity:", err.message);
    }

};

/*
=========================================================
LIST ALL RESTAURANTS ON THE PLATFORM
GET /api/super-admin/restaurants?status=Active&search=spice&page=1&limit=20
=========================================================
*/

export const getAllRestaurants = async (req, res, next) => {

    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (search) {

            filter.$or = [
                { restaurant_name: { $regex: search, $options: "i" } },
                { owner_name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [restaurants, total] = await Promise.all([
            Restaurant.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Restaurant.countDocuments(filter)
        ]);

        // Attach subscription info for each restaurant

        const restaurantIds = restaurants.map((r) => r._id);

        const subscriptions = await RestaurantSubscription.find({
            restaurant_id: { $in: restaurantIds }
        }).populate("plan_id", "plan_name price billing_cycle");

        const subMap = {};

        for (const sub of subscriptions) {
            subMap[sub.restaurant_id.toString()] = sub;
        }

        const enriched = restaurants.map((r) => ({
            ...r.toObject(),
            subscription: subMap[r._id.toString()] || null
        }));

        sendResponse(res, 200, true, "Restaurants fetched successfully.", {
            restaurants: enriched,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (error) { next(error) }

};

/*
=========================================================
GET SINGLE RESTAURANT DETAIL
GET /api/super-admin/restaurants/:id
=========================================================
*/

export const getRestaurantDetail = async (req, res, next) => {

    try {
        const { id } = req.params;
        const restaurant = await Restaurant.findById(id);

        if (!restaurant) {
            throw new Error("Restaurant not found.");
        }

        const subscription = await RestaurantSubscription.findOne({
            restaurant_id: id
        }).populate("plan_id");

        const staffCount = await User.countDocuments({
            restaurant_id: id,
            is_active: true
        });

        const adminUser = await User.findOne({
            restaurant_id: id,
            role: "Admin"
        }).select("name email phone");

        sendResponse(res, 200, true, "Restaurant detail fetched successfully.", {
            restaurant,
            subscription,
            staff_count: staffCount,
            primary_admin: adminUser
        });

    } catch (error) { next(error) }

};

/*
=========================================================
SUSPEND RESTAURANT ACCOUNT 
=========================================================
*/

export const suspendRestaurant = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            throw new Error("A reason is required to suspend a restaurant.");
        }

        const restaurant = await Restaurant.findById(id);

        if (!restaurant) {
            throw new Error("Restaurant not found.");
        }

        restaurant.status = "Suspended";

        await restaurant.save();

        await RestaurantSubscription.findOneAndUpdate(
            { restaurant_id: id },
            { $set: { status: "Suspended", suspended_reason: reason } }
        );

        await logActivity(
            req.superAdmin._id,
            "Suspended Restaurant",
            id, reason, req
        );

        sendResponse(res, 200, true, "Restaurant suspended successfully.", restaurant);

    } catch (error) { next(error) }

};

/*
=========================================================
REACTIVATE RESTAURANT ACCOUNT (same note as above)
PUT /api/super-admin/restaurants/:id/reactivate
=========================================================
*/

export const reactivateRestaurant = async (req, res, next) => {

    try {
        const { id } = req.params;
        const restaurant = await Restaurant.findById(id);

        if (!restaurant) {
            throw new Error("Restaurant not found.");
        }

        restaurant.status = "Active";

        await restaurant.save();

        await RestaurantSubscription.findOneAndUpdate(
            { restaurant_id: id },
            { $set: { status: "Active", suspended_reason: "" } }
        );

        await logActivity(
            req.superAdmin._id,
            "Reactivated Restaurant",
            id, "", req
        );

        sendResponse(res, 200, true, "Restaurant reactivated successfully.", restaurant);

    } catch (error) { next(error) }

};

/*
=========================================================
DEACTIVATE A STAFF ACCOUNT 
PUT /api/super-admin/restaurants/:restaurantId/staff/:staffId/deactivate
=========================================================
*/

export const deactivateStaffAccount = async (req, res, next) => {

    try {
        const { restaurantId, staffId } = req.params;
        const user = await User.findOne({
            _id: staffId,
            restaurant_id: restaurantId
        });

        if (!user) {
            throw new Error("Staff account not found.");
        }

        user.is_active = false;

        await user.save();

        await logActivity(
            req.superAdmin._id,
            "Deactivated Staff Account",
            restaurantId,
            `Deactivated user: ${user.name} (${user.email})`,
            req
        );

        sendResponse(res, 200, true, "Staff account deactivated successfully.", null);

    } catch (error) { next(error) }

};

/*
=========================================================
PLATFORM ACTIVITY LOG
GET /api/super-admin/activity-log?restaurant_id=...&page=1&limit=30
=========================================================
*/

export const getActivityLog = async (req, res, next) => {

    try {
        const { restaurant_id, page = 1, limit = 30 } = req.query;
        const filter = {};

        if (restaurant_id) filter.target_restaurant_id = restaurant_id;

        const skip = (Number(page) - 1) * Number(limit);

        const [logs, total] = await Promise.all([
            PlatformActivityLog.find(filter)
                .populate("super_admin_id", "name email")
                .populate("target_restaurant_id", "restaurant_name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            PlatformActivityLog.countDocuments(filter)
        ]);

        sendResponse(res, 200, true, "Activity log fetched successfully.", {
            logs,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });

    } catch (error) { next(error); }

};

/*
=========================================================
READ-ONLY DEEP-DIVE REPORT FOR ONE RESTAURANT
GET /api/super-admin/restaurants/:id/report?date_from=&date_to=
=========================================================
*/

export const getRestaurantReportSummary = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { date_from, date_to } = req.query;

        const restaurant = await Restaurant.findById(id);

        if (!restaurant) {
            throw new Error("Restaurant not found.");
        }

        const from = date_from ? new Date(date_from) : new Date(new Date().setDate(new Date().getDate() - 30));
        from.setHours(0, 0, 0, 0);

        const to = date_to ? new Date(date_to) : new Date();
        to.setHours(23, 59, 59, 999);

        const restaurantId = new mongoose.Types.ObjectId(id);

        const matchStage = {
            restaurant_id: restaurantId,
            createdAt: { $gte: from, $lte: to },
            order_status: { $nin: ["Cancelled", "Rejected"] }
        };

        const [summaryAgg] = await Order.aggregate([

            { $match: matchStage },

            {
                $group: {
                    _id: null,
                    total_orders: { $sum: 1 },
                    gross_sales: { $sum: "$grand_total" },
                    avg_order_value: { $avg: "$grand_total" }
                }
            }

        ]);

        const dailyTrend = await Order.aggregate([

            { $match: matchStage },

            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    orders: { $sum: 1 },
                    sales: { $sum: "$grand_total" }
                }
            },

            { $sort: { _id: 1 } }

        ]);

        const staffCount = await User.countDocuments({ restaurant_id: id, is_active: true });

        sendResponse(res, 200, true, "Restaurant report summary fetched successfully.", {

            restaurant: {
                id: restaurant._id,
                restaurant_name: restaurant.restaurant_name,
                status: restaurant.status
            },

            range: { from, to },
            summary: summaryAgg || { total_orders: 0, gross_sales: 0, avg_order_value: 0 },
            daily_trend: dailyTrend,
            staff_count: staffCount
        });

    } catch (error) { next(error) }

};