import mongoose from "mongoose";

import Reservation from "../models/Reservation.js";
import Table from "../models/Table.js";
import Customer from "../models/Customer.js";

import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
Helper — check if candidate tables are free for the
requested date/time window (no overlapping active reservation).
=========================================================
*/

const areTablesAvailable = async (restaurantId, tableIds, date, time, durationMinutes, excludeReservationId = null) => {

    const requestedStart = new Date(`${date}T${time}:00`);
    const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60000);

    const filter = {
        restaurant_id: restaurantId,
        reservation_date: date,
        tables_assigned: { $in: tableIds },
        status: { $in: ["Requested", "Confirmed", "Seated"] }
    };

    if (excludeReservationId) {
        filter._id = { $ne: excludeReservationId };
    }

    const overlapping = await Reservation.find(filter);

    for (const res of overlapping) {
        const existingStart = new Date(`${res.reservation_date}T${res.reservation_time}:00`);
        const existingEnd = new Date(existingStart.getTime() + res.duration_minutes * 60000);

        // Overlap check: (StartA < EndB) and (EndA > StartB)

        if (requestedStart < existingEnd && requestedEnd > existingStart) {
            return false;
        }

    }

    return true;

};

/*
=========================================================
PART 8.11B-1 — CREATE RESERVATION
POST /api/reservations
=========================================================
*/

export const createReservation = async (req, res, next) => {

    try {

        const {
            customer_name, customer_phone, party_size,
            reservation_date, reservation_time, duration_minutes,
            tables_assigned, zone_preference, special_requests, source
        } = req.body;

        if (!customer_name || !customer_phone || !party_size || !reservation_date || !reservation_time) {
            throw new Error("Customer name, phone, party size, date, and time are required.");
        }

        const duration = duration_minutes || 90;

        // If specific tables were requested upfront, validate availability

        if (tables_assigned && tables_assigned.length > 0) {

            const available = await areTablesAvailable(
                req.user.restaurant_id,
                tables_assigned,
                reservation_date,
                reservation_time,
                duration
            );

            if (!available) {
                throw new Error("One or more selected tables are already booked for this time slot.");
            }

        }

        // Try to link to an existing CRM customer by phone

        const existingCustomer = await Customer.findOne({
            restaurant_id: req.user.restaurant_id,
            phone: customer_phone.trim()
        });

        const reservation = await Reservation.create({
            restaurant_id: req.user.restaurant_id,
            customer_name: customer_name.trim(),
            customer_phone: customer_phone.trim(),
            customer_id: existingCustomer ? existingCustomer._id : null,
            party_size,
            reservation_date,
            reservation_time,
            duration_minutes: duration,
            tables_assigned: tables_assigned || [],
            zone_preference: zone_preference || "",
            special_requests: special_requests || "",
            source: source || "Phone",
            status: tables_assigned && tables_assigned.length > 0 ? "Confirmed" : "Requested",
            created_by: req.user.id
        });

        // If tables were assigned right away, mark them Reserved

        if (tables_assigned && tables_assigned.length > 0) {

            await Table.updateMany(
                { _id: { $in: tables_assigned } },
                { $set: { status: "Reserved" } }
            );
        }

        sendResponse(res, 201, true, "Reservation created successfully.", reservation);

    } catch (error) { next(error); }

};

/*
=========================================================
SUGGEST AVAILABLE TABLES FOR A SLOT
GET /api/reservations/available-tables?date=...&time=...&duration=90&party_size=4
=========================================================
*/

export const getAvailableTables = async (req, res, next) => {

    try {

        const { date, time, duration = 90, party_size } = req.query;

        if (!date || !time) {
            throw new Error("Date and time are required.");
        }

        const allTables = await Table.find({
            restaurant_id: req.user.restaurant_id,
            is_active: true,
            status: { $ne: "Out of Service" }
        });

        const candidates = party_size
            ? allTables.filter((t) => t.seating_capacity >= Number(party_size))
            : allTables;
        const availableTables = [];

        for (const table of candidates) {
            const isFree = await areTablesAvailable(
                req.user.restaurant_id,
                [table._id],
                date,
                time,
                Number(duration)
            );

            if (isFree) {
                availableTables.push(table);
            }

        }

        sendResponse(res, 200, true, "Available tables fetched successfully.", availableTables);

    } catch (error) { next(error) }

};

