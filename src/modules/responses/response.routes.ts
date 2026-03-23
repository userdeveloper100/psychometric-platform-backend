import { Router } from 'express';
import * as responseController from './response.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';

const router = Router();

<<<<<<< HEAD
/**
 * @swagger
 * /api/responses:
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
router.get('/', authenticateJWT, responseController.getAllResponses);

/**
 * @swagger
 * /api/v1/responses/submit:
 *   post:
 *     summary: Create resource (/responses/submit)
 *     description: Responses API endpoint.
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
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
router.post('/responses/submit', authenticateJWT, responseController.submitResponses);
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
router.get('/responses/student/:studentId', authenticateJWT, responseController.getStudentResponses);
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
=======
router.post('/responses/submit', authenticateJWT, responseController.submitResponses);
router.get('/responses/student/:studentId', authenticateJWT, responseController.getStudentResponses);
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
router.get('/responses/test/:testId', authenticateJWT, responseController.getTestResponses);

export default router;
