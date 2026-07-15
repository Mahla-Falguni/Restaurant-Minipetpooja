import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import dns from "dns";
import net from "net";

// Routes
import authRoutes from "./routes/authRoutes.js";
import restaurantRoutes from "./routes/restaurantRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import qrRoutes from "./routes/qrRoutes.js";
import publicRoutes from "./routes/publicRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js";
import orderTimelineRoutes from "./routes/orderTimelineRoutes.js";
import waiterRoutes from "./routes/waiterRoutes.js"
import customerRoutes from "./routes/customerRoutes.js"
import reportRoutes from "./routes/reportRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import reservationRoutes from "./routes/reservationRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import cashierRoutes from "./routes/cashierRoutes.js";
import kitchenRoutes from "./routes/kitchenRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import razorpayWebhookRoutes from "./routes/razorpayWebhookRoutes.js";


// Middlewares
import notFoundMiddleware from "./middleware/notFoundMiddleware.js";
import errorMiddleware from "./middleware/errorMiddleware.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ==============================
   Global Middlewares
============================== */


const allowedOrigins = [
  "https://frontend-chi-pink-64.vercel.app",
  "https://frontend-git-main-mahla-falgunis-projects.vercel.app",
  "https://restaurant-minipetpooja-frontend.vercel.app",
  "http://localhost:5173"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

/*
=========================================
RAZORPAY WEBHOOK — must be mounted BEFORE express.json().
Signature verification needs the exact raw bytes Razorpay sent;
once express.json() parses the body into an object, those raw
bytes are gone and the signature can never be recomputed correctly.
=========================================
*/
app.use("/api/webhooks", express.raw({ type: "application/json" }), razorpayWebhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true, }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ==============================
   Health Check
============================== */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true, message: "Restaurant POS API Running 🚀",
  });
});

app.get("/api/test-network", (req, res) => {
  const host = "ac-lhtm1yi-shard-00-00.mtpoaoa.mongodb.net";
  const port = 27017;
  
  dns.lookup(host, (dnsErr, address, family) => {
    if (dnsErr) {
      return res.status(500).json({ success: false, phase: "dns", error: dnsErr.message });
    }
    
    const socket = new net.Socket();
    socket.setTimeout(2500);
    
    socket.connect(port, address, () => {
      socket.destroy();
      return res.status(200).json({
        success: true,
        phase: "tcp",
        message: `Successfully connected to ${host} (${address}) on port ${port}!`
      });
    });
    
    socket.on("error", (tcpErr) => {
      socket.destroy();
      return res.status(500).json({
        success: false,
        phase: "tcp",
        resolvedAddress: address,
        error: tcpErr.message
      });
    });
    
    socket.on("timeout", () => {
      socket.destroy();
      return res.status(500).json({
        success: false,
        phase: "tcp",
        resolvedAddress: address,
        error: "Connection timed out"
      });
    });
  });
});

/* ==============================
   API Routes
============================== */

app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/order-timeline", orderTimelineRoutes);
app.use("/api/waiter", waiterRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/cashier", cashierRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/dashboard", dashboardRoutes);



/* ==============================
   Error Handling
============================== */

app.use(notFoundMiddleware);

app.use(errorMiddleware);

export default app;