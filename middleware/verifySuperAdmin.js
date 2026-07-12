import jwt from "jsonwebtoken";

import SuperAdmin from "../models/SuperAdmin.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================
VERIFY SUPER ADMIN
=========================================
*/

const verifySuperAdmin = async (req, res, next) => {

    try {

        const authHeader = req.headers.authorization || req.headers.Authorization;

        let token;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token && req.cookies) {
            token = req.cookies.superAdminToken;
        }

        if (!token) {
            return sendResponse(res, 401, false, "Not authorized. No token provided.");
        }

        let decoded;

        try {
            decoded = jwt.verify(token, process.env.SUPER_ADMIN_JWT_SECRET);
        } catch (err) {

            if (err.name === "TokenExpiredError") {
                return sendResponse(res, 401, false, "Session expired. Please log in again.");
            }

            return sendResponse(res, 401, false, "Not authorized. Invalid token.");

        }

        const superAdmin = await SuperAdmin.findById(decoded.id);

        if (!superAdmin || !superAdmin.is_active) {
            return sendResponse(res, 401, false, "Not authorized. Account not found or inactive.");
        }

        req.superAdmin = superAdmin;

        next();

    } catch (error) { next(error) }

};

export default verifySuperAdmin;