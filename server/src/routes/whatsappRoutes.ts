import { Router } from 'express';
import {
  getAccounts,
  getAccountById,
  createAccount,
  connectAccount,
  disconnectAccount,
  deleteAccount,
  createAccountSchema,
} from '../controllers/whatsappController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/accounts', getAccounts);
router.post('/accounts', validateRequest(createAccountSchema), createAccount);
router.get('/accounts/:id', getAccountById);
router.post('/accounts/:id/connect', connectAccount);
router.post('/accounts/:id/disconnect', disconnectAccount);
router.delete('/accounts/:id', deleteAccount);

export default router;
