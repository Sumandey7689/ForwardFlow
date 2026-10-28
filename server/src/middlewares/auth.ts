import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { AuthTokenPayload } from '../types/index.js';

// Extend Express Request type to include authenticated admin
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token = req.cookies?.access_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401, 'UNAUTHORIZED');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, email: true, name: true },
    });

    if (!admin) {
      throw new AppError('Account not found or session has expired.', 401, 'UNAUTHORIZED');
    }

    req.admin = admin;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      next(new AppError('Session expired. Please log in again.', 401, 'TOKEN_EXPIRED'));
      return;
    }
    if (err.name === 'JsonWebTokenError') {
      next(new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN'));
      return;
    }
    next(err);
  }
}
