import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AuthTokenPayload } from '../types/index.js';

let ioInstance: SocketIOServer | null = null;

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication Middleware
  ioInstance.use((socket: Socket, next) => {
    try {
      let token: string | undefined = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies.access_token;
      }

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
      (socket as any).adminId = decoded.adminId;
      next();
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Socket.IO authentication rejected');
      next(new Error('Authentication error: Invalid token'));
    }
  });

  ioInstance.on('connection', (socket: Socket) => {
    const adminId = (socket as any).adminId;
    if (adminId) {
      const room = `admin_${adminId}`;
      socket.join(room);
      logger.info({ adminId, socketId: socket.id }, 'Socket.IO client joined admin room');

      socket.on('disconnect', () => {
        logger.debug({ adminId, socketId: socket.id }, 'Socket.IO client disconnected');
      });
    }
  });

  return ioInstance;
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Emit event to a specific administrator's private room
 */
export function emitToAdmin(adminId: string, event: string, data: any): void {
  if (ioInstance) {
    ioInstance.to(`admin_${adminId}`).emit(event, data);
  }
}

/**
 * Broadcast event to all authenticated administrators
 */
export function broadcastToAllAdmins(event: string, data: any): void {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}
