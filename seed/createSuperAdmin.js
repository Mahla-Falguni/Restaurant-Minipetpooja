import mongoose from "mongoose";
import dotenv from "dotenv";

import SuperAdmin from "../models/SuperAdmin.js";

dotenv.config();

const createSuperAdmin = async () => {
    try {

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log("✅ MongoDB Connected");

        // Check if Super Admin already exists
        const existing = await SuperAdmin.findOne({
            email: "superadmin@example.com"
        });

        if (existing) {
            console.log("⚠️ Super Admin already exists.");
            process.exit();
        }

        // Create Super Admin
        const superAdmin = await SuperAdmin.create({
            name: "Super Admin",
            email: "superadmin@example.com",
            password: "123456",      // <-- Plain password
            role: "Super Admin"
        });

        console.log("✅ Super Admin Created Successfully");
        console.log("--------------------------------");
        console.log("Email    : superadmin@example.com");
        console.log("Password : 123456");
        console.log("ID       :", superAdmin._id);

        process.exit();

    } catch (error) {

        console.error("❌ Error:", error.message);

        process.exit(1);
    }
};

createSuperAdmin();