import { Router } from 'express';
import * as reportController from './report.controller';

const router = Router();

router.get('/tests/:id/report', reportController.getTestReport);

export default router;
