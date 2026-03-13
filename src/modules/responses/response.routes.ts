import { Router } from 'express';
import * as responseController from './response.controller';

const router = Router();

router.post('/tests/:id/submit', responseController.submitResponse);

export default router;
