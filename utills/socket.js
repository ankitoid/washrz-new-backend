import socketService from "../services/socketService.js";

export const emitToUser = (userId, event, data) =>
  socketService.emitToUser(userId, event, data);