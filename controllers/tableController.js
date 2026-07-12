import Table from "../models/Table.js";
import { generateReferenceNumber } from "../utils/generateReferenceNumber.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
CREATE TABLE
POST /api/reservations/tables
=========================================================
*/

export const createTable = async (req, res, next) => {

    try {

        const { table_number, seating_capacity, zone } = req.body;

        if (!table_number || !seating_capacity) {
            throw new Error("Table number and seating capacity are required.");
        }

        const existing = await Table.findOne({
            restaurant_id: req.user.restaurant_id,
            table_number: table_number.trim()
        });

        if (existing) {
            throw new Error("A table with this number already exists.");
        }

        const table = await Table.create({
            restaurant_id: req.user.restaurant_id,
            table_number: table_number.trim(),
            table_code: generateReferenceNumber("TBL"),
            seating_capacity,
            zone: zone || "Main"
        });

        sendResponse(res, 201, true, "Table created successfully.", table);

    } catch (error) { next(error) }

};

/*
=========================================================
LIST TABLES (with live status)
GET /api/reservations/tables?zone=Rooftop
=========================================================
*/

export const getTables = async (req, res, next) => {

    try {
        const { zone } = req.query;

        const filter = {
            restaurant_id: req.user.restaurant_id,
            is_active: true
        };

        if (zone) filter.zone = zone;

        const tables = await Table.find(filter)
            .populate("current_order_id", "order_number order_status grand_total")
            .sort({ zone: 1, table_number: 1 });

        sendResponse(res, 200, true, "Tables fetched successfully.", tables);

    } catch (error) { next(error) }

};

/*
=========================================================
GET SINGLE TABLE
GET /api/tables/:id
=========================================================
*/

export const getTable = async (req, res, next) => {

    try {
        const { id } = req.params;

        const table = await Table.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        }).populate("current_order_id", "order_number order_status grand_total");

        if (!table) {
            throw new Error("Table not found.");
        }

        sendResponse(res, 200, true, "Table fetched successfully.", table);

    } catch (error) { next(error) }

};

/*
=========================================================
UPDATE TABLE
PUT /api/reservations/tables/:id
=========================================================
*/

export const updateTable = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { table_number, seating_capacity, zone, is_active } = req.body;

        const table = await Table.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!table) {
            throw new Error("Table not found.");
        }

        if (table_number !== undefined) table.table_number = table_number.trim();
        if (seating_capacity !== undefined) table.seating_capacity = seating_capacity;
        if (zone !== undefined) table.zone = zone;
        if (is_active !== undefined) table.is_active = is_active;

        await table.save();

        sendResponse(res, 200, true, "Table updated successfully.", table);

    } catch (error) { next(error) }

};

/*
=========================================================
DELETE (SOFT) TABLE
DELETE /api/tables/:id
=========================================================
*/

export const deleteTable = async (req, res, next) => {

    try {
        const { id } = req.params;
        const table = await Table.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!table) {
            throw new Error("Table not found.");
        }

        if (table.status === "Occupied" || table.status === "Reserved") {
            throw new Error("Cannot delete a table that is currently Occupied or reserved.");
        }

        table.is_active = false;

        await table.save();

        sendResponse(res, 200, true, "Table deleted successfully.", null);

    } catch (error) { next(error) }

};

/*
=========================================================
MANUALLY SET TABLE STATUS
PUT /api/reservations/tables/:id/status
=========================================================
*/

export const updateTableStatus = async (req, res, next) => {

    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ["Available", "Occupied", "Reserved", "Cleaning", "Out of Service"];

        if (!validStatuses.includes(status)) {
            throw new Error("Invalid table status.");
        }

        const table = await Table.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!table) {
            throw new Error("Table not found.");
        }

        table.status = status;

        if (status === "Available") {
            table.current_order_id = null;
        }

        await table.save();

        sendResponse(res, 200, true, "Table status updated successfully.", table);

    } catch (error) { next(error); }

};

/*
=========================================================
FLOOR OVERVIEW (grouped by zone, with counts)
GET /api/reservations/tables/floor-overview
=========================================================
*/

export const getFloorOverview = async (req, res, next) => {

    try {
        const tables = await Table.find({
            restaurant_id: req.user.restaurant_id,
            is_active: true
        }).sort({ zone: 1, table_number: 1 });

        const grouped = {};

        for (const table of tables) {

            if (!grouped[table.zone]) {
                grouped[table.zone] = [];
            }

            grouped[table.zone].push(table);

        }

        const counts = {
            total: tables.length,
            available: tables.filter((t) => t.status === "Available").length,
            Occupied: tables.filter((t) => t.status === "Occupied").length,
            reserved: tables.filter((t) => t.status === "Reserved").length,
            cleaning: tables.filter((t) => t.status === "Cleaning").length,
            out_of_service: tables.filter((t) => t.status === "Out of Service").length
        };

        sendResponse(res, 200, true, "Floor overview fetched successfully.", {
            zones: grouped,
            counts
        });

    } catch (error) { next(error) }

};