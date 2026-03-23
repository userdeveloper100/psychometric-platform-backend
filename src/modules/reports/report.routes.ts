import { Router } from 'express';
import * as reportController from './report.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// Only ADMIN can access reports
<<<<<<< HEAD
/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get all reports
 *     description: Fetch all active report source records with optional pagination.
 *     tags: [Reports]
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
 *         description: Reports fetched successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get(
    '/',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    reportController.getAllReports
);

/**
 * @swagger
 * /api/v1/reports/student/{studentId}/test/{testId}:
 *   get:
 *     summary: Retrieve resource (/reports/student/:studentId/test/:testId)
 *     description: Reports API endpoint.
 *     tags: [Reports]
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
    '/reports/student/:studentId/test/:testId',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    reportController.getTestReport
);

<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/reports/test/{testId}:
 *   get:
 *     summary: Retrieve resource (/reports/test/:testId)
 *     description: Reports API endpoint.
 *     tags: [Reports]
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
    '/reports/test/:testId',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    reportController.getTestReport
);

export default router;
