// services/socketService.js

let _io = null;
const userSocketMap = new Map(); // customerId → socket

const socketService = {

  init(io) {
    _io = io;
    return this;
  },

  get io() {
    if (!_io) throw new Error("socketService not initialised — call init(io) first");
    return _io;
  },

  // ── Room helpers ─────────────────────────────────────────────

  emitToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  },

  emitToAll(event, data) {
    this.io.emit(event, data);
  },

  // ── Named-room shortcuts (admin, rider, order) ────────────────

  emitToAdmin(event, data) {
    this.emitToRoom("admin-dashboard", event, data);
  },

  emitToRider(riderId, event, data) {
    this.emitToRoom(`rider:${riderId}`, event, data);
  },

  emitToOrder(orderId, event, data) {
    this.emitToRoom(`order:${orderId}`, event, data);
  },

  // ── Customer (userId → socket) ────────────────────────────────

  registerUser(userId, socket) {
    userSocketMap.set(String(userId), socket);
  },

  removeUser(userId) {
    userSocketMap.delete(String(userId));
  },

  emitToUser(userId, event, data) {
    const socket = userSocketMap.get(String(userId));
    if (socket) socket.emit(event, data);
  },
};

export default socketService;