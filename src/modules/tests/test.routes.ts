import { Router } from 'express';
import * as testController from './test.controller';

const router = Router();

/**
 * @route   POST /api/tests
 * @desc    Create a new test (ADMIN only)
 * @access  Private
 */
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/:
 *   post:
 *     summary: Create resource (/)
 *     description: Tests API endpoint.
 *     tags: [Tests]
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
router.post('/', testController.createTest);

/**
 * @route   GET /api/tests?instituteId=...&page=1&limit=10&status=DRAFT|PUBLISHED&search=...
 * @desc    Get tests for an institute (paginated)
 * @access  Private/Public (based on your middleware setup)
 */
<<<<<<< HEAD
/**
 * @swagger
 * /api/tests:
 *   get:
 *     summary: Get all tests
 *     description: Fetch all active tests with optional pagination.
 *     tags: [Tests]
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
 *         description: Tests fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get('/', testController.getAllTests);
=======
router.get('/', testController.getInstituteTests);
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f

/**
 * @route   PATCH /api/tests/:id/publish
 * @desc    Publish a test (ADMIN only)
 * @access  Private
 */
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/{id}/publish:
 *   patch:
 *     summary: Partially update resource (/:id/publish)
 *     description: Tests API endpoint.
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: id identifier
 *         schema:
 *           type: string
 *           example: "id-123"
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
router.patch('/:id/publish', testController.publishTest);

export default router;
