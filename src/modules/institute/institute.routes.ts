import { Router } from 'express';
import * as instituteController from './institute.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

// DEC-01: POST /institutes requires SUPER_ADMIN. The other institute routes require the ADMIN role. Tenant scope is
// enforced in the controller and service (an ADMIN can only act on their own institute).

const router = Router();

// Create
/**
 * @swagger
 * /api/v1/institutes:
 *   post:
 *     summary: Provision an institute (SUPER_ADMIN only)
 *     description: |
 *       DEC-01: only a SUPER_ADMIN (platform level, no institute) can create an institute. A tenant ADMIN gets 403.
 *       With initialAdminEmail, the institute and its first ADMIN invite are created in one transaction. The raw invite
 *       token is returned once, in initialAdminInvite.token. The admin accepts it with POST /api/v1/auth/accept-invite.
 *     tags: [Institutes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Institute
 *               email:
 *                 type: string
 *                 format: email
 *                 example: hq@acme.com
 *               initialAdminEmail:
 *                 type: string
 *                 format: email
 *                 description: Optional. Creates the first ADMIN invite for this institute.
 *                 example: admin@acme.com
 *           example:
 *             name: Acme Institute
 *             email: hq@acme.com
 *             initialAdminEmail: admin@acme.com
 *     responses:
 *       201:
 *         description: Institute created. initialAdminInvite is present only when initialAdminEmail was sent.
 *       400:
 *         description: name, email or initialAdminEmail is missing or malformed
 *       401:
 *         description: No token provided or invalid token
 *       403:
 *         description: Forbidden. SUPER_ADMIN role required.
 *       409:
 *         description: The institute email exists, or the initial admin email already has an account
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateJWT, authorizeRoles('SUPER_ADMIN'), instituteController.createInstitute);

// Read
/**
 * @swagger
 * /api/v1/institutes:
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
 * /api/v1/institutes/{id}:
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
 * /api/v1/institutes/{id}:
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
 * /api/v1/institutes/{id}:
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
