import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true
        },

        invoice_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Invoice",
            required: true
        },

        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },

        amount: {
            type: Number,
            required: true
        },

        payment_method: {
            type: String,
            enum: [
                "Cash",
                "UPI",
                "Card",
                "Online"
            ],
            required: true
        },

        payment_status: {
            type: String,
            enum: [
                "Pending",
                "Paid",
                "Failed",
                "Refunded",
                "Partial"
            ],
            default: "Pending"
        },

        gateway: {
            type: String,
            enum: [
                "Cash",
                "Razorpay",
                "Stripe",
                "PayPal",
                "PhonePe",
                "GooglePay",
                "Paytm"
            ],
            default: "Cash"
        },

        transaction_id: {
            type: String,
            default: ""
        },

        gateway_order_id: {
            type: String,
            default: ""
        },

        gateway_payment_id: {
            type: String,
            default: ""
        },

        gateway_signature: {
            type: String,
            default: ""
        },

        paid_at: {
            type: Date,
            default: null
        },

        refund_amount: {
            type: Number,
            default: 0
        },

        refund_reason: {
            type: String,
            default: ""
        },

        refund_at: {
            type: Date,
            default: null
        },

        remarks: {
            type: String,
            default: ""
        }

    },
    {
        timestamps: true
    });

export default mongoose.model(
    "Payment",
    paymentSchema
)