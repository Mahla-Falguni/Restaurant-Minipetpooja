import mongoose from "mongoose";

import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import Table from "../models/Table.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Reservation from "../models/Reservation.js";
import CashDrawer from "../models/CashDrawer.js";
import Payment from "../models/Payment.js";
import WaiterAssignment from "../models/WaiterAssignment.js";
import Restaurant from "../models/Restaurant.js";
import LeaveRequest from "../models/LeaveRequest.js";

import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
Helper — today's date range (server-local midnight to midnight)
=========================================================
*/

const getTodayRange = () => {

    const from = new Date();
    from.setHours(0, 0, 0, 0);

    const to = new Date();
    to.setHours(23, 59, 59, 999);

    return { from, to };

};

/*
=========================================================
Helper — last N days range (inclusive of today), used for
the revenue trend sparkline on the management dashboard.
=========================================================
*/

const getLastNDaysRange = (days) => {

    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);

    return { from, to };

};

const ACTIVE_ORDER_STATUSES = ["Pending", "Accepted", "Preparing", "Ready", "Served"];

/*
=========================================================
MANAGEMENT DASHBOARD — Admin & Manager
Full business overview: today's KPIs, order pipeline,
7-day revenue trend, table/staff/customer snapshots,
recent orders, and top-selling items.
=========================================================
*/

const buildManagementDashboard = async (restaurantId) => {

    const { from: todayFrom, to: todayTo } = getTodayRange();
    const { from: trendFrom, to: trendTo } = getLastNDaysRange(7);

    const baseMatch = { restaurant_id: restaurantId };

    const [
        todaySummary,
        orderStatusBreakdown,
        revenueTrend,
        tableCounts,
        staffCounts,
        totalCustomers,
        newCustomersToday,
        reservationsToday,
        recentOrders,
        topItems,
        pendingLeaveRequests
    ] = await Promise.all([

        // Today's headline numbers
        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    createdAt: { $gte: todayFrom, $lte: todayTo },
                    order_status: { $nin: ["Cancelled", "Rejected"] }
                }
            },
            {
                $group: {
                    _id: null,
                    total_orders: { $sum: 1 },
                    gross_sales: { $sum: "$grand_total" },
                    average_order_value: { $avg: "$grand_total" }
                }
            }
        ]),

        // Live order pipeline (today, all statuses)
        Order.aggregate([
            { $match: { ...baseMatch, createdAt: { $gte: todayFrom, $lte: todayTo } } },
            { $group: { _id: "$order_status", count: { $sum: 1 } } }
        ]),

        // 7-day revenue trend
        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    createdAt: { $gte: trendFrom, $lte: trendTo },
                    order_status: { $nin: ["Cancelled", "Rejected"] }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    orders: { $sum: 1 },
                    sales: { $sum: "$grand_total" }
                }
            },
            { $sort: { _id: 1 } }
        ]),

        // Table snapshot
        Table.aggregate([
            { $match: baseMatch },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),

        // Staff snapshot
        User.aggregate([
            { $match: baseMatch },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),

        Customer.countDocuments(baseMatch),

        Customer.countDocuments({
            ...baseMatch,
            createdAt: { $gte: todayFrom, $lte: todayTo }
        }),

        Reservation.countDocuments({
            ...baseMatch,
            reservation_date: todayFrom.toISOString().split("T")[0]
        }),

        Order.find(baseMatch)
            .sort({ createdAt: -1 })
            .limit(6)
            .select("order_number customer_name grand_total order_status payment_status order_type createdAt"),

        OrderItem.aggregate([
            {
                $lookup: {
                    from: "orders",
                    localField: "order_id",
                    foreignField: "_id",
                    as: "order"
                }
            },
            { $unwind: "$order" },
            {
                $match: {
                    "order.restaurant_id": restaurantId,
                    "order.createdAt": { $gte: todayFrom, $lte: todayTo },
                    "order.order_status": { $nin: ["Cancelled", "Rejected"] }
                }
            },
            {
                $group: {
                    _id: "$item_name",
                    quantity: { $sum: "$quantity" },
                    revenue: { $sum: "$total_price" }
                }
            },
            { $sort: { quantity: -1 } },
            { $limit: 5 }
        ]),

        LeaveRequest.countDocuments({ ...baseMatch, status: "Pending" }).catch(() => 0)

    ]);

    const summary = todaySummary[0] || { total_orders: 0, gross_sales: 0, average_order_value: 0 };

    const tableStatusMap = tableCounts.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
    }, {});

    const totalTables = Object.values(tableStatusMap).reduce((a, b) => a + b, 0);

    const staffStatusMap = staffCounts.reduce((acc, row) => {
        acc[row._id ? "active" : "inactive"] = row.count;
        return acc;
    }, { active: 0, inactive: 0 });

    return {
        dashboard_type: "management",

        kpis: {
            today_orders: summary.total_orders,
            today_revenue: Number((summary.gross_sales || 0).toFixed(2)),
            average_order_value: Number((summary.average_order_value || 0).toFixed(2)),
            total_tables: totalTables,
            occupied_tables: tableStatusMap["Occupied"] || 0,
            available_tables: tableStatusMap["Available"] || 0,
            total_customers: totalCustomers,
            new_customers_today: newCustomersToday,
            reservations_today: reservationsToday,
            staff_active: staffStatusMap.active,
            staff_inactive: staffStatusMap.inactive,
            pending_leave_requests: pendingLeaveRequests || 0
        },

        order_status_breakdown: orderStatusBreakdown.map((row) => ({
            status: row._id,
            count: row.count
        })),

        revenue_trend: revenueTrend.map((row) => ({
            date: row._id,
            orders: row.orders,
            sales: Number(row.sales.toFixed(2))
        })),

        recent_orders: recentOrders,

        top_items: topItems.map((row) => ({
            name: row._id,
            quantity: row.quantity,
            revenue: Number(row.revenue.toFixed(2))
        }))
    };

};

