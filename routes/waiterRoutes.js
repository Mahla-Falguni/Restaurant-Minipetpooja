import express from "express";

import { getDashboard, getAssignedTables, getTableDetails, assignTable, transferTable, mergeTables, createSplitBill, getSplitBills, paySplitBill, cancelSplitBill, requestBill, addOrderItem, updateOrderItem, removeOrderItem } from "../controllers/waiterController.js";
import verifyJWT from "../middleware/verifyJWT.js";
import checkRoleMiddleware from "../middleware/checkRoleMiddleware.js";

const router = express.Router();

router.use(verifyJWT);


router.get("/dashboard", getDashboard);

router.get("/tables", getAssignedTables);

router.get("/table/:id", getTableDetails);

router.post("/assign-table", assignTable);

router.put("/transfer-table", transferTable);

router.post("/merge-tables", mergeTables);

router.post("/split-bill", createSplitBill);

router.get("/split-bills/:order_id", getSplitBills);

router.put("/split-payment/:split_id", paySplitBill);

router.put("/cancel-split/:split_id", cancelSplitBill);

router.post("/request-bill", requestBill);

router.post("/add-item", addOrderItem);

router.put("/update-item", updateOrderItem);

router.delete("/remove-item/:id", removeOrderItem);

export default router;