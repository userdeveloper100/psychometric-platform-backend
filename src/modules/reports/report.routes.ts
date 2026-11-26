import { Router } from 'express';
import * as reportController from './report.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// ADMIN, RECRUITER and EVALUATOR can read reports, each only within its own institute
/**
 * @swagger
 * /api/v1/reports:
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
    authorizeRoles('ADMIN', 'RECRUITER', 'EVALUATOR'),
    reportController.getAllReports
);

/**
 * @swagger
 * /api/v1/reports/student/{studentId}/test/{testId}:
 *   get:
 *     summary: Student report with dimension scores, composite, percentile rank and band
 *     description: |
 *       Scoring engine (DEC). Each dimension has the raw mean (score) and the normalized 0..100 score. The composite is the
 *       weighted mean of the normalized scores, with equal weights. The percentile rank and band come from the completed
 *       candidates of the same test and institute only. A pending candidate has no percentile. ADMIN, RECRUITER or EVALUATOR.
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
router.get(
    '/student/:studentId/test/:testId',
    authenticateJWT,
    authorizeRoles('ADMIN', 'RECRUITER', 'EVALUATOR'),
    reportController.getStudentReport
);

/**
 * @swagger
 * /api/v1/reports/test/{testId}:
 *   get:
 *     summary: Test report with cohort statistics and per-dimension averages
 *     description: |
 *       Scoring engine (DEC). cohort holds the completed count and the composite mean, median, population standard deviation,
 *       min and max, plus the average normalized score of each dimension. Each student has the same scores as the student
 *       report. Only the caller's institute is used. ADMIN, RECRUITER or EVALUATOR.
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
router.get(
    '/test/:testId',
    authenticateJWT,
    authorizeRoles('ADMIN', 'RECRUITER', 'EVALUATOR'),
    reportController.getTestReport
);

/**
 * @swagger
 * /api/v1/reports/test/{testId}/export:
 *   get:
 *     summary: Export a test report as CSV
 *     description: |
 *       Scoring engine export. Returns one row per invited student with the status, the composite score, the
 *       institute-scoped percentile rank and band, and the normalized (0..100) score of each dimension. Only the
 *       caller's institute is used, and a foreign or inactive test is 404. Cells that start with = + - @ are
 *       prefixed with an apostrophe to prevent CSV formula injection. The export is logged as a sensitive admin action.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [csv]
 *     responses:
 *       200:
 *         description: CSV file. Content-Disposition is attachment, and the file name contains the test id.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: format is missing or not csv
 *       401:
 *         description: No token provided or invalid token
 *       403:
 *         description: Forbidden. ADMIN, RECRUITER or EVALUATOR role required, with an institute on the token.
 *       404:
 *         description: Test not found in the caller's institute
 *       500:
 *         description: Internal server error
 */
router.get(
    '/test/:testId/export',
    authenticateJWT,
    authorizeRoles('ADMIN', 'RECRUITER', 'EVALUATOR'),
    reportController.exportTestReportCsv
);

export default router;