/*
=========================================================
CASHIER DASHBOARD
Today's collections, active drawer status, payment-mode
split, and the latest bills.
=========================================================
*/

const buildCashierDashboard = async (restaurantId, userId) => {

    const { from: todayFrom, to: todayTo } = getTodayRange();
    const baseMatch = { restaurant_id: restaurantId };

    const [
        activeDrawer,
        paymentBreakdown,
        todayOrders,
        pendingPayments,
        recentOrders
    ] = await Promise.all([

        CashDrawer.findOne({
            restaurant_id: restaurantId,
            cashier_id: userId,
            status: "Open"
        }).sort({ opened_at: -1 }),

        Payment.aggregate([
            {
                $match: {
                    ...baseMatch,
                    createdAt: { $gte: todayFrom, $lte: todayTo },
                    payment_status: "Paid"
                }
            },
            { $group: { _id: "$payment_method", amount: { $sum: "$amount" } } }
        ]),

        Order.countDocuments({
            ...baseMatch,
            createdAt: { $gte: todayFrom, $lte: todayTo },
            payment_status: "Paid"
        }),

        Order.countDocuments({
            ...baseMatch,
            payment_status: "Pending",
            order_status: { $nin: ["Cancelled", "Rejected"] }
        }),

        Order.find(baseMatch)
            .sort({ createdAt: -1 })
            .limit(6)
            .select("order_number customer_name grand_total payment_status payment_method order_type createdAt")

    ]);

    const todayCollections = paymentBreakdown.reduce((sum, row) => sum + row.amount, 0);

    return {
        dashboard_type: "cashier",

        kpis: {
            today_collections: Number(todayCollections.toFixed(2)),
            today_orders_billed: todayOrders,
            pending_payments: pendingPayments,
            drawer_status: activeDrawer ? "Open" : "Closed"
        },

        active_drawer: activeDrawer ? {
            opening_balance: activeDrawer.opening_balance,
            cash_received: activeDrawer.cash_received,
            upi_received: activeDrawer.upi_received,
            card_received: activeDrawer.card_received,
            online_received: activeDrawer.online_received,
            opened_at: activeDrawer.opened_at
        } : null,

        payment_breakdown: paymentBreakdown.map((row) => ({
            method: row._id,
            amount: Number(row.amount.toFixed(2))
        })),

        recent_orders: recentOrders
    };

};

/*
=========================================================
WAITER DASHBOARD
Assigned tables, active orders on the floor, and orders
that are ready and waiting to be served.
=========================================================
*/

