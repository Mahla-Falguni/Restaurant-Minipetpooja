import mongoose from "mongoose";

import WaiterAssignment from "../models/WaiterAssignment.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import Payment from "../models/Payment.js";
import BillSplit from "../models/BillSplit.js";
import Invoice from "../models/Invoice.js";


import User from "../models/User.js";
import OrderItem from "../models/OrderItem.js";
import MenuItem from "../models/MenuItem.js";
import Category from "../models/Category.js";
import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";

import sendResponse from "../utils/sendResponse.js";


/*
=========================================
GET WAITER DASHBOARD
GET /api/waiter/dashboard
=========================================
*/

export const getDashboard = async (req, res, next) => {

    try {

        const waiterId = req.user.id;

        const assignment = await WaiterAssignment.find({
            waiter_id: waiterId,
            is_active: true
        });

        const tableIds = assignment.map((table) => table.table_id);
        const totalTables = tableIds.length;

        const OccupiedTables = await Table.countDocuments({
            _id: { $in: tableIds },
            status: "Occupied"
        });

        const availableTables = await Table.countDocuments({
            _id: { $in: tableIds },
            status: "Available"
        });

        const runningOrders = await Order.countDocuments({
            table_id: { $in: tableIds },
            order_status: {
                $in: ["Pending", "Accepted", "Preparing", "Ready"]
            }
        });

        const pendingBills = await Order.countDocuments({
            table_id: { $in: tableIds },
            payment_status: "Pending",
            order_status: "Served"
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const payments = await Payment.aggregate([
            {
                $match: {
                    paid_at: { $gte: today },
                    payment_status: "Paid"
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$amount" }
                }
            }
        ]);

        const sales = payments.length ? payments[0].totalSales : 0;

        sendResponse(res, 200, true, "Dashboard Loaded", {
            total_tables: totalTables,
            Occupied_tables: OccupiedTables,
            available_tables: availableTables,
            running_orders: runningOrders,
            pending_bills: pendingBills,
            today_sales: sales
        });

    }
    catch (error) { next(error) }

};


/*
=========================================
GET ASSIGNED TABLES
GET /api/waiter/tables
=========================================
*/

export const getAssignedTables = async (req, res, next) => {

    try {

        const waiterId = req.user.id;

        const assignments = await WaiterAssignment.find({
            waiter_id: waiterId,
            is_active: true
        }).populate({
            path: "table_id",
            populate: {
                path: "restaurant_id",
                select: "restaurant_name"
            }
        });

        const response = [];

        for (const assignment of assignments) {

            const table = assignment.table_id;

            if (!table) continue;

            const order = await Order.findOne({
                table_id: table._id,
                order_status: {
                    $in: ["Pending", "Accepted", "Preparing", "Ready", "Served"]
                }
            })
                .populate("items")
                .sort({ createdAt: -1 });

            response.push({
                assignment_id: assignment._id,
                table_id: table._id,
                table_number: table.table_number,
                capacity: table.capacity,
                status: table.status,
                restaurant_name: table.restaurant_id?.restaurant_name || "",
                shift: assignment.shift,
                assigned_at: assignment.assigned_at,
                active_order: order
                    ? {
                        order_id: order._id,
                        order_number: order.order_number,
                        customer_name: order.customer_name,
                        customer_phone: order.customer_phone,
                        order_status: order.order_status,
                        payment_status: order.payment_status,
                        total_items: order.total_items,
                        grand_total: order.grand_total,
                        createdAt: order.createdAt,
                        estimated_time: order.estimated_time
                    }
                    : null
            });

        }

        response.sort((a, b) => Number(a.table_number) - Number(b.table_number));

        sendResponse(res, 200, true, "Assigned Tables Loaded", response);

    }
    catch (error) { next(error) }

};


/*
=========================================
GET TABLE DETAILS
GET /api/waiter/table/:id
=========================================
*/

export const getTableDetails = async (req, res, next) => {

    try {

        const { id } = req.params;

        const table = await Table.findById(id)
            .populate("restaurant_id", "restaurant_name");

        if (!table) {
            return sendResponse(res, 404, false, "Table not found.");
        }

        const assignment = await WaiterAssignment.findOne({
            table_id: table._id,
            is_active: true
        }).populate("waiter_id", "name email phone role");

        const order = await Order.findOne({
            table_id: table._id,
            order_status: {
                $in: ["Pending", "Accepted", "Preparing", "Ready", "Served"]
            }
        })
            .populate("items")
            .populate("invoice_id")
            .populate("served_by", "first_name last_name")
            .populate("chef_id", "first_name last_name")
            .sort({ createdAt: -1 });

        let response = {

            table: {
                id: table._id,
                table_number: table.table_number,
                capacity: table.capacity,
                status: table.status,
                restaurant: table.restaurant_id
            },

            waiter: assignment
                ? {
                    id: assignment.waiter_id?._id,
                    name: assignment.waiter_id?.name,
                    email: assignment.waiter_id?.email,
                    phone: assignment.waiter_id?.phone,
                    shift: assignment.shift,
                    assigned_at: assignment.assigned_at
                }
                : null,

            order: null

        };

        if (order) {

            response.order = {
                order_id: order._id,
                order_number: order.order_number,
                customer_name: order.customer_name,
                customer_phone: order.customer_phone,
                customer_email: order.customer_email,
                order_type: order.order_type,
                order_status: order.order_status,
                payment_status: order.payment_status,
                payment_method: order.payment_method,
                total_items: order.total_items,
                subtotal: order.subtotal,
                discount: order.discount,
                cgst: order.cgst,
                sgst: order.sgst,
                service_charge: order.service_charge,
                grand_total: order.grand_total,
                invoice_number: order.invoice_number,
                estimated_time: order.estimated_time,
                special_instruction: order.special_instruction,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                served_by: order.served_by,
                chef: order.chef_id,
                invoice: order.invoice_id,
                status_history: order.status_history,
                items: order.items
            };

        }

        sendResponse(res, 200, true, "Table Details Loaded", response);

    }
    catch (error) { next(error) }

};


/*
=========================================
ASSIGN TABLE TO WAITER
POST /api/waiter/assign-table
=========================================
*/

export const assignTable = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { table_id, waiter_id, shift } = req.body;

        const table = await Table.findById(table_id).session(session);

        if (!table) {
            throw new Error("Table not found.");
        }

        const waiter = await User.findById(waiter_id).session(session);

        if (!waiter) {
            throw new Error("Waiter not found.");
        }

        if (waiter.role !== "Waiter") {
            throw new Error("Selected user is not a waiter.");
        }

        await WaiterAssignment.updateMany(
            { table_id, is_active: true },
            { is_active: false },
            { session }
        );

        const assignment = await WaiterAssignment.create(
            [
                {
                    restaurant_id: table.restaurant_id,
                    table_id,
                    waiter_id,
                    shift,
                    assigned_by: req.user.id,
                    assigned_at: new Date(),
                    is_active: true
                }
            ],
            { session }
        );

        table.assigned_waiter = waiter_id;

        await table.save({ session });

        await session.commitTransaction();
        session.endSession();

        const response = await WaiterAssignment.findById(assignment[0]._id)
            .populate("table_id", "table_number capacity status")
            .populate("waiter_id", "name email phone");


        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${table.restaurant_id}`).emit("table_assigned", {
                table_id,
                waiter_id,
                shift
            });
        }

        return sendResponse(res, 201, true, "Table assigned successfully.", response);

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};

/*
=========================================
TRANSFER ORDER TO ANOTHER TABLE
PUT /api/waiter/transfer-table
=========================================
*/

export const transferTable = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { order_id, new_table_id } = req.body;
        const order = await Order.findById(order_id).session(session);

        if (!order) {
            throw new Error("Order not found.");
        }

        if (["Completed", "Cancelled", "Rejected"].includes(order.order_status)) {
            throw new Error("Cannot transfer this order.");
        }

        const oldTable = await Table.findById(order.table_id).session(session);

        const newTable = await Table.findById(new_table_id).session(session);

        if (!newTable) {
            throw new Error("Destination table not found.");
        }

        if (oldTable.restaurant_id.toString() !== newTable.restaurant_id.toString()) {
            throw new Error("Cannot transfer across restaurants.");
        }

        if (newTable.status !== "Available") {
            throw new Error("Destination table is Occupied.");
        }

        const existingOrder = await Order.findOne({
            table_id: newTable._id,
            order_status: {
                $in: ["Pending", "Accepted", "Preparing", "Ready", "Served"]
            }
        }).session(session);

        if (existingOrder) {
            throw new Error("Destination table already has an active order.");
        }

        if (!order.original_table) {
            order.original_table = oldTable._id;
        }

        order.table_id = newTable._id;
        order.table_number = newTable.table_number;

        order.status_history.push({
            status: order.order_status,
            changed_by: req.user.id,
            remarks: `Transferred from Table ${oldTable.table_number} to Table ${newTable.table_number}`
        });

        await order.save({ session });

        oldTable.status = "Available";
        newTable.status = "Occupied";

        await oldTable.save({ session });
        await newTable.save({ session });

        await WaiterAssignment.updateMany(
            { table_id: oldTable._id, is_active: true },
            { table_id: newTable._id },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${order.restaurant_id}`).emit("table_transferred", {
                order_id: order._id,
                from: oldTable.table_number,
                to: newTable.table_number
            });
        }

        return sendResponse(res, 200, true, "Table transferred successfully.", {
            order_number: order.order_number,
            old_table: oldTable.table_number,
            new_table: newTable.table_number
        });

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};

