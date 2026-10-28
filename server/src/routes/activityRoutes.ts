import { Router } from 'express';
import {
  getActivities,
  getActivityById,
  retryJob,
  bulkRetry,
  getDashboardStats,
} from '../controllers/activityController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getActivities);
router.get('/stats', getDashboardStats);
router.get('/:id', getActivityById);
router.post('/:id/retry', retryJob);
router.post('/bulk-retry', bulkRetry);

export default router;
