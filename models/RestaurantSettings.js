import mongoose from "mongoose";

const restaurantSettingsSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            unique: true
        },

        gst_percentage: {
            type: Number,
            default: 5
        },

        service_charge_percentage: {
            type: Number,
            default: 0
        },

        currency: {
            type: String,
            default: "INR"
        },

        allow_cash: {
            type: Boolean,
            default: true
        },

        allow_upi: {
            type: Boolean,
            default: true
        },

        allow_card: {
            type: Boolean,
            default: true
        },

        allow_online: {
            type: Boolean,
            default: true
        },

        auto_accept_orders: {
            type: Boolean,
            default: false
        },

        estimated_preparation_time: {
            type: Number,
            default: 20
        }

    },
    {
        timestamps: true
    });

export default mongoose.model(
    "RestaurantSettings",
    restaurantSettingsSchema
);