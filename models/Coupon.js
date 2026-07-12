import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
    {

        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },

        code: {
            type: String,
            required: true,
            uppercase: true
        },

        description: {
            type: String,
            default: ""
        },

        discount_type: {
            type: String,
            enum: [
                "Percentage",
                "Flat"
            ],
            default: "Percentage"
        },

        discount_value: {
            type: Number,
            required: true
        },

        minimum_order: {
            type: Number,
            default: 0
        },

        maximum_discount: {
            type: Number,
            default: 0
        },

        expiry_date: {
            type: Date,
            required: true
        },

        is_active: {
            type: Boolean,
            default: true
        }

    },
    {
        timestamps: true
    });

export default mongoose.model(
    "Coupon",
    couponSchema
);