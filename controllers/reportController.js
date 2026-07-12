import mongoose from "mongoose";

import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import ReportExportLog from "../models/ReportExportLog.js";
import CashDrawer from "../models/CashDrawer.js";
import Refund from "../models/Refund.js";

import sendResponse from "../utils/sendResponse.js";
import { sendCSVResponse } from "../utils/csvExporter.js";

/*
=========================================================
Helper — build a date range filter from query params.
Defaults to "today" if nothing is provided.
=========================================================
*/

const buildDateRange = (date_from, date_to) => {

    const from = date_from ? new Date(date_from) : new Date();
    from.setHours(0, 0, 0, 0);

    const to = date_to ? new Date(date_to) : new Date();
    to.setHours(23, 59, 59, 999);

    return { from, to };

};

/*
=========================================================
PART 8.9A — SALES SUMMARY
GET /api/reports/sales-summary?date_from=2026-06-01&date_to=2026-06-30
=========================================================
*/

export const getSalesSummary = async (req, res, next) => {

    try {

        const { date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        const matchStage = {
            restaurant_id: restaurantId,
            createdAt: { $gte: from, $lte: to },
            order_status: { $nin: ["Cancelled", "Rejected"] }
        };

        const summary = await Order.aggregate([

            { $match: matchStage },

            {
                $group: {
                    _id: null,
                    total_orders: { $sum: 1 },
                    gross_sales: { $sum: "$grand_total" },
                    total_discount: { $sum: { $ifNull: ["$additional_discount", 0] } },
                    total_tax: { $sum: { $ifNull: ["$tax_amount", 0] } },
                    average_order_value: { $avg: "$grand_total" }
                }
            }

        ]);

        // Day-wise breakdown for trend charts

        const dailyTrend = await Order.aggregate([

            { $match: matchStage },

            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    orders: { $sum: 1 },
                    sales: { $sum: "$grand_total" }
                }
            },

            { $sort: { _id: 1 } }

        ]);

        // Order-type breakdown (Dine-in / Takeaway / Delivery — adjust enum to match your Order model)

        const orderTypeBreakdown = await Order.aggregate([

            { $match: matchStage },

            {
                $group: {
                    _id: "$order_type",
                    count: { $sum: 1 },
                    sales: { $sum: "$grand_total" }
                }
            }

        ]);

        const result = summary[0] || {
            total_orders: 0,
            gross_sales: 0,
            total_discount: 0,
            total_tax: 0,
            average_order_value: 0
        };

        sendResponse(res, 200, true, "Sales summary fetched successfully.", {
            date_from: from,
            date_to: to,
            summary: {
                total_orders: result.total_orders,
                gross_sales: Number(result.gross_sales.toFixed(2)),
                total_discount: Number(result.total_discount.toFixed(2)),
                total_tax: Number(result.total_tax.toFixed(2)),
                net_sales: Number((result.gross_sales - result.total_discount).toFixed(2)),
                average_order_value: Number((result.average_order_value || 0).toFixed(2))
            },

            daily_trend: dailyTrend,
            order_type_breakdown: orderTypeBreakdown

        });

    } catch (error) { next(error); }

};

/*
=========================================================
GST / TAX REPORT
GET /api/reports/gst?date_from=...&date_to=...
=========================================================
*/

