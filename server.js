import "dotenv/config";
import http from "http";
import app from "./app.js";
import connectDB from "./db.js";
import { initializeSocket } from "./socket/socket.js";

const PORT = process.env.PORT || 5000;

await connectDB();

const server = http.createServer(app);
initializeSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});