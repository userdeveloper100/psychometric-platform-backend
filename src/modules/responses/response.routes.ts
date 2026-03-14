import { Router } from 'express';
import * as responseController from './response.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';

const router = Router();

router.post('/responses/submit', authenticateJWT, responseController.submitResponses);
router.get('/responses/student/:studentId', authenticateJWT, responseController.getStudentResponses);
router.get('/responses/test/:testId', authenticateJWT, responseController.getTestResponses);

export default router;
