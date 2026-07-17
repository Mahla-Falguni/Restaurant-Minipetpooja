import mongoose from "mongoose";

// Register connection error listener to prevent unhandled process exit
mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection event error:", err.message);
});

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log("MongoDB is already connected.");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    throw error;
  }
};

export default connectDB;