export const getGSTReport = async (req, res, next) => {

    try {

        const { date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        const orders = await Order.find({
            restaurant_id: restaurantId,
            createdAt: { $gte: from, $lte: to },
            order_status: { $nin: ["Cancelled", "Rejected"] }
        }).select(
            "order_number createdAt subtotal cgst_amount sgst_amount tax_amount grand_total"
        );

        const rows = orders.map((o) => ({
            order_number: o.order_number,
            date: o.createdAt.toISOString().split("T")[0],
            taxable_amount: o.subtotal || 0,
            cgst: o.cgst_amount || 0,
            sgst: o.sgst_amount || 0,
            total_tax: o.tax_amount || ((o.cgst_amount || 0) + (o.sgst_amount || 0)),
            grand_total: o.grand_total
        }));

        const totals = rows.reduce(
            (acc, row) => {
                acc.taxable_amount += row.taxable_amount;
                acc.cgst += row.cgst;
                acc.sgst += row.sgst;
                acc.total_tax += row.total_tax;
                acc.grand_total += row.grand_total;
                return acc;
            },
            { taxable_amount: 0, cgst: 0, sgst: 0, total_tax: 0, grand_total: 0 }
        );

        sendResponse(res, 200, true, "GST report fetched successfully.", {
            date_from: from,
            date_to: to,
            rows,
            totals
        });

    } catch (error) { next(error); }

};

/*
=========================================================
ITEM-WISE SALES REPORT
GET /api/reports/item-wise?date_from=...&date_to=...
=========================================================
*/

export const getItemWiseSales = async (req, res, next) => {

    try {

        const { date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        const itemWise = await Order.aggregate([

            {
                $match: {
                    restaurant_id: restaurantId,
                    createdAt: { $gte: from, $lte: to },
                    order_status: { $nin: ["Cancelled", "Rejected"] }
                }
            },

            { $unwind: "$items" },

            {
                $group: {
                    _id: "$items.item_name",
                    quantity_sold: { $sum: "$items.quantity" },
                    total_revenue: {
                        $sum: { $multiply: ["$items.quantity", "$items.price"] }
                    }
                }
            },

            { $sort: { total_revenue: -1 } }

        ]);

        sendResponse(res, 200, true, "Item-wise sales report fetched successfully.", {
            date_from: from,
            date_to: to,
            items: itemWise
        });

    } catch (error) { next(error) }

};

/*
=========================================================CATEGORY-WISE SALES REPORT
GET /api/reports/category-wise?date_from=...&date_to=...
=========================================================
*/

export const getCategoryWiseSales = async (req, res, next) => {

    try {

        const { date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        const categoryWise = await Order.aggregate([

            {
                $match: {
                    restaurant_id: restaurantId,
                    createdAt: { $gte: from, $lte: to },
                    order_status: { $nin: ["Cancelled", "Rejected"] }
                }
            },

            { $unwind: "$items" },

            {
                $group: {
                    _id: "$items.category",
                    quantity_sold: { $sum: "$items.quantity" },
                    total_revenue: {
                        $sum: { $multiply: ["$items.quantity", "$items.price"] }
                    }
                }
            },

            { $sort: { total_revenue: -1 } }

        ]);

        sendResponse(res, 200, true, "Category-wise sales report fetched successfully.", {
            date_from: from,
            date_to: to,
            categories: categoryWise
        });

    } catch (error) { next(error); }

};

/*
=========================================================
PAYMENT MODE SUMMARY
GET /api/reports/payment-mode-summary?date_from=...&date_to=...
=========================================================
*/

export const getPaymentModeSummary = async (req, res, next) => {

    try {

        const { date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        const breakdown = await Payment.aggregate([

            {
                $match: {
                    restaurant_id: restaurantId,
                    createdAt: { $gte: from, $lte: to },
                    status: { $ne: "Failed" }
                }
            },

            {
                $group: {
                    _id: "$payment_method",
                    total_amount: { $sum: "$amount" },
                    transaction_count: { $sum: 1 }
                }
            },

            { $sort: { total_amount: -1 } }

        ]);

        const grandTotal = breakdown.reduce((sum, b) => sum + b.total_amount, 0);

        sendResponse(res, 200, true, "Payment mode summary fetched successfully.", {
            date_from: from,
            date_to: to,
            breakdown,
            grand_total: Number(grandTotal.toFixed(2))
        });

    } catch (error) { next(error); }

};

/*
=========================================================
CASHIER-WISE SUMMARY
GET /api/reports/cashier-wise?date_from=...&date_to=...
=========================================================
*/

export const getCashierWiseSummary = async (req, res, next) => {

    try {

        const { date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        const breakdown = await Payment.aggregate([

            {
                $match: {
                    restaurant_id: restaurantId,
                    createdAt: { $gte: from, $lte: to },
                    status: { $ne: "Failed" }
                }
            },

            {
                $group: {
                    _id: "$collected_by",
                    total_collected: { $sum: "$amount" },
                    transaction_count: { $sum: 1 }
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "cashier"
                }
            },

            { $unwind: { path: "$cashier", preserveNullAndEmptyArrays: true } },

            {
                $project: {
                    _id: 0,
                    cashier_id: "$_id",
                    cashier_name: "$cashier.name",
                    total_collected: 1,
                    transaction_count: 1
                }
            },

            { $sort: { total_collected: -1 } }

        ]);

        sendResponse(res, 200, true, "Cashier-wise summary fetched successfully.", {
            date_from: from,
            date_to: to,
            breakdown
        });

    } catch (error) { next(error); }

};

/*
=========================================================
EXPORT REPORT AS CSV
GET /api/reports/export?type=sales|gst|item-wise|category-wise|payment-mode|cashier-wise&date_from=...&date_to=...
=========================================================
*/

export const exportReport = async (req, res, next) => {

    try {

        const { type, date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        let rows = [];
        let filename = "report.csv";
        let logType = "Sales Summary";

        switch (type) {

            case "gst": {

                const orders = await Order.find({
                    restaurant_id: restaurantId,
                    createdAt: { $gte: from, $lte: to },
                    order_status: { $nin: ["Cancelled", "Rejected"] }
                }).select("order_number createdAt subtotal cgst_amount sgst_amount tax_amount grand_total");

                rows = orders.map((o) => ({
                    order_number: o.order_number,
                    date: o.createdAt.toISOString().split("T")[0],
                    taxable_amount: o.subtotal || 0,
                    cgst: o.cgst_amount || 0,
                    sgst: o.sgst_amount || 0,
                    total_tax: o.tax_amount || 0,
                    grand_total: o.grand_total
                }));

                filename = `gst-report-${Date.now()}.csv`;
                logType = "GST Report";

                break;

            }

            case "item-wise": {

                rows = await Order.aggregate([
                    {
                        $match: {
                            restaurant_id: restaurantId,
                            createdAt: { $gte: from, $lte: to },
                            order_status: { $nin: ["Cancelled", "Rejected"] }
                        }
                    },
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: "$items.item_name",
                            quantity_sold: { $sum: "$items.quantity" },
                            total_revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                        }
                    },
                    { $project: { _id: 0, item_name: "$_id", quantity_sold: 1, total_revenue: 1 } },
                    { $sort: { total_revenue: -1 } }
                ]);

                filename = `item-wise-sales-${Date.now()}.csv`;
                logType = "Item Wise Sales";

                break;

            }

            case "category-wise": {

                rows = await Order.aggregate([
                    {
                        $match: {
                            restaurant_id: restaurantId,
                            createdAt: { $gte: from, $lte: to },
                            order_status: { $nin: ["Cancelled", "Rejected"] }
                        }
                    },
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: "$items.category",
                            quantity_sold: { $sum: "$items.quantity" },
                            total_revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                        }
                    },
                    { $project: { _id: 0, category: "$_id", quantity_sold: 1, total_revenue: 1 } },
                    { $sort: { total_revenue: -1 } }
                ]);

                filename = `category-wise-sales-${Date.now()}.csv`;
                logType = "Category Wise Sales";

                break;

            }

            case "payment-mode": {

                rows = await Payment.aggregate([
                    {
                        $match: {
                            restaurant_id: restaurantId,
                            createdAt: { $gte: from, $lte: to },
                            status: { $ne: "Failed" }
                        }
                    },
                    {
                        $group: {
                            _id: "$payment_method",
                            total_amount: { $sum: "$amount" },
                            transaction_count: { $sum: 1 }
                        }
                    },
                    { $project: { _id: 0, payment_method: "$_id", total_amount: 1, transaction_count: 1 } }
                ]);

                filename = `payment-mode-summary-${Date.now()}.csv`;
                logType = "Payment Mode Summary";

                break;

            }

            case "cashier-wise": {

                rows = await Payment.aggregate([
                    {
                        $match: {
                            restaurant_id: restaurantId,
                            createdAt: { $gte: from, $lte: to },
                            status: { $ne: "Failed" }
                        }
                    },
                    {
                        $group: {
                            _id: "$collected_by",
                            total_collected: { $sum: "$amount" },
                            transaction_count: { $sum: 1 }
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "_id",
                            foreignField: "_id",
                            as: "cashier"
                        }
                    },
                    { $unwind: { path: "$cashier", preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 0,
                            cashier_name: "$cashier.name",
                            total_collected: 1,
                            transaction_count: 1
                        }
                    }
                ]);

                filename = `cashier-wise-summary-${Date.now()}.csv`;
                logType = "Cashier Wise Summary";

                break;

            }

            case "sales":
            default: {

                const orders = await Order.find({
                    restaurant_id: restaurantId,
                    createdAt: { $gte: from, $lte: to },
                    order_status: { $nin: ["Cancelled", "Rejected"] }
                }).select("order_number createdAt order_type grand_total additional_discount tax_amount");

                rows = orders.map((o) => ({
                    order_number: o.order_number,
                    date: o.createdAt.toISOString().split("T")[0],
                    order_type: o.order_type,
                    grand_total: o.grand_total,
                    discount: o.additional_discount || 0,
                    tax: o.tax_amount || 0
                }));

                filename = `sales-summary-${Date.now()}.csv`;
                logType = "Sales Summary";

                break;

            }

        }

        // Log the export for audit purposes (fire-and-forget, don't block response)

        ReportExportLog.create({
            restaurant_id: req.user.restaurant_id,
            report_type: logType,
            date_from: from,
            date_to: to,
            format: "CSV",
            exported_by: req.user.id
        }).catch((err) => console.error("Report export log failed:", err.message));

        if (rows.length === 0) {
            return sendResponse(res, 200, true, "No data found for the selected range.", []);
        }

        sendCSVResponse(res, filename, rows);

    } catch (error) {

        next(error);

    }

};

/*
=========================================================
EXPORT HISTORY (audit log)
GET /api/reports/export-history?page=1&limit=20
=========================================================
*/

export const getExportHistory = async (req, res, next) => {

    try {

        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const [logs, total] = await Promise.all([

            ReportExportLog.find({ restaurant_id: req.user.restaurant_id })
                .populate("exported_by", "name role")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),

            ReportExportLog.countDocuments({ restaurant_id: req.user.restaurant_id })

        ]);

        sendResponse(res, 200, true, "Export history fetched successfully.", {
            logs,

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
Z REPORT
GET /api/cashier/z-report?date_from=...&date_to=...&cashier_id=...
=========================================================
*/

export const getZReport = async (req, res, next) => {

    try {

        const { date_from, date_to, cashier_id } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        // Cashiers can only ever see their own report.
        // Manager/Admin may specify cashier_id, or omit it for restaurant-wide.

        const isManagerOrAdmin = ["Manager", "Admin"].includes(req.user.role);

        const targetCashierId =
            isManagerOrAdmin && cashier_id ? cashier_id : req.user.id;

        const drawerFilter = {
            restaurant_id: restaurantId,
            opened_at: { $lte: to }
        };

        if (!isManagerOrAdmin || cashier_id) {
            drawerFilter.cashier_id = new mongoose.Types.ObjectId(targetCashierId);
        }

        // Drawer(s) relevant to this window — most recent first

        const drawers = await CashDrawer.find(drawerFilter)
            .populate("cashier_id", "name")
            .sort({ opened_at: -1 })
            .limit(isManagerOrAdmin && !cashier_id ? 50 : 1);

        // Payments collected in this window (scoped to the same cashier filter)

        const paymentMatch = {
            restaurant_id: restaurantId,
            payment_status: "Paid",
            paid_at: { $gte: from, $lte: to }
        };

        if (!isManagerOrAdmin || cashier_id) {
            paymentMatch.collected_by = new mongoose.Types.ObjectId(targetCashierId);
        }

        const paymentAgg = await Payment.aggregate([

            { $match: paymentMatch },

            {
                $group: {
                    _id: "$payment_method",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }

        ]);

        const paymentBreakdown = { Cash: 0, Card: 0, UPI: 0, Online: 0 };

        let totalCollected = 0;
        let totalTransactions = 0;

        paymentAgg.forEach((row) => {
            paymentBreakdown[row._id] = row.total;
            totalCollected += row.total;
            totalTransactions += row.count;
        });

        // Refunds issued in this window

        const refundMatch = {
            restaurant_id: restaurantId,
            status: "Completed",
            processed_at: { $gte: from, $lte: to }
        };

        const refundAgg = await Refund.aggregate([

            { $match: refundMatch },

            {
                $group: {
                    _id: null,
                    total_refunded: { $sum: "$refund_amount" },
                    refund_count: { $sum: 1 }
                }
            }

        ]);

        const refundSummary = refundAgg[0] || { total_refunded: 0, refund_count: 0 };

        sendResponse(res, 200, true, "Z-Report generated successfully.", {
            date_from: from,
            date_to: to,
            drawers,
            payment_breakdown: paymentBreakdown,
            total_collected: Number(totalCollected.toFixed(2)),
            total_transactions: totalTransactions,
            total_refunded: Number(refundSummary.total_refunded.toFixed(2)),
            refund_count: refundSummary.refund_count,
            net_collection: Number((totalCollected - refundSummary.total_refunded).toFixed(2))
        });

    } catch (error) { next(error); }

};

/*
=========================================================
CASHIER ANALYTICS
GET /api/cashier/analytics?date_from=...&date_to=...
=========================================================
*/

export const getCashierAnalytics = async (req, res, next) => {

    try {

        const { date_from, date_to } = req.query;
        const { from, to } = buildDateRange(date_from, date_to);
        const restaurantId = new mongoose.Types.ObjectId(req.user.restaurant_id);

        const collectionByCashier = await Payment.aggregate([

            {
                $match: {
                    restaurant_id: restaurantId,
                    payment_status: "Paid",
                    paid_at: { $gte: from, $lte: to }
                }
            },

            {
                $group: {
                    _id: "$collected_by",
                    total_collected: { $sum: "$amount" },
                    transaction_count: { $sum: 1 },
                    average_transaction: { $avg: "$amount" }
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "cashier"
                }
            },

            { $unwind: { path: "$cashier", preserveNullAndEmptyArrays: true } },

            {
                $project: {
                    _id: 0,
                    cashier_id: "$_id",
                    cashier_name: "$cashier.name",
                    total_collected: 1,
                    transaction_count: 1,
                    average_transaction: { $round: ["$average_transaction", 2] }
                }
            },

            { $sort: { total_collected: -1 } }

        ]);

        // Drawer reconciliation discrepancies (closed drawers only)

        const drawerDiscrepancies = await CashDrawer.aggregate([

            {
                $match: {
                    restaurant_id: restaurantId,
                    status: "Closed",
                    closed_at: { $gte: from, $lte: to }
                }
            },

            {
                $group: {
                    _id: "$cashier_id",
                    shifts_closed: { $sum: 1 },
                    total_difference: { $sum: "$difference" },
                    total_expected: { $sum: "$expected_cash" },
                    total_actual: { $sum: "$actual_cash" }
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "cashier"
                }
            },

            { $unwind: { path: "$cashier", preserveNullAndEmptyArrays: true } },

            {
                $project: {
                    _id: 0,
                    cashier_id: "$_id",
                    cashier_name: "$cashier.name",
                    shifts_closed: 1,
                    total_difference: { $round: ["$total_difference", 2] },
                    total_expected: { $round: ["$total_expected", 2] },
                    total_actual: { $round: ["$total_actual", 2] }
                }
            },

            { $sort: { total_difference: 1 } }

        ]);

        sendResponse(res, 200, true, "Cashier analytics fetched successfully.", {
            date_from: from,
            date_to: to,
            collection_by_cashier: collectionByCashier,
            drawer_discrepancies: drawerDiscrepancies
        });

    } catch (error) { next(error) }

};