const buildWaiterDashboard = async (restaurantId, userId) => {

    const [
        myAssignments,
        activeOrdersCount,
        readyToServeCount,
        myRecentOrders
    ] = await Promise.all([

        WaiterAssignment.find({
            restaurant_id: restaurantId,
            waiter_id: userId,
            is_active: true
        }).populate("table_id", "table_number zone status seating_capacity"),

        Order.countDocuments({
            restaurant_id: restaurantId,
            served_by: userId,
            order_status: { $in: ACTIVE_ORDER_STATUSES }
        }),

        Order.countDocuments({
            restaurant_id: restaurantId,
            served_by: userId,
            order_status: "Ready"
        }),

        Order.find({ restaurant_id: restaurantId, served_by: userId })
            .sort({ createdAt: -1 })
            .limit(6)
            .select("order_number customer_name table_id grand_total order_status createdAt")
            .populate("table_id", "table_number")

    ]);

    const myTables = myAssignments
        .filter((a) => a.table_id)
        .map((a) => ({
            table_number: a.table_id.table_number,
            zone: a.table_id.zone,
            status: a.table_id.status,
            seating_capacity: a.table_id.seating_capacity
        }));

    return {
        dashboard_type: "waiter",

        kpis: {
            assigned_tables: myTables.length,
            active_orders: activeOrdersCount,
            ready_to_serve: readyToServeCount,
            tables_needing_attention: myTables.filter((t) => t.status === "Occupied").length
        },

        my_tables: myTables,

        recent_orders: myRecentOrders
    };

};

/*
=========================================================
KITCHEN DASHBOARD
Live order queue counts by prep stage, plus the oldest
tickets still waiting so the kitchen can prioritise.
=========================================================
*/

const buildKitchenDashboard = async (restaurantId) => {

    const { from: todayFrom, to: todayTo } = getTodayRange();
    const baseMatch = { restaurant_id: restaurantId };

    const [
        statusCounts,
        completedToday,
        queue
    ] = await Promise.all([

        Order.aggregate([
            {
                $match: {
                    ...baseMatch,
                    order_status: { $in: ["Pending", "Accepted", "Preparing", "Ready"] }
                }
            },
            { $group: { _id: "$order_status", count: { $sum: 1 } } }
        ]),

        Order.countDocuments({
            ...baseMatch,
            order_status: { $in: ["Served", "Completed"] },
            updatedAt: { $gte: todayFrom, $lte: todayTo }
        }),

        Order.find({
            ...baseMatch,
            order_status: { $in: ["Pending", "Accepted", "Preparing"] }
        })
            .sort({ createdAt: 1 })
            .limit(8)
            .select("order_number order_type order_status total_items estimated_time createdAt")

    ]);

    const statusMap = statusCounts.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
    }, {});

    return {
        dashboard_type: "kitchen",

        kpis: {
            pending: statusMap["Pending"] || 0,
            accepted: statusMap["Accepted"] || 0,
            preparing: statusMap["Preparing"] || 0,
            ready: statusMap["Ready"] || 0,
            completed_today: completedToday
        },

        queue
    };

};

/*
=========================================================
GET /api/dashboard/overview
Returns a payload shaped for whichever role is logged in.
Every role hits the same endpoint — the frontend renders
a different view based on `dashboard_type`.
=========================================================
*/

export const getDashboardOverview = async (req, res, next) => {

    try {

        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);
        const userId = req.user._id;
        const restaurant = await Restaurant.findById(restaurantId).select("restaurant_name");

        let payload;

        switch (req.user.role) {

            case "Admin":
            case "Manager":
                payload = await buildManagementDashboard(restaurantId);
                break;

            case "Cashier":
                payload = await buildCashierDashboard(restaurantId, userId);
                break;

            case "Waiter":
                payload = await buildWaiterDashboard(restaurantId, userId);
                break;

            case "Kitchen":
                payload = await buildKitchenDashboard(restaurantId);
                break;

            default:
                payload = { dashboard_type: "generic", kpis: {} };

        }

        payload.role = req.user.role;
        payload.restaurant_name = restaurant?.restaurant_name || "";
        payload.generated_at = new Date();

        sendResponse(res, 200, true, "Dashboard data fetched successfully.", payload);

    } catch (error) { next(error); }

};