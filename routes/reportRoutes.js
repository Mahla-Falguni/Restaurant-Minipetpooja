import express from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import checkRole from "../middleware/checkRoleMiddleware.js";

import { getSalesSummary, getGSTReport, getItemWiseSales, getCategoryWiseSales, getPaymentModeSummary, getCashierWiseSummary, exportReport, getExportHistory } from "../controllers/reportController.js";

const router = express.Router();

router.use(verifyJWT);

/*
=========================================
DASHBOARD DATA
=========================================
*/

router.get("/sales-summary", checkRole("Manager", "Admin"), getSalesSummary);

router.get("/gst", checkRole("Manager", "Admin"), getGSTReport);

router.get("/item-wise", checkRole("Manager", "Admin"), getItemWiseSales);

router.get("/category-wise", checkRole("Manager", "Admin"), getCategoryWiseSales);

router.get("/payment-mode-summary", checkRole("Manager", "Admin"), getPaymentModeSummary);

router.get("/cashier-wise", checkRole("Manager", "Admin"), getCashierWiseSummary);

/*
=========================================
CSV EXPORT
=========================================
*/

router.get("/export", checkRole("Manager", "Admin"), exportReport);

/*
=========================================
EXPORT AUDIT LOG
=========================================
*/

router.get("/export-history", checkRole("Admin"), getExportHistory);

export default router;