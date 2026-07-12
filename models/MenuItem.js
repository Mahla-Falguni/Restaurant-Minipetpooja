import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    item_name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    image_public_id: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discount_price: {
      type: Number,
      default: 0,
    },

    food_type: {
      type: String,
      enum: ["Veg", "Non-Veg", "Egg"],
      default: "Veg",
    },

    preparation_time: {
      type: Number,
      default: 15,
    },

    calories: {
      type: Number,
      default: 0,
    },

    spice_level: {
      type: String,
      enum: ["Mild", "Medium", "Hot"],
      default: "Medium",
    },

    is_available: {
      type: Boolean,
      default: true,
    },

    status: {
      type: Boolean,
      default: true,
    },

    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("MenuItem", menuItemSchema);