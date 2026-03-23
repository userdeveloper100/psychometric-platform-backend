import { Router } from 'express';
import * as studentController from './student.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
<<<<<<< HEAD
import { createStudentValidation } from "./student.validation";
import { validateRequest } from "../../middleware/validate.middleware";

const router = Router();

=======

const router = Router();

/**
 * @route   POST /api/students
 * @desc    Create a single student (ADMIN only)
 * @access  Private
 */
router.post(
    '/',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    studentController.createStudent
);

/**
 * @route   POST /api/students/bulk-upload
 * @desc    Bulk upload students from array (ADMIN only)
 * @access  Private
 */
router.post(
    '/bulk-upload',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    studentController.bulkUploadStudents
);
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f

/**
 * @route   GET /api/students?page=1&limit=10&search=
 * @desc    Get all active students (paginated)
 * @access  Private
 */
<<<<<<< HEAD
/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Get all students
 *     description: Fetch all active students with optional pagination.
 *     tags: [Students]
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
 *         description: Students fetched successfully
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
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
router.get(
    '/',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    studentController.getStudents
);

/**
<<<<<<< HEAD
 * @swagger
 * /api/students/AddStudent:
 *   post:
 *     summary: Create a new student
 *     tags: [Students]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - instituteId
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               instituteId:
 *                 type: string
 *                 example: 8a3e5c9e-1234-4e4c-b8a7-111111111111
 *     responses:
 *       201:
 *         description: Student created successfully
 */
/**
 * @swagger
 * /api/v1/:
 *   post:
 *     summary: Create resource (/)
 *     description: Students API endpoint.
 *     tags: [Students]
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
router.post(
    '/AddStudent',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    createStudentValidation,
    validateRequest,
    studentController.createStudent
);

/**
 * @route   POST /api/students/bulk-upload
 * @desc    Bulk upload students from array (ADMIN only)
 * @access  Private
 */
/**
 * @swagger
 * /api/v1/bulk-upload:
 *   post:
 *     summary: Create resource (/bulk-upload)
 *     description: Students API endpoint.
 *     tags: [Students]
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
router.post(
    '/bulk-upload',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    studentController.bulkUploadStudents
);


/**
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
 * @route   DELETE /api/students/:id
 * @desc    Soft delete a student (ADMIN only)
 * @access  Private
 */
<<<<<<< HEAD
/**
 * @swagger
 * /api/v1/{id}:
 *   delete:
 *     summary: Delete resource (/:id)
 *     description: Students API endpoint.
 *     tags: [Students]
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
    '/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    studentController.deleteStudent
);

export default router;
