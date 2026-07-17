import app from "../app.js";
import connectDB from "../db.js";

let isConnected = false;

export default async function handler(req, res) {
  // Return 200 OK immediately for OPTIONS preflight requests to bypass DB connection but pass CORS checks
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    const allowedOrigins = [
      "https://frontend-chi-pink-64.vercel.app",
      "https://frontend-git-main-mahla-falgunis-projects.vercel.app",
      "https://restaurant-minipetpooja-frontend.vercel.app",
      "http://localhost:5173"
    ];

    if (origin && (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app"))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type, Authorization, X-Requested-With");
    }
    return res.status(200).end();
  }

  // Ensure database connection is active and reused
  if (!isConnected) {
    const maskedUri = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/:([^@]+)@/, ":******@") : "undefined";
    console.log(`Connecting to database with URI: ${maskedUri}`);
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error("Database connection failed in serverless handler:", err.message);
      return res.status(500).json({
        success: false,
        message: "Database connection failed",
        error: err.message
      });
    }
  }

  // Forward the request to the Express application
  return app(req, res);
}