/*
=========================================
MERGE TABLES
POST /api/waiter/merge-tables
=========================================
*/


export const mergeTables = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { master_order_id, merge_order_ids } = req.body;

        // Basic Validation

        if (!master_order_id) {
            throw new Error("Master order is required.");
        }

        if (!Array.isArray(merge_order_ids) || merge_order_ids.length === 0) {
            throw new Error("Please select at least one order to merge.");
        }

        // Prevent duplicate IDs

        const uniqueOrders = [...new Set(merge_order_ids)];

        if (uniqueOrders.includes(master_order_id)) {
            throw new Error("Master order cannot be merged into itself.");
        }

        // Load Master Order

        const masterOrder = await Order.findById(master_order_id)
            .populate("items")
            .session(session);

        if (!masterOrder) {
            throw new Error("Master order not found.");
        }

        // Master Order Status Validation

        const invalidStatuses = ["Completed", "Cancelled", "Rejected", "Merged"];

        if (invalidStatuses.includes(masterOrder.order_status)) {
            throw new Error("Master order cannot be merged.");
        }

        // Load Merge Orders

        const mergeOrders = await Order.find({ _id: { $in: uniqueOrders } })
            .populate("items")
            .session(session);

        if (mergeOrders.length !== uniqueOrders.length) {
            throw new Error("One or more merge orders were not found.");
        }

        // Validate Every Merge Order

        for (const order of mergeOrders) {

            if (invalidStatuses.includes(order.order_status)) {
                throw new Error(`Order ${order.order_number} cannot be merged.`);
            }

            if (order.restaurant_id.toString() !== masterOrder.restaurant_id.toString()) {
                throw new Error("Orders belong to different restaurants.");
            }

            if (order.merged_into) {
                throw new Error(`Order ${order.order_number} has already been merged.`);
            }

            if (order._id.toString() === masterOrder._id.toString()) {
                throw new Error("Invalid merge request.");
            }

        }

        // Merge Order Items

        let subtotal = masterOrder.subtotal;
        let totalItems = masterOrder.total_items;
        let couponDiscount = masterOrder.coupon_discount || 0;
        const mergedItemIds = [...masterOrder.items];

        for (const order of mergeOrders) {

            await OrderItem.updateMany(
                { order_id: order._id },
                { order_id: masterOrder._id },
                { session }
            );

            mergedItemIds.push(...order.items);

            subtotal += order.subtotal;
            totalItems += order.total_items;
            couponDiscount += order.coupon_discount || 0;

        }

        // Remove Duplicate Item IDs

        masterOrder.items = [...new Set(mergedItemIds.map((id) => id.toString()))];

        masterOrder.items = masterOrder.items.map(
            (id) => new mongoose.Types.ObjectId(id)
        );

        // Recalculate Taxes

        const gst = subtotal * (masterOrder.gst_percentage / 100);
        const cgst = gst / 2;
        const sgst = gst / 2;
        const serviceCharge = subtotal * (masterOrder.service_charge_percentage / 100);
        const grandTotal = subtotal + cgst + sgst + serviceCharge - couponDiscount;

        // Update Master Order

        masterOrder.subtotal = subtotal;
        masterOrder.total_items = totalItems;
        masterOrder.cgst = cgst;
        masterOrder.sgst = sgst;
        masterOrder.service_charge = serviceCharge;
        masterOrder.discount = couponDiscount;
        masterOrder.coupon_discount = couponDiscount;
        masterOrder.grand_total = grandTotal;

        // Timeline Entry

        masterOrder.status_history.push({
            status: masterOrder.order_status,
            changed_by: req.user.id,
            remarks: `${mergeOrders.length} table(s) merged into this order.`
        });

        await masterOrder.save({ session });

        // Update Invoice

        if (masterOrder.invoice_id) {

            await Invoice.findByIdAndUpdate(
                masterOrder.invoice_id,
                {
                    subtotal,
                    cgst,
                    sgst,
                    service_charge: serviceCharge,
                    discount: couponDiscount,
                    grand_total: grandTotal
                },
                { session }
            );

        }

        // Finalize Child Orders

        const mergedOrderNumbers = [];

        for (const order of mergeOrders) {

            order.order_status = "Merged";
            order.merged_into = masterOrder._id;
            order.merged_at = new Date();
            order.merged_by = req.user.id;

            order.status_history.push({
                status: "Merged",
                changed_by: req.user.id,
                remarks: `Merged into Order #${masterOrder.order_number}`
            });

            await order.save({ session });

            mergedOrderNumbers.push(order.order_number);

            // Release Child Table

            const table = await Table.findById(order.table_id).session(session);

            if (table) {
                table.status = "Available";
                await table.save({ session });
            }

            // Deactivate Waiter Assignment

            await WaiterAssignment.updateMany(
                { table_id: order.table_id, is_active: true },
                { is_active: false, ended_at: new Date(), ended_by: req.user.id },
                { session }
            );

            // Child Invoice

            if (order.invoice_id) {

                await Invoice.findByIdAndUpdate(
                    order.invoice_id,
                    { is_merged: true, merged_invoice: masterOrder.invoice_id },
                    { session }
                );

            }

        }

        // Commit Transaction

        await session.commitTransaction();
        session.endSession();

        // Socket Notification

        const io = req.app.get("io");

        if (io) {

            io.to(`restaurant_${masterOrder.restaurant_id}`).emit("tables_merged", {
                master_order_id: masterOrder._id,
                master_order_number: masterOrder.order_number,
                merged_orders: mergedOrderNumbers
            });

        }

        // Fetch Updated Order

        const response = await Order.findById(masterOrder._id)
            .populate("items")
            .populate("table_id")
            .populate("invoice_id");

        // Response

        return sendResponse(res, 200, true, "Tables merged successfully.", response);

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};


