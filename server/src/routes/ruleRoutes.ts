import { Router } from 'express';
import {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  activateRule,
  pauseRule,
  deleteRule,
  createRuleSchema,
  updateRuleSchema,
} from '../controllers/ruleController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', getRules);
router.post('/', validateRequest(createRuleSchema), createRule);
router.get('/:id', getRuleById);
router.patch('/:id', validateRequest(updateRuleSchema), updateRule);
router.put('/:id', validateRequest(updateRuleSchema), updateRule);
router.post('/:id/activate', activateRule);
router.post('/:id/pause', pauseRule);
router.delete('/:id', deleteRule);

export default router;
