import express from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import { getDashboardOverview } from "../controllers/dashboardController.js";

const router = express.Router();

router.use(verifyJWT);

/*
=========================================
GET /api/dashboard/overview
=========================================
*/

router.get("/overview", getDashboardOverview);

export default router;