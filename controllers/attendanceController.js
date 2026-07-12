import mongoose from "mongoose";

import Attendance from "../models/Attendance.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
Helper — format a Date object as "YYYY-MM-DD"
=========================================================
*/

const formatDate = (date) => {
    return new Date(date).toISOString().split("T")[0];
};

/*
=========================================================
CHECK IN (self)
POST /api/staff/attendance/check-in
=========================================================
*/

export const checkIn = async (req, res, next) => {

    try {
        const today = formatDate(new Date());

        const existing = await Attendance.findOne({
            restaurant_id: req.user.restaurant_id,
            staff_id: req.user.id,
            date: today
        });

        if (existing && existing.check_in_at) {
            throw new Error("You have already checked in today.");
        }

        let record;

        if (existing) {

            existing.check_in_at = new Date();
            existing.shift_id = req.body.shift_id || existing.shift_id;
            existing.status = "Present";

            record = await existing.save();

        } else {

            record = await Attendance.create({
                restaurant_id: req.user.restaurant_id,
                staff_id: req.user.id,
                shift_id: req.body.shift_id || null,
                date: today,
                check_in_at: new Date(),
                status: "Present"

            });

        }

        sendResponse(res, 200, true, "Checked in successfully.", record);

    } catch (error) { next(error); }

};

/*
=========================================================
CHECK OUT (self)
POST /api/staff/attendance/check-out
=========================================================
*/

export const checkOut = async (req, res, next) => {

    try {

        const today = formatDate(new Date());

        const record = await Attendance.findOne({
            restaurant_id: req.user.restaurant_id,
            staff_id: req.user.id,
            date: today
        });

        if (!record || !record.check_in_at) {
            throw new Error("You have not checked in today.");
        }

        if (record.check_out_at) {
            throw new Error("You have already checked out today.");
        }

        record.check_out_at = new Date();

        const hoursWorked =
            (record.check_out_at - record.check_in_at) / (1000 * 60 * 60);

        record.total_hours = Number(hoursWorked.toFixed(2));

        // Mark half day if less than 4 hours worked

        if (hoursWorked < 4) {
            record.status = "Half Day";
        }

        await record.save();

        sendResponse(res, 200, true, "Checked out successfully.", record);

    } catch (error) { next(error); }

};

/*
=========================================================
MANUALLY MARK ATTENDANCE (Manager/Admin)
POST /api/staff/attendance/mark
=========================================================
*/

export const markAttendance = async (req, res, next) => {

    try {

        const { staff_id, date, status, check_in_at, check_out_at, notes } = req.body;

        if (!staff_id || !date || !status) {
            throw new Error("Staff ID, date, and status are required.");
        }

        let record = await Attendance.findOne({
            restaurant_id: req.user.restaurant_id,
            staff_id,
            date
        });

        if (!record) {

            record = new Attendance({
                restaurant_id: req.user.restaurant_id,
                staff_id,
                date
            });

        }

        record.status = status;

        if (check_in_at) record.check_in_at = new Date(check_in_at);
        if (check_out_at) record.check_out_at = new Date(check_out_at);

        if (record.check_in_at && record.check_out_at) {

            const hoursWorked =
                (record.check_out_at - record.check_in_at) / (1000 * 60 * 60);

            record.total_hours = Number(hoursWorked.toFixed(2));

        }

        record.notes = notes || record.notes;
        record.marked_by = req.user.id;

        await record.save();

        sendResponse(res, 200, true, "Attendance marked successfully.", record);

    } catch (error) { next(error); }

};

/*
=========================================================
GET ATTENDANCE (self or by staff, with date range)
GET /api/staff/attendance?staff_id=...&date_from=...&date_to=...
=========================================================
*/

export const getAttendance = async (req, res, next) => {

    try {

        const { staff_id, date_from, date_to, page = 1, limit = 31 } = req.query;

        const filter = { restaurant_id: req.user.restaurant_id };

        // Non-managers can only view their own attendance

        if (["Manager", "Admin"].includes(req.user.role)) {
            if (staff_id) filter.staff_id = staff_id;
        } else {
            filter.staff_id = req.user.id;
        }

        if (date_from || date_to) {
            filter.date = {};
            if (date_from) filter.date.$gte = date_from;
            if (date_to) filter.date.$lte = date_to;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [records, total] = await Promise.all([

            Attendance.find(filter)
                .populate("staff_id", "first_name last_name role")
                .populate("shift_id", "name start_time end_time")
                .sort({ date: -1 })
                .skip(skip)
                .limit(Number(limit)),

            Attendance.countDocuments(filter)

        ]);

        sendResponse(res, 200, true, "Attendance records fetched successfully.", {

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
MONTHLY ATTENDANCE SUMMARY (for payroll)
GET /api/staff/attendance/summary?staff_id=...&month=7&year=2026
=========================================================
*/

export const getMonthlyAttendanceSummary = async (req, res, next) => {

    try {

        const { staff_id, month, year } = req.query;

        if (!staff_id || !month || !year) {
            throw new Error("Staff ID, month, and year are required.");
        }

        const monthStr = String(month).padStart(2, "0");
        const datePrefix = `${year}-${monthStr}`;
        const records = await Attendance.find({
            restaurant_id: req.user.restaurant_id,
            staff_id,
            date: { $regex: `^${datePrefix}` }
        });

        const summary = {
            days_present: records.filter((r) => r.status === "Present").length,
            days_absent: records.filter((r) => r.status === "Absent").length,
            days_half: records.filter((r) => r.status === "Half Day").length,
            days_on_leave: records.filter((r) => r.status === "On Leave").length,

            total_hours: Number(
                records.reduce((sum, r) => sum + (r.total_hours || 0), 0).toFixed(2))

        };

        sendResponse(res, 200, true, "Monthly attendance summary fetched.", summary);

    } catch (error) { next(error); }

};