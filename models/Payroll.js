import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
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

        month: {
            type: Number, // 1-12
            required: true
        },

        year: {
            type: Number,
            required: true
        },

        base_salary: {
            type: Number,
            required: true
        },

        days_present: {
            type: Number,
            default: 0
        },

        days_absent: {
            type: Number,
            default: 0
        },

        days_on_leave: {
            type: Number,
            default: 0
        },

        overtime_hours: {
            type: Number,
            default: 0
        },

        overtime_rate_per_hour: {
            type: Number,
            default: 0
        },

        bonuses: {
            type: Number,
            default: 0
        },

        deductions: {
            type: Number,
            default: 0
        },

        deduction_remarks: {
            type: String,
            default: ""
        },

        net_pay: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            enum: ["Draft", "Finalized", "Paid"],
            default: "Draft"
        },

        paid_at: {
            type: Date,
            default: null
        },

        payment_method: {
            type: String,
            enum: ["Bank Transfer", "Cash", "Cheque", "UPI", null],
            default: null
        },

        generated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

payrollSchema.index({ restaurant_id: 1, staff_id: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Payroll", payrollSchema);