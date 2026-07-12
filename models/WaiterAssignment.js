import mongoose from "mongoose";

const waiterAssignmentSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        waiter_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        table_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Table",
            required: true,
            index: true
        },

        shift: {
            type: String,
            enum: [
                "Morning",
                "Afternoon",
                "Evening",
                "Night"
            ],
            default: "Morning"
        },

        assigned_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        assigned_at: {
            type: Date,
            default: Date.now
        },

        unassigned_at: {
            type: Date,
            default: null
        },

        is_active: {
            type: Boolean,
            default: true
        },

        remarks: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model(
    "WaiterAssignment",
    waiterAssignmentSchema
);
