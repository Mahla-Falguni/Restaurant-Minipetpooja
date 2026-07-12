import mongoose from "mongoose";


const restaurantSubscriptionSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            unique: true,
            index: true
        },

        plan_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SubscriptionPlan",
            required: true
        },

        status: {
            type: String,
            enum: ["Trial", "Active", "Past Due", "Suspended", "Cancelled"],
            default: "Trial"
        },

        trial_ends_at: {
            type: Date,
            default: null
        },

        current_period_start: {
            type: Date,
            required: true
        },

        current_period_end: {
            type: Date,
            required: true
        },

        auto_renew: {
            type: Boolean,
            default: true
        },

        last_payment_amount: {
            type: Number,
            default: 0
        },

        last_payment_at: {
            type: Date,
            default: null
        },

        suspended_reason: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

restaurantSubscriptionSchema.index({ status: 1, current_period_end: 1 });

export default mongoose.model("RestaurantSubscription", restaurantSubscriptionSchema);