import { Router } from 'express';
import * as dimensionController from './dimension.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// Logged-in users can view dimensions
router.get(
    '/tests/:testId/dimensions',
    authenticateJWT,
    dimensionController.getTestDimensions
);

// ADMIN only create/delete
router.post(
    '/tests/:testId/dimensions',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    dimensionController.createDimension
);

router.delete(
    '/dimensions/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    dimensionController.deleteDimension
);

export default router;
