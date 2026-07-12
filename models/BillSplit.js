import mongoose from "mongoose";

const billSplitSchema = new mongoose.Schema(
    {

        restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },

        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true
        },

        invoice_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Invoice",
            default: null
        },

        split_number: {
            type: Number,
            required: true
        },

        split_type: {
            type: String,
            enum: [
                "Equal",
                "Custom",
                "Item",
                "Quantity"
            ],
            required: true
        },

        customer_name: {
            type: String,
            default: ""
        },

        customer_phone: {
            type: String,
            default: ""
        },

        customer_email: {
            type: String,
            default: ""
        },

        items: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "OrderItem"
            }
        ],

        subtotal: {
            type: Number,
            default: 0
        },

        discount: {
            type: Number,
            default: 0
        },

        coupon_discount: {
            type: Number,
            default: 0
        },

        gst_percentage: {
            type: Number,
            default: 0
        },

        cgst: {
            type: Number,
            default: 0
        },

        sgst: {
            type: Number,
            default: 0
        },

        service_charge_percentage: {
            type: Number,
            default: 0
        },

        service_charge: {
            type: Number,
            default: 0
        },

        grand_total: {
            type: Number,
            required: true
        },
        payment_status: {
            type: String,
            enum: [
                "Pending",
                "Partial",
                "Paid",
                "Failed",
                "Refunded"
            ],
            default: "Pending"
        },

        payment_method: {
            type: String,
            enum: [
                "Cash",
                "Card",
                "UPI",
                "Online"
            ],
            default: "Cash"
        },

        paid_amount: {
            type: Number,
            default: 0
        },

        due_amount: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            enum: [
                "Active",
                "Merged",
                "Cancelled"
            ],
            default: "Active"
        },

        remarks: {
            type: String,
            default: ""
        },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        paid_at: {
            type: Date,
            default: null
        }

    },

    {
        timestamps: true
    }
);

billSplitSchema.index({
    order_id: 1
});

billSplitSchema.index({
    restaurant_id: 1
});

billSplitSchema.index({
    payment_status: 1
});

billSplitSchema.index({
    split_number: 1
});

billSplitSchema.index({
    status: 1
});

export default mongoose.model(
    "BillSplit",
    billSplitSchema
);