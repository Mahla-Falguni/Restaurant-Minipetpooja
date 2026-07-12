import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema(
  {
    restaurant_name: {
      type: String,
      required: true,
    },

    owner_name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
    },

    phone: {
      type: String,
    },

    address: {
      type: String,
    },

    city: {
      type: String,
    },

    state: {
      type: String,
    },

    gst_number: {
      type: String,
    },

    logo: {
      type: String,
      default: "",
    },

    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Active", "Suspended"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Restaurant",
  restaurantSchema
);