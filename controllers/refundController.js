import mongoose from "mongoose";

import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
import Refund from "../models/Refund.js";
import CashDrawer from "../models/CashDrawer.js";

import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
REQUEST REFUND
POST /api/cashier/refund/request
=========================================================
*/

export const requestRefund = async (req, res, next) => {

    try {

        const {
            order_id,
            refund_type,
            refund_amount,
            refund_method,
            reason
        } = req.body;

        if (!order_id) throw new Error("Order ID is required.");

        if (!["Full", "Partial"].includes(refund_type)) {
            throw new Error("Refund type must be Full or Partial.");
        }

        if (!refund_amount || refund_amount <= 0) {
            throw new Error("Refund amount must be greater than zero.");
        }

        if (!reason || !reason.trim()) {
            throw new Error("Refund reason is required.");
        }

        const order = await Order.findById(order_id);

        if (!order) throw new Error("Order not found.");

        if (order.payment_status === "Pending") {
            throw new Error("Cannot refund an unpaid order.");
        }

        const paidPayments = await Payment.find({
            order_id: order._id,
            payment_status: "Paid"
        });

        const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);

        const alreadyRefunded = await Refund.aggregate([

            {
                $match: {
                    order_id: order._id,
                    status: { $in: ["Approved", "Completed"] }
                }
            },

            {
                $group: {
                    _id: null,
                    total: { $sum: "$refund_amount" }
                }
            }

        ]);

        const refundedSoFar = alreadyRefunded.length ? alreadyRefunded[0].total : 0;
        const refundableAmount = totalPaid - refundedSoFar;

        if (refund_type === "Full" && Number(refund_amount) !== Number(refundableAmount.toFixed(2))) {
            throw new Error(`Full refund amount must equal the refundable balance of ₹${refundableAmount.toFixed(2)}.`);
        }

        if (Number(refund_amount) > refundableAmount) {
            throw new Error(`Refund amount exceeds refundable balance of ₹${refundableAmount.toFixed(2)}.`);
        }

        const refund = await Refund.create({
            restaurant_id: order.restaurant_id,
            order_id: order._id,
            invoice_id: order.invoice_id,
            refund_type,
            refund_amount: Number(refund_amount),
            refund_method: refund_method || "Original Payment Method",
            reason,
            status: "Pending",
            requested_by: req.user.id
        });

        if (req.io) {

            req.io.to(`restaurant_${order.restaurant_id}`).emit("refund_requested", {
                refund_id: refund._id,
                order_id: order._id,
                amount: refund.refund_amount
            });
        }

        sendResponse(res, 201, true, "Refund request submitted. Awaiting approval.", refund);

    } catch (error) { next(error); }

};

/*
=========================================================
APPROVE / REJECT REFUND
PUT /api/cashier/refund/:refund_id/approve
PUT /api/cashier/refund/:refund_id/reject
=========================================================
*/

export const approveRefund = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { refund_id } = req.params;

        const refund = await Refund.findById(refund_id).session(session);

        if (!refund) throw new Error("Refund request not found.");

        if (refund.status !== "Pending") {
            throw new Error(`Refund is already ${refund.status}.`);
        }

        refund.status = "Approved";

        refund.approved_by = req.user.id;

        await refund.save({ session });

        await session.commitTransaction();
        session.endSession();

        if (req.io) {

            req.io.to(`restaurant_${refund.restaurant_id}`).emit("refund_approved", {
                refund_id: refund._id
            });

        }

        sendResponse(res, 200, true, "Refund approved. Proceed to process payment reversal.", refund);

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        next(error);

    }

};

export const rejectRefund = async (req, res, next) => {

    try {

        const { refund_id } = req.params;
        const { rejected_reason } = req.body;

        const refund = await Refund.findById(refund_id);

        if (!refund) throw new Error("Refund request not found.");

        if (refund.status !== "Pending") {
            throw new Error(`Refund is already ${refund.status}.`);
        }

        refund.status = "Rejected";
        refund.approved_by = req.user.id;
        refund.rejected_reason = rejected_reason || "Not specified";

        await refund.save();

        if (req.io) {
            req.io.to(`restaurant_${refund.restaurant_id}`).emit("refund_rejected", {
                refund_id: refund._id
            })
        }

        sendResponse(res, 200, true, "Refund request rejected.", refund);

    } catch (error) { next(error); }

};

