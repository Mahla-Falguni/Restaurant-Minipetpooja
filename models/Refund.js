import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true
        },

        invoice_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Invoice",
            default: null
        },

        payment_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            default: null
        },

        refund_type: {
            type: String,
            enum: ["Full", "Partial"],
            required: true
        },

        refund_amount: {
            type: Number,
            required: true
        },

        refund_method: {
            type: String,
            enum: ["Cash", "Card", "UPI", "Online", "Original Payment Method"],
            default: "Original Payment Method"
        },

        reason: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Completed"],
            default: "Pending"
        },

        requested_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        approved_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        rejected_reason: {
            type: String,
            default: ""
        },

        processed_at: {
            type: Date,
            default: null
        },

        transaction_reference: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

refundSchema.index({ order_id: 1 });
refundSchema.index({ status: 1 });

export default mongoose.model("Refund", refundSchema);