/*
=========================================================
LIST RESERVATIONS
GET /api/reservations?date=2026-07-05&status=Confirmed&page=1&limit=20
=========================================================
*/

export const getReservations = async (req, res, next) => {

    try {

        const { date, status, search, page = 1, limit = 20 } = req.query;
        const filter = { restaurant_id: req.user.restaurant_id };

        if (date) filter.reservation_date = date;
        if (status) filter.status = status;
        if (search) {

            filter.$or = [
                { customer_name: { $regex: search, $options: "i" } },
                { customer_phone: { $regex: search, $options: "i" } }
            ];

        }

        const skip = (Number(page) - 1) * Number(limit);
        const [reservations, total] = await Promise.all([

            Reservation.find(filter)
                .populate("tables_assigned", "table_number zone seating_capacity")
                .populate("created_by", "first_name last_name")
                .sort({ reservation_date: 1, reservation_time: 1 })
                .skip(skip)
                .limit(Number(limit)),
            Reservation.countDocuments(filter)
        ]);

        sendResponse(res, 200, true, "Reservations fetched successfully.", {
            reservations,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }

        });

    } catch (error) { next(error) }

};

/*
=========================================================
GET TODAY'S RESERVATIONS (quick dashboard view)
GET /api/reservations/today
=========================================================
*/

export const getTodaysReservations = async (req, res, next) => {

    try {

        const today = new Date().toISOString().split("T")[0];
        const reservations = await Reservation.find({
            restaurant_id: req.user.restaurant_id,
            reservation_date: today,
            status: { $in: ["Requested", "Confirmed", "Seated"] }
        })
            .populate("tables_assigned", "table_number zone")
            .sort({ reservation_time: 1 });

        sendResponse(res, 200, true, "Today's reservations fetched successfully.", reservations);

    } catch (error) { next(error) }

};

/*
=========================================================
CONFIRM RESERVATION + ASSIGN TABLES
PUT /api/reservations/:id/confirm
=========================================================
*/

export const confirmReservation = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { tables_assigned } = req.body;

        const reservation = await Reservation.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        if (reservation.status !== "Requested") {
            throw new Error(`Reservation is already ${reservation.status}.`);
        }

        // Table assignment is optional at confirm time — a manager can confirm
        // the booking now and assign tables later (e.g. from the floor plan
        // when the guests actually arrive), or assign them right here if
        // they're already known.
        if (tables_assigned && tables_assigned.length > 0) {

            const available = await areTablesAvailable(
                req.user.restaurant_id,
                tables_assigned,
                reservation.reservation_date,
                reservation.reservation_time,
                reservation.duration_minutes,
                reservation._id
            );

            if (!available) {
                throw new Error("One or more selected tables are already booked for this time slot.");
            }

            reservation.tables_assigned = tables_assigned;

            await Table.updateMany(
                { _id: { $in: tables_assigned } },
                { $set: { status: "Reserved" } }
            );

        }

        reservation.status = "Confirmed";

        await reservation.save();

        sendResponse(res, 200, true, "Reservation confirmed successfully.", reservation);

    } catch (error) { next(error) }

};

/*
=========================================================
SEAT GUESTS (mark reservation Seated + tables Occupied)
PUT /api/reservations/:id/seat
=========================================================
*/

