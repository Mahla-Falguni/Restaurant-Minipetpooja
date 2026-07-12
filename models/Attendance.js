import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        shift_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shift",
            default: null
        },

        date: {
            type: String,
            required: true
        },

        check_in_at: {
            type: Date,
            default: null
        },

        check_out_at: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ["Present", "Absent", "Half Day", "On Leave", "Late"],
            default: "Present"
        },

        total_hours: {
            type: Number,
            default: 0
        },

        notes: {
            type: String,
            default: ""
        },

        marked_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

attendanceSchema.index({ restaurant_id: 1, staff_id: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);