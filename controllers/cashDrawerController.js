import CashDrawer from "../models/CashDrawer.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
OPEN CASH DRAWER
POST /api/cashier/drawer/open
=========================================================
*/

export const openDrawer = async (req, res, next) => {
    try {
        const { opening_balance, shift } = req.body;

        if (opening_balance === undefined || opening_balance < 0) {
            throw new Error("A valid opening balance is required.");
        }

        const existing = await CashDrawer.findOne({
            cashier_id: req.user.id,
            status: "Open"
        });

        if (existing) {
            throw new Error("You already have an open cash drawer. Close it before opening a new one.");
        }

        const drawer = await CashDrawer.create({
            restaurant_id: req.user.restaurant_id,
            cashier_id: req.user.id,
            shift: shift || "Morning",
            opening_balance: Number(opening_balance),
            opened_by: req.user.id
        });
        sendResponse(res, 201, true, "Cash drawer opened successfully.", drawer);

    } catch (error) { next(error); }
};

/*
=========================================================
RECORD CASH PAID OUT
POST /api/cashier/drawer/paid-out
=========================================================
*/

export const recordCashPaidOut = async (req, res, next) => {
    try {
        const { amount, notes } = req.body;

        if (!amount || amount <= 0) {
            throw new Error("A valid amount is required.");
        }

        const drawer = await CashDrawer.findOne({
            cashier_id: req.user.id,
            status: "Open"
        });

        if (!drawer) {
            throw new Error("No open cash drawer found. Please open a drawer first.");
        }

        drawer.cash_paid_out += Number(amount);
        drawer.notes = drawer.notes
            ? `${drawer.notes}\n₹${amount} paid out - ${notes || "No note"}`
            : `₹${amount} paid out - ${notes || "No note"}`;
        await drawer.save();
        sendResponse(res, 200, true, "Cash paid-out recorded.", drawer);

    } catch (error) { next(error); }
};

/*
=========================================================
GET CURRENT DRAWER STATUS
GET /api/cashier/drawer/status
=========================================================
*/

export const getDrawerStatus = async (req, res, next) => {
    try {
        const drawer = await CashDrawer.findOne({
            cashier_id: req.user.id,
            status: "Open"
        });

        if (!drawer) {
            return sendResponse(res, 200, true, "No open drawer.", null);
        }

        const expectedCash =
            drawer.opening_balance +
            drawer.cash_received -
            drawer.cash_paid_out -
            drawer.cash_refunded;
        sendResponse(res, 200, true, "Drawer status fetched.", {

            ...drawer.toObject(),
            expected_cash: expectedCash
        });

    } catch (error) { next(error); }
};

/*
=========================================================
CLOSE CASH DRAWER
POST /api/cashier/drawer/close
=========================================================
*/

export const closeDrawer = async (req, res, next) => {
    try {
        const { actual_cash, notes } = req.body;

        if (actual_cash === undefined || actual_cash < 0) {
            throw new Error("Actual counted cash is required to close the drawer.");
        }

        const drawer = await CashDrawer.findOne({
            cashier_id: req.user.id,
            status: "Open"
        });

        if (!drawer) {
            throw new Error("No open cash drawer found.");
        }

        const expectedCash =
            drawer.opening_balance +
            drawer.cash_received -
            drawer.cash_paid_out -
            drawer.cash_refunded;
        const difference = Number((actual_cash - expectedCash).toFixed(2));

        drawer.expected_cash = expectedCash;
        drawer.actual_cash = Number(actual_cash);
        drawer.difference = difference;
        drawer.closing_balance = Number(actual_cash);
        drawer.status = "Closed";
        drawer.closed_at = new Date();
        drawer.closed_by = req.user.id;

        if (notes) {
            drawer.notes = drawer.notes ? `${drawer.notes}\nClosing note: ${notes}` : `Closing note: ${notes}`;
        }

        await drawer.save();
        sendResponse(res, 200, true, "Cash drawer closed successfully.", drawer);

    } catch (error) { next(error); }
};

/*
=========================================================
DRAWER HISTORY
GET /api/cashier/drawer/history
=========================================================
*/

export const getDrawerHistory = async (req, res, next) => {
    try {
        const filter = {
            restaurant_id: req.user.restaurant_id
        };

        // Cashiers see only their own history; managers/admins see all

        if (req.user.role === "Cashier") {
            filter.cashier_id = req.user.id;
        }

        const drawers = await CashDrawer.find(filter)
            .populate("cashier_id", "first_name last_name")
            .sort({ createdAt: -1 })
            .limit(50);
        sendResponse(res, 200, true, "Drawer history fetched.", drawers);

    } catch (error) { next(error); }
};