import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            default: "",
            trim: true,
            lowercase: true
        },

        dob: {
            type: Date,
            default: null
        },

        gender: {
            type: String,
            enum: ["Male", "Female", "Other", "Prefer not to say"],
            default: "Prefer not to say"
        },

        address: {
            type: String,
            default: ""
        },

        tags: {
            type: [String],
            default: []
        },

        total_orders: {
            type: Number,
            default: 0
        },

        total_spent: {
            type: Number,
            default: 0
        },

        average_order_value: {
            type: Number,
            default: 0
        },

        last_visit_at: {
            type: Date,
            default: null
        },

        first_visit_at: {
            type: Date,
            default: null
        },

        loyalty_points: {
            type: Number,
            default: 0
        },

        membership_tier: {
            type: String,
            enum: ["None", "Bronze", "Silver", "Gold", "Platinum"],
            default: "None"
        },

        last_birthday_reward_year: {
            type: Number,
            default: null
        },

        is_active: {
            type: Boolean,
            default: true
        },

        notes: {
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

customerSchema.index({ restaurant_id: 1, phone: 1 }, { unique: true });
customerSchema.index({ restaurant_id: 1, name: "text", phone: "text", email: "text" });

export default mongoose.model("Customer", customerSchema);