import { Router } from 'express';
import {
  getRules,
  getRuleById,
  createRule,
  activateRule,
  pauseRule,
  deleteRule,
  createRuleSchema,
} from '../controllers/ruleController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', getRules);
router.post('/', validateRequest(createRuleSchema), createRule);
router.get('/:id', getRuleById);
router.post('/:id/activate', activateRule);
router.post('/:id/pause', pauseRule);
router.delete('/:id', deleteRule);

export default router;
