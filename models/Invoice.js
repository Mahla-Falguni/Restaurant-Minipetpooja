import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({

    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true
    },

    restaurant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true
    },

    invoice_number: {
        type: String,
        required: true,
        unique: true
    },

    invoice_date: {
        type: Date,
        default: Date.now
    },

    subtotal: Number,
    cgst: Number,
    sgst: Number,
    service_charge: Number,
    discount: Number,
    grand_total: Number,

    payment_status: {
        type: String,
        enum: [
            "Pending",
            "Paid",
            "Refunded"
        ],
        default: "Pending"
    }

}, {
    timestamps: true
});

export default mongoose.model(
    "Invoice",
    invoiceSchema
);