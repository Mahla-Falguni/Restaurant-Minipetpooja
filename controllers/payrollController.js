import Payroll from "../models/Payroll.js";
import User from "../models/User.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
GENERATE PAYROLL FOR A STAFF MEMBER
POST /api/staff/payroll/generate
=========================================================
*/

export const generatePayroll = async (req, res, next) => {

    try {

        const {
            staff_id, month, year, base_salary,
            days_present, days_absent, days_on_leave,
            overtime_hours, overtime_rate_per_hour,
            bonuses, deductions, deduction_remarks
        } = req.body;

        if (!staff_id || !month || !year || base_salary === undefined) {
            throw new Error("Staff ID, month, year, and base salary are required.");
        }

        const existing = await Payroll.findOne({
            restaurant_id: req.user.restaurant_id,
            staff_id,
            month,
            year
        });

        if (existing) {
            throw new Error("Payroll for this staff member and month has already been generated.");
        }

        const overtimePay = (overtime_hours || 0) * (overtime_rate_per_hour || 0);

        const netPay =
            Number(base_salary) +
            overtimePay +
            (bonuses || 0) -
            (deductions || 0);

        if (netPay < 0) {
            throw new Error("Net pay cannot be negative — check deductions.");
        }

        const payroll = await Payroll.create({
            restaurant_id: req.user.restaurant_id,
            staff_id,
            month,
            year,
            base_salary,
            days_present: days_present || 0,
            days_absent: days_absent || 0,
            days_on_leave: days_on_leave || 0,
            overtime_hours: overtime_hours || 0,
            overtime_rate_per_hour: overtime_rate_per_hour || 0,
            bonuses: bonuses || 0,
            deductions: deductions || 0,
            deduction_remarks: deduction_remarks || "",
            net_pay: Number(netPay.toFixed(2)),
            generated_by: req.user.id
        });

        sendResponse(res, 201, true, "Payroll generated successfully.", payroll);

    } catch (error) { next(error); }

};

/*
=========================================================
FINALIZE PAYROLL (lock further edits)
PUT /api/staff/payroll/:id/finalize
=========================================================
*/

export const finalizePayroll = async (req, res, next) => {

    try {

        const { id } = req.params;

        const payroll = await Payroll.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!payroll) {
            throw new Error("Payroll record not found.");
        }

        if (payroll.status !== "Draft") {
            throw new Error(`Payroll is already ${payroll.status}.`);
        }

        payroll.status = "Finalized";

        await payroll.save();

        sendResponse(res, 200, true, "Payroll finalized successfully.", payroll);

    } catch (error) { next(error); }

};

/*
=========================================================
PART 8.10D-3 — MARK PAYROLL AS PAID
PUT /api/staff/payroll/:id/mark-paid
=========================================================
*/

export const markPayrollPaid = async (req, res, next) => {

    try {

        const { id } = req.params;

        const { payment_method } = req.body;

        if (!payment_method) {
            throw new Error("Payment method is required.");
        }

        const payroll = await Payroll.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!payroll) {
            throw new Error("Payroll record not found.");
        }

        if (payroll.status === "Paid") {
            throw new Error("This payroll has already been marked as paid.");
        }

        if (payroll.status !== "Finalized") {
            throw new Error("Payroll must be finalized before marking as paid.");
        }

        payroll.status = "Paid";
        payroll.payment_method = payment_method;
        payroll.paid_at = new Date();

        await payroll.save();

        sendResponse(res, 200, true, "Payroll marked as paid successfully.", payroll);

    } catch (error) { next(error); }

};

/*
=========================================================
GET PAYROLL RECORDS
GET /api/staff/payroll?staff_id=...&month=7&year=2026&status=Paid
=========================================================
*/

export const getPayrollRecords = async (req, res, next) => {

    try {

        const { staff_id, month, year, status, page = 1, limit = 20 } = req.query;
        const filter = { restaurant_id: req.user.restaurant_id };

        if (["Manager", "Admin"].includes(req.user.role)) {
            if (staff_id) filter.staff_id = staff_id;
        } else {

            filter.staff_id = req.user.id;

        }

        if (month) filter.month = Number(month);
        if (year) filter.year = Number(year);
        if (status) filter.status = status;
        const skip = (Number(page) - 1) * Number(limit);
        const [records, total] = await Promise.all([

            Payroll.find(filter)
                .populate("staff_id", "first_name last_name role")
                .sort({ year: -1, month: -1 })
                .skip(skip)
                .limit(Number(limit)),

            Payroll.countDocuments(filter)

        ]);

        sendResponse(res, 200, true, "Payroll records fetched successfully.", {
            records,

            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }

        });

    } catch (error) { next(error); }

};

/*
=========================================================
PAYROLL SUMMARY FOR A MONTH (all staff)
GET /api/staff/payroll/summary?month=7&year=2026
=========================================================
*/

export const getPayrollSummary = async (req, res, next) => {

    try {

        const { month, year } = req.query;

        if (!month || !year) {
            throw new Error("Month and year are required.");
        }

        const records = await Payroll.find({
            restaurant_id: req.user.restaurant_id,
            month: Number(month),
            year: Number(year)
        }).populate("staff_id", "first_name last_name role");

        const totalStaff = await User.countDocuments({
            restaurant_id: req.user.restaurant_id,
            is_active: true
        });

        const summary = {
            total_staff: totalStaff,
            payroll_generated_count: records.length,
            total_base_salary: records.reduce((sum, r) => sum + r.base_salary, 0),
            total_net_pay: records.reduce((sum, r) => sum + r.net_pay, 0),
            paid_count: records.filter((r) => r.status === "Paid").length,
            pending_count: records.filter((r) => r.status !== "Paid").length,
            records
        };

        sendResponse(res, 200, true, "Payroll summary fetched successfully.", summary);

    } catch (error) { next(error); }

};