import { Router } from 'express';
import {
  login,
  logout,
  getMe,
  updateProfile,
  loginSchema,
  updateProfileSchema,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { loginRateLimiter } from '../middlewares/rateLimit.js';
import { validateRequest } from '../middlewares/validate.js';

const router = Router();

router.post('/login', loginRateLimiter, validateRequest(loginSchema), login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.patch('/profile', requireAuth, validateRequest(updateProfileSchema), updateProfile);

export default router;
