import { Router } from 'express';
import * as studentController from './student.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

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

/**
 * @route   GET /api/students?page=1&limit=10&search=
 * @desc    Get all active students (paginated)
 * @access  Private
 */
router.get(
    '/',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    studentController.getStudents
);

/**
 * @route   DELETE /api/students/:id
 * @desc    Soft delete a student (ADMIN only)
 * @access  Private
 */
router.delete(
    '/:id',
    authenticateJWT,
    authorizeRoles('ADMIN'),
    studentController.deleteStudent
);

export default router;
