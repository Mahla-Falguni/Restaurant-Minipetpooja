import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        table_number: {
            type: String,
            required: true,
            trim: true
        },

        table_code: {
            type: String,
            unique: true,
            sparse: true
        },

        qr_url: {
            type: String,
            default: null
        },

        seating_capacity: {
            type: Number,
            required: true,
            min: 1
        },

        zone: {
            type: String,
            default: "Main", // e.g. "Main", "Rooftop", "Outdoor", "Private"
            trim: true
        },

        status: {
            type: String,
            enum: ["Available", "Occupied", "Reserved", "Cleaning", "Out of Service"],
            default: "Available"
        },

        current_order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null
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

tableSchema.index(
    { restaurant_id: 1, table_number: 1 },
    { unique: true, partialFilterExpression: { is_active: true } }
);
tableSchema.index({ restaurant_id: 1, zone: 1 });

export default mongoose.model("Table", tableSchema);