import mongoose from "mongoose";


const shiftSchema = new mongoose.Schema(
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

        start_time: {
            type: String, // "09:00" 24hr format
            required: true
        },

        end_time: {
            type: String, // "17:00"
            required: true
        },

        days_of_week: {
            type: [String],
            enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        },

        assigned_staff: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        is_active: {
            type: Boolean,
            default: true
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

shiftSchema.index({ restaurant_id: 1, name: 1 }, { unique: true });

export default mongoose.model("Shift", shiftSchema);