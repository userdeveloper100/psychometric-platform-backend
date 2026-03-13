import { Router } from 'express';
import * as testController from './test.controller';

const router = Router();

router.post('/', testController.createTest);
router.get('/', testController.getTests);
router.post('/:id/publish', testController.publishTest);

export default router;
