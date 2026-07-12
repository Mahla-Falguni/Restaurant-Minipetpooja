import { getIO } from "./socket.js";

export const emitNewOrder = (order) => {
    const io = getIO();
    io.to(order.restaurant_id.toString()).emit("newOrder", order);
};

export const emitOrderAccepted = (order) => {
    const io = getIO();
    io.to(order.restaurant_id.toString()).emit("orderAccepted", order);
};

export const emitPreparing = (order) => {
    const io = getIO();
    io.to(order.restaurant_id.toString()).emit("orderPreparing", order);
};

export const emitReady = (order) => {
    const io = getIO();
    io.to(order.restaurant_id.toString()).emit("orderReady", order);
};

export const emitServed = (order) => {
    const io = getIO();
    io.to(order.restaurant_id.toString()).emit("orderServed", order);
};

export const emitCompleted = (order) => {
    const io = getIO();
    io.to(order.restaurant_id.toString()).emit("orderCompleted", order);
};

export const emitRejected = (order) => {
    const io = getIO();
    io.to(order.restaurant_id.toString()).emit("orderRejected", order);
};