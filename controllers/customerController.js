import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import LoyaltyTransaction from "../models/LoyaltyTransaction.js";

import sendResponse from "../utils/sendResponse.js";
import { getTierForSpend } from "../utils/membershipTiers.js";

/*
=========================================================
CREATE CUSTOMER
POST /api/customer/create
=========================================================
*/

export const createCustomer = async (req, res, next) => {

    try {

        const { name, phone, email, dob, gender, address, tags, notes } = req.body;

        if (!name || !name.trim()) {
            throw new Error("Customer name is required.");
        }

        if (!phone || !phone.trim()) {
            throw new Error("Customer phone number is required.");
        }

        const existing = await Customer.findOne({
            restaurant_id: req.user.restaurant_id,
            phone: phone.trim()
        });

        if (existing) {
            throw new Error("A customer with this phone number already exists.");
        }

        const customer = await Customer.create({
            restaurant_id: req.user.restaurant_id,
            name: name.trim(),
            phone: phone.trim(),
            email: email || "",
            dob: dob || null,
            gender: gender || "Prefer not to say",
            address: address || "",
            tags: tags || [],
            notes: notes || "",
            created_by: req.user.id
        });

        sendResponse(res, 201, true, "Customer created successfully.", customer);

    } catch (error) { next(error); }

};

/*
=========================================================
GET / SEARCH CUSTOMERS
GET /api/customer/list?search=rahul&tier=Gold&page=1&limit=20
=========================================================
*/

export const getCustomers = async (req, res, next) => {

    try {

        const { search, tier, page = 1, limit = 20 } = req.query;

        const filter = {
            restaurant_id: req.user.restaurant_id,
            is_active: true
        };

        if (tier) {
            filter.membership_tier = tier;
        }

        if (search) {

            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [customers, total] = await Promise.all([
            Customer.find(filter)
                .sort({ last_visit_at: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Customer.countDocuments(filter)
        ]);

        sendResponse(res, 200, true, "Customers fetched successfully.", {
            customers,

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
GET SINGLE CUSTOMER PROFILE
GET /api/customer/:id
=========================================================
*/

export const getCustomerProfile = async (req, res, next) => {

    try {

        const { id } = req.params;

        const customer = await Customer.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!customer) {
            throw new Error("Customer not found.");
        }

        // Recent orders (visit history)

        const recentOrders = await Order.find({
            customer_phone: customer.phone,
            restaurant_id: req.user.restaurant_id,
            order_status: { $nin: ["Cancelled", "Rejected"] }
        })

            .sort({ createdAt: -1 })
            .limit(10)
            .select("order_number grand_total order_status createdAt total_items");

        // Recent loyalty activity

        const loyaltyHistory = await LoyaltyTransaction.find({

            customer_id: customer._id
        })
            .sort({ createdAt: -1 })
            .limit(20);

        sendResponse(res, 200, true, "Customer profile fetched successfully.", {

            customer,
            recent_orders: recentOrders,
            loyalty_history: loyaltyHistory
        });

    } catch (error) { next(error); }

};

/*
=========================================================
UPDATE CUSTOMER
PUT /api/customer/:id
=========================================================
*/

export const updateCustomer = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { name, email, dob, gender, address, tags, notes, is_active } = req.body;
        const customer = await Customer.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!customer) {
            throw new Error("Customer not found.");
        }

        if (name !== undefined) customer.name = name.trim();
        if (email !== undefined) customer.email = email;
        if (dob !== undefined) customer.dob = dob;
        if (gender !== undefined) customer.gender = gender;
        if (address !== undefined) customer.address = address;
        if (tags !== undefined) customer.tags = tags;
        if (notes !== undefined) customer.notes = notes;
        if (is_active !== undefined) customer.is_active = is_active;

        await customer.save();

        sendResponse(res, 200, true, "Customer updated successfully.", customer);

    } catch (error) { next(error); }

};

/*
=========================================================
RECORD A VISIT / LINK ORDER TO CUSTOMER
=========================================================
*/

export const syncCustomerAfterOrder = async (order, session = null) => {

    try {

        if (!order.customer_phone) return null;

        let customer = await Customer.findOne({
            restaurant_id: order.restaurant_id,
            phone: order.customer_phone
        }).session(session);

        if (!customer) {

            const created = await Customer.create(

                [{
                    restaurant_id: order.restaurant_id,
                    name: order.customer_name || "Walk-in Customer",
                    phone: order.customer_phone,
                    first_visit_at: new Date(),
                    last_visit_at: new Date()
                }],

                session ? { session } : {}

            );

            customer = created[0];

        }

        customer.total_orders += 1;
        customer.total_spent += order.grand_total;
        customer.average_order_value = Number(
            (customer.total_spent / customer.total_orders).toFixed(2)
        );

        customer.last_visit_at = new Date();

        if (!customer.first_visit_at) {
            customer.first_visit_at = new Date();
        }

        customer.membership_tier = getTierForSpend(customer.total_spent);

        await customer.save(session ? { session } : {});

        return customer;

    } catch (error) {

        // Don't let CRM sync failures break the checkout flow;
        // log and continue.

        console.error("syncCustomerAfterOrder error:", error.message);

        return null;

    }

};

/*
=========================================================
UPCOMING BIRTHDAYS
GET /api/customer/birthdays?days=7
=========================================================
*/

export const getUpcomingBirthdays = async (req, res, next) => {

    try {
        const days = Number(req.query.days) || 7;
        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDate = today.getDate();

        // Fetch all customers with a DOB set, filter in JS since
        // MongoDB doesn't easily compare month/day across year boundaries.

        const customers = await Customer.find({
            restaurant_id: req.user.restaurant_id,
            dob: { $ne: null },
            is_active: true
        }).select("name phone dob last_birthday_reward_year");

        const upcoming = customers.filter((c) => {
            const dob = new Date(c.dob);
            const dobMonth = dob.getMonth() + 1;
            const dobDate = dob.getDate();

            // Build this year's birthday date for day-difference math

            const thisYearBirthday = new Date(
                today.getFullYear(), dobMonth - 1, dobDate);

            let diffDays = Math.ceil(
                (thisYearBirthday - today) / (1000 * 60 * 60 * 24));

            // If birthday already passed this year, check next year's

            if (diffDays < 0) {
                const nextYearBirthday = new Date(
                    today.getFullYear() + 1, dobMonth - 1, dobDate);

                diffDays = Math.ceil(
                    (nextYearBirthday - today) / (1000 * 60 * 60 * 24));

            }

            return diffDays >= 0 && diffDays <= days;

        });

        sendResponse(res, 200, true, "Upcoming birthdays fetched.", upcoming);

    } catch (error) { next(error); }

};