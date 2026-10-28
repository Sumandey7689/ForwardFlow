import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long').optional(),
  }),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await verifyPassword(password, admin.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    // Update lastLoginAt
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT (7 days validity)
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-Only Cookie
    const isProduction = env.NODE_ENV === 'production';
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'ADMIN_LOGIN',
        resourceType: 'Admin',
        resourceId: admin.id,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    logger.info({ adminId: admin.id, email: admin.email }, 'Admin successfully authenticated');

    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          lastLoginAt: new Date(),
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.admin) {
      await prisma.auditLog.create({
        data: {
          adminId: req.admin.id,
          action: 'ADMIN_LOGOUT',
          resourceType: 'Admin',
          resourceId: req.admin.id,
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        },
      });
    }

    res.clearCookie('access_token');
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.admin) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!admin) {
      throw new AppError('Admin not found', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: { admin },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.admin) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { name, currentPassword, newPassword } = req.body;

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
    });

    if (!admin) {
      throw new AppError('Admin not found', 404, 'NOT_FOUND');
    }

    const updateData: { name?: string; passwordHash?: string } = {};

    if (name) {
      updateData.name = name.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('Current password is required to set a new password', 400, 'PASSWORD_REQUIRED');
      }

      const isMatch = await verifyPassword(currentPassword, admin.passwordHash);
      if (!isMatch) {
        throw new AppError('Current password does not match', 400, 'INVALID_PASSWORD');
      }

      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updated = await prisma.admin.update({
      where: { id: admin.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'ADMIN_PROFILE_UPDATE',
        resourceType: 'Admin',
        resourceId: admin.id,
        metadata: JSON.stringify({ updatedFields: Object.keys(updateData) }),
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    res.json({
      success: true,
      data: { admin: updated },
    });
  } catch (error) {
    next(error);
  }
}
