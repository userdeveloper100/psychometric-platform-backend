import { Router } from 'express';
import * as reportController from './report.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// Only ADMIN can access reports
router.get(
    '/reports/student/:studentId/test/:testId',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    reportController.getTestReport
);

router.get(
    '/reports/test/:testId',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    reportController.getTestReport
);

export default router;
