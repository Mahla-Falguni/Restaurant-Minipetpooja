import mongoose from "mongoose";


const cashDrawerSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        cashier_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        shift: {
            type: String,
            enum: ["Morning", "Afternoon", "Evening", "Night"],
            default: "Morning"
        },

        opening_balance: {
            type: Number,
            required: true,
            default: 0
        },

        opened_at: {
            type: Date,
            default: Date.now
        },

        opened_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        cash_received: {
            type: Number,
            default: 0
        },

        cash_paid_out: {
            type: Number,
            default: 0
        },

        cash_refunded: {
            type: Number,
            default: 0
        },

        upi_received: {
            type: Number,
            default: 0
        },

        card_received: {
            type: Number,
            default: 0
        },

        online_received: {
            type: Number,
            default: 0
        },

        expected_cash: {
            type: Number,
            default: 0
        },

        actual_cash: {
            type: Number,
            default: null
        },

        difference: {
            type: Number,
            default: 0
        },

        closing_balance: {
            type: Number,
            default: null
        },

        closed_at: {
            type: Date,
            default: null
        },

        closed_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        status: {
            type: String,
            enum: ["Open", "Closed"],
            default: "Open"
        },

        notes: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

cashDrawerSchema.index({ restaurant_id: 1, status: 1 });
cashDrawerSchema.index({ cashier_id: 1, status: 1 });

export default mongoose.model("CashDrawer", cashDrawerSchema);