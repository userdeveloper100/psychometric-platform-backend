import { Router } from 'express';
import * as instituteController from './institute.controller';

const router = Router();

router.post('/', instituteController.createInstitute);

export default router;
