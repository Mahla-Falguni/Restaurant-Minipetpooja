import mongoose from "mongoose";

import Order from "../models/Order.js";
import Table from "../models/Table.js";
import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";
import BillSplit from "../models/BillSplit.js";
import CashDrawer from "../models/CashDrawer.js";
import { syncCustomerAfterOrder } from "./customerController.js";
import { calculateEarnedPoints } from "../utils/membershipTiers.js";

import sendResponse from "../utils/sendResponse.js";
import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";

/*
=========================================================
CASHIER DASHBOARD
GET /api/cashier/dashboard
=========================================================
*/

export const getCashierDashboard = async (req, res, next) => {
    try {
        const restaurantId = req.user.restaurant_id;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Pending bills: served orders not yet fully paid
        const pendingBills = await Order.countDocuments({
            restaurant_id: restaurantId,
            order_status: { $in: ["Served", "Ready"] },
            payment_status: { $in: ["Pending", "Partial"] }
        });

        // Bill requested (waiter clicked "Request Bill")
        const billRequested = await Order.countDocuments({
            restaurant_id: restaurantId,
            bill_requested: true,
            payment_status: { $ne: "Paid" }
        });

        // Paid bills today
        const paidBillsToday = await Order.countDocuments({
            restaurant_id: restaurantId,
            payment_status: "Paid",
            updatedAt: { $gte: today }
        });

        // Active split bills
        const activeSplitBills = await BillSplit.countDocuments({
            restaurant_id: restaurantId,
            status: "Active",
            payment_status: { $ne: "Paid" }
        });

        // Active tables
        const OccupiedTables = await Table.countDocuments({
            restaurant_id: restaurantId,
            status: "Occupied"
        });

        const totalTables = await Table.countDocuments({
            restaurant_id: restaurantId
        });

        // Today's sales & collection (from Payment records)
        const salesAgg = await Payment.aggregate([
            {
                $match: {
                    restaurant_id: new mongoose.Types.ObjectId(restaurantId),
                    payment_status: "Paid",
                    paid_at: { $gte: today }
                }
            },

            {
                $group: {
                    _id: "$payment_method",
                    total: { $sum: "$amount" }
                }
            }
        ]);

        const paymentBreakdown = { Cash: 0, Card: 0, UPI: 0, Online: 0 };

        let todayCollection = 0;

        salesAgg.forEach((row) => {
            paymentBreakdown[row._id] = row.total;
            todayCollection += row.total;
        });

        // Unpaid invoices
        const unpaidInvoices = await Invoice.countDocuments({
            restaurant_id: restaurantId,
            status: { $ne: "Cancelled" },
            grand_total: { $gt: 0 }
        });

        // Cash drawer status for this cashier
        const drawer = await CashDrawer.findOne({
            cashier_id: req.user.id,
            status: "Open"
        });

        sendResponse(res, 200, true, "Cashier dashboard loaded", {
            pending_bills: pendingBills,
            bill_requested: billRequested,
            paid_bills_today: paidBillsToday,
            active_split_bills: activeSplitBills,
            Occupied_tables: OccupiedTables,
            total_tables: totalTables,
            today_collection: todayCollection,
            payment_breakdown: paymentBreakdown,
            unpaid_invoices: unpaidInvoices,
            drawer_status: drawer ? "Open" : "Closed",
            drawer
        });

    } catch (error) { next(error); }
};

/*
=========================================================
BILL CHECKOUT
POST /api/cashier/checkout
=========================================================
*/

