import { Router } from 'express';
import * as questionController from './question.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

<<<<<<< HEAD
/**
 * @swagger
 * /api/questions:
 *   get:
 *     summary: Get all questions
 *     description: Fetch all active questions with optional pagination.
 *     tags: [Questions]
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
 *         description: Questions fetched successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get(
    '/',
    authenticateJWT,
    questionController.getAllQuestions
);

// Logged-in users can view questions
/**
 * @swagger
 * /api/v1/dimensions/{dimensionId}/questions:
 *   get:
 *     summary: Retrieve resource (/dimensions/:dimensionId/questions)
 *     description: Questions API endpoint.
 *     tags: [Questions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dimensionId
 *         required: true
 *         description: dimensionId identifier
 *         schema:
 *           type: string
 *           example: "dimensionId-123"
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
// Logged-in users can view questions
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
router.get(
    '/dimensions/:dimensionId/questions',
    authenticateJWT,
    questionController.getDimensionQuestions
);

// ADMIN only create/delete
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/dimensions/{dimensionId}/questions:
 *   post:
 *     summary: Create resource (/dimensions/:dimensionId/questions)
 *     description: Questions API endpoint.
 *     tags: [Questions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dimensionId
 *         required: true
 *         description: dimensionId identifier
 *         schema:
 *           type: string
 *           example: "dimensionId-123"
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
    '/dimensions/:dimensionId/questions',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    questionController.createQuestion
);

<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/questions/{id}:
 *   delete:
 *     summary: Delete resource (/questions/:id)
 *     description: Questions API endpoint.
 *     tags: [Questions]
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
    '/questions/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    questionController.deleteQuestion
);

export default router;
