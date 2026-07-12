import mongoose from "mongoose";

const loyaltyTransactionSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            index: true
        },

        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null
        },

        type: {
            type: String,
            enum: ["Earned", "Redeemed", "Expired", "Adjusted", "Birthday Bonus"],
            required: true
        },

        points: {
            type: Number,
            required: true
        },

        balance_after: {
            type: Number,
            required: true
        },

        remarks: {
            type: String,
            default: ""
        },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

loyaltyTransactionSchema.index({ customer_id: 1, createdAt: -1 });

export default mongoose.model("LoyaltyTransaction", loyaltyTransactionSchema);