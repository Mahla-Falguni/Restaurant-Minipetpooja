import Shift from "../models/Shift.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
CREATE SHIFT
POST /api/staff/shifts
=========================================================
*/

export const createShift = async (req, res, next) => {

    try {

        const { name, start_time, end_time, days_of_week, assigned_staff } = req.body;

        if (!name || !start_time || !end_time) {
            throw new Error("Name, start time, and end time are required.");
        }

        const existing = await Shift.findOne({
            restaurant_id: req.user.restaurant_id,
            name: name.trim()
        });

        if (existing) {
            throw new Error("A shift with this name already exists.");
        }

        const shift = await Shift.create({
            restaurant_id: req.user.restaurant_id,
            name: name.trim(),
            start_time,
            end_time,
            days_of_week: days_of_week || undefined,
            assigned_staff: assigned_staff || [],
            created_by: req.user.id
        });

        sendResponse(res, 201, true, "Shift created successfully.", shift);

    } catch (error) { next(error) }

};

/*
=========================================================
LIST SHIFTS
GET /api/staff/shifts
=========================================================
*/

export const getShifts = async (req, res, next) => {

    try {

        const shifts = await Shift.find({
            restaurant_id: req.user.restaurant_id,
            is_active: true
        })
            .populate("assigned_staff", "name role")
            .sort({ start_time: 1 });

        sendResponse(res, 200, true, "Shifts fetched successfully.", shifts);

    } catch (error) { next(error) }

};

/*
=========================================================
UPDATE SHIFT
PUT /api/staff/shifts/:id
=========================================================
*/

export const updateShift = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { name, start_time, end_time, days_of_week, assigned_staff, is_active } = req.body;

        const shift = await Shift.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!shift) {
            throw new Error("Shift not found.");
        }

        if (name !== undefined) shift.name = name.trim();
        if (start_time !== undefined) shift.start_time = start_time;
        if (end_time !== undefined) shift.end_time = end_time;
        if (days_of_week !== undefined) shift.days_of_week = days_of_week;
        if (assigned_staff !== undefined) shift.assigned_staff = assigned_staff;
        if (is_active !== undefined) shift.is_active = is_active;

        await shift.save();

        sendResponse(res, 200, true, "Shift updated successfully.", shift);

    } catch (error) { next(error) }

};

/*
=========================================================
DELETE (SOFT) SHIFT
DELETE /api/staff/shifts/:id
=========================================================
*/

export const deleteShift = async (req, res, next) => {

    try {

        const { id } = req.params;

        const shift = await Shift.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!shift) {
            throw new Error("Shift not found.");
        }

        shift.is_active = false;

        await shift.save();

        sendResponse(res, 200, true, "Shift deactivated successfully.", null);

    } catch (error) { next(error) }

};