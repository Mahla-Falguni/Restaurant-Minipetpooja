import mongoose from "mongoose";

/*
=========================================
REPORT EXPORT LOG MODEL
=========================================
*/

const reportExportLogSchema = new mongoose.Schema(
    {
        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true
        },

        report_type: {
            type: String,
            enum: [
                "Sales Summary",
                "GST Report",
                "Item Wise Sales",
                "Payment Mode Summary",
                "Cashier Wise Summary",
                "Category Wise Sales"
            ],
            required: true
        },

        date_from: {
            type: Date,
            required: true
        },

        date_to: {
            type: Date,
            required: true
        },

        format: {
            type: String,
            enum: ["CSV", "JSON"],
            default: "CSV"
        },

        exported_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

reportExportLogSchema.index({ restaurant_id: 1, createdAt: -1 });

export default mongoose.model("ReportExportLog", reportExportLogSchema);