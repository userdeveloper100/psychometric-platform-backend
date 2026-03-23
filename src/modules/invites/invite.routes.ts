import { Router } from 'express';
import * as inviteController from './invite.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

/**
<<<<<<< HEAD
 * @swagger
 * /api/invites:
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
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
 * @route   POST /api/invites/tests/:testId/invite
 * @desc    Invite students to a test (ADMIN only)
 * @access  Private
 */
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/tests/{testId}/invite:
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
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
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
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/tests/{testId}/invites:
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
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
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
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/students/{studentId}/invites:
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
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
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
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/{id}:
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
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
router.delete(
    '/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    inviteController.deleteInvite
);

<<<<<<< HEAD
export default router;
=======
export default router;
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
