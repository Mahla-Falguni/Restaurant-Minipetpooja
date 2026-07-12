import bcrypt from "bcryptjs";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import sendResponse from "../utils/sendResponse.js";
import createPasswordResetControllers from "../utils/passwordReset.js";

/*
===================================
REGISTER
POST /api/auth/register
===================================
*/

export const register = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      role
    } = req.body;

    const existingUser =
      await User.findOne({
        email
      });

    if (existingUser) {
      return sendResponse(res, 400, false, "User already exists");
    }

    const salt = await bcrypt.genSalt(10);

    const hashedPassword =
      await bcrypt.hash(password, salt);

    const user = await User.create({
      first_name,
      last_name,
      email,
      phone,
      password:
        hashedPassword,

      role:
        role || "Admin",
    });

    const token =
      generateToken(user._id);

    const safeUser = user.toObject();
    delete safeUser.password;

    sendResponse(res, 201, true, "Registration Successful",
      { user: safeUser, token, });

  } catch (error) { next(error); }
};

/*
===================================
LOGIN
POST /api/auth/login
===================================
*/

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return sendResponse(res, 400, false, "Invalid Credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return sendResponse(res, 400, false, "Invalid Credentials");
    }

    const token =
      generateToken(user._id);

    const safeUser = user.toObject();
    delete safeUser.password;

    sendResponse(res, 200, true, "Login Successful",
      { user: safeUser, token, });

  } catch (error) { next(error); }
};

/*
===================================
PROFILE
GET /api/auth/profile
===================================
*/

export const getProfile =
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).select("-password");

      sendResponse(res, 200, true, "Profile Fetched", user);

    } catch (error) { next(error); }
  };

/*
===================================
FORGOT / VERIFY / RESET PASSWORD
Shared across every role that logs in through this User model —
Admin, Manager, Waiter, Cashier, Kitchen all use these same
three endpoints. See utils/passwordReset.js for the engine.
POST /api/auth/forgot-password         { email }
GET  /api/auth/verify-reset-token/:token
POST /api/auth/reset-password/:token   { new_password, confirm_password }
===================================
*/

const userPasswordReset = createPasswordResetControllers({

  Model: User,

  // Where the frontend's reset-password page lives, e.g. /reset-password/<token>
  frontendResetPath: "/reset-password",

  getDisplayName: (doc) => `${doc.first_name} ${doc.last_name}`.trim(),

  // User model hashes its own password (see register() above) — mirror that here
  setPassword: async (doc, rawPassword) => {
    const salt = await bcrypt.genSalt(10);
    doc.password = await bcrypt.hash(rawPassword, salt);
  }

});

export const forgotPassword = userPasswordReset.forgotPassword;
export const verifyResetToken = userPasswordReset.verifyResetToken;
export const resetPassword = userPasswordReset.resetPassword;