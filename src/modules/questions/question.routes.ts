import { Router } from 'express';
import * as questionController from './question.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// Logged-in users can view questions
router.get(
    '/dimensions/:dimensionId/questions',
    authenticateJWT,
    questionController.getDimensionQuestions
);

// ADMIN only create/delete
router.post(
    '/dimensions/:dimensionId/questions',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    questionController.createQuestion
);

router.delete(
    '/questions/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    questionController.deleteQuestion
);

export default router;
