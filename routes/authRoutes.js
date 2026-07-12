import express from "express";

import { register, login, getProfile, forgotPassword, verifyResetToken, resetPassword, } from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();


// PUBLIC ROUTES
// http://localhost:5000/api/auth/register
router.post("/register", register);

// http://localhost:5000/api/auth/login
router.post("/login", login);

// Shared by every role (Admin, Manager, Waiter, Cashier, Kitchen) 
// http://localhost:5000/api/auth/forgot-password
router.post("/forgot-password", forgotPassword);

// http://localhost:5000/api/auth/verify-reset-token/:token
router.get("/verify-reset-token/:token", verifyResetToken);

// http://localhost:5000/api/auth/reset-password/:token
router.post("/reset-password/:token", resetPassword);


// PRIVATE ROUTES
// All roles (Admin, Manager, Waiter, Cashier, Kitchen) can access their profile
// http://localhost:5000/api/auth/profile
router.get("/profile", authMiddleware, getProfile);

export default router;