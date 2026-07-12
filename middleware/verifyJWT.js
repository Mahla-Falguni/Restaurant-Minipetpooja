import jwt from "jsonwebtoken";

import User from "../models/User.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================
VERIFY JWT
=========================================
*/

const verifyJWT = async (req, res, next) => {

    try {

        let token;

        const authHeader =
            req.headers.authorization ||
            req.headers.Authorization;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token && req.cookies) {
            token = req.cookies.token || req.cookies.accessToken;
        }

        if (!token) {
            return sendResponse(res, 401, false, "Not authorized. No token provided.");
        }

        let decoded;

        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        }
        catch (err) {

            if (err.name === "TokenExpiredError") {
                return sendResponse(
                    res,
                    401,
                    false,
                    "Session expired. Please log in again."
                );
            }

            return sendResponse(res, 401, false, "Not authorized. Invalid token.");
        }

        const userId =
            decoded.id ||
            decoded._id ||
            decoded.userId;

        if (!userId) {
            return sendResponse(res, 401, false, "Not authorized. Malformed token.");
        }

        const user = await User.findById(userId).select("-password");

        if (!user) {
            return sendResponse(res, 401, false, "Not authorized. User no longer exists.");
        }

        req.user = user;

        next();

    }
    catch (error) { next(error) }

};

export default verifyJWT;