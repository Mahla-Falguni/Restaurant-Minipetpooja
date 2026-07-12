import Restaurant from "../models/Restaurant.js";
import RestaurantSubscription from "../models/RestaurantSubscription.js";
import User from "../models/User.js";

import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
PLATFORM-WIDE DASHBOARD
GET /api/super-admin/analytics/overview
=========================================================
*/

export const getPlatformOverview = async (req, res, next) => {

    try {

        const totalRestaurants = await Restaurant.countDocuments();
        const activeRestaurants = await Restaurant.countDocuments({ status: "Active" });
        const suspendedRestaurants = await Restaurant.countDocuments({ status: "Suspended" });
        const totalStaffAccounts = await User.countDocuments({ is_active: true });
        const subscriptionBreakdown = await RestaurantSubscription.aggregate([

            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }

        ]);

        const revenueByPlan = await RestaurantSubscription.aggregate([

            { $match: { status: "Active" } },

            {
                $lookup: {
                    from: "subscriptionplans",
                    localField: "plan_id",
                    foreignField: "_id",
                    as: "plan"
                }
            },

            { $unwind: "$plan" },

            {
                $group: {
                    _id: "$plan.plan_name",
                    total_mrr: { $sum: "$plan.price" },
                    subscriber_count: { $sum: 1 }
                }
            }

        ]);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const newRestaurantsLast30Days = await Restaurant.countDocuments({

            createdAt: { $gte: thirtyDaysAgo }

        });

        sendResponse(res, 200, true, "Platform overview fetched successfully.", {
            total_restaurants: totalRestaurants,
            active_restaurants: activeRestaurants,
            suspended_restaurants: suspendedRestaurants,
            total_staff_accounts: totalStaffAccounts,
            new_restaurants_last_30_days: newRestaurantsLast30Days,
            subscription_breakdown: subscriptionBreakdown,
            revenue_by_plan: revenueByPlan
        });

    } catch (error) { next(error); }

};