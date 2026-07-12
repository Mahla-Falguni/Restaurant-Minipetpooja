import mongoose from "mongoose";

const orderItemSchema =
  new mongoose.Schema(
    {
      order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        index: true,
      },

      menu_item_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
      },

      item_name: {
        type: String,
        required: true,
      },

      item_image: {
        type: String,
        default: "",
      },

      category_name: {
        type: String,
        default: ""
      },

      food_type: {
        type: String,
        default: ""
      },

      preparation_time: {
        type: Number,
        default: 0
      },

      spice_level: {
        type: String,
        default: ""
      },

      calories: {
        type: Number,
        default: 0
      },

      original_price: {
        type: Number,
        required: true,
      },

      discount_price: {
        type: Number,
        default: 0,
      },

      final_price: {
        type: Number,
        required: true,
      },

      quantity: {
        type: Number,
        required: true,
        default: 1,
      },

      total_price: {
        type: Number,
        required: true,
      },

      category_name: {
        type: String,
        default: ""
      },

      food_type: {
        type: String,
        default: ""
      },

      preparation_time: {
        type: Number,
        default: 0
      },

      spice_level: {
        type: String,
        default: ""
      },

      calories: {
        type: Number,
        default: 0
      },

      payment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null
      },

      special_instruction: {
        type: String,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

export default mongoose.model(
  "OrderItem",
  orderItemSchema
);