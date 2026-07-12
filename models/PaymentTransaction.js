import mongoose from "mongoose";

/*
=========================================================
PAYMENT TRANSACTION
One row per Razorpay order created for a subscription payment.
Kept separate from RestaurantSubscription so we have a full,
append-only payment history — useful for the restaurant's own
billing history AND for super admin financial reporting later.
=========================================================
*/

const paymentTransactionSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        plan_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SubscriptionPlan",
            required: true
        },

        razorpay_order_id: {
            type: String,
            required: true,
            unique: true
        },

        razorpay_payment_id: {
            type: String,
            default: null
        },

        razorpay_signature: {
            type: String,
            default: null
        },

        amount: {
            // stored in rupees (not paise) for easy reading/reporting
            type: Number,
            required: true
        },

        currency: {
            type: String,
            default: "INR"
        },

        status: {
            type: String,
            enum: ["Created", "Paid", "Failed"],
            default: "Created"
        },

        failure_reason: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("PaymentTransaction", paymentTransactionSchema);