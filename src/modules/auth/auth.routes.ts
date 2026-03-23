import { Router } from 'express';
import * as authController from './auth.controller';

const router = Router();

/**
<<<<<<< HEAD
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new institute admin
 *     description: Creates a new institute admin account and returns created user details.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - instituteName
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Admin
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@acme.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@123
 *               instituteName:
 *                 type: string
 *                 example: Acme Institute
 *           example:
 *             name: John Admin
 *             email: admin@acme.com
 *             password: Admin@123
 *             instituteName: Acme Institute
 *     responses:
 *       201:
 *         description: Institute admin registered successfully
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
 *                   example: Registration successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: clx123abc
 *                     name:
 *                       type: string
 *                       example: John Admin
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
 *         description: Validation error or bad request
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
 *                   example: Email already exists
 *       404:
 *         description: Dependent resource not found
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
 *                   example: Institute not found
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
/**
 * @swagger
 * /api/v1/register:
 *   post:
 *     summary: Create resource (/register)
 *     description: Auth API endpoint.
 *     tags: [Auth]
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
=======
 * @route   POST /api/auth/register
 * @desc    Register a new institute admin
 * @access  Public
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
 */
router.post('/register', authController.register);

/**
<<<<<<< HEAD
 * @swagger
 * /api/auth/login:
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
/**
 * @swagger
 * /api/v1/login:
 *   post:
 *     summary: Create resource (/login)
 *     description: Auth API endpoint.
 *     tags: [Auth]
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
=======
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
 */
router.post('/login', authController.login);

export default router;