/*
=========================================================
COMPLETE / PROCESS REFUND
PUT /api/cashier/refund/:refund_id/complete
=========================================================
*/

export const completeRefund = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { refund_id } = req.params;
        const { transaction_reference } = req.body;
        const refund = await Refund.findById(refund_id).session(session);

        if (!refund) throw new Error("Refund request not found.");

        if (refund.status !== "Approved") {
            throw new Error("Only approved refunds can be completed.");
        }

        const order = await Order.findById(refund.order_id).session(session);

        if (!order) throw new Error("Associated order not found.");

        // -----------------------------------------
        // Create a negative Payment record for audit trail
        // -----------------------------------------

        await Payment.create(

            [{
                restaurant_id: order.restaurant_id,
                order_id: order._id,
                invoice_id: order.invoice_id,
                amount: -Math.abs(refund.refund_amount),
                paid_amount: -Math.abs(refund.refund_amount),
                payment_method: refund.refund_method,
                payment_status: "Refunded",
                paid_at: new Date(),
                transaction_id: transaction_reference || "",
                collected_by: req.user.id
            }],

            { session }

        );

        // -----------------------------------------
        // Update order payment status
        // -----------------------------------------

        if (refund.refund_type === "Full") {
            order.payment_status = "Refunded";

        } else {
            order.payment_status = "Partial";

        }

        order.status_history.push({
            status: order.order_status,
            changed_by: req.user.id,
            remarks: `Refund of ₹${refund.refund_amount} completed via ${refund.refund_method}.`
        });

        await order.save({ session });

        // -----------------------------------------
        // Update Invoice
        // -----------------------------------------

        if (order.invoice_id) {

            await Invoice.findByIdAndUpdate(
                order.invoice_id,
                { payment_status: order.payment_status },
                { session }
            );
        }

        // -----------------------------------------
        // Update Cash Drawer if refund was cash
        // -----------------------------------------

        if (refund.refund_method === "Cash") {

            await CashDrawer.findOneAndUpdate(
                { cashier_id: req.user.id, status: "Open" },
                { $inc: { cash_refunded: refund.refund_amount } },
                { session }
            );
        }

        // -----------------------------------------
        // Finalize Refund
        // -----------------------------------------

        refund.status = "Completed";
        refund.processed_at = new Date();
        refund.transaction_reference = transaction_reference || "";

        await refund.save({ session });
        await session.commitTransaction();
        session.endSession();

        if (req.io) {
            req.io.to(`restaurant_${refund.restaurant_id}`).emit("refund_completed", {
                refund_id: refund._id,
                order_id: order._id
            });
        }

        sendResponse(res, 200, true, "Refund completed successfully.", refund);

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        next(error);

    }

};

/*
=========================================================
LIST / VIEW REFUNDS
GET /api/cashier/refunds?status=Pending
GET /api/cashier/refund/:refund_id
=========================================================
*/

export const getRefunds = async (req, res, next) => {

    try {

        const { status } = req.query;
        const filter = {
            restaurant_id: req.user.restaurant_id
        };

        if (status) {
            filter.status = status;
        }

        const refunds = await Refund.find(filter)
            .populate("order_id", "order_number grand_total")
            .populate("requested_by", "first_name last_name")
            .populate("approved_by", "first_name last_name")
            .sort({ createdAt: -1 });

        sendResponse(res, 200, true, "Refunds fetched successfully.", refunds);

    } catch (error) { next(error); }

};

export const getRefundById = async (req, res, next) => {

    try {

        const { refund_id } = req.params;

        const refund = await Refund.findById(refund_id)
            .populate("order_id")
            .populate("invoice_id")
            .populate("requested_by", "first_name last_name")
            .populate("approved_by", "first_name last_name");

        if (!refund) throw new Error("Refund not found.");

        sendResponse(res, 200, true, "Refund fetched successfully.", refund);

    } catch (error) { next(error); }

};