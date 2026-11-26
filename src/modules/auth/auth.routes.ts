import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Public registration (disabled)
 *     description: |
 *       DEC-02: public self-registration is closed. Every request is refused with 403 and logged as an
 *       authorization_denied event. Accounts are created only from an invite issued by an ADMIN
 *       (POST /api/v1/auth/invites), accepted with POST /api/v1/auth/accept-invite.
 *     tags: [Auth]
 *     responses:
 *       403:
 *         description: Public registration is disabled. An invitation is required.
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
 *                   example: Public registration is disabled. An invitation is required.
 */
router.post('/register', authRateLimiter, authController.register);

/**
 * @swagger
 * /api/v1/auth/invites:
 *   post:
 *     summary: Invite a user to the caller's institute (ADMIN only)
 *     description: |
 *       DEC-02: creates a user invite in the caller's institute. The institute comes only from the verified token.
 *       The token is 256 random bits, and only its SHA-256 hash is stored. The raw token is returned once, in this
 *       response, and is never shown again. expiresAt defaults to 7 days and may be at most 30 days ahead.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: teacher@acme.com
 *               role:
 *                 type: string
 *                 enum: [ADMIN, STUDENT]
 *                 example: ADMIN
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-12-03T00:00:00.000Z
 *     responses:
 *       201:
 *         description: Invite created. The token is shown once.
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
 *                   example: User invite created. The token is shown once.
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: 3f9a0c...64 hex characters
 *                     invite:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Invalid email, role or expiresAt
 *       401:
 *         description: No token provided or invalid token
 *       403:
 *         description: Forbidden. ADMIN role required, or no institute scope on the token.
 *       500:
 *         description: Internal server error
 */
router.post('/invites', authenticateJWT, authorizeRoles('ADMIN'), authController.createUserInvite);

/**
 * @swagger
 * /api/v1/auth/invites:
 *   get:
 *     summary: List the user invites of the caller's institute (ADMIN only)
 *     description: |
 *       DEC-02: lists the active invites of the caller's institute, newest first. Token hashes and raw tokens are
 *       never returned.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: User invites fetched successfully
 *       400:
 *         description: Invalid pagination parameters
 *       401:
 *         description: No token provided or invalid token
 *       403:
 *         description: Forbidden. ADMIN role required.
 *       500:
 *         description: Internal server error
 */
router.get('/invites', authenticateJWT, authorizeRoles('ADMIN'), authController.listUserInvites);

/**
 * @swagger
 * /api/v1/auth/invites/{id}:
 *   delete:
 *     summary: Revoke a pending user invite (ADMIN only)
 *     description: |
 *       DEC-02: revokes a pending invite of the caller's institute. An invite of another institute, or one already
 *       used or revoked, is reported as not found.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User invite revoked successfully
 *       401:
 *         description: No token provided or invalid token
 *       403:
 *         description: Forbidden. ADMIN role required.
 *       404:
 *         description: Invite not found in the caller's institute
 *       500:
 *         description: Internal server error
 */
router.delete('/invites/:id', authenticateJWT, authorizeRoles('ADMIN'), authController.revokeUserInvite);

/**
 * @swagger
 * /api/v1/auth/accept-invite:
 *   post:
 *     summary: Accept a user invite and create the account (public, token-bound)
 *     description: |
 *       DEC-02: the invite token in the body is the only credential. The account is created in the invited
 *       institute with the invited role. The invite is consumed in the same transaction, so it can be used once.
 *       Every refusal (unknown, revoked, used, expired, inactive institute, or email already has an account)
 *       returns the same generic 400. The token is never logged.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - name
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 example: 3f9a0c...64 hex characters
 *               name:
 *                 type: string
 *                 example: Jane Teacher
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Teacher@123
 *     responses:
 *       201:
 *         description: Account created successfully
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
 *                   example: Account created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     instituteId:
 *                       type: string
 *       400:
 *         description: Missing fields, or the invite is not usable (generic message)
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
 *                   example: Invite is invalid or no longer usable
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Internal server error
 */
router.post('/accept-invite', authRateLimiter, authController.acceptUserInvite);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticates user credentials and returns a JWT token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@acme.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@123
 *           example:
 *             email: admin@acme.com
 *             password: Admin@123
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: clx123abc
 *                     email:
 *                       type: string
 *                       example: admin@acme.com
 *                     role:
 *                       type: string
 *                       example: ADMIN
 *                     instituteId:
 *                       type: string
 *                       example: inst_001
 *       400:
 *         description: Invalid input or validation error
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
 *                   example: Email and password are required
 *       404:
 *         description: User not found
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
 *                   example: User not found
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 */
router.post('/login', authRateLimiter, authController.login);

/**
 * @swagger
 * /api/v1/auth/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     description: Retrieves a paginated list of all users. Requires admin role.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                   example: Users fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: clx123abc
 *                       email:
 *                         type: string
 *                         format: email
 *                         example: admin@acme.com
 *                       role:
 *                         type: string
 *                         enum: [ADMIN, STUDENT]
 *                         example: ADMIN
 *                       instituteId:
 *                         type: string
 *                         example: inst_001
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2023-01-01T00:00:00.000Z
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2023-01-01T00:00:00.000Z
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *       401:
 *         description: Unauthorized - No token provided
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
 *                   example: No token provided
 *       403:
 *         description: Forbidden - Admin role required
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
 *                   example: Access denied. Admin role required.
 *       400:
 *         description: Bad Request - Invalid pagination parameters
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
 *                   example: page and limit must be positive integers
 *       500:
 *         description: Internal server error
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
 *                   example: Failed to fetch users
 */
router.get('/users', authenticateJWT, authorizeRoles('ADMIN'), authController.getAllUsers);

export default router;
