import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        customer_name: {
            type: String,
            required: true,
            trim: true
        },

        customer_phone: {
            type: String,
            required: true,
            trim: true
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            default: null
        },

        party_size: {
            type: Number,
            required: true,
            min: 1
        },

        reservation_date: {
            type: String, 
            required: true
        },

        reservation_time: {
            type: String, 
            required: true
        },

        duration_minutes: {
            type: Number,
            default: 90
        },

        tables_assigned: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Table"
            }
        ],

        zone_preference: {
            type: String,
            default: ""
        },

        special_requests: {
            type: String,
            default: ""
        },

        status: {
            type: String,
            enum: [
                "Requested",
                "Confirmed",
                "Seated",
                "Completed",
                "No Show",
                "Cancelled"
            ],
            default: "Requested"
        },

        source: {
            type: String,
            enum: ["Phone", "Walk-in", "Website", "App", "Third Party"],
            default: "Phone"
        },

        seated_at: {
            type: Date,
            default: null
        },

        completed_at: {
            type: Date,
            default: null
        },

        cancelled_reason: {
            type: String,
            default: ""
        },

        reminder_sent: {
            type: Boolean,
            default: false
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

reservationSchema.index({ restaurant_id: 1, reservation_date: 1, reservation_time: 1 });
reservationSchema.index({ restaurant_id: 1, status: 1 });
reservationSchema.index({ customer_phone: 1 });

export default mongoose.model("Reservation", reservationSchema);