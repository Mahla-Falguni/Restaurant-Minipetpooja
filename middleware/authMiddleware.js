import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {

  try {

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith(
        "Bearer"
      )) {

      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      next();

    } else {

      return res.status(401).json({
        success: false,
        message:
          "Unauthorized. No token found.",
      });

    }

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Invalid Token",
    });

  }
};

export default authMiddleware;