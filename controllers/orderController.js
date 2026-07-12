import mongoose from "mongoose";

import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import MenuItem from "../models/MenuItem.js";
import Restaurant from "../models/Restaurant.js";
import Table from "../models/Table.js";
import Coupon from "../models/Coupon.js";
import RestaurantSettings from "../models/RestaurantSettings.js";
import Invoice from "../models/Invoice.js";
import Category from "../models/Category.js";

import { emitNewOrder } from "../socket/kitchenSocket.js";

import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";
import generateOrderNumber from "../utils/generateOrderNumber.js";
import sendResponse from "../utils/sendResponse.js";

// CREATE ORDER
// POST /api/orders/create

export const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            table_id,
            customer_name,
            customer_phone,
            customer_email,
            order_type,
            payment_method,
            special_instruction,
            items
        } = req.body;

        // Validate Items
        if (!items || items.length === 0) {
            return sendResponse(res, 400, false, "Please select at least one item.");
        }

        // Find Table
        const table =
            await Table.findById(table_id);

        if (!table) {
            return sendResponse(res, 404, false, "Table not found.");
        }

        // Find Restaurant
        const restaurant = await Restaurant.findById(table.restaurant_id);

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant not found.");
        }

        let subtotal = 0;
        let totalItems = 0;
        const orderItems = [];

        // Validate Every Menu Item
        for (const item of items) {
            const menu = await MenuItem.findById(item.menu_item_id);

            if (!menu) {
                throw new Error(`Menu Item Not Found`);
            }

            if (!menu.is_available) {
                throw new Error(`${menu.item_name} is unavailable`)
            }


            const itemCategory =
                await Category.findById(menu.category_id);

            const qty =
                Number(item.quantity);

            const originalPrice = menu.price;
            const discountPrice = menu.discount_price;

            const finalPrice =
                discountPrice > 0
                    ? discountPrice
                    : originalPrice;

            const total =
                qty * finalPrice;

            subtotal += total;

            totalItems += qty;

            orderItems.push({

                menu_item_id:
                    menu._id,

                item_name:
                    menu.item_name,

                item_image:
                    menu.image,

                category_name:
                    itemCategory ? itemCategory.category_name : "",

                food_type:
                    menu.food_type,

                preparation_time:
                    menu.preparation_time,

                spice_level:
                    menu.spice_level,

                calories:
                    menu.calories,

                original_price:
                    originalPrice,

                discount_price:
                    discountPrice,

                final_price:
                    finalPrice,

                quantity: qty,

                total_price: total,

                special_instruction:
                    item.special_instruction || ""
            });
        }

        // Tax Calculation
        const settings =
            await RestaurantSettings.findOne({
                restaurant_id:
                    restaurant._id
            });

        const gstPercentage =
            settings
                ? settings.gst_percentage
                : 5;

        const servicePercentage =
            settings
                ? settings.service_charge_percentage
                : 0;

        const totalGST =
            subtotal *
            (gstPercentage / 100);

        const cgst =
            totalGST / 2;

        const sgst =
            totalGST / 2;

        const serviceCharge =
            subtotal *
            (servicePercentage / 100);

        let couponDiscount = 0;
        let couponCode = "";

        if (req.body.coupon_code) {
            const coupon =
                await Coupon.findOne({
                    restaurant_id:
                        restaurant._id,
                    code:
                        req.body.coupon_code.toUpperCase(),
                    is_active: true
                });

            if (!coupon) {
                throw new Error(
                    "Invalid Coupon"
                );
            }

            if (coupon.expiry_date < new Date()) {
                throw new Error(
                    "Coupon Expired"
                );
            }

            if (subtotal < coupon.minimum_order) {
                throw new Error(`Minimum order ₹${coupon.minimum_order}`);
            }
            couponCode =
                coupon.code;
            if (
                coupon.discount_type === "Flat"
            ) {
                couponDiscount =
                    coupon.discount_value;
            } else {
                couponDiscount =
                    subtotal *
                    coupon.discount_value /
                    100;
                if (
                    coupon.maximum_discount > 0
                    &&
                    couponDiscount >
                    coupon.maximum_discount
                ) {
                    couponDiscount =
                        coupon.maximum_discount;
                }
            }
        }


        const grandTotal =
            subtotal +
            cgst +
            sgst +
            serviceCharge -
            couponDiscount;

        const existingOrder =
            await Order.findOne({
                table_id,
                order_status: {
                    $in: [
                        "Pending",
                        "Accepted",
                        "Preparing"
                    ]
                }
            });

        if (existingOrder) {
            throw new Error("This table already has an active order.");
        }

        const allowedPayments = [];


        if (!settings || settings.allow_cash)
            allowedPayments.push("Cash");

        if (!settings || settings.allow_upi)
            allowedPayments.push("UPI");

        if (!settings || settings.allow_card)
            allowedPayments.push("Card");

        if (!settings || settings.allow_online)
            allowedPayments.push("Online");
        if (
            !allowedPayments.includes(
                payment_method
            )
        ) {
            throw new Error(`${payment_method} payment is disabled`);
        }



        // Create Order
        const order =
            await Order.create([
                {
                    restaurant_id:
                        restaurant._id,

                    table_id:
                        table._id,

                    table_number:
                        table.table_number,

                    order_number:
                        generateOrderNumber(),

                    customer_name,
                    customer_phone,
                    customer_email,
                    order_type,
                    subtotal,
                    cgst,
                    sgst,
                    discount: couponDiscount,
                    coupon_code: couponCode,
                    coupon_discount: couponDiscount,

                    gst_percentage: gstPercentage,

                    service_charge_percentage:
                        servicePercentage,

                    service_charge:
                        serviceCharge,

                    grand_total:
                        grandTotal,

                    payment_method,

                    special_instruction,

                    total_items:
                        totalItems,
                }
            ], { session });

        const createdOrder =
            order[0];

        const createdItems = [];

        for (const item of orderItems) {

            const orderItem =
                await OrderItem.create([
                    {
                        order_id:
                            createdOrder._id,
                        ...item
                    }

                ], { session });

            createdItems.push(
                orderItem[0]._id
            );
        }

        createdOrder.items =
            createdItems;

        const invoice =
            await Invoice.create([{
                order_id:
                    createdOrder._id,
                restaurant_id:
                    restaurant._id,
                invoice_number:
                    generateInvoiceNumber(),
                subtotal,
                cgst,
                sgst,
                service_charge:
                    serviceCharge,
                discount:
                    couponDiscount,
                grand_total:
                    grandTotal
            }], { session });

        createdOrder.invoice_id =
            invoice[0]._id;

        createdOrder.invoice_number =
            invoice[0].invoice_number;

        await createdOrder.save({
            session
        });

        table.status = "Occupied";
        await table.save({
            session
        });

        await session.commitTransaction();
        session.endSession();

        const response =
            await Order.findById(createdOrder._id)
                .populate("items")
                .populate("invoice_id")
                .populate(
                    "table_id",
                    "table_number"
                );


        emitNewOrder(response);

        sendResponse(res, 201, true, "Order Created Successfully", response);
    }

    catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

