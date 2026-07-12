import jwt from "jsonwebtoken";

import SuperAdmin from "../models/SuperAdmin.js";
import sendResponse from "../utils/sendResponse.js";
import createPasswordResetControllers from "../utils/passwordReset.js";

/*
=========================================================
SUPER ADMIN LOGIN
POST /api/super-admin/auth/login
=========================================================
*/

export const superAdminLogin = async (req, res, next) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            throw new Error("Email and password are required.");
        }

        const superAdmin = await SuperAdmin.findOne({ email: email.toLowerCase().trim() })
            .select("+password");

        if (!superAdmin) {
            throw new Error("Invalid email or password.");
        }

        if (!superAdmin.is_active) {
            throw new Error("This account has been deactivated.");
        }

        const isMatch = await superAdmin.comparePassword(password);

        if (!isMatch) {
            throw new Error("Invalid email or password.");
        }

        const token = jwt.sign(
            { id: superAdmin._id, role: superAdmin.role },
            process.env.SUPER_ADMIN_JWT_SECRET,
            { expiresIn: "8h" }
        );

        superAdmin.last_login_at = new Date();

        await superAdmin.save();

        res.cookie("superAdminToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 8 * 60 * 60 * 1000
        });

        sendResponse(res, 200, true, "Login successful.", {
            token,
            super_admin: {
                id: superAdmin._id,
                name: superAdmin.name,
                email: superAdmin.email,
                role: superAdmin.role
            }
        });

    } catch (error) { next(error) }

};

/*
=========================================================
CREATE ADDITIONAL SUPER ADMIN
POST /api/super-admin/auth/create
=========================================================
*/

export const createSuperAdmin = async (req, res, next) => {

    try {

        if (req.superAdmin.role !== "Super Admin") {
            throw new Error("Only a Super Admin can create new platform accounts.");
        }

        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            throw new Error("Name, email, and password are required.");
        }

        const existing = await SuperAdmin.findOne({ email: email.toLowerCase().trim() });

        if (existing) {
            throw new Error("An account with this email already exists.");
        }

        const newAdmin = await SuperAdmin.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: role || "Platform Support"
        });

        sendResponse(res, 201, true, "Platform account created successfully.", {
            id: newAdmin._id,
            name: newAdmin.name,
            email: newAdmin.email,
            role: newAdmin.role
        });

    } catch (error) { next(error) }

};

/*
=========================================================
GET CURRENT SUPER ADMIN PROFILE
GET /api/super-admin/auth/me
=========================================================
*/

export const getSuperAdminProfile = async (req, res, next) => {

    try {

        sendResponse(res, 200, true, "Profile fetched successfully.", {
            id: req.superAdmin._id,
            name: req.superAdmin.name,
            email: req.superAdmin.email,
            role: req.superAdmin.role,
            last_login_at: req.superAdmin.last_login_at
        });

    } catch (error) { next(error) }

};

/*
=========================================================
LOGOUT
POST /api/super-admin/auth/logout
=========================================================
*/

export const superAdminLogout = async (req, res, next) => {

    try {
        res.clearCookie("superAdminToken");
        sendResponse(res, 200, true, "Logged out successfully.", null);

    } catch (error) { next(error) }

};

/*
=========================================================
FORGOT / VERIFY / RESET PASSWORD
Same engine as the restaurant-side User model, pointed at the
SuperAdmin collection instead. See utils/passwordReset.js.
POST /api/super-admin/auth/forgot-password         { email }
GET  /api/super-admin/auth/verify-reset-token/:token
POST /api/super-admin/auth/reset-password/:token   { new_password, confirm_password }
=========================================================
*/

const superAdminPasswordReset = createPasswordResetControllers({

    Model: SuperAdmin,

    // Where the frontend's super-admin reset page lives, e.g. /super-admin/reset-password/<token>
    frontendResetPath: "/super-admin/reset-password",

    getDisplayName: (doc) => doc.name,

    // SuperAdmin hashes its own password via a pre-save hook (see models/SuperAdmin.js) —
    // just assign the raw value here and let that hook do the hashing on save
    setPassword: async (doc, rawPassword) => {
        doc.password = rawPassword;
    }

});

export const superAdminForgotPassword = superAdminPasswordReset.forgotPassword;
export const superAdminVerifyResetToken = superAdminPasswordReset.verifyResetToken;
export const superAdminResetPassword = superAdminPasswordReset.resetPassword;