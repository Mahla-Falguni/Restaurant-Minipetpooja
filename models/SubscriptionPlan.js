import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
    {
        plan_name: {
            type: String,
            required: true,
            trim: true
            // e.g. "Starter", "Growth", "Enterprise"
        },

        billing_cycle: {
            type: String,
            enum: ["Monthly", "Yearly"],
            required: true
        },

        price: {
            type: Number,
            required: true
        },

        max_branches: {
            type: Number,
            default: 1
        },

        max_staff_accounts: {
            type: Number,
            default: 10
        },

        features_included: {
            type: [String],
            default: []
            // e.g. ["POS", "KDS", "CRM", "Inventory", "Reservations", "Payroll"]
        },

        is_active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);