export const seatReservation = async (req, res, next) => {

    try {

        const { id } = req.params;

        const reservation = await Reservation.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        if (reservation.status !== "Confirmed") {
            throw new Error("Only confirmed reservations can be seated.");
        }

        reservation.status = "Seated";
        reservation.seated_at = new Date();

        await reservation.save();

        await Table.updateMany(
            { _id: { $in: reservation.tables_assigned } },
            { $set: { status: "Occupied" } }
        );

        sendResponse(res, 200, true, "Guests seated successfully.", reservation);

    } catch (error) { next(error) }

};

/*
=========================================================
COMPLETE RESERVATION (guests leave, free tables)
PUT /api/reservations/:id/complete
=========================================================
*/

export const completeReservation = async (req, res, next) => {

    try {

        const { id } = req.params;

        const reservation = await Reservation.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        if (reservation.status !== "Seated") {
            throw new Error("Only seated reservations can be completed.");
        }

        reservation.status = "Completed";
        reservation.completed_at = new Date();

        await reservation.save();

        await Table.updateMany(
            { _id: { $in: reservation.tables_assigned } },
            { $set: { status: "Cleaning", current_order_id: null } }
        );

        sendResponse(res, 200, true, "Reservation completed successfully.", reservation);

    } catch (error) { next(error) }

};

/*
=========================================================
CANCEL RESERVATION
PUT /api/reservations/:id/cancel
=========================================================
*/

export const cancelReservation = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { reason } = req.body;
        const reservation = await Reservation.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        if (["Completed", "Cancelled", "No Show"].includes(reservation.status)) {
            throw new Error(`Reservation is already ${reservation.status}.`);
        }

        const previousTables = reservation.tables_assigned;

        reservation.status = "Cancelled";
        reservation.cancelled_reason = reason || "";

        await reservation.save();

        if (previousTables && previousTables.length > 0) {
            await Table.updateMany(
                { _id: { $in: previousTables }, status: "Reserved" },
                { $set: { status: "Available" } }
            );
        }

        sendResponse(res, 200, true, "Reservation cancelled successfully.", reservation);

    } catch (error) { next(error) }

};

/*
=========================================================
MARK NO SHOW
PUT /api/reservations/:id/no-show
=========================================================
*/

export const markNoShow = async (req, res, next) => {

    try {

        const { id } = req.params;
        const reservation = await Reservation.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        if (!["Requested", "Confirmed"].includes(reservation.status)) {
            throw new Error("Only requested or confirmed reservations can be marked as no-show.");
        }

        const previousTables = reservation.tables_assigned;

        reservation.status = "No Show";

        await reservation.save();

        if (previousTables && previousTables.length > 0) {

            await Table.updateMany(
                { _id: { $in: previousTables }, status: "Reserved" },
                { $set: { status: "Available" } }
            )
        }

        sendResponse(res, 200, true, "Reservation marked as no-show.", reservation);

    } catch (error) { next(error) }

};

/*
=========================================================
RESCHEDULE RESERVATION
PUT /api/reservations/:id/reschedule
=========================================================
*/

export const rescheduleReservation = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { reservation_date, reservation_time, duration_minutes } = req.body;

        if (!reservation_date || !reservation_time) {
            throw new Error("New date and time are required.");
        }

        const reservation = await Reservation.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        if (["Completed", "Cancelled", "No Show", "Seated"].includes(reservation.status)) {
            throw new Error(`Cannot reschedule a reservation that is ${reservation.status}.`);
        }

        const duration = duration_minutes || reservation.duration_minutes;

        if (reservation.tables_assigned.length > 0) {

            const available = await areTablesAvailable(
                req.user.restaurant_id,
                reservation.tables_assigned,
                reservation_date,
                reservation_time,
                duration,
                reservation._id
            );

            if (!available) {
                throw new Error("Assigned tables are not available at the new time. Reassign tables first.");
            }

        }

        reservation.reservation_date = reservation_date;
        reservation.reservation_time = reservation_time;
        reservation.duration_minutes = duration;
        reservation.reminder_sent = false;

        await reservation.save();

        sendResponse(res, 200, true, "Reservation rescheduled successfully.", reservation);

    } catch (error) { next(error) }

};