import express from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import checkRole from "../middleware/checkRoleMiddleware.js";


import { getCashierDashboard, checkoutOrder, addPayment, getInvoiceForReprint } from "../controllers/cashierController.js";
import { requestRefund, approveRefund, rejectRefund, completeRefund, getRefunds, getRefundById } from "../controllers/refundController.js";
import { openDrawer, recordCashPaidOut, getDrawerStatus, closeDrawer, getDrawerHistory } from "../controllers/cashDrawerController.js";
import { getZReport, getCashierAnalytics } from "../controllers/reportController.js";

const router = express.Router();

// -----------------------------------------
// All cashier routes require login,
// and (besides refund approval) the Cashier/Manager/Admin role.
// -----------------------------------------

router.use(verifyJWT);

/*
=========================================
DASHBOARD
=========================================
*/

router.get("/dashboard", checkRole("Cashier", "Manager", "Admin"), getCashierDashboard);

/*
=========================================
CHECKOUT
=========================================
*/

router.post("/checkout", checkRole("Cashier", "Manager", "Admin"), checkoutOrder);

/*
=========================================
MULTI-METHOD PAYMENT
=========================================
*/

router.post("/add-payment", checkRole("Cashier", "Manager", "Admin"), addPayment);

/*
=========================================
INVOICE REPRINT
=========================================
*/

router.get("/invoice/:order_id", checkRole("Cashier", "Manager", "Admin"), getInvoiceForReprint);

/*
=========================================
REFUNDS
=========================================
*/

router.post("/refund/request", checkRole("Cashier", "Manager", "Admin"), requestRefund);

router.put("/refund/:refund_id/approve", checkRole("Manager", "Admin"), approveRefund);

router.put("/refund/:refund_id/reject", checkRole("Manager", "Admin"), rejectRefund);

router.put("/refund/:refund_id/complete", checkRole("Cashier", "Manager", "Admin"), completeRefund);

router.get("/refunds", checkRole("Cashier", "Manager", "Admin"), getRefunds);

router.get("/refund/:refund_id", checkRole("Cashier", "Manager", "Admin"), getRefundById);

/*
=========================================
CASH DRAWER
=========================================
*/

router.post("/drawer/open", checkRole("Cashier", "Manager", "Admin"), openDrawer);

router.post("/drawer/paid-out", checkRole("Cashier", "Manager", "Admin"), recordCashPaidOut);

router.get("/drawer/status", checkRole("Cashier", "Manager", "Admin"), getDrawerStatus);

router.post("/drawer/close", checkRole("Cashier", "Manager", "Admin"), closeDrawer);

router.get("/drawer/history", checkRole("Cashier", "Manager", "Admin"), getDrawerHistory);

/*
=========================================
Z REPORT
=========================================
*/

router.get("/z-report", checkRole("Cashier", "Manager", "Admin"), getZReport);

/*
=========================================
ANALYTICS
=========================================
*/

router.get("/analytics", checkRole("Manager", "Admin"), getCashierAnalytics);

export default router;