/*
=========================================
CREATE SPLIT BILL
POST /api/waiter/split-bill
=========================================
*/


export const createSplitBill = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { order_id, split_type, guests, splits } = req.body;

        // Validate Order

        if (!order_id) {
            throw new Error("Order ID is required.");
        }

        // Validate Split Type

        const allowedTypes = ["Equal", "Custom", "Item", "Quantity"];

        if (!allowedTypes.includes(split_type)) {
            throw new Error("Invalid split type.");
        }

        const order = await Order.findById(order_id)
            .populate("items")
            .session(session);

        if (!order) {
            throw new Error("Order not found.");
        }

        // Prevent double-split

        const existingSplits = await BillSplit.find({
            order_id,
            status: "Active"
        }).session(session);

        if (existingSplits.length) {
            throw new Error("This order has already been split.");
        }

        // Common order values

        const subtotal = order.subtotal;
        const discount = order.discount || 0;
        const couponDiscount = order.coupon_discount || 0;
        const gstPercentage = order.gst_percentage;
        const servicePercentage = order.service_charge_percentage;
        const grandTotal = order.grand_total;

        const preparedSplits = [];

        // Equal Split

        if (split_type === "Equal") {

            if (!guests || guests <= 1) {
                throw new Error("Invalid guest count.");
            }

            const splitSubtotal = subtotal / guests;
            const splitDiscount = discount / guests;
            const splitCoupon = couponDiscount / guests;

            const splitGST = (splitSubtotal * gstPercentage) / 100;
            const splitCGST = splitGST / 2;
            const splitSGST = splitGST / 2;
            const splitService = (splitSubtotal * servicePercentage) / 100;

            const splitGrand =
                splitSubtotal +
                splitCGST +
                splitSGST +
                splitService -
                splitDiscount -
                splitCoupon;

            for (let i = 1; i <= guests; i++) {
                preparedSplits.push({
                    order_id,
                    split_number: i,
                    split_type,
                    subtotal: +splitSubtotal.toFixed(2),
                    discount: +splitDiscount.toFixed(2),
                    coupon_discount: +splitCoupon.toFixed(2),
                    gst_percentage: gstPercentage,
                    cgst: +splitCGST.toFixed(2),
                    sgst: +splitSGST.toFixed(2),
                    service_charge_percentage: servicePercentage,
                    service_charge: +splitService.toFixed(2),
                    grand_total: +splitGrand.toFixed(2),
                    due_amount: +splitGrand.toFixed(2),
                    items: order.items,
                    status: "Active"
                });
            }
        }

        // Custom Split

        if (split_type === "Custom") {

            if (!splits || !splits.length) {
                throw new Error("Custom split data required.");
            }

            const total = splits.reduce((sum, s) => sum + s.amount, 0);

            // Allow ₹1 rounding tolerance
            if (Math.abs(total - grandTotal) > 1) {
                throw new Error("Split total does not match order total.");
            }

            splits.forEach((split, index) => {
                preparedSplits.push({
                    order_id,
                    split_number: index + 1,
                    split_type,
                    customer_name: split.customer_name || "",
                    grand_total: +split.amount.toFixed(2),
                    due_amount: +split.amount.toFixed(2),
                    items: order.items,
                    status: "Active"
                });
            });
        }

        // Item Split

        if (split_type === "Item") {

            if (!splits || !splits.length) {
                throw new Error("Item split data required.");
            }

            splits.forEach((split, index) => {

                const splitSubtotal = split.items.reduce(
                    (sum, item) => sum + (item.final_price * item.quantity), 0
                );

                const proportion = subtotal > 0 ? splitSubtotal / subtotal : 0;

                const splitDiscount = +(discount * proportion).toFixed(2);
                const splitCoupon = +(couponDiscount * proportion).toFixed(2);
                const splitGST = +((splitSubtotal * gstPercentage) / 100).toFixed(2);
                const splitCGST = +(splitGST / 2).toFixed(2);
                const splitSGST = +(splitGST / 2).toFixed(2);
                const splitService = +((splitSubtotal * servicePercentage) / 100).toFixed(2);

                const splitGrand = +(
                    splitSubtotal +
                    splitCGST +
                    splitSGST +
                    splitService -
                    splitDiscount -
                    splitCoupon
                ).toFixed(2);

                preparedSplits.push({
                    order_id,
                    split_number: index + 1,
                    split_type,
                    customer_name: split.customer_name || "",
                    subtotal: +splitSubtotal.toFixed(2),
                    discount: splitDiscount,
                    coupon_discount: splitCoupon,
                    gst_percentage: gstPercentage,
                    cgst: splitCGST,
                    sgst: splitSGST,
                    service_charge_percentage: servicePercentage,
                    service_charge: splitService,
                    grand_total: splitGrand,
                    due_amount: splitGrand,
                    items: split.items,
                    status: "Active"
                });
            });
        }

        // Quantity Split

        if (split_type === "Quantity") {

            if (!splits || !splits.length) {
                throw new Error("Quantity split data required.");
            }

            splits.forEach((split, index) => {
                preparedSplits.push({
                    ...split,
                    order_id,
                    split_number: index + 1,
                    split_type,
                    due_amount: split.grand_total || 0,
                    status: "Active"
                });
            });
        }

        // Create Split Bills (BillSplit + Invoice + Payment per split)

        const createdSplits = [];

        for (const split of preparedSplits) {

            // Validate grand_total before creating
            // any DB documents for this split

            if (
                split.grand_total === undefined ||
                split.grand_total === null ||
                isNaN(split.grand_total)
            ) {
                throw new Error(
                    `Split ${split.split_number} has no valid grand_total. ` +
                    `Check that Item split calculations are correct.`
                );
            }

            // Create Bill Split

            const billSplit = await BillSplit.create(
                [
                    {
                        restaurant_id: order.restaurant_id,
                        order_id: order._id,
                        split_number: split.split_number,
                        split_type: split.split_type,
                        customer_name: split.customer_name || "",
                        customer_phone: split.customer_phone || "",
                        customer_email: split.customer_email || "",
                        items: split.items,
                        subtotal: split.subtotal || 0,
                        discount: split.discount || 0,
                        coupon_discount: split.coupon_discount || 0,
                        gst_percentage: split.gst_percentage || order.gst_percentage,
                        cgst: split.cgst || 0,
                        sgst: split.sgst || 0,
                        service_charge_percentage:
                            split.service_charge_percentage ||
                            order.service_charge_percentage,
                        service_charge: split.service_charge || 0,
                        grand_total: split.grand_total,
                        due_amount: split.due_amount,
                        payment_status: "Pending",
                        payment_method: order.payment_method,
                        created_by: req.user.id
                    }
                ],
                { session }
            );

            const createdSplit = billSplit[0];

            // Invoice

            const invoice = await Invoice.create(
                [
                    {
                        restaurant_id: order.restaurant_id,
                        order_id: order._id,
                        bill_split_id: createdSplit._id,
                        invoice_number: generateInvoiceNumber(),
                        subtotal: createdSplit.subtotal,
                        discount: createdSplit.discount,
                        cgst: createdSplit.cgst,
                        sgst: createdSplit.sgst,
                        service_charge: createdSplit.service_charge,
                        grand_total: createdSplit.grand_total
                    }
                ],
                { session }
            );

            // Payment

            const payment = await Payment.create(
                [
                    {
                        restaurant_id: order.restaurant_id,
                        order_id: order._id,
                        invoice_id: invoice[0]._id,
                        bill_split_id: createdSplit._id,
                        amount: createdSplit.grand_total,
                        payment_method: createdSplit.payment_method,
                        payment_status: "Pending"
                    }
                ],
                { session }
            );


            const updatedSplit = await BillSplit.findByIdAndUpdate(
                createdSplit._id,
                {
                    $set: {
                        invoice_id: invoice[0]._id,
                        payment_id: payment[0]._id
                    }
                },
                { new: true, session }
            );

            createdSplits.push(updatedSplit);

        }

        // Update Original Order

        await Order.findByIdAndUpdate(
            order._id,
            {
                $set: {
                    is_split: true,
                    split_count: createdSplits.length
                },
                $push: {
                    status_history: {
                        status: "Bill Split",
                        changed_by: req.user.id,
                        remarks: `Bill split into ${createdSplits.length} parts.`
                    }
                }
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        // Socket

        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${order.restaurant_id}`).emit("bill_split_created", {
                order_id: order._id,
                splits: createdSplits.length
            });
        }

        return sendResponse(res, 201, true, "Bill split successfully.", createdSplits);

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};

/*
=========================================
GET SPLIT BILLS
GET /api/waiter/split-bills/:order_id
=========================================
*/

export const getSplitBills = async (req, res, next) => {

    try {

        const { order_id } = req.params;

        if (!order_id) {
            throw new Error("Order ID is required.");
        }

        const splits = await BillSplit.find({
            order_id,
            status: "Active"
        })
            .populate({
                path: "items",
                select: "item_name quantity total_price"
            })
            .populate({ path: "invoice_id" })
            .sort({ split_number: 1 });

        if (!splits.length) {
            throw new Error("No split bills found.");
        }

        const result = [];

        for (const split of splits) {

            const payment = await Payment.findOne({
                invoice_id: split.invoice_id?._id
            });

            result.push({
                ...split.toObject(),
                payment
            });

        }

        const summary = {
            total_splits: splits.length,
            total_amount: splits.reduce((total, split) => total + split.grand_total, 0),
            total_paid: splits.reduce((total, split) => total + split.paid_amount, 0),
            total_due: splits.reduce((total, split) => total + split.due_amount, 0)
        };

        return sendResponse(res, 200, true, "Split bills fetched successfully.", {
            summary,
            splits: result
        });

    }
    catch (error) {
        next(error);
    }

};



/*
=========================================
PAY SPLIT BILL
PUT /api/waiter/split-payment/:split_id
=========================================
*/

export const paySplitBill = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { split_id } = req.params;
        const { amount, payment_method, transaction_id } = req.body;

        if (!split_id) {
            throw new Error("Split ID is required.");
        }

        if (!amount || amount <= 0) {
            throw new Error("Invalid payment amount.");
        }

        const split = await BillSplit.findById(split_id).session(session);

        if (!split) {
            throw new Error("Split bill not found.");
        }

        if (split.status !== "Active") {
            throw new Error("Split bill is not active.");
        }

        if (split.payment_status === "Paid") {
            throw new Error("This split is already paid.");
        }

        if (amount > split.due_amount) {
            throw new Error("Amount exceeds due amount.");
        }

        const payment = await Payment.findOne({
            invoice_id: split.invoice_id
        }).session(session);

        if (!payment) {
            throw new Error("Payment record not found.");
        }

        payment.paid_amount = (payment.paid_amount || 0) + amount;
        payment.amount = split.grand_total;
        payment.payment_method = payment_method;
        payment.transaction_id = transaction_id || "";
        payment.due_amount = split.grand_total - payment.paid_amount;

        if (payment.due_amount <= 0) {
            payment.payment_status = "Paid";
            payment.paid_at = new Date();
        }
        else {
            payment.payment_status = "Partial";
        }

        await payment.save({ session });

        split.paid_amount += amount;
        split.due_amount -= amount;
        split.payment_method = payment_method;

        if (split.due_amount <= 0) {
            split.payment_status = "Paid";
            split.paid_at = new Date();
            split.due_amount = 0;
        }
        else {
            split.payment_status = "Partial";
        }

        await split.save({ session });

        const pendingSplits = await BillSplit.countDocuments({
            order_id: split.order_id,
            status: "Active",
            payment_status: { $ne: "Paid" }
        }).session(session);

        if (pendingSplits === 0) {

            const order = await Order.findById(split.order_id).session(session);

            if (order) {

                order.payment_status = "Paid";

                order.status_history.push({
                    status: "Payment Completed",
                    changed_by: req.user.id,
                    remarks: "All split bills paid."
                });

                await order.save({ session });

            }

        }

        await session.commitTransaction();
        session.endSession();

        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${split.restaurant_id}`).emit("split_payment_updated", {
                split_id: split._id,
                payment_status: split.payment_status,
                due_amount: split.due_amount
            });
        }

        return sendResponse(res, 200, true, "Payment updated successfully.", split);

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};


