import { Router } from 'express';
import * as responseController from './response.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/responses:
 *   get:
 *     summary: Get all responses
 *     description: Fetch all active responses with optional pagination.
 *     tags: [Responses]
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
 *         description: Responses fetched successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateJWT, authorizeRoles('ADMIN', 'EVALUATOR'), responseController.getAllResponses);

/**
 * @swagger
 * /api/v1/responses/submit:
 *   post:
 *     summary: Submit responses with an invite token (DEC-03)
 *     description: Public. The body token is the only credential. The token decides the student, the test and the institute. Each submission is accepted once.
 *     tags: [Responses]
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
// DEC-03: no JWT. The invite token in the body is the only credential, and the shared invite rules check it.
router.post('/submit', responseController.submitResponses);
/**
 * @swagger
 * /api/v1/responses/student/{studentId}:
 *   get:
 *     summary: Retrieve resource (/responses/student/:studentId)
 *     description: Responses API endpoint.
 *     tags: [Responses]
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
    '/student/:studentId',
    authenticateJWT,
    authorizeRoles('ADMIN', 'EVALUATOR'),
    responseController.getStudentResponses
);
/**
 * @swagger
 * /api/v1/responses/test/{testId}:
 *   get:
 *     summary: Retrieve resource (/responses/test/:testId)
 *     description: Responses API endpoint.
 *     tags: [Responses]
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
router.get('/test/:testId', authenticateJWT, authorizeRoles('ADMIN', 'EVALUATOR'), responseController.getTestResponses);

/**
 * @swagger
 * /api/v1/responses/{id}:
 *   delete:
 *     summary: Delete resource (/responses/:id)
 *     description: Responses API endpoint.
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: response id identifier
 *         schema:
 *           type: string
 *           example: "id-123"
 *     responses:
 *       200:
 *         description: Request successful
 *       400:
 *         description: Bad request
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateJWT, authorizeRoles('ADMIN'), responseController.deleteResponse);

export default router;
