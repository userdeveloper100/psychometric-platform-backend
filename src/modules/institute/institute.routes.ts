import { Router } from 'express';
import * as instituteController from './institute.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

// SEC-02: every institute route requires a valid token and the ADMIN role. Tenant scope is
// enforced in the controller and service (an ADMIN can only act on their own institute).

const router = Router();

// Create
/**
 * @swagger
 * /api/v1/:
 *   post:
 *     summary: Create resource (/)
 *     description: Institutes API endpoint.
 *     tags: [Institutes]
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
router.post('/', authenticateJWT, authorizeRoles('ADMIN'), instituteController.createInstitute);

// Read
/**
 * @swagger
 * /api/institutes:
 *   get:
 *     summary: Get all institutes
 *     description: Fetch all active institutes with optional pagination.
 *     tags: [Institutes]
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
 *         description: Institutes fetched successfully
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
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateJWT, authorizeRoles('ADMIN'), instituteController.getAllInstitutes);
/**
 * @swagger
 * /api/v1/{id}:
 *   get:
 *     summary: Retrieve resource (/:id)
 *     description: Institutes API endpoint.
 *     tags: [Institutes]
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
router.get('/:id', authenticateJWT, authorizeRoles('ADMIN'), instituteController.getInstituteById);

// Update
/**
 * @swagger
 * /api/v1/{id}:
 *   put:
 *     summary: Update resource (/:id)
 *     description: Institutes API endpoint.
 *     tags: [Institutes]
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
router.put('/:id', authenticateJWT, authorizeRoles('ADMIN'), instituteController.updateInstitute);

// Soft delete
/**
 * @swagger
 * /api/v1/{id}:
 *   delete:
 *     summary: Delete resource (/:id)
 *     description: Institutes API endpoint.
 *     tags: [Institutes]
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
router.delete('/:id', authenticateJWT, authorizeRoles('ADMIN'), instituteController.deleteInstitute);

export default router;
