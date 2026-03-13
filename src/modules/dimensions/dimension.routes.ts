import { Router } from 'express';
import * as dimensionController from './dimension.controller';

const router = Router();

router.post('/tests/:testId/dimensions', dimensionController.createDimension);

export default router;
