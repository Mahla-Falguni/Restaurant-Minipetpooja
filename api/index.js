import app from "../app.js";
import connectDB from "../db.js";

let isConnected = false;

export default async function handler(req, res) {
  // Return 200 OK immediately for OPTIONS preflight requests to bypass DB connection
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Ensure database connection is active and reused
  if (!isConnected) {
    const maskedUri = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/:([^@]+)@/, ":******@") : "undefined";
    console.log(`Connecting to database asynchronously with URI: ${maskedUri}`);
    connectDB()
      .then(() => {
        isConnected = true;
      })
      .catch((err) => {
        console.error("Database connection failed asynchronously:", err.message);
      });
  }

  // Forward the request to the Express application
  return app(req, res);
}