export const checkoutOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { order_id, additional_discount = 0, round_off = true } = req.body;

        if (!order_id) {
            throw new Error("Order ID is required.");
        }

        const order = await Order.findById(order_id)
            .populate("items")
            .session(session);

        if (!order) {
            throw new Error("Order not found.");
        }

        if (["Completed", "Cancelled", "Rejected", "Merged"].includes(order.order_status)) {
            throw new Error(`Cannot checkout a ${order.order_status} order.`);
        }

        if (order.payment_status === "Paid") {
            throw new Error("This order has already been paid in full.");
        }

        if (order.is_split) {
            throw new Error("This order is split into multiple bills. Use the split payment flow instead.");
        }

        if (additional_discount < 0) {
            throw new Error("Additional discount cannot be negative.");
        }

        // -----------------------------------------
        // Recalculate final total with extra discount
        // -----------------------------------------

        const baseDiscount = (order.discount || 0) + (order.coupon_discount || 0);
        const totalDiscount = baseDiscount + Number(additional_discount);

        let finalTotal =
            order.subtotal +
            order.cgst +
            order.sgst +
            order.service_charge -
            totalDiscount;

        if (finalTotal < 0) finalTotal = 0;

        let roundOffAmount = 0;

        if (round_off) {
            const rounded = Math.round(finalTotal);
            roundOffAmount = Number((rounded - finalTotal).toFixed(2));
            finalTotal = rounded;
        }

        // -----------------------------------------
        // Update Order
        // -----------------------------------------

        order.additional_discount = Number(additional_discount);
        order.round_off = roundOffAmount;
        order.grand_total = finalTotal;
        order.checkout_at = new Date();
        order.checked_out_by = req.user.id;
        order.status_history.push({
            status: order.order_status,
            changed_by: req.user.id,
            remarks: `Bill finalized at checkout. Additional discount: ₹${additional_discount}, Round-off: ₹${roundOffAmount}`
        });

        await order.save({ session });

        // -----------------------------------------
        // Update / Create Invoice
        // -----------------------------------------

        let invoice;

        if (order.invoice_id) {
            invoice = await Invoice.findByIdAndUpdate(
                order.invoice_id,
                {
                    subtotal: order.subtotal,
                    cgst: order.cgst,
                    sgst: order.sgst,
                    service_charge: order.service_charge,
                    discount: totalDiscount,
                    round_off: roundOffAmount,
                    grand_total: finalTotal
                },
                { new: true, session }
            );

        } else {
            const created = await Invoice.create(
                [{
                    restaurant_id: order.restaurant_id,
                    order_id: order._id,
                    invoice_number: generateInvoiceNumber(),
                    subtotal: order.subtotal,
                    cgst: order.cgst,
                    sgst: order.sgst,
                    service_charge: order.service_charge,
                    discount: totalDiscount,
                    round_off: roundOffAmount,
                    grand_total: finalTotal
                }],
                { session }
            );

            invoice = created[0];
            order.invoice_id = invoice._id;

            await order.save({ session });
        }

        await session.commitTransaction();
        session.endSession();
        if (req.io) {
            req.io.to(`restaurant_${order.restaurant_id}`).emit("bill_checked_out", {
                order_id: order._id,
                grand_total: finalTotal
            });
        }

        sendResponse(res, 200, true, "Bill finalized. Ready for payment.", {
            order_number: order.order_number,
            table_number: order.table_number,
            subtotal: order.subtotal,
            cgst: order.cgst,
            sgst: order.sgst,
            service_charge: order.service_charge,
            discount: totalDiscount,
            round_off: roundOffAmount,
            grand_total: finalTotal,
            invoice
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

/*
=========================================================
MULTIPLE PAYMENT METHODS
POST /api/cashier/add-payment
=========================================================
*/

export const addPayment = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { order_id, payments } = req.body;

        if (!order_id) {
            throw new Error("Order ID is required.");
        }

        if (!Array.isArray(payments) || payments.length === 0) {
            throw new Error("At least one payment entry is required.");
        }

        const order = await Order.findById(order_id).session(session);

        if (!order) {
            throw new Error("Order not found.");
        }

        if (order.payment_status === "Paid") {
            throw new Error("This order is already fully paid.");
        }

        const validMethods = ["Cash", "Card", "UPI", "Online"];

        let totalIncoming = 0;

        for (const p of payments) {
            if (!validMethods.includes(p.method)) {
                throw new Error(`Invalid payment method: ${p.method}`);
            }

            if (!p.amount || p.amount <= 0) {
                throw new Error("Each payment amount must be greater than zero.");
            }
            totalIncoming += Number(p.amount);
        }

        // -----------------------------------------
        // Existing paid amount so far
        // -----------------------------------------

        const existingPayments = await Payment.find({
            order_id: order._id,
            payment_status: "Paid"
        }).session(session);

        const alreadyPaid = existingPayments.reduce(
            (sum, p) => sum + p.amount, 0
        );

        const dueBeforeThis = Number((order.grand_total - alreadyPaid).toFixed(2));

        if (totalIncoming > dueBeforeThis + 0.5) {
            // small tolerance for rounding
            throw new Error(
                `Payment amount (₹${totalIncoming}) exceeds due amount (₹${dueBeforeThis}).`
            );
        }

        // -----------------------------------------
        // Create a Payment record per method
        // -----------------------------------------

        const createdPayments = [];

        for (const p of payments) {
            const paymentDoc = await Payment.create(
                [{
                    restaurant_id: order.restaurant_id,
                    order_id: order._id,
                    invoice_id: order.invoice_id,
                    amount: Number(p.amount),
                    paid_amount: Number(p.amount),
                    payment_method: p.method,
                    transaction_id: p.transaction_id || "",
                    payment_status: "Paid",
                    paid_at: new Date(),
                    collected_by: req.user.id
                }],
                { session }
            );

            createdPayments.push(paymentDoc[0]);

            // -----------------------------------------
            // Update cash drawer if cash was used
            // -----------------------------------------

            if (p.method === "Cash") {
                await CashDrawer.findOneAndUpdate(
                    { cashier_id: req.user.id, status: "Open" },
                    { $inc: { cash_received: Number(p.amount) } },
                    { session }
                );

            } else if (p.method === "UPI") {
                await CashDrawer.findOneAndUpdate(
                    { cashier_id: req.user.id, status: "Open" },
                    { $inc: { upi_received: Number(p.amount) } },
                    { session }
                );

            } else if (p.method === "Card") {
                await CashDrawer.findOneAndUpdate(
                    { cashier_id: req.user.id, status: "Open" },
                    { $inc: { card_received: Number(p.amount) } },
                    { session }
                );

            } else if (p.method === "Online") {
                await CashDrawer.findOneAndUpdate(
                    { cashier_id: req.user.id, status: "Open" },
                    { $inc: { online_received: Number(p.amount) } },
                    { session }
                );
            }
        }

        // -----------------------------------------
        // Update Order Payment Status
        // -----------------------------------------

        const totalPaidNow = alreadyPaid + totalIncoming;
        const dueNow = Number((order.grand_total - totalPaidNow).toFixed(2));

        if (dueNow <= 0.5) {
            order.payment_status = "Paid";
            order.order_status = "Completed";
            order.completed_at = new Date();

            // Free the table

            await Table.findByIdAndUpdate(
                order.table_id,
                { status: "Available" },
                { session }
            );

            // Sync customer stats / loyalty points now that the order is
            // fully paid off — this belongs here, not before we've even
            // validated/collected the incoming payments.

            await syncCustomerAfterOrder(order, session);

        } else {
            order.payment_status = "Partial";
        }

        order.payment_method = payments.map((p) => p.method).join(", ");
        order.status_history.push({
            status: order.order_status,
            changed_by: req.user.id,
            remarks: `Payment of ₹${totalIncoming} collected (${payments.map(p => `${p.method}: ₹${p.amount}`).join(", ")})`
        });

        await order.save({ session });

        // -----------------------------------------
        // Update Invoice
        // -----------------------------------------

        if (order.invoice_id) {
            await Invoice.findByIdAndUpdate(
                order.invoice_id,
                {
                    payment_status: order.payment_status,
                    paid_amount: totalPaidNow,
                    due_amount: dueNow > 0 ? dueNow : 0
                },
                { session }
            );
        }

        await session.commitTransaction();
        session.endSession();

        if (req.io) {
            req.io.to(`restaurant_${order.restaurant_id}`).emit("payment_collected", {
                order_id: order._id,
                payment_status: order.payment_status,
                due_amount: dueNow > 0 ? dueNow : 0
            });
        }

        sendResponse(res, 200, true, "Payment recorded successfully.", {
            order_number: order.order_number,
            payment_status: order.payment_status,
            total_paid: totalPaidNow,
            due_amount: dueNow > 0 ? dueNow : 0,
            payments: createdPayments
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

/*
=========================================================
REPRINT / FETCH INVOICE
GET /api/cashier/invoice/:order_id
=========================================================
*/

export const getInvoiceForReprint = async (req, res, next) => {
    try {
        const { order_id } = req.params;
        const order = await Order.findById(order_id)
            .populate("items")
            .populate("invoice_id")
            .populate("table_id", "table_number")
            .populate("restaurant_id", "restaurant_name address gst_number phone");
        if (!order) {
            throw new Error("Order not found.");
        }

        const payments = await Payment.find({
            order_id: order._id,
            payment_status: "Paid"
        }).sort({ createdAt: 1 });

        sendResponse(res, 200, true, "Invoice fetched successfully.", {
            restaurant: order.restaurant_id,
            table_number: order.table_id?.table_number,
            order_number: order.order_number,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            items: order.items,
            subtotal: order.subtotal,
            cgst: order.cgst,
            sgst: order.sgst,
            service_charge: order.service_charge,
            discount: order.discount,
            round_off: order.round_off || 0,
            grand_total: order.grand_total,
            invoice: order.invoice_id,
            payments,
            issued_at: order.checkout_at || order.createdAt
        });

    } catch (error) { next(error); }
};