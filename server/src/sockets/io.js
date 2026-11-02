let io = null;

export function setIO(instance) {
    io = instance;
}

export function emitToUser(userId, event, payload) {
    if (!io) {
        console.warn("Socket.IO ainda não foi inicializado.");
        return;
    }

    io.to(`user:${userId}`).emit(event, payload);
}