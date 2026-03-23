import { Router } from 'express';
import * as dimensionController from './dimension.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

<<<<<<< HEAD
/**
 * @swagger
 * /api/dimensions:
 *   get:
 *     summary: Get all dimensions
 *     description: Fetch all active dimensions with optional pagination.
 *     tags: [Dimensions]
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
 *         description: Dimensions fetched successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get(
    '/',
    authenticateJWT,
    dimensionController.getAllDimensions
);

/**
 * @swagger
 * /api/dimensions/tests/{testId}/dimensions:
 *   get:
 *     summary: Get dimensions by test
 *     description: Fetch all dimensions for a given psychometric test.
 *     tags: [Dimensions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         description: Psychometric test ID
 *         schema:
 *           type: string
 *           example: 2d9f3d0a-76f8-4f8a-9b88-1f2d4b631111
 *     responses:
 *       200:
 *         description: Dimensions fetched successfully
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
 *                   example: Dimensions fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: 6a7e8f90-1234-4abc-9def-111111111111
 *                       name:
 *                         type: string
 *                         example: Leadership
 *                       testId:
 *                         type: string
 *                         example: 2d9f3d0a-76f8-4f8a-9b88-1f2d4b631111
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: testId is required
 *       404:
 *         description: Test not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Test not found
 *       500:
 *         description: Failed to fetch dimensions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to fetch dimensions
 */
/**
 * @swagger
 * /api/v1/tests/{testId}/dimensions:
 *   get:
 *     summary: Retrieve resource (/tests/:testId/dimensions)
 *     description: Dimensions API endpoint.
 *     tags: [Dimensions]
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
// Logged-in users can view dimensions
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
router.get(
    '/tests/:testId/dimensions',
    authenticateJWT,
    dimensionController.getTestDimensions
);

<<<<<<< HEAD
/**
 * @swagger
 * /api/dimensions/tests/{testId}/dimensions:
 *   post:
 *     summary: Create dimension for a test
 *     description: Create a new dimension under a given test. ADMIN role required.
 *     tags: [Dimensions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         description: Psychometric test ID
 *         schema:
 *           type: string
 *           example: 2d9f3d0a-76f8-4f8a-9b88-1f2d4b631111
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: Leadership
 *               description:
 *                 type: string
 *                 example: Measures leadership behaviors and influence.
 *           example:
 *             name: Leadership
 *             description: Measures leadership behaviors and influence.
 *     responses:
 *       201:
 *         description: Dimension created successfully
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
 *                   example: Dimension created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 6a7e8f90-1234-4abc-9def-111111111111
 *                     name:
 *                       type: string
 *                       example: Leadership
 *                     testId:
 *                       type: string
 *                       example: 2d9f3d0a-76f8-4f8a-9b88-1f2d4b631111
 *       400:
 *         description: Invalid request body or validation failure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: name and description are required
 *       404:
 *         description: Test not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Test not found
 *       500:
 *         description: Failed to create dimension
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to create dimension
 */
/**
 * @swagger
 * /api/v1/tests/{testId}/dimensions:
 *   post:
 *     summary: Create resource (/tests/:testId/dimensions)
 *     description: Dimensions API endpoint.
 *     tags: [Dimensions]
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
// ADMIN only create/delete
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
router.post(
    '/tests/:testId/dimensions',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    dimensionController.createDimension
);

<<<<<<< HEAD
/**
 * @swagger
 * /api/dimensions/dimensions/{id}:
 *   delete:
 *     summary: Delete a dimension
 *     description: Permanently deletes a dimension by ID. ADMIN role required.
 *     tags: [Dimensions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Dimension ID
 *         schema:
 *           type: string
 *           example: 6a7e8f90-1234-4abc-9def-111111111111
 *     responses:
 *       200:
 *         description: Dimension deleted successfully
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
 *                   example: Dimension deleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 6a7e8f90-1234-4abc-9def-111111111111
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: dimension id is required
 *       404:
 *         description: Dimension not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Dimension not found
 *       500:
 *         description: Failed to delete dimension
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to delete dimension
 */
/**
 * @swagger
 * /api/v1/dimensions/{id}:
 *   delete:
 *     summary: Delete resource (/dimensions/:id)
 *     description: Dimensions API endpoint.
 *     tags: [Dimensions]
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
    '/dimensions/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    dimensionController.deleteDimension
);

export default router;
