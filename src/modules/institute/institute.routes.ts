import { Router } from 'express';
import * as instituteController from './institute.controller';

const router = Router();

// Create
<<<<<<< HEAD
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
router.post('/', instituteController.createInstitute);

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
router.get('/', instituteController.getAllInstitutes);
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
router.get('/:id', instituteController.getInstituteById);

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
router.put('/:id', instituteController.updateInstitute);

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
=======
router.post('/', instituteController.createInstitute);

// Read
router.get('/', instituteController.getInstitutes);
router.get('/:id', instituteController.getInstituteById);

// Update
router.put('/:id', instituteController.updateInstitute);

// Soft delete
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
router.delete('/:id', instituteController.deleteInstitute);

export default router;