/*
=========================================
CANCEL SPLIT BILL
PUT /api/waiter/cancel-split/:split_id
=========================================
*/

export const cancelSplitBill = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { split_id } = req.params;

        if (!split_id) {
            throw new Error("Split ID is required.");
        }

        const split = await BillSplit.findById(split_id).session(session);

        if (!split) {
            throw new Error("Split bill not found.");
        }

        if (split.status === "Cancelled") {
            throw new Error("Split bill is already cancelled.");
        }

        if (split.payment_status === "Paid") {
            throw new Error("Paid split bills cannot be cancelled.");
        }

        if (split.payment_status === "Partial") {
            throw new Error("Partially paid split bills cannot be cancelled.");
        }

        split.status = "Cancelled";
        split.updated_by = req.user.id;

        await split.save({ session });

        if (split.invoice_id) {

            const invoice = await Invoice.findById(split.invoice_id).session(session);

            if (invoice) {
                invoice.status = "Cancelled";
                await invoice.save({ session });
            }

        }

        const payment = await Payment.findOne({
            invoice_id: split.invoice_id
        }).session(session);

        if (payment && payment.payment_status === "Pending") {
            payment.payment_status = "Cancelled";
            await payment.save({ session });
        }

        const activeSplits = await BillSplit.countDocuments({
            order_id: split.order_id,
            status: "Active"
        }).session(session);

        if (activeSplits === 0) {

            const order = await Order.findById(split.order_id).session(session);

            if (order) {

                order.is_split = false;
                order.split_count = 0;

                order.status_history.push({
                    status: "Split Cancelled",
                    changed_by: req.user.id,
                    remarks: "All split bills cancelled."
                });

                await order.save({ session });

            }

        }

        await session.commitTransaction();
        session.endSession();

        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${split.restaurant_id}`).emit("split_bill_cancelled", {
                split_id: split._id,
                order_id: split.order_id
            });
        }

        return sendResponse(res, 200, true, "Split bill cancelled successfully.");

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};


export const requestBill = async (req, res, next) => { };

/*
=========================================
ADD ITEM TO EXISTING ORDER
POST /api/waiter/add-item
=========================================
*/

export const addOrderItem = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { order_id, menu_item_id, quantity, special_instruction } = req.body;

        const order = await Order.findById(order_id)
            .populate("items")
            .session(session);

        if (!order) {
            throw new Error("Order not found.");
        }

        if (["Completed", "Cancelled", "Rejected"].includes(order.order_status)) {
            throw new Error("This order cannot be modified.");
        }

        const menu = await MenuItem.findById(menu_item_id);

        if (!menu) {
            throw new Error("Menu item not found.");
        }

        if (!menu.is_available) {
            throw new Error(`${menu.item_name} is unavailable`);
        }

        const category = await Category.findById(menu.category_id);

        const originalPrice = menu.price;
        const discountPrice = menu.discount_price;
        const finalPrice = discountPrice > 0 ? discountPrice : originalPrice;
        const total = finalPrice * quantity;

        const orderItem = await OrderItem.create(
            [
                {
                    order_id: order._id,
                    menu_item_id: menu._id,
                    item_name: menu.item_name,
                    item_image: menu.image,
                    category_name: category?.category_name || "",
                    food_type: menu.food_type,
                    preparation_time: menu.preparation_time,
                    spice_level: menu.spice_level,
                    calories: menu.calories,
                    original_price: originalPrice,
                    discount_price: discountPrice,
                    final_price: finalPrice,
                    quantity,
                    total_price: total,
                    special_instruction: special_instruction || ""
                }
            ],
            { session }
        );

        order.items.push(orderItem[0]._id);

        const items = await OrderItem.find({ order_id: order._id }).session(session);

        let subtotal = 0;
        let totalItems = 0;

        items.forEach((item) => {
            subtotal += item.total_price;
            totalItems += item.quantity;
        });

        const gst = subtotal * (order.gst_percentage / 100);
        const cgst = gst / 2;
        const sgst = gst / 2;
        const serviceCharge = subtotal * (order.service_charge_percentage / 100);
        const grandTotal = subtotal + cgst + sgst + serviceCharge - order.coupon_discount;

        order.subtotal = subtotal;
        order.total_items = totalItems;
        order.cgst = cgst;
        order.sgst = sgst;
        order.service_charge = serviceCharge;
        order.grand_total = grandTotal;

        order.status_history.push({
            status: order.order_status,
            changed_by: req.user.id,
            remarks: `Added ${quantity} × ${menu.item_name}`
        });

        await order.save({ session });

        await Invoice.findByIdAndUpdate(
            order.invoice_id,
            { subtotal, cgst, sgst, service_charge: serviceCharge, grand_total: grandTotal },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${order.restaurant_id}`).emit("order_updated", {
                order_id: order._id,
                type: "ITEM_ADDED",
                item: menu.item_name
            });
        }

        return sendResponse(res, 200, true, "Item added successfully.");

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};


