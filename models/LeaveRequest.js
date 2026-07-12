import mongoose from "mongoose";


const leaveRequestSchema = new mongoose.Schema(
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

        leave_type: {
            type: String,
            enum: ["Sick", "Casual", "Paid", "Unpaid", "Emergency"],
            required: true
        },

        from_date: {
            type: Date,
            required: true
        },

        to_date: {
            type: Date,
            required: true
        },

        reason: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Cancelled"],
            default: "Pending"
        },

        reviewed_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        review_remarks: {
            type: String,
            default: ""
        },

        reviewed_at: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

leaveRequestSchema.index({ restaurant_id: 1, staff_id: 1, status: 1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);