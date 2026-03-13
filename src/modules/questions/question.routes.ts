import { Router } from 'express';
import * as questionController from './question.controller';

const router = Router();

router.post('/dimensions/:dimensionId/questions', questionController.createQuestion);

export default router;
