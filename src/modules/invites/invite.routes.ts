import { Router } from 'express';
import * as inviteController from './invite.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

/**
 * @route   POST /api/invites/tests/:testId/invite
 * @desc    Invite students to a test (ADMIN only)
 * @access  Private
 */
router.post(
    '/tests/:testId/invite',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.inviteStudents
);

/**
 * @route   GET /api/invites/tests/:testId/invites
 * @desc    Get all invites for a test (ADMIN only)
 * @access  Private
 */
router.get(
    '/tests/:testId/invites',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.getTestInvites
);

/**
 * @route   GET /api/invites/students/:studentId/invites
 * @desc    Get all invites for a student
 * @access  Private
 */
router.get(
    '/students/:studentId/invites',
    authenticateJWT,
    inviteController.getStudentInvites
);

/**
 * @route   DELETE /api/invites/:id
 * @desc    Soft delete an invite (ADMIN only)
 * @access  Private
 */
router.delete(
    '/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.deleteInvite
);

export default router;