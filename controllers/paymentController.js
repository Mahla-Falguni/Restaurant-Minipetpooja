import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";

import generateTransactionId from "../utils/generateTransactionId.js";
import sendResponse from "../utils/sendResponse.js";

/*
====================================
CREATE PAYMENT
POST /api/payments/create
====================================
*/

export const createPayment = async (req, res, next) => {

    try {

        const {
            order_id,
            payment_method,
            gateway,
            remarks
        } = req.body;

        const order =
            await Order.findById(order_id);

        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        const invoice = await Invoice.findById(order.invoice_id);

        if (!invoice) {
            return sendResponse(res, 404, false, "Invoice not found.");
        }

        const payment =
            await Payment.create({
                order_id: order._id,
                invoice_id: invoice._id,

                restaurant_id:
                    order.restaurant_id,

                amount:
                    order.grand_total,

                payment_method,
                gateway,
                payment_status: "Pending",

                transaction_id:
                    generateTransactionId(),

                remarks
            });

        order.payment_id = payment._id;

        await order.save();

        sendResponse(res, 201, true, "Payment Created", payment);

    } catch (error) { next(error); }

};


export const markPaymentPaid = async (req, res, next) => {

    try {

        const { id } = req.params;

        const payment = await Payment.findById(id);

        if (!payment) {
            return sendResponse(res, 404, false, "Payment not found.");
        }

        payment.payment_status = "Paid";
        payment.paid_at = new Date();

        await payment.save();

        await Order.findByIdAndUpdate(
            payment.order_id,
            { payment_status: "Paid" }
        );

        await Invoice.findByIdAndUpdate(
            payment.invoice_id,
            { payment_status: "Paid" }
        );

        sendResponse(res, 200, true, "Payment Successful", payment);

    } catch (error) { next(error); }

};



export const getPayments = async (req, res, next) => {

    try {

        const payments =
            await Payment.find()

                .populate(
                    "order_id",
                    "order_number"
                )

                .populate(
                    "invoice_id",
                    "invoice_number"
                )

                .sort({ createdAt: -1 });

        sendResponse(res, 200, true, "Payment List", payments);

    } catch (error) { next(error); }

};