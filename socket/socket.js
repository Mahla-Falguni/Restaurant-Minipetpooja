import { Server } from "socket.io";

let io;

export const initializeSocket = (server) => {

  io = new Server(server, {

    cors: {
      origin: "*", methods: [
        "GET", "POST", "PATCH", "PUT", "DELETE"
      ]
    }
  });

  io.on("connection", (socket) => {

    console.log(`Socket Connected : ${socket.id}`);

    socket.on("joinRestaurant", (restaurantId) => {

      socket.join(restaurantId);

      console.log(`Restaurant Joined : ${restaurantId}`);

    });

    socket.on("disconnect", () => {
      console.log(`Socket Disconnected : ${socket.id}`);
    });

  });

};

export const getIO = () => {

  if (!io) {
    throw new Error("Socket.io not initialized.");
  }

  return io;

};