/*
===================================
GET ALL ORDERS (for restaurant dashboard)
GET /api/orders
===================================
*/
export const getOrders = async (req, res, next) => {
    try {
        const restaurant =
            await Restaurant.findOne({ owner_id: req.user._id });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant not found.");
        }

        const orders = await Order.find({ restaurant_id: restaurant._id })
            .populate("table_id", "table_number")
            .sort({ createdAt: -1 });


        const orderIds = orders.map((o) => o._id);
        const allItems = await OrderItem.find({ order_id: { $in: orderIds } });

        const itemsByOrder = allItems.reduce((acc, item) => {
            const key = item.order_id.toString();
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

        const ordersWithItems = orders.map((order) => ({
            ...order.toObject(),
            items: itemsByOrder[order._id.toString()] || [],
        }));

        sendResponse(res, 200, true, "Orders fetched", ordersWithItems);
    } catch (error) { next(error) }
};

/*
===================================
GET SINGLE ORDER BY ID
GET /api/orders/:id
===================================
*/
export const getOrderById = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("invoice_id")
            .populate("table_id", "table_number");

        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        const items = await OrderItem.find({ order_id: order._id });

        sendResponse(res, 200, true, "Order fetched", {
            ...order.toObject(),
            items,
        });
    } catch (error) { next(error) }
};