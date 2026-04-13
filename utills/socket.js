export const emitToUser = (userId, event, data) => {
  const socket = userSocketMap.get(userId);
  if (socket) {
    socket.emit(event, data);
  }
};