/*
=========================================
UPDATE ORDER ITEM
PUT /api/waiter/update-item
=========================================
*/

export const updateOrderItem = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { order_item_id, quantity, special_instruction } = req.body;

        const orderItem = await OrderItem.findById(order_item_id).session(session);

        if (!orderItem) {
            throw new Error("Order item not found.");
        }

        const order = await Order.findById(orderItem.order_id).session(session);

        if (!order) {
            throw new Error("Order not found.");
        }

        if (["Completed", "Cancelled", "Rejected"].includes(order.order_status)) {
            throw new Error("This order cannot be modified.");
        }

        if (quantity === undefined || quantity < 1) {
            throw new Error("Quantity must be at least 1.");
        }

        orderItem.quantity = Number(quantity);
        orderItem.total_price = orderItem.final_price * Number(quantity);

        if (special_instruction !== undefined) {
            orderItem.special_instruction = special_instruction;
        }

        await orderItem.save({ session });

        const items = await OrderItem.find({ order_id: order._id }).session(session);

        let subtotal = 0;
        let totalItems = 0;

        items.forEach((item) => {
            subtotal += item.total_price;
            totalItems += item.quantity;
        });

        const gst = subtotal * (order.gst_percentage / 100);
        const cgst = gst / 2;
        const sgst = gst / 2;
        const serviceCharge = subtotal * (order.service_charge_percentage / 100);
        const grandTotal = subtotal + cgst + sgst + serviceCharge - order.coupon_discount;

        order.subtotal = subtotal;
        order.total_items = totalItems;
        order.cgst = cgst;
        order.sgst = sgst;
        order.service_charge = serviceCharge;
        order.grand_total = grandTotal;

        order.status_history.push({
            status: order.order_status,
            changed_by: req.user.id,
            remarks: `Updated ${orderItem.item_name} quantity to ${quantity}`
        });

        await order.save({ session });

        await Invoice.findByIdAndUpdate(
            order.invoice_id,
            { subtotal, cgst, sgst, service_charge: serviceCharge, grand_total: grandTotal },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${order.restaurant_id}`).emit("order_updated", {
                order_id: order._id,
                type: "ITEM_UPDATED",
                item: orderItem.item_name,
                quantity: orderItem.quantity
            });
        }

        return sendResponse(res, 200, true, "Order item updated successfully.");

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};

/*
=========================================
REMOVE ORDER ITEM
DELETE /api/waiter/remove-item/:id
=========================================
*/

export const removeOrderItem = async (req, res, next) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const orderItemId = req.params.id;

        const orderItem = await OrderItem.findById(orderItemId).session(session);

        if (!orderItem) {
            throw new Error("Order item not found.");
        }

        const order = await Order.findById(orderItem.order_id).session(session);

        if (!order) {
            throw new Error("Order not found.");
        }

        if (["Completed", "Cancelled", "Rejected"].includes(order.order_status)) {
            throw new Error("This order cannot be modified.");
        }

        order.items = order.items.filter(
            (itemId) => itemId.toString() !== orderItemId
        );

        await OrderItem.findByIdAndDelete(orderItemId, { session });

        const items = await OrderItem.find({ order_id: order._id }).session(session);

        if (items.length === 0) {

            order.subtotal = 0;
            order.total_items = 0;
            order.cgst = 0;
            order.sgst = 0;
            order.service_charge = 0;
            order.grand_total = 0;
            order.order_status = "Cancelled";

            order.status_history.push({
                status: "Cancelled",
                changed_by: req.user.id,
                remarks: "All items removed. Order cancelled."
            });

            await order.save({ session });

            await Invoice.findByIdAndUpdate(
                order.invoice_id,
                { subtotal: 0, cgst: 0, sgst: 0, service_charge: 0, grand_total: 0, discount: 0 },
                { session }
            );

            await Table.findByIdAndUpdate(
                order.table_id,
                { status: "Available" },
                { session }
            );

        }
        else {

            let subtotal = 0;
            let totalItems = 0;

            items.forEach((item) => {
                subtotal += item.total_price;
                totalItems += item.quantity;
            });

            const gst = subtotal * (order.gst_percentage / 100);
            const cgst = gst / 2;
            const sgst = gst / 2;
            const serviceCharge = subtotal * (order.service_charge_percentage / 100);
            const grandTotal = subtotal + cgst + sgst + serviceCharge - order.coupon_discount;

            order.subtotal = subtotal;
            order.total_items = totalItems;
            order.cgst = cgst;
            order.sgst = sgst;
            order.service_charge = serviceCharge;
            order.grand_total = grandTotal;

            order.status_history.push({
                status: order.order_status,
                changed_by: req.user.id,
                remarks: `Removed ${orderItem.item_name}`
            });

            await order.save({ session });

            await Invoice.findByIdAndUpdate(
                order.invoice_id,
                { subtotal, cgst, sgst, service_charge: serviceCharge, grand_total: grandTotal },
                { session }
            );

        }

        await session.commitTransaction();
        session.endSession();

        const io = req.app.get("io");

        if (io) {
            io.to(`restaurant_${order.restaurant_id}`).emit("order_updated", {
                order_id: order._id,
                type: "ITEM_REMOVED",
                item: orderItem.item_name
            });
        }

        return sendResponse(res, 200, true, "Order item removed successfully.");

    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

};