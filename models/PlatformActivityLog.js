import mongoose from "mongoose";

const platformActivityLogSchema = new mongoose.Schema(
    {
        super_admin_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SuperAdmin",
            required: true,
            index: true
        },

        action: {
            type: String,
            required: true
        },

        target_restaurant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            default: null
        },

        details: {
            type: String,
            default: ""
        },

        ip_address: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

platformActivityLogSchema.index({ target_restaurant_id: 1, createdAt: -1 });

export default mongoose.model("PlatformActivityLog", platformActivityLogSchema);