import bcrypt from "bcryptjs";

import User from "../models/User.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================
STAFF MEMBER MANAGEMENT
CREATE STAFF MEMBER
POST /api/staff/members
=========================================
*/


export const createStaffMember = async (req, res, next) => {
    try {
        const { first_name, last_name, email, phone, password, role } = req.body;

        if (!first_name || !last_name || !email || !password || !role) {
            throw new Error("First name, last name, email, password, and role are required.");
        }

        if (!["Manager", "Waiter", "Cashier", "Kitchen"].includes(role)) {
            throw new Error("Invalid staff role.");
        }

        const existing = await User.findOne({ email });
        if (existing) {
            throw new Error("A user with this email already exists.");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const staff = await User.create({
            restaurant_id: req.user.restaurant_id,
            first_name,
            last_name,
            email,
            phone,
            password: hashedPassword,
            role,
        });

        const { password: _pw, ...staffData } = staff.toObject();

        sendResponse(res, 201, true, "Staff member created successfully.", staffData);
    } catch (error) {
        next(error);
    }
};

// GET STAFF MEMBERS (everyone but the Admin themselves)
// GET /api/staff/members
export const getStaffMembers = async (req, res, next) => {
    try {
        const staff = await User.find({
            restaurant_id: req.user.restaurant_id,
        })
            .select("-password")
            .sort({ createdAt: -1 });

        sendResponse(res, 200, true, "Staff members fetched successfully.", staff);
    } catch (error) {
        next(error);
    }
};

// TOGGLE STAFF ACTIVE STATUS
// PATCH /api/staff/members/:id/status
export const toggleStaffStatus = async (req, res, next) => {
    try {
        const staff = await User.findOne({
            _id: req.params.id,
            restaurant_id: req.user.restaurant_id,
        });

        if (!staff) {
            return sendResponse(res, 404, false, "Staff member not found.");
        }

        staff.status = !staff.status;
        await staff.save();

        const { password: _pw, ...staffData } = staff.toObject();

        sendResponse(res, 200, true, "Staff status updated.", staffData);
    } catch (error) {
        next(error);
    }
};