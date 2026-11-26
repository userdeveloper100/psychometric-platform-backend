import { Router } from 'express';
import * as inviteController from './invite.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/invites:
 *   get:
 *     summary: Get all invites
 *     description: Fetch all active invites with optional pagination.
 *     tags: [Invites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Invites fetched successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get(
    '/',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.getAllInvites
);

/**
 * @route   POST /api/v1/invites/tests/:testId/invite
 * @desc    Invite students to a test (ADMIN only)
 * @access  Private
 */
/**
 * @swagger
 * /api/v1/invites/tests/{testId}/invite:
 *   post:
 *     summary: Create resource (/tests/:testId/invite)
 *     description: Invites API endpoint.
 *     tags: [Invites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         description: testId identifier
 *         schema:
 *           type: string
 *           example: "testId-123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             name: "Sample Name"
 *             description: "Sample payload"
 *     responses:
 *       200:
 *         description: Request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Success"
 *       201:
 *         description: Resource created successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
router.post(
    '/tests/:testId/invite',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.inviteStudents
);

/**
 * @route   GET /api/v1/invites/tests/:testId/invites
 * @desc    Get all invites for a test (ADMIN only)
 * @access  Private
 */
/**
 * @swagger
 * /api/v1/invites/tests/{testId}/invites:
 *   get:
 *     summary: Retrieve resource (/tests/:testId/invites)
 *     description: Invites API endpoint.
 *     tags: [Invites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         description: testId identifier
 *         schema:
 *           type: string
 *           example: "testId-123"
 *     responses:
 *       200:
 *         description: Request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Success"
 *       201:
 *         description: Resource created successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
router.get(
    '/tests/:testId/invites',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.getTestInvites
);

/**
 * @route   GET /api/v1/invites/students/:studentId/invites
 * @desc    Get all invites for a student
 * @access  Private
 */
/**
 * @swagger
 * /api/v1/invites/students/{studentId}/invites:
 *   get:
 *     summary: Retrieve resource (/students/:studentId/invites)
 *     description: Invites API endpoint.
 *     tags: [Invites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         description: studentId identifier
 *         schema:
 *           type: string
 *           example: "studentId-123"
 *     responses:
 *       200:
 *         description: Request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Success"
 *       201:
 *         description: Resource created successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
router.get(
    '/students/:studentId/invites',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.getStudentInvites
);

/**
 * @route   DELETE /api/v1/invites/:id
 * @desc    Soft delete an invite (ADMIN only)
 * @access  Private
 */
/**
 * @swagger
 * /api/v1/invites/{id}:
 *   delete:
 *     summary: Delete resource (/:id)
 *     description: Invites API endpoint.
 *     tags: [Invites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: id identifier
 *         schema:
 *           type: string
 *           example: "id-123"
 *     responses:
 *       200:
 *         description: Request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Success"
 *       201:
 *         description: Resource created successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
router.delete(
    '/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.deleteInvite
);

/**
 * @route   POST /api/v1/invites/assessment
 * @desc    Load the assessment for an invite token (DEC-03). No JWT. The token is in the body, not the URL,
 *          so it is not written to URL logs or browser history.
 * @access  Public (invite token)
 */
/**
 * @swagger
 * /api/v1/invites/assessment:
 *   post:
 *     summary: Load the candidate assessment (DEC-03)
 *     description: Public. Returns the test, its active dimensions and active questions for a pending, unexpired invite. Every refusal is the same 404.
 *     tags: [Invites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: 3f9c0e2a7b1d4e8f9a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f
 *     responses:
 *       200:
 *         description: Assessment fetched successfully
 *       400:
 *         description: token is required
 *       404:
 *         description: Assessment is not available for this invite (unknown, expired, revoked, completed, or an inactive parent)
 *       500:
 *         description: Internal server error
 */
router.post('/assessment', inviteController.getCandidateAssessment);

export default router;
