import Table from "../models/Table.js";
import Restaurant from "../models/Restaurant.js";
import generateTableQR from "../utils/generateTableQR.js";
import sendResponse from "../utils/sendResponse.js";

/*
===================================
GENERATE / REGENERATE QR FOR A SINGLE TABLE
POST /api/qr/table/:id
===================================
*/
export const generateQRForTable = async (req, res, next) => {
    try {
        const table = await Table.findById(req.params.id);

        if (!table) {
            return sendResponse(res, 404, false, "Table not found.");
        }

        // Ownership check — make sure this table belongs to the logged-in owner's restaurant
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });
        if (!restaurant || table.restaurant_id.toString() !== restaurant._id.toString()) {
            return sendResponse(res, 403, false, "Not authorized to manage this table.");
        }

        const qrDataUrl = await generateTableQR(table.table_code);

        table.qr_url = qrDataUrl;
        await table.save();

        sendResponse(res, 200, true, "QR generated successfully", {
            table_id: table._id,
            table_number: table.table_number,
            table_code: table.table_code,
            qr_url: table.qr_url,
        });
    } catch (error) { next(error) }
};

/*
===================================
GENERATE QR FOR ALL TABLES OF THE LOGGED-IN RESTAURANT
POST /api/qr/generate-all
===================================
*/
export const generateQRForAllTables = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });
        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant not found.");
        }

        const tables = await Table.find({ restaurant_id: restaurant._id });

        const updated = [];
        for (const table of tables) {
            const qrDataUrl = await generateTableQR(table.table_code);
            table.qr_url = qrDataUrl;
            await table.save();
            updated.push({ table_id: table._id, table_number: table.table_number, qr_url: table.qr_url });
        }

        sendResponse(res, 200, true, `${updated.length} QR codes generated`, updated);
    } catch (error) { next(error); }
};

/*
===================================
GET QR FOR A SINGLE TABLE (for preview/print page)
GET /api/qr/table/:id
===================================
*/
export const getTableQR = async (req, res, next) => {
    try {
        const table = await Table.findById(req.params.id);

        if (!table) {
            return sendResponse(res, 404, false, "Table not found.");
        }

        if (!table.qr_url) {
            const qrDataUrl = await generateTableQR(table.table_code);
            table.qr_url = qrDataUrl;
            await table.save();
        }

        sendResponse(res, 200, true, "QR fetched", {
            table_id: table._id,
            table_number: table.table_number,
            qr_url: table.qr_url,
        });
    } catch (error) {
        next(error);
    }
};

