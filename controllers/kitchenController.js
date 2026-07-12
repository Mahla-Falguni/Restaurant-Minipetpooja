import Order from "../models/Order.js";

import sendResponse from "../utils/sendResponse.js";

/*
==================================================
GET KITCHEN ORDERS
GET /api/kitchen/orders
==================================================
*/

export const getKitchenOrders = async (req, res, next) => {
    try {
        const {
            status,
            order_type,
            table_number,
            page = 1,
            limit = 50
        } = req.query;

        const filter = {};

        // Restaurant Filter (Logged-in Restaurant)
        if (req.user?.restaurant_id) {
            filter.restaurant_id = req.user.restaurant_id;
        }

        // Default Kitchen Orders
        filter.order_status = {
            $in: ["Pending", "Accepted", "Preparing", "Ready"]
        };

        // Status Filter
        if (status) {
            filter.order_status = status;
        }

        // Order Type
        if (order_type) {
            filter.order_type = order_type;
        }

        // Table Filter
        if (table_number) {
            filter.table_number = table_number;
        }

        const orders = await Order.find(filter)

            .populate("items")
            .populate("table_id", "table_number table_name")
            .populate("chef_id", "first_name last_name")
            .populate("served_by", "first_name last_name")
            .sort({ createdAt: 1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const totalOrders =
            await Order.countDocuments(filter);

        return sendResponse(res, 200, true, "Kitchen Orders Fetched Successfully",
            {
                totalOrders,
                currentPage: Number(page),
                totalPages: Math.ceil(totalOrders / limit),
                orders
            }
        );
    }
    catch (error) { next(error); }
};

/*
==================================================
CHEF ACCEPT ORDER
PATCH /api/kitchen/accept/:id
==================================================
*/

export const acceptOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        if (order.order_status !== "Pending") {
            return sendResponse(res, 400, false, "Only pending orders can be accepted.");
        }

        order.order_status = "Accepted";
        order.accepted_at = new Date();

        // Assign Chef Automatically
        if (req.user) { order.chef_id = req.user._id; }

        // Timeline
        order.status_history.push({
            status: "Accepted",
            remarks: "Order accepted by chef.",
            changed_at: new Date(),
            changed_by: req.user ? req.user._id : null
        });
        await order.save();

        /*
        SOCKET EVENT io.emit("orderAccepted", order);
        */

        return sendResponse(res, 200, true, "Order Accepted Successfully", order);
    }
    catch (error) { next(error); }
};


/*
==================================================
START PREPARING ORDER
PATCH /api/kitchen/preparing/:id
==================================================
*/

export const startPreparing = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        if (order.order_status !== "Accepted") {
            return sendResponse(res, 400, false, "Only accepted orders can be moved to Preparing.");
        }

        order.order_status = "Preparing";
        order.preparing_at = new Date();
        order.status_history.push({
            status: "Preparing",
            remarks: "Chef started preparing the order.",
            changed_at: new Date(),
            changed_by: req.user ? req.user._id : null
        });
        await order.save();

        /*
        SOCKET EVENT io.emit("orderPreparing", order);
        */

        return sendResponse(res, 200, true, "Order moved to Preparing.", order);
    }

    catch (error) { next(error); }
};


/*
==================================================
MARK ORDER READY
PATCH /api/kitchen/ready/:id
==================================================
*/

export const markReady = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        if (order.order_status !== "Preparing") {
            return sendResponse(res, 400, false, "Only preparing orders can be marked Ready.");
        }

        order.order_status = "Ready";
        order.ready_at = new Date();
        order.status_history.push({
            status: "Ready",
            remarks: "Food is ready for serving.",
            changed_at: new Date(),
            changed_by: req.user ? req.user._id : null
        });
        await order.save();

        /*
        SOCKET EVENT  io.emit("orderReady", order);
        */

        return sendResponse(res, 200, true, "Order marked as Ready.", order);
    }

    catch (error) { next(error); }
};


/*
==================================================
SERVE ORDER
PATCH /api/kitchen/serve/:id
==================================================
*/

export const serveOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        if (order.order_status !== "Ready") {
            return sendResponse(res, 400, false, "Only ready orders can be served.");
        }

        order.order_status = "Served";
        order.served_at = new Date();

        if (req.user) { order.served_by = req.user._id; }

        order.status_history.push({
            status: "Served",
            remarks: "Food served to customer.",
            changed_at: new Date(),
            changed_by: req.user ? req.user._id : null
        });
        await order.save();

        /*
        io.emit("orderServed", order);
        */

        return sendResponse(res, 200, true, "Order served successfully.", order);
    }

    catch (error) { next(error); }
};



/*
==================================================
COMPLETE ORDER
PATCH /api/kitchen/complete/:id
==================================================
*/

export const completeOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        if (order.order_status !== "Served") {
            return sendResponse(res, 400, false, "Only served orders can be completed.");
        }

        order.order_status = "Completed";
        order.completed_at = new Date();
        order.status_history.push({
            status: "Completed",
            remarks: "Order completed successfully.",
            changed_at: new Date(),
            changed_by: req.user ? req.user._id : null
        });
        await order.save();


        /*
        io.emit("orderCompleted", order);
        */

        return sendResponse(res, 200, true, "Order completed successfully.", order);
    }

    catch (error) { next(error); }
};


/*
==================================================
REJECT ORDER
PATCH /api/kitchen/reject/:id
==================================================
*/

export const rejectOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        if (order.order_status !== "Pending" && order.order_status !== "Accepted") {
            return sendResponse(res, 400, false, "Order cannot be rejected.");
        }

        order.order_status = "Rejected";
        order.status_history.push({
            status: "Rejected",
            remarks: req.body.reason || "Rejected by kitchen.",
            changed_at: new Date(),
            changed_by: req.user ? req.user._id : null
        });
        await order.save();

        /*
        io.emit("orderRejected", order);
        */

        return sendResponse(res, 200, true, "Order rejected.", order);
    }

    catch (error) { next(error); }
};



/*
==================================================
KITCHEN DASHBOARD STATS
GET /api/kitchen/dashboard
==================================================
*/

export const getKitchenDashboardStats = async (req, res, next) => {
    try {
        const restaurantFilter = {};

        if (req.user?.restaurant_id) {
            restaurantFilter.restaurant_id = req.user.restaurant_id;
        }

        const [pending, accepted, preparing, ready, served, completed, rejected]
            = await Promise.all([
                Order.countDocuments({
                    ...restaurantFilter,
                    order_status: "Pending"
                }),

                Order.countDocuments({
                    ...restaurantFilter,
                    order_status: "Accepted"
                }),

                Order.countDocuments({
                    ...restaurantFilter,
                    order_status: "Preparing"
                }),

                Order.countDocuments({
                    ...restaurantFilter,
                    order_status: "Ready"
                }),

                Order.countDocuments({
                    ...restaurantFilter,
                    order_status: "Served"
                }),

                Order.countDocuments({
                    ...restaurantFilter,
                    order_status: "Completed"
                }),

                Order.countDocuments({
                    ...restaurantFilter,
                    order_status: "Rejected"
                })
            ]);

        return sendResponse(res, 200, true, "Kitchen Dashboard",
            {
                pending,
                accepted,
                preparing,
                ready,
                served,
                completed,
                rejected,
                activeOrders:
                    pending +
                    accepted +
                    preparing +
                    ready +
                    served
            }
        );
    }

    catch (error) { next(error); }
};