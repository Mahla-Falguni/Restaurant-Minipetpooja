import express from "express";

import verifyJWT from "../middleware/verifyJWT.js";
import checkRole from "../middleware/checkRoleMiddleware.js";
import requireFeature from "../middleware/checkPlanFeature.js";

import { createShift, getShifts, updateShift, deleteShift } from "../controllers/shiftController.js";
import { checkIn, checkOut, markAttendance, getAttendance, getMonthlyAttendanceSummary } from "../controllers/attendanceController.js";
import { applyLeave, getLeaveRequests, reviewLeaveRequest, cancelLeaveRequest } from "../controllers/leaveController.js";
import { generatePayroll, finalizePayroll, markPayrollPaid, getPayrollRecords, getPayrollSummary } from "../controllers/payrollController.js";
import { createStaffMember, getStaffMembers, toggleStaffStatus } from "../controllers/staffMemberController.js";

const router = express.Router();

router.use(verifyJWT);

// Entire staff module (members, shifts, attendance, leave, payroll) is
// gated behind the "Staff & Payroll" plan feature — a restaurant on
// Starter/Growth without this feature gets a clear upgrade message
// instead of silently failing.
router.use(requireFeature("Staff & Payroll"));

/*
=========================================
STAFF MEMBERS
=========================================
*/

router.post("/members", checkRole("Manager", "Admin"), createStaffMember);
router.get("/members", checkRole("Manager", "Admin"), getStaffMembers);
router.patch("/members/:id/status", checkRole("Admin"), toggleStaffStatus);

/*
=========================================
SHIFTS
=========================================
*/

router.post("/shifts", checkRole("Manager", "Admin"), createShift);
router.get("/shifts", checkRole("Waiter", "Cashier", "Manager", "Admin"), getShifts);
router.put("/shifts/:id", checkRole("Manager", "Admin"), updateShift);
router.delete("/shifts/:id", checkRole("Manager", "Admin"), deleteShift);

/*
=========================================
ATTENDANCE
=========================================
*/

router.post("/attendance/check-in", checkIn);
router.post("/attendance/check-out", checkOut);
router.post("/attendance/mark", checkRole("Manager", "Admin"), markAttendance);
router.get("/attendance", getAttendance);
router.get("/attendance/summary", checkRole("Manager", "Admin"), getMonthlyAttendanceSummary);

/*
=========================================
LEAVE REQUESTS
=========================================
*/

router.post("/leave/apply", applyLeave);
router.get("/leave", getLeaveRequests);
router.put("/leave/:id/review", checkRole("Manager", "Admin"), reviewLeaveRequest);
router.put("/leave/:id/cancel", cancelLeaveRequest);

/*
=========================================
PAYROLL
=========================================
*/

router.post("/payroll/generate", checkRole("Manager", "Admin"), generatePayroll);
router.put("/payroll/:id/finalize", checkRole("Admin"), finalizePayroll);
router.put("/payroll/:id/mark-paid", checkRole("Admin"), markPayrollPaid);
router.get("/payroll", getPayrollRecords);
router.get("/payroll/summary", checkRole("Manager", "Admin"), getPayrollSummary);

export default router;