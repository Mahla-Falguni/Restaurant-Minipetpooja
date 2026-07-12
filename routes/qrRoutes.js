import express from "express";

import { generateQRForTable, generateQRForAllTables, getTableQR, } from "../controllers/qrController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requireFeature from "../middleware/checkPlanFeature.js";

const router = express.Router();

router.use(authMiddleware);

// Entire QR Menu module is gated behind the "QR Menu" plan feature.
// Generation logic itself is unchanged — this only gates access.
router.use(requireFeature("QR Menu"));

// http://localhost:5000/api/qr/table/:id  (regenerate one table's QR)
router.post("/table/:id", generateQRForTable);

// http://localhost:5000/api/qr/generate-all  (bulk-generate for every table)
router.post("/generate-all", generateQRForAllTables);

// http://localhost:5000/api/qr/table/:id  (fetch QR for preview/print)
router.get("/table/:id", getTableQR);

export default router;