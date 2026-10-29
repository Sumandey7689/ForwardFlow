import { Router } from 'express';
import {
  syncConversations,
  getConversations,
  getCapabilities,
  addCustomPhoneNumbers,
} from '../controllers/conversationController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/accounts/:id/sync', syncConversations);
router.get('/accounts/:id/conversations', getConversations);
router.get('/accounts/:id/capabilities', getCapabilities);
router.post('/accounts/:id/custom-numbers', addCustomPhoneNumbers);

export default router;
