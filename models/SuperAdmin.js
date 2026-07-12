import mongoose from "mongoose";
import bcrypt from "bcrypt";


const superAdminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        role: {
            type: String,
            enum: ["Super Admin", "Platform Support"],
            default: "Super Admin"
        },

        is_active: {
            type: Boolean,
            default: true
        },

        last_login_at: {
            type: Date,
            default: null
        },

        reset_password_token: {
            type: String,
            select: false
        },

        reset_password_expires: {
            type: Date,
            select: false
        }
    },
    {
        timestamps: true
    }
);

superAdminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

superAdminSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("SuperAdmin", superAdminSchema);