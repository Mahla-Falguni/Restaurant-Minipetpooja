import Order from "../models/Order.js";

import sendResponse from "../utils/sendResponse.js";

export const updateOrderStatus = async (req, res, next) => {

    try {

        const { status, remarks } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) {
            return sendResponse(res, 404, false, "Order not found");
        }

        order.order_status = status;

        order.status_history.push({
            status,
            remarks,
            changed_by: req.user
                ? req.user._id
                : null
        });

        const now = new Date();

        switch (status) {

            case "Accepted":
                order.accepted_at = now;
                break;

            case "Preparing":
                order.preparing_at = now;
                break;

            case "Ready":
                order.ready_at = now;
                break;

            case "Served":
                order.served_at = now;
                break;

            case "Completed":
                order.completed_at = now;
                break;

            case "Cancelled":
                order.cancelled_at = now;
                break;
        }

        await order.save();

        const io = req.app.get("io");
        if (io) {
            io.to(`restaurant_${order.restaurant_id}`).emit(
                "order_status_updated",
                {
                    order_id: order._id,
                    order_number: order.order_number,
                    table_number: order.table_number,
                    order_status: order.order_status,
                }
            );
        }

        sendResponse(res, 200, true, "Order Updated", order);

    } catch (error) { next(error); }

};


export const getOrderTimeline = async (req, res, next) => {

    try {

        const order = await Order.findById(req.params.id)

            .populate(
                "status_history.changed_by",
                "first_name last_name email"
            );

        if (!order) {
            return sendResponse(res, 404, false, "Order not found");
        }

        sendResponse(res, 200, true, "Timeline", order.status_history);

    } catch (error) { next(error); }

};


export const trackOrder = async ( req, res, next ) => {

        try {

            const order = await Order.findOne({
                    order_number:
                        req.params.orderNumber
                });

            if (!order) {
                return sendResponse( res, 404, false, "Order not found" );
            }

            sendResponse( res, 200, true, "Tracking",

                {
                    order_number:
                        order.order_number,

                    status:
                        order.order_status,

                    estimated_time:
                        order.estimated_time,

                    timeline:
                        order.status_history
                }
            );

        } catch (error) { next(error); }

    };
