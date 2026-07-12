import mongoose from "mongoose";

const statusHistorySchema =
  new mongoose.Schema({

    status: {
      type: String,
      required: true
    },

    changed_at: {
      type: Date,
      default: Date.now
    },

    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    remarks: {
      type: String,
      default: ""
    }

  }, {
    _id: false
  });

const orderSchema = new mongoose.Schema(
  {
    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },

    order_number: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    customer_name: {
      type: String,
      required: true,
      trim: true,
    },

    customer_phone: {
      type: String,
      default: "",
      trim: true,
    },

    customer_email: {
      type: String,
      default: "",
      trim: true,
    },

    order_type: {
      type: String,
      enum: [
        "Dine-In",
        "Takeaway",
        "Delivery",
      ],
      default: "Dine-In",
    },

    subtotal: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    gst_percentage: {
      type: Number,
      default: 5
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
      required: true,
    },

    payment_method: {
      type: String,
      enum: [
        "Cash",
        "Card",
        "UPI",
        "Online",
      ],
      default: "Cash",
    },

    payment_status: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Failed",
        "Refunded",
      ],
      default: "Pending",
    },

    order_status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Preparing",
        "Ready",
        "Served",
        "Completed",
        "Cancelled",
        "Rejected",
      ],
      default: "Pending",
    },

  
    status_history: [statusHistorySchema],

    accepted_at: { type: Date, default: null },
    preparing_at: { type: Date, default: null },
    ready_at: { type: Date, default: null },
    served_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },

    special_instruction: {
      type: String,
      default: "",
    },

    total_items: {
      type: Number,
      default: 0,
    },

    estimated_time: {
      type: Number,
      default: 20,
    },

    coupon_code: {
      type: String,
      default: "",
    },

    coupon_discount: {
      type: Number,
      default: 0,
    },

    tax_percentage: {
      type: Number,
      default: 5,
    },

    invoice_number: {
      type: String,
      default: "",
    },

    served_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    chef_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OrderItem",
      },
    ],

    table_number: {
      type: String,
      default: "",
    },

    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice"
    },

    bill_requested: {
      type: Boolean,
      default: false
    },

    bill_requested_at: {
      type: Date,
      default: null
    },

    bill_requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    merged_into: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },

    merged_at: {
      type: Date,
      default: null
    },

    merged_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Order",
  orderSchema
);